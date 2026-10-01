import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getModifiers,
  createModifier,
  updateModifier,
  deleteModifier,
} from '../controllers/modifier.controller.js';

const router = Router();

/**
 * @openapi
 * /api/modifiers:
 *   get:
 *     summary: Mendapatkan semua grup modifier dan opsi tambahannya
 *     tags:
 *       - Modifiers
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar modifier
 *   post:
 *     summary: Membuat grup modifier baru beserta opsi dan konfigurasi potong stok
 *     tags:
 *       - Modifiers
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
 *                 example: Level Gula
 *               isRequired:
 *                 type: boolean
 *                 default: false
 *               isMultiple:
 *                 type: boolean
 *                 default: false
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: Less Sugar 50%
 *                     price:
 *                       type: integer
 *                       example: 0
 *                     trackStock:
 *                       type: boolean
 *                       example: false
 *                     inventoryProductId:
 *                       type: string
 *                       nullable: true
 *                     deductQty:
 *                       type: number
 *                       example: 1
 *     responses:
 *       201:
 *         description: Modifier berhasil dibuat
 */
router.get('/', authenticate, requirePermission('inventory:view'), getModifiers);
router.post('/', authenticate, requirePermission('inventory:manage'), createModifier);

/**
 * @openapi
 * /api/modifiers/{id}:
 *   put:
 *     summary: Memperbarui grup modifier dan opsinya
 *     tags:
 *       - Modifiers
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
 *         description: Modifier berhasil diperbarui
 *   delete:
 *     summary: Menghapus grup modifier
 *     tags:
 *       - Modifiers
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
 *         description: Modifier berhasil dihapus
 */
router.put('/:id', authenticate, requirePermission('inventory:manage'), updateModifier);
router.delete('/:id', authenticate, requirePermission('inventory:manage'), deleteModifier);

export default router;
