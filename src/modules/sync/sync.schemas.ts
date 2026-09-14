import { z } from 'zod';

// ──── Single Sync Event Schema ────

const TransactionItemSyncSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  discountValue: z.number().optional().nullable(),
  discountAmount: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const PaymentSyncSchema = z.object({
  id: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid(),
  amount: z.number().positive(),
  roundingAmount: z.number().default(0),
  metadata: z.record(z.unknown()).optional(),
});

const CompleteTransactionPayloadSchema = z.object({
  id: z.string().uuid(),
  transactionNumber: z.string().optional(),
  customerId: z.string().uuid().optional().nullable(),
  promotionId: z.string().uuid().optional().nullable(),
  orderType: z.enum(['DINE_IN', 'TAKE_AWAY', 'DELIVERY', 'ONLINE']).optional().nullable(),
  queueNumber: z.string().optional().nullable(),
  subtotal: z.number().nonnegative(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  discountValue: z.number().optional().nullable(),
  discountTotal: z.number().nonnegative(),
  roundingAmount: z.number().default(0),
  total: z.number().nonnegative(),
  items: z.array(TransactionItemSyncSchema).min(1),
  payments: z.array(PaymentSyncSchema).min(1),
});

const AdjustStockPayloadSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  type: z.enum(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'EXPIRED']),
  quantityDelta: z.number().int(),
  unitCost: z.number().optional(),
  reason: z.string().optional(),
});

const CancelTransactionPayloadSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().min(1),
});

// ──── Event envelope ────

export const SyncEventInputSchema = z.object({
  eventId: z.string().uuid(), // client-generated UUID for idempotency
  deviceId: z.string().min(1),
  occurredAt: z.string().datetime(),
  clientVersion: z.string().optional(),
  operation: z.enum(['COMPLETE_TRANSACTION', 'ADJUST_STOCK', 'CANCEL_TRANSACTION']),
  entityId: z.string().uuid(),
  payload: z.unknown(), // validated per operation below
});

export const PushRequestSchema = z.object({
  events: z.array(SyncEventInputSchema).min(1).max(100),
});

export type SyncEventInput = z.infer<typeof SyncEventInputSchema>;
export type PushRequest = z.infer<typeof PushRequestSchema>;

// Helper: validate payload by operation type
export function validateEventPayload(operation: string, payload: unknown) {
  switch (operation) {
    case 'COMPLETE_TRANSACTION':
      return CompleteTransactionPayloadSchema.parse(payload);
    case 'ADJUST_STOCK':
      return AdjustStockPayloadSchema.parse(payload);
    case 'CANCEL_TRANSACTION':
      return CancelTransactionPayloadSchema.parse(payload);
    default:
      throw { statusCode: 400, code: 'UNKNOWN_OPERATION', message: `Operasi tidak dikenal: ${operation}` };
  }
}
