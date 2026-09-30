import { z } from 'zod';

export const transactionItemInputSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, 'ID Produk harus valid'),
  productName: z.string().optional(),
  variantId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.string().optional().nullable()
  ),
  quantity: z.number().positive('Kuantitas item harus lebih dari 0'),
  unitPrice: z.number().min(0, 'Harga satuan tidak boleh negatif'),
  discountType: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional().nullable()
  ),
  discountValue: z.number().min(0).optional().nullable(),
  discountAmount: z.number().min(0).default(0),
  subtotal: z.number().min(0),
  total: z.number().min(0),
});

export const transactionPaymentInputSchema = z.object({
  id: z.string().optional(),
  paymentMethodId: z.string().min(1, 'ID Metode pembayaran harus valid'),
  amount: z.number().positive('Nominal pembayaran harus lebih dari 0'),
  roundingAmount: z.number().default(0),
  metadata: z.any().optional(),
});

export const completeTransactionSchema = z.object({
  id: z.string().optional(), // Client-generated UUID for idempotency
  transactionNumber: z.string().optional(),
  customerId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.string().optional().nullable()
  ),
  orderType: z.preprocess(
    (val) => (val === 'GENERAL' || val === '' || val === null || val === undefined ? null : val),
    z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ONLINE']).optional().nullable()
  ),
  queueNumber: z.string().optional().nullable(),
  items: z.array(transactionItemInputSchema).min(1, 'Transaksi minimal harus memiliki 1 item'),
  payments: z.array(transactionPaymentInputSchema).min(1, 'Transaksi minimal harus memiliki 1 pembayaran'),
  subtotal: z.number().min(0),
  discountType: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional().nullable()
  ),
  discountValue: z.number().min(0).optional().nullable(),
  discountTotal: z.number().min(0).default(0),
  roundingAmount: z.number().default(0),
  total: z.number().min(0),
  promotionId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.string().optional().nullable()
  ),
  createdAt: z.string().optional(),
  completedAt: z.string().optional(),
}).passthrough();

export const cancelTransactionSchema = z.object({
  reason: z.string().min(1, 'Alasan pembatalan transaksi wajib diisi'),
});

export type CompleteTransactionInput = z.infer<typeof completeTransactionSchema>;
export type CancelTransactionInput = z.infer<typeof cancelTransactionSchema>;
