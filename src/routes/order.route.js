import { Router } from 'express';
import {
  getPendingOrders,
  lookupOrder,
  cancelOrder,
} from '../controllers/order.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

// Rute internal kasir & staf — terproteksi autentikasi
router.use(authenticate);

// Mengambil daftar pesanan pending kasir
router.get('/pending', requirePermission('pos:access'), getPendingOrders);

// Scan barcode / cari kode pesanan untuk dimasukkan ke keranjang POS
router.get('/lookup/:orderNumber', requirePermission('pos:access'), lookupOrder);

// Batalkan pesanan pending
router.post('/:id/cancel', requirePermission('pos:access'), cancelOrder);

export default router;
