import { z } from 'zod';

/**
 * Skema satu item dalam transfer stok
 */
const transferItemSchema = z.object({
  productId: z
    .string({ required_error: 'productId item transfer wajib diisi.' })
    .uuid('productId harus berupa UUID valid.'),

  quantity: z
    .number({
      required_error: 'Jumlah item transfer wajib diisi.',
      invalid_type_error: 'Jumlah item transfer harus berupa angka.',
    })
    .min(0.001, 'Jumlah item transfer harus lebih dari 0.')
    .max(999999, 'Jumlah item transfer terlalu besar.'),
});

/**
 * Skema Validasi Transfer Stok: POST /api/transfers
 */
export const createTransferSchema = z.object({
  fromBranchId: z
    .string({ required_error: 'ID cabang pengirim (fromBranchId) wajib diisi.' })
    .uuid('fromBranchId harus berupa UUID valid.'),

  toBranchId: z
    .string({ required_error: 'ID cabang tujuan (toBranchId) wajib diisi.' })
    .uuid('toBranchId harus berupa UUID valid.'),

  notes: z
    .string()
    .max(500, 'Catatan transfer terlalu panjang (maksimal 500 karakter).')
    .optional()
    .nullable(),

  items: z
    .array(transferItemSchema, {
      required_error: 'Daftar item transfer wajib diisi.',
      invalid_type_error: 'items harus berupa array.',
    })
    .min(1, 'Transfer harus memiliki minimal 1 item produk.'),
}).refine((data) => data.fromBranchId !== data.toBranchId, {
  message: 'Cabang pengirim dan cabang tujuan tidak boleh sama.',
  path: ['toBranchId'],
});
