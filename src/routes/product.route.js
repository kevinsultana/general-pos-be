import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateVariant,
} from '../controllers/product.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * GET    /api/products         - Daftar semua produk
 * POST   /api/products         - Tambah produk baru
 * GET    /api/products/:id     - Detail produk
 * PUT    /api/products/:id     - Update produk
 * DELETE /api/products/:id     - Hapus produk
 * PUT    /api/products/:id/variants/:variantId - Update varian
 */

router.get('/', authenticate, requirePermission('inventory:view'), getProducts);
router.post('/', authenticate, requirePermission('inventory:manage'), createProduct);
router.get('/:id', authenticate, requirePermission('inventory:view'), getProductById);
router.put('/:id', authenticate, requirePermission('inventory:manage'), updateProduct);
router.delete('/:id', authenticate, requirePermission('inventory:manage'), deleteProduct);
router.put('/:id/variants/:variantId', authenticate, requirePermission('inventory:manage'), updateVariant);

export default router;
