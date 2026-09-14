import { z } from 'zod';

export const createPrinterSchema = z.object({
  name: z.string().min(1, 'Nama printer wajib diisi').max(100),
  connectionType: z.enum(['BLUETOOTH', 'USB', 'NETWORK']),
  addressReference: z.string().optional().nullable(),
  paperSize: z.enum(['PAPER_58MM', 'PAPER_80MM']),
  role: z.enum(['RECEIPT', 'KITCHEN']),
  receiptCopies: z.number().int().min(1).max(5).default(1),
  kitchenCopies: z.number().int().min(1).max(5).default(1),
  autoPrint: z.boolean().default(false),
  active: z.boolean().default(true),
  configuration: z.any().optional(),
});

export const updatePrinterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  connectionType: z.enum(['BLUETOOTH', 'USB', 'NETWORK']).optional(),
  addressReference: z.string().optional().nullable(),
  paperSize: z.enum(['PAPER_58MM', 'PAPER_80MM']).optional(),
  role: z.enum(['RECEIPT', 'KITCHEN']).optional(),
  receiptCopies: z.number().int().min(1).max(5).optional(),
  kitchenCopies: z.number().int().min(1).max(5).optional(),
  autoPrint: z.boolean().optional(),
  active: z.boolean().optional(),
  configuration: z.any().optional(),
});

export type CreatePrinterInput = z.infer<typeof createPrinterSchema>;
export type UpdatePrinterInput = z.infer<typeof updatePrinterSchema>;
