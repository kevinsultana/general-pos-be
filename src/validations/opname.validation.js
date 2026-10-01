import { z } from 'zod';

/**
 * Skema satu item dalam sesi stock opname
 */
const opnameItemSchema = z.object({
  productId: z
    .string({ required_error: 'productId item opname wajib diisi.' })
    .uuid('productId harus berupa UUID valid.'),

  physicalQty: z
    .number({
      required_error: 'Jumlah fisik stok (physicalQty) wajib diisi.',
      invalid_type_error: 'physicalQty harus berupa angka.',
    })
    .min(0, 'physicalQty tidak boleh bernilai negatif.')
    .max(9999999, 'physicalQty melebihi batas wajar.'),

  reason: z
    .string()
    .max(200, 'Alasan penyesuaian terlalu panjang (maksimal 200 karakter).')
    .optional()
    .nullable(),
});

/**
 * Skema Validasi Stock Opname: POST /api/opnames
 */
export const createOpnameSchema = z.object({
  notes: z
    .string()
    .max(500, 'Catatan sesi opname terlalu panjang (maksimal 500 karakter).')
    .optional()
    .nullable(),

  items: z
    .array(opnameItemSchema, {
      required_error: 'Daftar item opname wajib diisi.',
      invalid_type_error: 'items harus berupa array.',
    })
    .min(1, 'Sesi opname harus memiliki minimal 1 item produk yang diaudit.'),
});
