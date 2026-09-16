import { z } from 'zod';

export const createPromotionSchema = z
  .object({
    name: z.string().min(1, 'Nama promosi wajib diisi').max(100),
    description: z.string().optional(),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED']).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED']).optional(),
    value: z.number().positive('Nilai diskon harus lebih dari 0').optional(),
    discountValue: z.number().positive('Nilai diskon harus lebih dari 0').optional(),
    startAt: z.string().optional(),
    startDate: z.string().optional(),
    endAt: z.string().optional(),
    endDate: z.string().optional(),
    // 1:1 whole Rupiah scale (Rp 1 = 1 unit)
    minimumPurchase: z.number().min(0).optional().nullable(),
    minSpend: z.number().min(0).optional().nullable(),
    active: z.boolean().default(true),
    code: z.string().optional(),
  })
  .transform((data) => {
    const rawType = data.type || data.discountType || 'PERCENTAGE';
    const type: 'PERCENTAGE' | 'FIXED_AMOUNT' =
      rawType === 'FIXED' ? 'FIXED_AMOUNT' : (rawType as 'PERCENTAGE' | 'FIXED_AMOUNT');

    const value = data.value ?? data.discountValue;
    if (value === undefined || value <= 0) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Nilai diskon harus lebih dari 0',
        },
      ]);
    }

    const startAt =
      data.startAt || data.startDate || new Date().toISOString();
    const endAt =
      data.endAt ||
      data.endDate ||
      new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

    const minimumPurchase =
      data.minimumPurchase !== undefined
        ? data.minimumPurchase
        : data.minSpend !== undefined
        ? data.minSpend
        : null;

    return {
      name: data.name,
      description: data.description,
      type,
      value,
      startAt,
      endAt,
      minimumPurchase,
      active: data.active ?? true,
      code: data.code,
    };
  });

export const updatePromotionSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED']).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED']).optional(),
    value: z.number().positive().optional(),
    discountValue: z.number().positive().optional(),
    startAt: z.string().optional(),
    startDate: z.string().optional(),
    endAt: z.string().optional(),
    endDate: z.string().optional(),
    minimumPurchase: z.number().min(0).optional().nullable(),
    minSpend: z.number().min(0).optional().nullable(),
    active: z.boolean().optional(),
  })
  .transform((data) => {
    let type: 'PERCENTAGE' | 'FIXED_AMOUNT' | undefined;
    const rawType = data.type || data.discountType;
    if (rawType) {
      type = rawType === 'FIXED' ? 'FIXED_AMOUNT' : (rawType as 'PERCENTAGE' | 'FIXED_AMOUNT');
    }

    const value = data.value ?? data.discountValue;
    const startAt = data.startAt || data.startDate;
    const endAt = data.endAt || data.endDate;
    const minimumPurchase =
      data.minimumPurchase !== undefined
        ? data.minimumPurchase
        : data.minSpend !== undefined
        ? data.minSpend
        : undefined;

    return {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(value !== undefined ? { value } : {}),
      ...(startAt !== undefined ? { startAt } : {}),
      ...(endAt !== undefined ? { endAt } : {}),
      ...(minimumPurchase !== undefined ? { minimumPurchase } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    };
  });

export const validatePromoCodeSchema = z.object({
  code: z.string().min(1, 'Kode promo wajib diisi'),
  subtotal: z.number().min(0),
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type ValidatePromoCodeInput = z.infer<typeof validatePromoCodeSchema>;

