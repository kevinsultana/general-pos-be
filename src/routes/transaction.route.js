import { Router } from 'express';
import { checkout, getTransactions } from '../controllers/transaction.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Transactions
 *   description: Transaksi penjualan kasir POS
 */

/**
 * @openapi
 * /api/transactions/checkout:
 *   post:
 *     summary: Memproses checkout & pembayaran transaksi
 *     description: |
 *       Memproses transaksi penjualan dari keranjang kasir. Mendukung tiga metode pembayaran: **CASH**, **QRIS**, dan **TRANSFER**.
 *       - Wajib ada shift aktif sebelum checkout
 *       - Mengurangi stok varian otomatis (jika fitur stock tracking aktif)
 *       - Menerapkan diskon promo jika `promoCode` disertakan
 *       - Mengembalikan `receiptNumber` untuk struk
 *     tags:
 *       - Transactions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shiftId
 *               - paymentMethod
 *               - items
 *             properties:
 *               shiftId:
 *                 type: string
 *                 example: uuid-shift-abc123
 *                 description: ID shift kasir yang sedang aktif
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, QRIS, TRANSFER]
 *                 example: CASH
 *               cashReceived:
 *                 type: number
 *                 example: 100000
 *                 description: Uang tunai yang diterima (wajib jika paymentMethod=CASH)
 *               customerId:
 *                 type: string
 *                 example: uuid-customer-xyz
 *                 description: UUID pelanggan terdaftar (opsional)
 *               orderId:
 *                 type: string
 *                 example: uuid-order-selforder
 *                 description: UUID pesanan self-order yang dikaitkan (opsional)
 *               promoCode:
 *                 type: string
 *                 example: DISKON10
 *                 description: Kode promo yang diterapkan (opsional)
 *               roundingMode:
 *                 type: string
 *                 enum: [ROUND, FLOOR, NONE]
 *                 example: ROUND
 *                 description: Mode pembulatan total (opsional, default NONE)
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - variantId
 *                     - quantity
 *                     - price
 *                   properties:
 *                     variantId:
 *                       type: string
 *                       example: uuid-variant-regular
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *                     price:
 *                       type: number
 *                       example: 18000
 *                     notes:
 *                       type: string
 *                       example: Tanpa es
 *     responses:
 *       201:
 *         description: Transaksi berhasil diproses
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
 *                   example: Transaksi berhasil
 *                 data:
 *                   type: object
 *                   properties:
 *                     transaction:
 *                       $ref: '#/components/schemas/Transaction'
 *                     discountAmount:
 *                       type: number
 *                       example: 5000
 *                     paymentMethod:
 *                       type: string
 *                       example: CASH
 *                     cashReceived:
 *                       type: number
 *                       example: 100000
 *                     changeAmount:
 *                       type: number
 *                       example: 59000
 *       400:
 *         description: Shift tidak aktif, uang tidak cukup, atau item tidak valid
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/checkout', authenticate, requirePermission('pos:access'), checkout);

/**
 * @openapi
 * /api/transactions:
 *   get:
 *     summary: Mendapatkan riwayat semua transaksi
 *     description: Mengambil daftar transaksi penjualan pada cabang aktif dengan filter opsional berdasarkan tanggal, metode bayar, atau kasir. Digunakan untuk halaman laporan penjualan.
 *     tags:
 *       - Transactions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-10-01"
 *         description: Filter tanggal mulai (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-10-31"
 *         description: Filter tanggal akhir (YYYY-MM-DD)
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [CASH, QRIS, TRANSFER]
 *         description: Filter berdasarkan metode pembayaran
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 50
 *     responses:
 *       200:
 *         description: Riwayat transaksi berhasil dimuat
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
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *                     total:
 *                       type: integer
 *                       example: 235
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', authenticate, requirePermission('reports:view'), getTransactions);

export default router;
