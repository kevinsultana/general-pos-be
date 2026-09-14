import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(2, 'Nama role minimal 2 karakter').max(50),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, 'Role minimal harus memiliki 1 hak akses (permission)'),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
