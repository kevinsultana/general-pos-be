import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Nama pelanggan wajib diisi').max(100),
  phone: z.string().optional(),
  email: z.string().email('Format email tidak valid').optional(),
  notes: z.string().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
