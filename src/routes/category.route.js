import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';

const router = Router();

/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: Mendapatkan semua kategori produk milik tenant aktif
 *     tags:
 *       - Categories
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar kategori
 *   post:
 *     summary: Membuat kategori baru
 *     tags:
 *       - Categories
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
 *                 example: Minuman Dingin
 *               color:
 *                 type: string
 *                 example: "#f59e0b"
 *     responses:
 *       201:
 *         description: Kategori berhasil dibuat
 *       400:
 *         description: Nama kategori tidak valid
 */
router.get('/', authenticate, requirePermission('inventory:view'), getCategories);
router.post('/', authenticate, requirePermission('inventory:manage'), createCategory);

/**
 * @openapi
 * /api/categories/{id}:
 *   put:
 *     summary: Memperbarui data kategori
 *     tags:
 *       - Categories
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
 *               name:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: Kategori berhasil diperbarui
 *       404:
 *         description: Kategori tidak ditemukan
 *   delete:
 *     summary: Menghapus kategori
 *     tags:
 *       - Categories
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
 *         description: Kategori berhasil dihapus
 *       404:
 *         description: Kategori tidak ditemukan
 */
router.put('/:id', authenticate, requirePermission('inventory:manage'), updateCategory);
router.delete('/:id', authenticate, requirePermission('inventory:manage'), deleteCategory);

export default router;
