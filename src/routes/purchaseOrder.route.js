import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from '../controllers/purchaseOrder.controller.js';

const router = Router();

/**
 * @openapi
 * /api/purchase-orders:
 *   get:
 *     summary: Mendapatkan daftar Purchase Orders (PO)
 *     tags:
 *       - Purchase Orders
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, ORDERED, RECEIVED, CANCELLED]
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar PO
 *   post:
 *     summary: Membuat pesanan pembelian baru ke supplier
 *     tags:
 *       - Purchase Orders
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supplierId
 *               - items
 *             properties:
 *               supplierId:
 *                 type: string
 *               orderDate:
 *                 type: string
 *                 format: date-time
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
 *                     quantity:
 *                       type: number
 *                     costPrice:
 *                       type: integer
 *     responses:
 *       201:
 *         description: PO berhasil dibuat
 */
router.get('/', authenticate, requirePermission('inventory:view'), getPurchaseOrders);
router.post('/', authenticate, requirePermission('inventory:manage'), createPurchaseOrder);

/**
 * @openapi
 * /api/purchase-orders/{id}/receive:
 *   patch:
 *     summary: Konfirmasi penerimaan barang masuk ke cabang aktif dan tambah stok fisik
 *     tags:
 *       - Purchase Orders
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
 *         description: Barang berhasil diterima dan stok bertambah
 */
router.patch('/:id/receive', authenticate, requirePermission('inventory:manage'), receivePurchaseOrder);

/**
 * @openapi
 * /api/purchase-orders/{id}/cancel:
 *   patch:
 *     summary: Membatalkan pesanan pembelian
 *     tags:
 *       - Purchase Orders
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
 *         description: PO berhasil dibatalkan
 */
router.patch('/:id/cancel', authenticate, requirePermission('inventory:manage'), cancelPurchaseOrder);

export default router;
