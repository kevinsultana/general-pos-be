import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter').max(30),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  displayName: z.string().min(2, 'Nama tampilan minimal 2 karakter').max(100),
  email: z.string().email('Format email tidak valid').optional(),
  roleId: z.string().uuid('ID Role harus berupa UUID yang valid'),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  roleId: z.string().uuid().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
