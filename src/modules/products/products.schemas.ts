import { z } from 'zod';

export const productVariantInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nama varian wajib diisi'),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  cost: z.number().min(0, 'HPP modal tidak boleh negatif'),
  sellingPrice: z.number().min(0, 'Harga jual tidak boleh negatif'),
  stock: z.number().default(0),
  lowStockThreshold: z.number().default(0),
  active: z.boolean().default(true),
});

export const createProductSchema = z.object({
  id: z.string().optional(),
  categoryId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.string().optional().nullable()
  ),
  name: z.string().min(1, 'Nama produk wajib diisi').max(150),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  cost: z.number().min(0, 'HPP modal tidak boleh negatif'),
  sellingPrice: z.number().min(0, 'Harga jual tidak boleh negatif'),
  stock: z.number().default(0),
  lowStockThreshold: z.number().default(0),
  imageReference: z.string().optional().nullable(),
  active: z.boolean().default(true),
  variants: z.array(productVariantInputSchema).optional(),
});

export const updateProductSchema = z.object({
  categoryId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.string().optional().nullable()
  ),
  name: z.string().min(1).max(150).optional(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  cost: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  stock: z.number().optional(),
  lowStockThreshold: z.number().optional(),
  imageReference: z.string().optional().nullable(),
  active: z.boolean().optional(),
  discontinued: z.boolean().optional(),
  variants: z.array(productVariantInputSchema).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
