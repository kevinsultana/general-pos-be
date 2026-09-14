import { z } from 'zod';

export const refundItemInputSchema = z.object({
  transactionItemId: z.string().uuid('ID Item Transaksi harus valid'),
  quantity: z.number().positive('Kuantitas refund harus lebih dari 0'),
  amount: z.number().positive('Nominal refund item harus lebih dari 0'),
});

export const createRefundSchema = z.object({
  reason: z.string().min(1, 'Alasan refund wajib diisi'),
  items: z.array(refundItemInputSchema).min(1, 'Minimal 1 item yang direfund'),
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
