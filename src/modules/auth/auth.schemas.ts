import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
  storeId: z.string().uuid().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token wajib disertakan'),
});

export const registerStoreSchema = z.object({
  storeName: z.string().min(2, 'Nama toko minimal 2 karakter'),
  ownerName: z.string().min(2, 'Nama pemilik minimal 2 karakter').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  username: z.string().min(3, 'Username minimal 3 karakter'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  email: z.string().email('Format email tidak valid').optional(),
  storeId: z.string().uuid().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type RegisterStoreInput = z.infer<typeof registerStoreSchema>;
