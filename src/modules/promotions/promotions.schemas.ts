import { z } from 'zod';

export const createPromotionSchema = z.object({
  name: z.string().min(1, 'Nama promosi wajib diisi').max(100),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  value: z.number().positive('Nilai diskon harus lebih dari 0'),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  minimumPurchase: z.number().min(0).optional(),
  active: z.boolean().default(true),
  code: z.string().optional(),
});

export const updatePromotionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  value: z.number().positive().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  minimumPurchase: z.number().min(0).optional().nullable(),
  active: z.boolean().optional(),
});

export const validatePromoCodeSchema = z.object({
  code: z.string().min(1, 'Kode promo wajib diisi'),
  subtotal: z.number().min(0),
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type ValidatePromoCodeInput = z.infer<typeof validatePromoCodeSchema>;
