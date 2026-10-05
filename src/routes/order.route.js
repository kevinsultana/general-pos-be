import { Router } from 'express';
import {
  getPendingOrders,
  lookupOrder,
  cancelOrder,
} from '../controllers/order.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Orders
 *   description: Pesanan self-order pelanggan via QR menu meja
 */

// Seluruh rute orders membutuhkan autentikasi
router.use(authenticate);

/**
 * @openapi
 * /api/orders/pending:
 *   get:
 *     summary: Mendapatkan daftar pesanan yang menunggu diproses kasir
 *     description: Mengambil semua pesanan berstatus PENDING yang dibuat pelanggan melalui QR self-order menu meja. Kasir memuat pesanan ini ke keranjang POS untuk di-checkout.
 *     tags:
 *       - Orders
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar pesanan pending berhasil dimuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/pending', requirePermission('pos:access'), getPendingOrders);

/**
 * @openapi
 * /api/orders/lookup/{orderNumber}:
 *   get:
 *     summary: Mencari pesanan berdasarkan kode barcode / nomor pesanan
 *     description: Endpoint scan barcode untuk memuat pesanan pelanggan ke keranjang kasir. Mendukung barcode USB/Bluetooth scanner maupun input manual. Mengembalikan error jika pesanan sudah tidak berstatus PENDING.
 *     tags:
 *       - Orders
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         description: Nomor pesanan (contoh ORD-882194) atau barcode yang di-scan
 *         schema:
 *           type: string
 *           example: ORD-882194
 *     responses:
 *       200:
 *         description: Pesanan ditemukan dan siap dimuat ke kasir
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Pesanan sudah diproses / bukan status PENDING
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Pesanan tidak ditemukan
 */
router.get('/lookup/:orderNumber', requirePermission('pos:access'), lookupOrder);

/**
 * @openapi
 * /api/orders/{id}/cancel:
 *   post:
 *     summary: Membatalkan pesanan self-order
 *     description: Membatalkan pesanan pelanggan yang masih berstatus PENDING. Kasir menggunakan ini jika pelanggan ingin membatalkan pesanan yang sudah masuk.
 *     tags:
 *       - Orders
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID pesanan yang akan dibatalkan
 *         schema:
 *           type: string
 *           example: uuid-order-abc123
 *     responses:
 *       200:
 *         description: Pesanan berhasil dibatalkan
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
 *                   example: Pesanan berhasil dibatalkan
 *       400:
 *         description: Pesanan sudah tidak bisa dibatalkan (bukan status PENDING)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/cancel', requirePermission('pos:access'), cancelOrder);

export default router;
