import { z } from 'zod';

/**
 * Skema Validasi Auth: POST /api/auth/register
 */
export const registerSchema = z.object({
  storeName: z
    .string({ required_error: 'Nama toko wajib diisi.' })
    .trim()
    .min(2, 'Nama toko minimal 2 karakter.')
    .max(100, 'Nama toko maksimal 100 karakter.'),

  storeSlug: z
    .string({ required_error: 'Slug toko wajib diisi.' })
    .trim()
    .toLowerCase()
    .min(3, 'Slug toko minimal 3 karakter.')
    .max(30, 'Slug toko maksimal 30 karakter.')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung (-). Tidak boleh diawali atau diakhiri dengan tanda hubung.'
    ),

  ownerName: z
    .string({ required_error: 'Nama pemilik wajib diisi.' })
    .trim()
    .min(2, 'Nama pemilik minimal 2 karakter.')
    .max(100, 'Nama pemilik maksimal 100 karakter.'),

  email: z
    .string({ required_error: 'Email wajib diisi.' })
    .trim()
    .toLowerCase()
    .email('Format alamat email tidak valid.'),

  password: z
    .string({ required_error: 'Password wajib diisi.' })
    .min(8, 'Password minimal 8 karakter.')
    .max(100, 'Password terlalu panjang (maksimal 100 karakter).'),
});

/**
 * Skema Validasi Auth: POST /api/auth/login
 */
export const loginSchema = z.object({
  storeSlug: z
    .string({ required_error: 'Slug toko wajib diisi.' })
    .trim()
    .toLowerCase()
    .min(1, 'Slug toko tidak boleh kosong.'),

  email: z
    .string({ required_error: 'Email wajib diisi.' })
    .trim()
    .toLowerCase()
    .email('Format alamat email tidak valid.'),

  password: z
    .string({ required_error: 'Password wajib diisi.' })
    .min(1, 'Password tidak boleh kosong.'),

  clientType: z
    .enum(['web', 'mobile'], {
      errorMap: () => ({ message: 'clientType harus berupa "web" atau "mobile".' }),
    })
    .optional()
    .default('web'),
});
