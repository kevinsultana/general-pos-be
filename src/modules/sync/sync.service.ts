import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SyncEventInput, validateEventPayload } from './sync.schemas.js';
import { AuditService } from '../audit/audit.service.js';

export interface SyncEventResult {
  eventId: string;
  operation: string;
  entityId: string;
  status: 'SYNCED' | 'FAILED' | 'SKIPPED';
  error?: string;
}

export interface PushResult {
  received: number;
  synced: number;
  failed: number;
  skipped: number;
  results: SyncEventResult[];
}

export interface PullEventItem {
  id: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload: unknown;
  occurredAt: string;
  syncedAt: string;
}

export interface PullResult {
  events: PullEventItem[];
  nextCursor: string;
  hasMore: boolean;
}

export class SyncService {
  /**
   * Process a batch of events pushed from a mobile device.
   * Each event is processed idempotently — duplicate eventIds are skipped.
   */
  static async push(
    storeId: string,
    currentUserId: string,
    deviceId: string,
    events: SyncEventInput[]
  ): Promise<PushResult> {
    const results: SyncEventResult[] = [];
    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const event of events) {
      const result = await SyncService.processSingleEvent(storeId, currentUserId, deviceId, event);
      results.push(result);

      if (result.status === 'SYNCED') synced++;
      else if (result.status === 'FAILED') failed++;
      else skipped++;
    }

    return {
      received: events.length,
      synced,
      failed,
      skipped,
      results,
    };
  }

  private static async processSingleEvent(
    storeId: string,
    currentUserId: string,
    deviceId: string,
    event: SyncEventInput
  ): Promise<SyncEventResult> {
    // 1. Idempotency: check if this eventId was already processed
    const existing = await prisma.syncEvent.findFirst({
      where: {
        id: event.eventId,
        status: 'SYNCED',
      },
    });

    if (existing) {
      return {
        eventId: event.eventId,
        operation: event.operation,
        entityId: event.entityId,
        status: 'SKIPPED',
      };
    }

    // 2. Create a PENDING record in SyncEvent log
    let syncRecord: { id: string } | null = null;
    try {
      syncRecord = await prisma.syncEvent.create({
        data: {
          id: event.eventId,
          storeId,
          deviceId,
          entityType: SyncService.getEntityType(event.operation),
          entityId: event.entityId,
          operation: 'EVENT',
          payload: {
            operation: event.operation,
            data: event.payload,
          } as any,
          status: 'PENDING',
          createdById: currentUserId,
        },
        select: { id: true },
      });
    } catch (err: any) {
      logger.error(`[Sync] Failed to create sync record for event ${event.eventId}: ${err.message}`);
    }

    // 3. Dispatch to the right service
    try {
      const validatedPayload = validateEventPayload(event.operation, event.payload);

      switch (event.operation) {
        case 'COMPLETE_TRANSACTION': {
          const payload = validatedPayload as any;
          await TransactionsService.completeTransaction(storeId, payload, currentUserId);
          break;
        }

        case 'ADJUST_STOCK': {
          const payload = validatedPayload as any;
          await InventoryService.adjustStock(storeId, payload, currentUserId);
          break;
        }

        case 'CANCEL_TRANSACTION': {
          const payload = validatedPayload as any;
          await TransactionsService.cancelTransaction(
            storeId,
            payload.transactionId,
            { reason: payload.reason },
            currentUserId
          );
          break;
        }

        default:
          throw { statusCode: 400, code: 'UNKNOWN_OPERATION', message: `Unknown operation: ${event.operation}` };
      }

      // 4. Mark as SYNCED
      if (syncRecord) {
        await prisma.syncEvent.update({
          where: { id: syncRecord.id },
          data: { status: 'SYNCED', syncedAt: new Date(), attemptCount: { increment: 1 } },
        });
      }

      await AuditService.record({
        storeId,
        userId: currentUserId,
        action: `SYNC_${event.operation}`,
        entityType: SyncService.getEntityType(event.operation),
        entityId: event.entityId,
        metadata: { deviceId, eventId: event.eventId },
      });

      return {
        eventId: event.eventId,
        operation: event.operation,
        entityId: event.entityId,
        status: 'SYNCED',
      };
    } catch (err: any) {
      const errorMsg = err?.message || JSON.stringify(err);
      logger.error(`[Sync] Event ${event.eventId} (${event.operation}) failed: ${errorMsg}`);

      // Mark as FAILED
      if (syncRecord) {
        await prisma.syncEvent.update({
          where: { id: syncRecord.id },
          data: {
            status: 'FAILED',
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        });
      }

      return {
        eventId: event.eventId,
        operation: event.operation,
        entityId: event.entityId,
        status: 'FAILED',
        error: errorMsg,
      };
    }
  }

  /**
   * Pull events for a device since a given cursor (sequence-based).
   * Returns events from the store that were created/updated after the given cursor.
   */
  static async pull(
    storeId: string,
    deviceId: string,
    cursorStr: string,
    limit = 50
  ): Promise<PullResult> {
    // cursor = the id (as bigint sequence) of the last event the client has seen
    // We use the auto-increment-style approach: events ordered by createdAt + their row id
    const cursorDate = cursorStr !== '0' ? new Date(parseInt(cursorStr, 10)) : new Date(0);

    const events = await prisma.syncEvent.findMany({
      where: {
        storeId,
        status: 'SYNCED',
        // Pull events from OTHER devices (not from this device itself)
        NOT: { deviceId },
        createdAt: { gt: cursorDate },
      },
      orderBy: { createdAt: 'asc' },
      take: limit + 1, // +1 to detect hasMore
    });

    const hasMore = events.length > limit;
    const sliced = hasMore ? events.slice(0, limit) : events;

    const nextCursor = sliced.length > 0
      ? sliced[sliced.length - 1].createdAt.getTime().toString()
      : cursorStr;

    // Update or create SyncCursor for this device
    await prisma.syncCursor.upsert({
      where: { storeId_deviceId: { storeId, deviceId } },
      create: {
        storeId,
        deviceId,
        cursor: BigInt(nextCursor),
      },
      update: {
        cursor: BigInt(nextCursor),
      },
    });

    return {
      events: sliced.map((e) => {
        const p = e.payload as any;
        return {
          id: e.id,
          deviceId: e.deviceId,
          entityType: e.entityType,
          entityId: e.entityId,
          operation: p?.operation || e.operation,
          payload: p?.data !== undefined ? p.data : e.payload,
          occurredAt: e.createdAt.toISOString(),
          syncedAt: e.syncedAt?.toISOString() || e.createdAt.toISOString(),
        };
      }),
      nextCursor,
      hasMore,
    };
  }

  private static getEntityType(operation: string): string {
    switch (operation) {
      case 'COMPLETE_TRANSACTION':
      case 'CANCEL_TRANSACTION':
        return 'Transaction';
      case 'ADJUST_STOCK':
        return 'StockMovement';
      default:
        return 'Unknown';
    }
  }
}
