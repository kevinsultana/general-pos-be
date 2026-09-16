import { z } from 'zod';

// ──── Single Sync Event Schema ────

const TransactionItemSyncSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().positive(), // DECIMAL(18,3) — supports fractional quantities
  unitPrice: z.number().nonnegative(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional().nullable(),
  discountValue: z.number().optional().nullable(),
  discountAmount: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const PaymentSyncSchema = z.object({
  id: z.string().uuid().optional(),
  paymentMethodId: z.string().min(1),
  paymentType: z.string().optional(),
  amount: z.number().positive(),
  roundingAmount: z.number().default(0),
  metadata: z.record(z.unknown()).optional(),
});

const CompleteTransactionPayloadSchema = z.object({
  id: z.string().uuid(),
  transactionNumber: z.string().optional(),
  customerId: z.string().uuid().optional().nullable(),
  promotionId: z.string().uuid().optional().nullable(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ONLINE']).optional().nullable(),
  queueNumber: z.string().optional().nullable(),
  subtotal: z.number().nonnegative(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional().nullable(),
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
  type: z.enum(['INITIAL', 'STOCK_IN', 'SALE', 'ADJUSTMENT', 'CANCEL_REVERSAL', 'REFUND_REVERSAL']),
  quantityDelta: z.number().int(),
  unitCost: z.number().optional(),
  reason: z.string().optional(),
});

const CancelTransactionPayloadSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().min(1),
});

const DeletePayloadSchema = z.object({
  id: z.string().uuid().optional(),
  entityId: z.string().uuid().optional(),
  reason: z.string().optional(),
}).passthrough();

const CustomerSyncSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).passthrough();

const ProductSyncSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  cost: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  stock: z.number().optional(),
  lowStockThreshold: z.number().optional(),
  active: z.boolean().optional(),
  discontinued: z.boolean().optional(),
  variants: z.array(z.any()).optional(),
}).passthrough();

const PromotionSyncSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED']).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED']).optional(),
  value: z.number().optional(),
  discountValue: z.number().optional(),
  minimumPurchase: z.number().optional().nullable(),
  minSpend: z.number().optional().nullable(),
  active: z.boolean().optional(),
}).passthrough();

const PrinterSyncSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  connectionType: z.enum(['BLUETOOTH', 'USB', 'NETWORK']).optional(),
  addressReference: z.string().optional().nullable(),
  paperSize: z.enum(['PAPER_58MM', 'PAPER_80MM']).optional(),
  role: z.enum(['RECEIPT', 'KITCHEN', 'BOTH']).optional(),
  receiptCopies: z.number().int().min(1).max(5).optional(),
  kitchenCopies: z.number().int().min(1).max(5).optional(),
  autoPrint: z.boolean().optional(),
  active: z.boolean().optional(),
  configuration: z.union([z.record(z.any()), z.string(), z.null()]).optional(),
}).passthrough();

const CategorySyncSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
}).passthrough();

// ──── Event envelope ────

export const SyncEventInputSchema = z.object({
  eventId: z.string().uuid(), // client-generated UUID for idempotency
  deviceId: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  clientVersion: z.string().optional(),
  operation: z.enum([
    'COMPLETE_TRANSACTION',
    'ADJUST_STOCK',
    'CANCEL_TRANSACTION',
    'REFUND_TRANSACTION',
    'CREATE_PRODUCT',
    'UPDATE_PRODUCT',
    'DELETE_PRODUCT',
    'CREATE_CUSTOMER',
    'UPDATE_CUSTOMER',
    'DELETE_CUSTOMER',
    'CREATE_PROMOTION',
    'UPDATE_PROMOTION',
    'DELETE_PROMOTION',
    'CREATE_PRINTER',
    'UPDATE_PRINTER',
    'DELETE_PRINTER',
    'CREATE_CATEGORY',
    'UPDATE_CATEGORY',
    'DELETE_CATEGORY',
    'CREATE',
    'UPDATE',
    'DELETE',
    'EVENT',
  ]),
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
    case 'CREATE_PRODUCT':
    case 'UPDATE_PRODUCT':
      return ProductSyncSchema.parse(payload);
    case 'DELETE_PRODUCT':
    case 'DELETE_CUSTOMER':
    case 'DELETE_PROMOTION':
    case 'DELETE_PRINTER':
    case 'DELETE_CATEGORY':
    case 'DELETE':
      return DeletePayloadSchema.parse(payload);
    case 'CREATE_CUSTOMER':
    case 'UPDATE_CUSTOMER':
      return CustomerSyncSchema.parse(payload);
    case 'CREATE_PROMOTION':
    case 'UPDATE_PROMOTION':
      return PromotionSyncSchema.parse(payload);
    case 'CREATE_PRINTER':
    case 'UPDATE_PRINTER':
      return PrinterSyncSchema.parse(payload);
    case 'CREATE_CATEGORY':
    case 'UPDATE_CATEGORY':
      return CategorySyncSchema.parse(payload);
    case 'REFUND_TRANSACTION':
    case 'CREATE':
    case 'UPDATE':
    case 'EVENT':
      return payload;
    default:
      throw { statusCode: 400, code: 'UNKNOWN_OPERATION', message: `Operasi tidak dikenal: ${operation}` };
  }
}
