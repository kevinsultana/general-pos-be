import { z } from 'zod';

export const createPaymentMethodSchema = z.object({
  type: z.enum(['CASH', 'QRIS', 'TRANSFER', 'DEBIT', 'CREDIT']),
  name: z.string().min(1, 'Nama metode pembayaran wajib diisi').max(50),
  enabled: z.boolean().default(true),
  configuration: z.any().optional(),
});

export const updatePaymentMethodSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  enabled: z.boolean().optional(),
  configuration: z.any().optional(),
});

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
