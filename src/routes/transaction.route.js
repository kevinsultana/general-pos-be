import { Router } from 'express';
import { checkout, getTransactions } from '../controllers/transaction.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * POST /api/transactions/checkout  - Proses checkout
 * GET  /api/transactions            - Riwayat transaksi
 */

router.post('/checkout', authenticate, requirePermission('pos:access'), checkout);
router.get('/', authenticate, requirePermission('reports:view'), getTransactions);

export default router;
