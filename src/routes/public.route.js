import { Router } from 'express';
import {
  getStoreCatalog,
  createPublicOrder,
  getPublicOrderStatus,
} from '../controllers/public.controller.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Public (Self-Order)
 *   description: Endpoint publik untuk pelanggan — tidak memerlukan token. Digunakan oleh halaman QR menu meja.
 */

/**
 * @openapi
 * /api/public/store/{tenantSlug}:
 *   get:
 *     summary: Mendapatkan katalog produk toko untuk menu publik
 *     description: |
 *       Mengambil daftar produk aktif beserta harga dari toko berdasarkan slug-nya.
 *       Endpoint ini diakses pelanggan melalui QR code di meja tanpa perlu login.
 *       Mengembalikan juga info nama toko dan cabang untuk ditampilkan di halaman menu.
 *     tags:
 *       - Public (Self-Order)
 *     parameters:
 *       - in: path
 *         name: tenantSlug
 *         required: true
 *         description: Slug unik toko (contoh "kopi-senja")
 *         schema:
 *           type: string
 *           example: kopi-senja
 *     responses:
 *       200:
 *         description: Katalog produk toko berhasil dimuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     store:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: Kopi Senja
 *                         slug:
 *                           type: string
 *                           example: kopi-senja
 *                     products:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Product'
 *       404:
 *         description: Toko tidak ditemukan atau tidak aktif
 */
router.get('/store/:tenantSlug', getStoreCatalog);

/**
 * @openapi
 * /api/public/orders:
 *   post:
 *     summary: Pelanggan membuat pesanan self-order via QR menu
 *     description: |
 *       Endpoint untuk pelanggan membuat pesanan mandiri dari halaman QR menu meja.
 *       Pesanan akan masuk ke antrean kasir dengan status **PENDING** dan bisa di-scan/dipilih kasir dari halaman POS.
 *       Tidak memerlukan token autentikasi.
 *     tags:
 *       - Public (Self-Order)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantSlug
 *               - customerName
 *               - items
 *             properties:
 *               tenantSlug:
 *                 type: string
 *                 example: kopi-senja
 *               tableNumber:
 *                 type: string
 *                 example: "5"
 *                 description: Nomor meja (opsional untuk takeaway)
 *               orderType:
 *                 type: string
 *                 enum: [DINE_IN, TAKEAWAY]
 *                 example: DINE_IN
 *               customerName:
 *                 type: string
 *                 example: Budi
 *               customerPhone:
 *                 type: string
 *                 example: "08123456789"
 *               notes:
 *                 type: string
 *                 example: Mohon tidak terlalu pedas
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - variantId
 *                     - quantity
 *                   properties:
 *                     variantId:
 *                       type: string
 *                       example: uuid-variant-regular
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *                     notes:
 *                       type: string
 *                       example: Tanpa es
 *     responses:
 *       201:
 *         description: Pesanan berhasil dibuat dan masuk ke antrean kasir
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Pesanan berhasil dikirim ke kasir
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderNumber:
 *                       type: string
 *                       example: ORD-882194
 *                     status:
 *                       type: string
 *                       example: PENDING
 *       400:
 *         description: Validasi gagal (item kosong, produk tidak aktif, dll)
 *       404:
 *         description: Toko tidak ditemukan
 */
router.post('/orders', createPublicOrder);

/**
 * @openapi
 * /api/public/orders/{orderNumber}:
 *   get:
 *     summary: Memeriksa status pesanan pelanggan
 *     description: |
 *       Pelanggan dapat mengecek status pesanan mereka berdasarkan nomor pesanan yang diterima setelah membuat order.
 *       Berguna untuk halaman konfirmasi setelah self-order.
 *     tags:
 *       - Public (Self-Order)
 *     parameters:
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         description: Nomor pesanan (contoh ORD-882194)
 *         schema:
 *           type: string
 *           example: ORD-882194
 *     responses:
 *       200:
 *         description: Status pesanan ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderNumber:
 *                       type: string
 *                       example: ORD-882194
 *                     status:
 *                       type: string
 *                       enum: [PENDING, COMPLETED, CANCELLED]
 *                       example: PENDING
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productName:
 *                             type: string
 *                           variantName:
 *                             type: string
 *                           quantity:
 *                             type: integer
 *                     totalAmount:
 *                       type: number
 *                       example: 54000
 *       404:
 *         description: Pesanan tidak ditemukan
 */
router.get('/orders/:orderNumber', getPublicOrderStatus);

export default router;
