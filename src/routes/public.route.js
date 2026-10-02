import { Router } from 'express';
import {
  getStoreCatalog,
  createPublicOrder,
  getPublicOrderStatus,
} from '../controllers/public.controller.js';

const router = Router();

// Halaman publik pelanggan — tidak memerlukan token autentikasi
router.get('/store/:tenantSlug', getStoreCatalog);
router.post('/orders', createPublicOrder);
router.get('/orders/:orderNumber', getPublicOrderStatus);

export default router;
