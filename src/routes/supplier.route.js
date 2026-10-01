import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplier.controller.js';

const router = Router();

/**
 * @openapi
 * /api/suppliers:
 *   get:
 *     summary: Mendapatkan daftar supplier milik tenant
 *     tags:
 *       - Suppliers
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar supplier
 *   post:
 *     summary: Menambahkan supplier baru
 *     tags:
 *       - Suppliers
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
 *                 example: PT Sumber Kopi Abadi
 *               contactName:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Supplier berhasil dibuat
 */
router.get('/', authenticate, requirePermission('inventory:view'), getSuppliers);
router.post('/', authenticate, requirePermission('inventory:manage'), createSupplier);

/**
 * @openapi
 * /api/suppliers/{id}:
 *   put:
 *     summary: Memperbarui data supplier
 *     tags:
 *       - Suppliers
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
 *         description: Supplier berhasil diperbarui
 *   delete:
 *     summary: Menghapus data supplier
 *     tags:
 *       - Suppliers
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
 *         description: Supplier berhasil dihapus
 */
router.put('/:id', authenticate, requirePermission('inventory:manage'), updateSupplier);
router.delete('/:id', authenticate, requirePermission('inventory:manage'), deleteSupplier);

export default router;
