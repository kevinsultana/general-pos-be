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
    // Entitlement verification: require PAID or PRO tier for cloud sync
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    });

    if (!store || (store.subscriptionPlan !== 'PAID' && store.subscriptionPlan !== 'PRO')) {
      throw {
        statusCode: 403,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Fitur sinkronisasi data ke cloud memerlukan paket langganan minimal PAID atau PRO',
      };
    }

    if (
      store.subscriptionStatus === 'EXPIRED' ||
      (store.subscriptionExpiresAt && store.subscriptionExpiresAt < new Date())
    ) {
      throw {
        statusCode: 403,
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Langganan toko Anda telah kedaluwarsa. Silakan perbarui paket langganan Anda.',
      };
    }

    const results: SyncEventResult[] = [];
    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const result = await SyncService.processSingleEvent(storeId, currentUserId, deviceId, event, i);
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
    event: SyncEventInput,
    sequenceOffset = 0
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
          createdAt: new Date(Date.now() + sequenceOffset),
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
          await TransactionsService.completeTransaction(storeId, payload, currentUserId, {
            allowNegativeStock: true,
            allowInactiveProducts: true,
          });
          break;
        }

        case 'ADJUST_STOCK': {
          const payload = validatedPayload as any;
          await InventoryService.adjustStock(
            storeId,
            {
              ...payload,
              id: payload.id || event.eventId,
            },
            currentUserId
          );
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
          const raw = validatedPayload as any;
          const entityId = event.entityId || raw.id;

          // 1. Ensure category exists or fallback to a default category
          let catId = raw.categoryId;
          if (catId) {
            const catExists = await prisma.category.findFirst({ where: { id: catId, storeId } });
            if (!catExists) {
              await prisma.category.create({
                data: {
                  id: catId,
                  storeId,
                  name: raw.categoryName || 'Umum',
                  active: true,
                },
              });
            }
          } else {
            let defaultCat = await prisma.category.findFirst({ where: { storeId } });
            if (!defaultCat) {
              defaultCat = await prisma.category.create({
                data: {
                  storeId,
                  name: 'Umum',
                  active: true,
                },
              });
            }
            catId = defaultCat.id;
          }

          // 2. Check if product already exists by ID or by SKU (upsert pattern for sync)
          const existingProduct = entityId
            ? await prisma.product.findFirst({ where: { id: entityId, storeId } })
            : (raw.sku ? await prisma.product.findFirst({ where: { sku: raw.sku, storeId } }) : null);

          if (existingProduct) {
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                name: raw.name ?? existingProduct.name,
                categoryId: catId,
                cost: raw.cost !== undefined ? raw.cost : existingProduct.cost,
                sellingPrice: raw.sellingPrice !== undefined ? raw.sellingPrice : existingProduct.sellingPrice,
                stock: raw.stock !== undefined ? raw.stock : existingProduct.stock,
                lowStockThreshold: raw.lowStockThreshold !== undefined ? raw.lowStockThreshold : existingProduct.lowStockThreshold,
                sku: raw.sku !== undefined ? (raw.sku || null) : existingProduct.sku,
                barcode: raw.barcode !== undefined ? (raw.barcode || null) : existingProduct.barcode,
                active: raw.active ?? existingProduct.active,
              },
            });
          } else {
            await prisma.product.create({
              data: {
                ...(entityId ? { id: entityId } : {}),
                storeId,
                categoryId: catId,
                name: raw.name || 'Produk',
                sku: raw.sku || null,
                barcode: raw.barcode || null,
                cost: raw.cost ?? 0,
                sellingPrice: raw.sellingPrice ?? 0,
                stock: raw.stock ?? 0,
                lowStockThreshold: raw.lowStockThreshold ?? 0,
                imageReference: raw.imageReference || null,
                active: raw.active ?? true,
                ...(raw.variants && raw.variants.length > 0
                  ? {
                      variants: {
                        create: raw.variants.map((v: any) => ({
                          ...(v.id ? { id: v.id } : {}),
                          name: v.name,
                          sku: v.sku || null,
                          barcode: v.barcode || null,
                          cost: v.cost ?? 0,
                          sellingPrice: v.sellingPrice ?? 0,
                          stock: v.stock ?? 0,
                          lowStockThreshold: v.lowStockThreshold ?? 0,
                          active: v.active ?? true,
                        })),
                      },
                    }
                  : {}),
              },
            });
          }
          break;
        }

        case 'UPDATE_PRODUCT': {
          const raw = validatedPayload as any;
          const entityId = event.entityId || raw.id;
          if (entityId) {
            const existing = await prisma.product.findFirst({ where: { id: entityId, storeId } });
            if (existing) {
              await prisma.product.update({
                where: { id: existing.id },
                data: {
                  ...(raw.name ? { name: raw.name } : {}),
                  ...(raw.categoryId ? { categoryId: raw.categoryId } : {}),
                  ...(raw.cost !== undefined ? { cost: raw.cost } : {}),
                  ...(raw.sellingPrice !== undefined ? { sellingPrice: raw.sellingPrice } : {}),
                  ...(raw.stock !== undefined ? { stock: raw.stock } : {}),
                  ...(raw.lowStockThreshold !== undefined ? { lowStockThreshold: raw.lowStockThreshold } : {}),
                  ...(raw.sku !== undefined ? { sku: raw.sku || null } : {}),
                  ...(raw.barcode !== undefined ? { barcode: raw.barcode || null } : {}),
                  ...(raw.active !== undefined ? { active: raw.active } : {}),
                },
              });
            }
          }
          break;
        }

        case 'DELETE_PRODUCT': {
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await ProductsService.deleteProduct(storeId, entityId, currentUserId);
          break;
        }

        case 'CREATE_CUSTOMER': {
          const entityId = event.entityId || (validatedPayload as any)?.id;
          const parsed = createCustomerSchema.parse(validatedPayload);
          await CustomersService.createCustomer(storeId, { ...parsed, id: entityId });
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

        case 'CREATE_CATEGORY': {
          const cat = validatedPayload as any;
          const entityId = event.entityId || cat.id;
          await prisma.category.upsert({
            where: { id: entityId },
            create: {
              id: entityId,
              storeId,
              name: cat.name || 'Kategori Baru',
              active: cat.active ?? true,
            },
            update: {
              name: cat.name,
              active: cat.active,
            },
          });
          break;
        }

        case 'UPDATE_CATEGORY': {
          const cat = validatedPayload as any;
          const entityId = event.entityId || cat.id;
          await prisma.category.updateMany({
            where: { id: entityId, storeId },
            data: {
              ...(cat.name ? { name: cat.name } : {}),
              ...(cat.active !== undefined ? { active: cat.active } : {}),
            },
          });
          break;
        }

        case 'DELETE_CATEGORY': {
          const entityId = event.entityId || (validatedPayload as any)?.id;
          await prisma.category.deleteMany({
            where: { id: entityId, storeId },
          });
          break;
        }

        case 'REFUND_TRANSACTION': {
          const payload = validatedPayload as any;
          const trxId = payload.transactionId || event.entityId;
          const refundId = payload.id || event.eventId;
          const existingRefund = await prisma.refund.findUnique({
            where: { id: refundId },
          });
          if (!existingRefund) {
            const trx = await prisma.transaction.findFirst({
              where: { id: trxId, storeId },
              include: { items: true },
            });
            if (trx) {
              const now = payload.refundedAt ? new Date(payload.refundedAt) : new Date();
              const newStatus = payload.status || (payload.isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED');

              await prisma.$transaction(async (tx) => {
                const createdRefund = await tx.refund.create({
                  data: {
                    id: refundId,
                    transactionId: trx.id,
                    amount: payload.amount || trx.total,
                    reason: payload.reason || 'Mobile Sync: Refund',
                    status: 'COMPLETED',
                    createdById: currentUserId,
                    createdAt: now,
                  },
                });

                const refundItems = payload.items as any[] | undefined;
                if (refundItems && refundItems.length > 0) {
                  for (const ri of refundItems) {
                    const matchedItem = trx.items.find((it) => it.productId === ri.productId);
                    await tx.refundItem.create({
                      data: {
                        refundId: createdRefund.id,
                        transactionItemId: matchedItem?.id || trx.items[0]?.id,
                        quantity: ri.quantity,
                        amount: ri.refundAmount || 0,
                      },
                    });

                    if (ri.variantId) {
                      await tx.productVariant.update({
                        where: { id: ri.variantId },
                        data: { stock: { increment: ri.quantity } },
                      });
                    } else if (ri.productId) {
                      await tx.product.update({
                        where: { id: ri.productId },
                        data: { stock: { increment: ri.quantity } },
                      });
                    }
                  }
                }

                await tx.transaction.update({
                  where: { id: trx.id },
                  data: {
                    status: newStatus as any,
                    refundedAt: now,
                  },
                });
              });
            }
          }
          break;
        }

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
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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
    if (operation.includes('CATEGORY')) return 'Category';
    if (operation.includes('CUSTOMER')) return 'Customer';
    if (operation.includes('PROMOTION')) return 'Promotion';
    if (operation.includes('PRINTER')) return 'Printer';
    return 'Unknown';
  }
}
