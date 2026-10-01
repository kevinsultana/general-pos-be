import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { subscriptionLimiter } from '../middlewares/rateLimiter.js';
import {
  createTransaction,
  verifyPayment,
  handleWebhook,
  getSubscriptionStatus,
} from '../controllers/subscription.controller.js';

const router = Router();

/**
 * @openapi
 * /api/subscriptions/create-transaction:
 *   post:
 *     summary: Inisiasi Transaksi Pembayaran Midtrans Snap
 *     description: Menghasilkan token snap Midtrans untuk upgrade paket langganan toko (PLUS atau PRO) secara bulanan atau tahunan.
 *     tags:
 *       - Subscriptions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan
 *               - billingCycle
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [PLUS, PRO]
 *                 example: PRO
 *                 description: Paket yang ingin di-upgrade
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *                 example: yearly
 *                 description: Periode penagihan langganan
 *     responses:
 *       200:
 *         description: Transaksi berhasil disiapkan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: "SNAP-TOKEN-XYZ123"
 *                 redirect_url:
 *                   type: string
 *                   example: "https://app.sandbox.midtrans.com/snap/v2/vtweb/SNAP-TOKEN-XYZ123"
 *                 orderId:
 *                   type: string
 *                   example: "SUB-KOPI-1727827200000"
 *       400:
 *         description: Parameter tidak valid
 *       401:
 *         description: Tidak terautentikasi
 */
router.post(
  '/create-transaction',
  authenticate,
  subscriptionLimiter,
  requirePermission('subscriptions:manage'),
  createTransaction
);

/**
 * @openapi
 * /api/subscriptions/verify:
 *   post:
 *     summary: Verifikasi Status Pembayaran & Terapkan Upgrade Paket
 *     description: Memeriksa status transaksi pembayaran ke Midtrans dan mengaktifkan paket langganan pada tenant toko serta mengembalikan JWT token baru.
 *     tags:
 *       - Subscriptions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 example: "SUB-KOPI-1727827200000"
 *                 description: ID order transaksi pembayaran
 *     responses:
 *       200:
 *         description: Pembayaran berhasil diverifikasi dan paket diperbarui
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
 *                   example: "Pembayaran berhasil diverifikasi dan paket langganan aktif."
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: Token JWT baru dengan plan yang terupdate
 *                     tenant:
 *                       type: object
 *                     payment:
 *                       type: object
 *       400:
 *         description: Pembayaran belum diselesaikan atau gagal
 *       401:
 *         description: Tidak terautentikasi
 */
router.post('/verify', authenticate, verifyPayment);

// Alias rute untuk kompabilitas endpoint verifikasi
router.post('/verify-payment', authenticate, verifyPayment);

/**
 * @openapi
 * /api/subscriptions/webhook:
 *   post:
 *     summary: Webhook Notifikasi Pembayaran Midtrans
 *     description: Endpoint publik penerima notifikasi HTTP POST dari server Midtrans untuk sinkronisasi otomatis status transaksi secara realtime.
 *     tags:
 *       - Subscriptions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order_id
 *               - status_code
 *               - gross_amount
 *               - signature_key
 *               - transaction_status
 *             properties:
 *               order_id:
 *                 type: string
 *                 example: "SUB-KOPI-1727827200000"
 *               status_code:
 *                 type: string
 *                 example: "200"
 *               gross_amount:
 *                 type: string
 *                 example: "600000.00"
 *               signature_key:
 *                 type: string
 *                 example: "abcdef123456..."
 *               transaction_status:
 *                 type: string
 *                 example: "settlement"
 *     responses:
 *       200:
 *         description: Notifikasi webhook berhasil diproses
 *       403:
 *         description: Signature key tidak valid
 *       404:
 *         description: Order tidak ditemukan
 */
router.post('/webhook', handleWebhook);

/**
 * @openapi
 * /api/subscriptions/status:
 *   get:
 *     summary: Mendapatkan Status Langganan Aktif Toko
 *     description: Mengembalikan detail paket langganan aktif toko, siklus penagihan, masa berlaku kedaluwarsa, dan riwayat pembayaran terbaru.
 *     tags:
 *       - Subscriptions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Informasi status langganan
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
 *                     plan:
 *                       type: string
 *                       example: "PRO"
 *                     planStatus:
 *                       type: string
 *                       example: "ACTIVE"
 *                     billingCycle:
 *                       type: string
 *                       example: "yearly"
 *                     subscriptionExpiresAt:
 *                       type: string
 *                       format: date-time
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Tidak terautentikasi
 */
router.get(
  '/status',
  authenticate,
  requirePermission('subscriptions:view'),
  getSubscriptionStatus
);

export default router;
