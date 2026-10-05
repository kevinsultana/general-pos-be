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
 * @openapi
 * tags:
 *   name: Products
 *   description: Manajemen produk & varian menu toko
 */

/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: Mendapatkan daftar semua produk aktif
 *     description: Mengambil seluruh produk beserta variannya pada cabang aktif tenant. Produk yang tidak aktif (isActive=false) tetap dikembalikan untuk keperluan manajemen.
 *     tags:
 *       - Products
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Daftar produk berhasil dimuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *   post:
 *     summary: Menambahkan produk baru beserta varian
 *     description: Membuat produk baru dengan minimal satu varian harga. Jika hanya satu varian, variantName dapat diisi "Default".
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
 *               - variants
 *             properties:
 *               name:
 *                 type: string
 *                 example: Kopi Susu
 *                 description: Nama produk
 *               description:
 *                 type: string
 *                 example: Kopi susu kekinian dengan gula aren
 *               categoryId:
 *                 type: string
 *                 example: uuid-category-minuman
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               variants:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - price
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: Regular
 *                     price:
 *                       type: number
 *                       example: 18000
 *                     costPrice:
 *                       type: number
 *                       example: 8000
 *                       description: Harga pokok penjualan (HPP)
 *     responses:
 *       201:
 *         description: Produk berhasil ditambahkan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validasi gagal (nama kosong atau varian tidak ada)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', authenticate, requirePermission('inventory:view'), getProducts);
router.post('/', authenticate, requirePermission('inventory:manage'), createProduct);

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: Mendapatkan detail satu produk
 *     description: Mengambil detail lengkap produk termasuk semua varian berdasarkan ID.
 *     tags:
 *       - Products
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID produk
 *         schema:
 *           type: string
 *           example: uuid-produk-123
 *     responses:
 *       200:
 *         description: Detail produk berhasil dimuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Memperbarui data produk
 *     description: Mengubah nama, deskripsi, kategori, status aktif, atau daftar varian produk.
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
 *           example: uuid-produk-123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Kopi Susu Gula Aren
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               variants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Kosongkan untuk varian baru
 *                     name:
 *                       type: string
 *                       example: Large
 *                     price:
 *                       type: number
 *                       example: 22000
 *                     costPrice:
 *                       type: number
 *                       example: 10000
 *     responses:
 *       200:
 *         description: Produk berhasil diperbarui
 *       400:
 *         description: Validasi gagal
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Menghapus produk
 *     description: Menghapus produk beserta semua variannya secara permanen dari sistem.
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authenticate, requirePermission('inventory:view'), getProductById);
router.put('/:id', authenticate, requirePermission('inventory:manage'), updateProduct);
router.delete('/:id', authenticate, requirePermission('inventory:manage'), deleteProduct);

/**
 * @openapi
 * /api/products/{id}/variants/{variantId}:
 *   put:
 *     summary: Memperbarui satu varian produk
 *     description: Mengubah nama, harga jual, atau HPP dari varian produk tertentu tanpa mengubah varian lain.
 *     tags:
 *       - Products
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID produk
 *         schema:
 *           type: string
 *       - in: path
 *         name: variantId
 *         required: true
 *         description: UUID varian
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Medium
 *               price:
 *                 type: number
 *                 example: 20000
 *               costPrice:
 *                 type: number
 *                 example: 9000
 *     responses:
 *       200:
 *         description: Varian berhasil diperbarui
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
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *                     costPrice:
 *                       type: number
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/variants/:variantId', authenticate, requirePermission('inventory:manage'), updateVariant);

export default router;
