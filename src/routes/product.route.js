import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
} from '../controllers/product.controller.js';

const router = Router();

/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: Mendapatkan katalog produk lengkap dengan paginasi, pencarian, dan filter cabang
 *     tags:
 *       - Products
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Berhasil mengambil katalog produk
 *   post:
 *     summary: Menambahkan produk baru, inisialisasi stok multi-cabang, varian, UOM, dan modifiers
 *     tags:
 *       - Products
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Kopi Susu Aren
 *               categoryId:
 *                 type: string
 *                 nullable: true
 *               basePrice:
 *                 type: integer
 *                 example: 18000
 *               cogs:
 *                 type: integer
 *                 example: 8000
 *               sku:
 *                 type: string
 *                 example: KSA-001
 *               barcode:
 *                 type: string
 *               description:
 *                 type: string
 *               isService:
 *                 type: boolean
 *                 default: false
 *               trackStock:
 *                 type: boolean
 *                 default: true
 *               initialStock:
 *                 type: number
 *                 default: 0
 *               minStock:
 *                 type: integer
 *                 default: 5
 *               branchId:
 *                 type: string
 *               variants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     priceAdj:
 *                       type: integer
 *                     sku:
 *                       type: string
 *               unitPrices:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     conversionRate:
 *                       type: integer
 *                     price:
 *                       type: integer
 *               modifierGroupIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Produk berhasil dibuat
 */
router.get('/', authenticate, requirePermission('inventory:view'), getProducts);
router.post('/', authenticate, requirePermission('inventory:manage'), createProduct);

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: Mendapatkan detail produk tunggal berdasarkan ID
 *     tags:
 *       - Products
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
 *         description: Detail produk ditemukan
 *       404:
 *         description: Produk tidak ditemukan
 *   put:
 *     summary: Memperbarui data produk dan relasi varian/UOM/modifiers
 *     tags:
 *       - Products
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
 *         description: Produk berhasil diperbarui
 *   delete:
 *     summary: Menghapus produk
 *     tags:
 *       - Products
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
 *         description: Produk berhasil dihapus
 */
router.get('/:id', authenticate, requirePermission('inventory:view'), getProductById);
router.put('/:id', authenticate, requirePermission('inventory:manage'), updateProduct);
router.delete('/:id', authenticate, requirePermission('inventory:manage'), deleteProduct);

/**
 * @openapi
 * /api/products/{id}/stock:
 *   patch:
 *     summary: Update cepat stok produk untuk cabang spesifik
 *     tags:
 *       - Products
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               branchId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               minStock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Stok berhasil diperbarui
 */
router.patch('/:id/stock', authenticate, requirePermission('inventory:manage'), updateProductStock);

export default router;
