import { z } from 'zod';

export const createStockMovementSchema = z.object({
  productId: z.string().uuid('ID Produk harus valid'),
  variantId: z.string().uuid().optional(),
  type: z.enum(['INITIAL', 'STOCK_IN', 'ADJUSTMENT']),
  quantityDelta: z.number().refine((val) => val !== 0, 'Perubahan kuantitas tidak boleh 0'),
  unitCost: z.number().min(0).optional(),
  reason: z.string().min(1, 'Alasan penyesuaian stok wajib diisi'),
});

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
