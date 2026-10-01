import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getCurrentShift,
  openShift,
  recordCashMovement,
  closeShift,
} from '../controllers/shift.controller.js';

const router = Router();

/**
 * @openapi
 * /api/shifts/current:
 *   get:
 *     summary: Mendapatkan informasi shift kasir yang sedang aktif di cabang saat ini
 *     tags:
 *       - Cashier Shifts
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat status shift
 */
router.get('/current', authenticate, requirePermission('pos:shift'), getCurrentShift);

/**
 * @openapi
 * /api/shifts/open:
 *   post:
 *     summary: Membuka shift kasir baru dengan modal uang kas awal
 *     tags:
 *       - Cashier Shifts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startingCash:
 *                 type: integer
 *                 example: 300000
 *               notes:
 *                 type: string
 *                 example: Shift Pagi Kasir 1
 *     responses:
 *       201:
 *         description: Shift kasir berhasil dibuka
 *       400:
 *         description: Shift sudah aktif sebelumnya atau data tidak valid
 */
router.post('/open', authenticate, requirePermission('pos:shift'), openShift);

/**
 * @openapi
 * /api/shifts/movement:
 *   post:
 *     summary: Mencatat arus kas masuk atau keluar dari laci kasir (misal beli es batu)
 *     tags:
 *       - Cashier Shifts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *               - reason
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [CASH_IN, CASH_OUT]
 *                 example: CASH_OUT
 *               amount:
 *                 type: integer
 *                 example: 25000
 *               reason:
 *                 type: string
 *                 example: Beli Es Batu Kristal 2 Pack
 *     responses:
 *       201:
 *         description: Mutasi kas berhasil dicatat
 */
router.post('/movement', authenticate, requirePermission('pos:shift'), recordCashMovement);

/**
 * @openapi
 * /api/shifts/close:
 *   post:
 *     summary: Menutup shift kasir dan menghitung rekonsiliasi selisih kas fisik
 *     tags:
 *       - Cashier Shifts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actualCash
 *             properties:
 *               actualCash:
 *                 type: integer
 *                 example: 850000
 *               notes:
 *                 type: string
 *                 example: Kas dihitung tepat, tidak ada selisih
 *     responses:
 *       200:
 *         description: Shift berhasil ditutup dan direkonsiliasi
 */
router.post('/close', authenticate, requirePermission('pos:shift'), closeShift);

export default router;
