import { Router } from 'express';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getMasterPermissions,
} from '../controllers/role.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePlan, requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/roles/permissions:
 *   get:
 *     summary: Mendapatkan daftar seluruh master permissions sistem secara terkelompok
 *     description: Mengambil seluruh daftar hak akses sistem (RBAC) yang terbagi dalam kategori panel untuk antarmuka checklist izin.
 *     tags:
 *       - Roles & Permissions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat master permissions
 *       401:
 *         description: Otentikasi diperlukan
 *       403:
 *         description: Memerlukan paket PLUS / PRO
 */
router.get(
  '/permissions',
  authenticate,
  requirePlan('PLUS'),
  getMasterPermissions
);

/**
 * @openapi
 * /api/roles:
 *   get:
 *     summary: Mendapatkan daftar semua peran (roles) toko
 *     description: Mengambil seluruh peran yang ada pada tenant aktif beserta jumlah staf yang menggunakannya. Membutuhkan paket PLUS/PRO dan permission roles:view.
 *     tags:
 *       - Roles & Permissions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar peran
 *       403:
 *         description: Paket tidak memenuhi syarat (PLAN_RESTRICTED) atau izin akses tidak mencukupi
 *   post:
 *     summary: Membuat peran kustom baru
 *     description: Mendaftarkan peran kustom baru dengan daftar hak akses (permissions) tertentu.
 *     tags:
 *       - Roles & Permissions
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
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *                 example: SUPERVISOR
 *               description:
 *                 type: string
 *                 example: Pengawas shift dan void kasir
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["pos:access", "pos:void", "pos:shift", "inventory:view"]
 *     responses:
 *       201:
 *         description: Peran kustom berhasil dibuat
 *       409:
 *         description: Nama peran sudah ada di toko ini
 */
router.get(
  '/',
  authenticate,
  requirePlan('PLUS'),
  requirePermission('roles:view'),
  getRoles
);

router.post(
  '/',
  authenticate,
  requirePlan('PLUS'),
  requirePermission('roles:manage'),
  createRole
);

/**
 * @openapi
 * /api/roles/{id}:
 *   put:
 *     summary: Memperbarui deskripsi atau hak akses peran
 *     description: Mengubah hak akses atau deskripsi peran. Peran bawaan sistem (isSystem=true) tidak dapat diganti namanya.
 *     tags:
 *       - Roles & Permissions
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
 *                 example: SUPERVISOR OUTLET
 *               description:
 *                 type: string
 *                 example: Deskripsi baru peran
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["pos:*", "inventory:view"]
 *     responses:
 *       200:
 *         description: Peran berhasil diperbarui
 *       400:
 *         description: Validasi gagal atau mencoba mengubah nama peran bawaan sistem
 *   delete:
 *     summary: Menghapus peran kustom
 *     description: Menghapus peran kustom yang tidak lagi digunakan oleh user aktif.
 *     tags:
 *       - Roles & Permissions
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
 *         description: Peran berhasil dihapus
 *       400:
 *         description: Peran bawaan sistem atau masih digunakan oleh staf aktif
 */
router.put(
  '/:id',
  authenticate,
  requirePlan('PLUS'),
  requirePermission('roles:manage'),
  updateRole
);

router.delete(
  '/:id',
  authenticate,
  requirePlan('PLUS'),
  requirePermission('roles:manage'),
  deleteRole
);

export default router;
