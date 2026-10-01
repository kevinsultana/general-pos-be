import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePlan, requirePermission } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createTransferSchema } from '../validations/transfer.validation.js';
import {
  getTransfers,
  createTransfer,
  receiveTransfer,
  cancelTransfer,
} from '../controllers/transfer.controller.js';

const router = Router();

/**
 * @openapi
 * /api/transfers:
 *   get:
 *     summary: Mendapatkan daftar riwayat transfer stok antar cabang (Khusus Paket PRO)
 *     tags:
 *       - Stock Transfers (PRO Only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, RECEIVED, CANCELLED]
 *     responses:
 *       200:
 *         description: Berhasil memuat data transfer
 */
router.get(
  '/',
  authenticate,
  requirePlan('PRO'),
  requirePermission('inventory:view'),
  getTransfers
);

/**
 * @openapi
 * /api/transfers:
 *   post:
 *     summary: Mengirim transfer stok produk ke cabang lain (Khusus Paket PRO)
 *     tags:
 *       - Stock Transfers (PRO Only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromBranchId
 *               - toBranchId
 *               - items
 *             properties:
 *               fromBranchId:
 *                 type: string
 *               toBranchId:
 *                 type: string
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *     responses:
 *       201:
 *         description: Transfer stok berhasil dibuat
 */
router.post(
  '/',
  authenticate,
  requirePlan('PRO'),
  requirePermission('inventory:manage'),
  validate(createTransferSchema),
  createTransfer
);

/**
 * @openapi
 * /api/transfers/{id}/receive:
 *   patch:
 *     summary: Konfirmasi penerimaan barang transfer di cabang tujuan (Khusus Paket PRO)
 *     tags:
 *       - Stock Transfers (PRO Only)
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
 *         description: Transfer stok berhasil diterima
 */
router.patch(
  '/:id/receive',
  authenticate,
  requirePlan('PRO'),
  requirePermission('inventory:manage'),
  receiveTransfer
);

/**
 * @openapi
 * /api/transfers/{id}/cancel:
 *   patch:
 *     summary: Membatalkan pengiriman transfer stok & mengembalikan stok ke cabang pengirim (Khusus Paket PRO)
 *     tags:
 *       - Stock Transfers (PRO Only)
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
 *         description: Transfer stok berhasil dibatalkan
 */
router.patch(
  '/:id/cancel',
  authenticate,
  requirePlan('PRO'),
  requirePermission('inventory:manage'),
  cancelTransfer
);

export default router;
