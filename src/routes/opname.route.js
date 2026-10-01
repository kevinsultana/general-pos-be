import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getOpnames,
  createOpname,
} from '../controllers/opname.controller.js';

const router = Router();

/**
 * @openapi
 * /api/opnames:
 *   get:
 *     summary: Mendapatkan riwayat audit stok opname per cabang
 *     tags:
 *       - Stock Opname
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat riwayat opname
 *   post:
 *     summary: Menyimpan sesi audit stok opname dan mengkalibrasi stok riil
 *     tags:
 *       - Stock Opname
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
 *             properties:
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - physicalQty
 *                   properties:
 *                     productId:
 *                       type: string
 *                     physicalQty:
 *                       type: number
 *                     reason:
 *                       type: string
 *                       example: Rusak/Basi
 *     responses:
 *       201:
 *         description: Stok opname selesai dan stok berhasil disesuaikan
 */
router.get('/', authenticate, requirePermission('inventory:view'), getOpnames);
router.post('/', authenticate, requirePermission('inventory:manage'), createOpname);

export default router;
