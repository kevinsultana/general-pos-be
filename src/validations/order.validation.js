import { z } from 'zod';

/**
 * Skema item modifier pilihan (topping, addon, dll)
 */
const selectedModifierSchema = z.object({
  modifierOptionId: z.string().uuid('modifierOptionId harus berupa UUID valid.').optional(),
  optionName: z.string().max(100, 'Nama opsi modifier terlalu panjang.').optional(),
  price: z
    .number({ invalid_type_error: 'Harga modifier harus berupa angka.' })
    .int('Harga modifier harus bilangan bulat.')
    .min(0, 'Harga modifier tidak boleh negatif.')
    .optional()
    .default(0),
  deductQty: z
    .number({ invalid_type_error: 'deductQty harus berupa angka.' })
    .min(0, 'deductQty tidak boleh negatif.')
    .optional(),
  inventoryProductId: z.string().uuid('inventoryProductId harus berupa UUID valid.').optional(),
}).passthrough();

/**
 * Skema satu item dalam keranjang belanja
 */
const orderItemSchema = z.object({
  productId: z
    .string({ required_error: 'productId wajib diisi.' })
    .uuid('productId harus berupa UUID valid.'),

  variantId: z.string().uuid('variantId harus berupa UUID valid.').optional().nullable(),

  unitId: z.string().uuid('unitId harus berupa UUID valid.').optional().nullable(),

  quantity: z
    .number({ required_error: 'Jumlah item wajib diisi.', invalid_type_error: 'Jumlah item harus berupa angka.' })
    .min(0.001, 'Jumlah item harus lebih dari 0.')
    .max(99999, 'Jumlah item terlalu besar.'),

  selectedModifiers: z.array(selectedModifierSchema).optional().default([]),
});

/**
 * Skema Validasi Order: POST /api/orders
 */
export const createOrderSchema = z.object({
  orderType: z
    .enum(['DIRECT', 'DINE_IN', 'TAKE_AWAY', 'DELIVERY', 'SERVICE_IN'], {
      errorMap: () => ({
        message:
          'orderType tidak valid. Pilihan: DIRECT, DINE_IN, TAKE_AWAY, DELIVERY, SERVICE_IN.',
      }),
    })
    .optional()
    .default('DIRECT'),

  tableNumber: z.string().max(20, 'Nomor meja terlalu panjang.').optional().nullable(),

  customerName: z.string().max(100, 'Nama pelanggan terlalu panjang.').optional().nullable(),

  customerId: z.string().uuid('customerId harus berupa UUID valid.').optional().nullable(),

  paymentMethod: z
    .enum(['CASH', 'QRIS', 'TRANSFER', 'DEBIT', 'CREDIT_CARD', 'MIDTRANS'], {
      errorMap: () => ({
        message:
          'paymentMethod tidak valid. Pilihan: CASH, QRIS, TRANSFER, DEBIT, CREDIT_CARD, MIDTRANS.',
      }),
    })
    .optional()
    .default('CASH'),

  paidAmount: z
    .number({
      required_error: 'Jumlah pembayaran (paidAmount) wajib diisi.',
      invalid_type_error: 'paidAmount harus berupa angka.',
    })
    .int('paidAmount harus bilangan bulat (satuan Rupiah).')
    .min(0, 'paidAmount tidak boleh negatif.'),

  discount: z
    .number({ invalid_type_error: 'discount harus berupa angka.' })
    .int('discount harus bilangan bulat.')
    .min(0, 'discount tidak boleh negatif.')
    .optional()
    .default(0),

  tax: z
    .number({ invalid_type_error: 'tax harus berupa angka.' })
    .int('tax harus bilangan bulat.')
    .min(0, 'tax tidak boleh negatif.')
    .optional()
    .default(0),

  notes: z.string().max(500, 'Catatan pesanan terlalu panjang (maks 500 karakter).').optional().nullable(),

  items: z
    .array(orderItemSchema, {
      required_error: 'Daftar item pesanan wajib diisi.',
      invalid_type_error: 'items harus berupa array.',
    })
    .min(1, 'Pesanan harus memiliki minimal 1 item.'),
});
