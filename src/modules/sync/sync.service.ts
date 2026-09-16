import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { ProductsService } from '../products/products.service.js';
import { createProductSchema, updateProductSchema } from '../products/products.schemas.js';
import { CustomersService } from '../customers/customers.service.js';
import { createCustomerSchema, updateCustomerSchema } from '../customers/customers.schemas.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { createPromotionSchema, updatePromotionSchema } from '../promotions/promotions.schemas.js';
import { PrintersService } from '../printers/printers.service.js';
import { createPrinterSchema, updatePrinterSchema } from '../printers/printers.schemas.js';
import { SyncEventInput, validateEventPayload } from './sync.schemas.js';
import { AuditService } from '../audit/audit.service.js';

export interface SyncEventResult {
  eventId: string;
  operation: string;
  entityId: string;
  status: 'SYNCED' | 'FAILED' | 'SKIPPED' | 'CONFLICT';
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
    // 1. Idempotency: check if this eventId was already processed or is in-flight
    const existing = await prisma.syncEvent.findFirst({
      where: { id: event.eventId },
      select: { id: true, status: true },
    });

    if (existing) {
      if (existing.status === 'SYNCED') {
        // Already successfully processed — skip silently
        return {
          eventId: event.eventId,
          operation: event.operation,
          entityId: event.entityId,
          status: 'SKIPPED',
        };
      }
      if (existing.status === 'PROCESSING') {
        // Currently in-flight on another request — report as SKIPPED (client will retry if it never resolves)
        return {
          eventId: event.eventId,
          operation: event.operation,
          entityId: event.entityId,
          status: 'SKIPPED',
        };
      }
      // FAILED or CONFLICT: delete the old record so we can retry cleanly below
      await prisma.syncEvent.delete({ where: { id: existing.id } });
    }

    // 2. Create a PENDING record, then immediately mark PROCESSING
    let syncRecord: { id: string } | null = null;
    try {
      const syncOp: 'CREATE' | 'UPDATE' | 'DELETE' | 'EVENT' =
        event.operation === 'CREATE' || event.operation.startsWith('CREATE_')
          ? 'CREATE'
          : event.operation === 'UPDATE' || event.operation.startsWith('UPDATE_')
          ? 'UPDATE'
          : event.operation === 'DELETE' || event.operation.startsWith('DELETE_')
          ? 'DELETE'
          : 'EVENT';

      syncRecord = await prisma.syncEvent.create({
        data: {
          id: event.eventId,
          storeId,
          deviceId,
          entityType: SyncService.getEntityType(event.operation),
          entityId: event.entityId,
          operation: syncOp,
          payload: {
            operation: event.operation,
            data: event.payload,
          } as any,
          status: 'PROCESSING',
          attemptCount: 1,
          lastAttemptAt: new Date(),
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

        case 'CREATE_PRODUCT': {
          const parsed = createProductSchema.parse(validatedPayload);
          await ProductsService.createProduct(storeId, parsed, currentUserId);
          break;
        }

        case 'UPDATE_PRODUCT': {
          const parsed = updateProductSchema.parse(validatedPayload);
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await ProductsService.updateProduct(storeId, entityId, parsed, currentUserId);
          break;
        }

        case 'DELETE_PRODUCT': {
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await ProductsService.deleteProduct(storeId, entityId, currentUserId);
          break;
        }

        case 'CREATE_CUSTOMER': {
          const parsed = createCustomerSchema.parse(validatedPayload);
          await CustomersService.createCustomer(storeId, parsed);
          break;
        }

        case 'UPDATE_CUSTOMER': {
          const parsed = updateCustomerSchema.parse(validatedPayload);
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await CustomersService.updateCustomer(storeId, entityId, parsed);
          break;
        }

        case 'DELETE_CUSTOMER': {
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await CustomersService.deleteCustomer(storeId, entityId);
          break;
        }

        case 'CREATE_PROMOTION': {
          const parsed = createPromotionSchema.parse(validatedPayload);
          await PromotionsService.createPromotion(storeId, parsed);
          break;
        }

        case 'UPDATE_PROMOTION': {
          const parsed = updatePromotionSchema.parse(validatedPayload);
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await PromotionsService.updatePromotion(storeId, entityId, parsed);
          break;
        }

        case 'DELETE_PROMOTION': {
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await PromotionsService.deletePromotion(storeId, entityId);
          break;
        }

        case 'CREATE_PRINTER': {
          const parsed = createPrinterSchema.parse(validatedPayload);
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await PrintersService.upsertPrinter(storeId, { ...parsed, id: entityId });
          break;
        }

        case 'UPDATE_PRINTER': {
          const parsed = updatePrinterSchema.parse(validatedPayload);
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await PrintersService.updatePrinter(storeId, entityId, parsed);
          break;
        }

        case 'DELETE_PRINTER': {
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await PrintersService.deletePrinter(storeId, entityId);
          break;
        }

        case 'REFUND_TRANSACTION':
        case 'CREATE':
        case 'UPDATE':
        case 'DELETE':
        case 'EVENT': {
          // Generic or broadcast sync events
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
      const isConflict = err?.code === 'CONFLICT' || err?.statusCode === 409;
      logger.error(`[Sync] Event ${event.eventId} (${event.operation}) ${isConflict ? 'CONFLICT' : 'FAILED'}: ${errorMsg}`);

      // Mark as CONFLICT or FAILED depending on error type
      if (syncRecord) {
        await prisma.syncEvent.update({
          where: { id: syncRecord.id },
          data: {
            status: isConflict ? 'CONFLICT' : 'FAILED',
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        });
      }

      return {
        eventId: event.eventId,
        operation: event.operation,
        entityId: event.entityId,
        status: isConflict ? 'CONFLICT' : 'FAILED',
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

  static async getSyncStatus(storeId: string) {
    const [totalEvents, cursors, recentEvents] = await Promise.all([
      prisma.syncEvent.count({ where: { storeId } }),
      prisma.syncCursor.findMany({
        where: { storeId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.syncEvent.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          deviceId: true,
          entityType: true,
          entityId: true,
          operation: true,
          status: true,
          createdAt: true,
          syncedAt: true,
        },
      }),
    ]);

    return {
      totalEvents,
      deviceCount: cursors.length,
      devices: cursors.map((c) => ({
        deviceId: c.deviceId,
        cursor: c.cursor.toString(),
        updatedAt: c.updatedAt,
      })),
      recentEvents: recentEvents.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        syncedAt: e.syncedAt?.toISOString() || null,
      })),
    };
  }

  private static getEntityType(operation: string): string {
    if (operation.includes('TRANSACTION')) return 'Transaction';
    if (operation.includes('STOCK')) return 'StockMovement';
    if (operation.includes('PRODUCT')) return 'Product';
    if (operation.includes('CUSTOMER')) return 'Customer';
    if (operation.includes('PROMOTION')) return 'Promotion';
    if (operation.includes('PRINTER')) return 'Printer';
    return 'Unknown';
  }
}
