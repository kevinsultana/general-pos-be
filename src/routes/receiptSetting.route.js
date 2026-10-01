import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getReceiptSetting,
  updateReceiptSetting,
} from '../controllers/receiptSetting.controller.js';

const router = Router();

/**
 * @openapi
 * /api/receipt-settings:
 *   get:
 *     summary: Mendapatkan konfigurasi desain struk kasir
 *     tags:
 *       - Receipt & Printer Settings
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat format struk
 */
router.get('/', authenticate, getReceiptSetting);

/**
 * @openapi
 * /api/receipt-settings:
 *   put:
 *     summary: Menyimpan konfigurasi desain struk kasir
 *     tags:
 *       - Receipt & Printer Settings
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paperSize:
 *                 type: string
 *                 enum: [58mm, 80mm]
 *               headerText:
 *                 type: string
 *               footerText:
 *                 type: string
 *               showCashierName:
 *                 type: boolean
 *               showCustomerName:
 *                 type: boolean
 *               showTableNumber:
 *                 type: boolean
 *               showStoreLogo:
 *                 type: boolean
 *               logoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Konfigurasi struk berhasil disimpan
 */
router.put('/', authenticate, requirePermission('settings:manage'), updateReceiptSetting);

export default router;
