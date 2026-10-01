import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  createOrder,
  getOrders,
  getOrderById,
} from '../controllers/order.controller.js';

const router = Router();

/**
 * @openapi
 * /api/orders:
 *   post:
 *     summary: Eksekusi transaksi penjualan kasir (POS Engine) dengan auto-potong stok
 *     tags:
 *       - Orders & POS
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - paidAmount
 *             properties:
 *               orderType:
 *                 type: string
 *                 enum: [DIRECT, DINE_IN, TAKE_AWAY, DELIVERY, SERVICE_IN]
 *                 default: DIRECT
 *               tableNumber:
 *                 type: string
 *               customerName:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, QRIS, TRANSFER, DEBIT]
 *                 default: CASH
 *               paidAmount:
 *                 type: integer
 *                 example: 50000
 *               discount:
 *                 type: integer
 *                 default: 0
 *               tax:
 *                 type: integer
 *                 default: 0
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                     variantId:
 *                       type: string
 *                     unitId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                       default: 1
 *                     selectedModifiers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           modifierOptionId:
 *                             type: string
 *                           optionName:
 *                             type: string
 *                           price:
 *                             type: integer
 *                           deductQty:
 *                             type: number
 *                           inventoryProductId:
 *                             type: string
 *     responses:
 *       201:
 *         description: Transaksi berhasil diproses dan struk siap dicetak
 *       400:
 *         description: Shift kasir belum dibuka atau uang pembayaran kurang
 *   get:
 *     summary: Mendapatkan riwayat daftar transaksi pesanan
 *     tags:
 *       - Orders & POS
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Berhasil memuat riwayat transaksi
 */
router.post('/', authenticate, requirePermission('pos:access'), createOrder);
router.get('/', authenticate, requirePermission('reports:view'), getOrders);

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     summary: Mendapatkan detail lengkap transaksi untuk cetak ulang nota
 *     tags:
 *       - Orders & POS
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rincian transaksi ditemukan
 *       404:
 *         description: Transaksi tidak ditemukan
 */
router.get('/:id', authenticate, getOrderById);

export default router;
