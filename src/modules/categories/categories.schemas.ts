import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi').max(100),
  active: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
