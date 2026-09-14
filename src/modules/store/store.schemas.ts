import { z } from 'zod';

export const updateStoreSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  ownerName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  currency: z.string().default('IDR').optional(),
  timezone: z.string().default('Asia/Jakarta').optional(),
  language: z.string().default('id').optional(),
  businessType: z.enum(['GENERAL', 'RESTAURANT']).optional(),
  customerEnabled: z.boolean().optional(),
  draftEnabled: z.boolean().optional(),
  splitPaymentEnabled: z.boolean().optional(),
  refundEnabled: z.boolean().optional(),
  restaurantEnabled: z.boolean().optional(),
  kitchenPrintingEnabled: z.boolean().optional(),
  cashRoundingEnabled: z.boolean().optional(),
  cashRoundingIncrement: z.number().int().min(1).optional(),
  cashRoundingMode: z.enum(['ROUND_NEAREST', 'ROUND_UP', 'ROUND_DOWN']).optional(),
});

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
