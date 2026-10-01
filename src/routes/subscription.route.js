import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  createTransaction,
  verifyPayment,
} from '../controllers/subscription.controller.js';

const router = Router();

/**
 * Route: Inisiasi Transaksi Midtrans Snap
 * POST /api/subscriptions/create-transaction
 */
router.post('/create-transaction', authenticate, createTransaction);

/**
 * Route: Verifikasi & Terapkan Pembayaran Sukses
 * POST /api/subscriptions/verify-payment
 */
router.post('/verify-payment', authenticate, verifyPayment);

export default router;
