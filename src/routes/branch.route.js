import { Router } from 'express';
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  switchBranch,
} from '../controllers/branch.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePlan, requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/branches:
 *   get:
 *     summary: Mendapatkan daftar seluruh cabang toko
 *     description: Mengambil seluruh outlet cabang milik tenant aktif beserta hitungan staf. Membutuhkan izin branches:view.
 *     tags:
 *       - Branches
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar cabang
 *       401:
 *         description: Tidak terautentikasi
 *       403:
 *         description: Izin tidak mencukupi (branches:view)
 *   post:
 *     summary: Menambahkan cabang toko baru
 *     description: Mendaftarkan outlet cabang baru. Eksklusif untuk pengguna paket PRO dan membutuhkan izin branches:manage.
 *     tags:
 *       - Branches
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
 *                 example: Cabang Dago
 *               address:
 *                 type: string
 *                 example: Jl. Ir. H. Juanda No. 123, Bandung
 *               phone:
 *                 type: string
 *                 example: 081234567890
 *     responses:
 *       201:
 *         description: Cabang baru berhasil ditambahkan
 *       400:
 *         description: Nama cabang tidak boleh kosong
 *       403:
 *         description: Fitur terbatas paket PRO atau izin branches:manage tidak mencukupi
 */
router.get(
  '/',
  authenticate,
  requirePermission('branches:view'),
  getBranches
);

router.post(
  '/',
  authenticate,
  requirePlan('PRO'),
  requirePermission('branches:manage'),
  createBranch
);

/**
 * @openapi
 * /api/branches/switch-branch:
 *   post:
 *     summary: Berpindah cabang aktif (Active Branch Switcher)
 *     description: Mengganti cabang aktif operasional toko dan menghasilkan token JWT baru.
 *     tags:
 *       - Branches
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - branchId
 *             properties:
 *               branchId:
 *                 type: string
 *                 example: uuid-branch-123
 *     responses:
 *       200:
 *         description: Berhasil beralih ke cabang yang dipilih
 *       400:
 *         description: Cabang nonaktif atau parameter tidak valid
 *       403:
 *         description: User tidak memiliki hak penugasan ke cabang ini
 *       404:
 *         description: Cabang tidak ditemukan
 */
router.post(
  '/switch-branch',
  authenticate,
  switchBranch
);

/**
 * @openapi
 * /api/branches/{id}:
 *   put:
 *     summary: Memperbarui data cabang toko
 *     description: Mengubah informasi nama, alamat, nomor telepon, atau status aktif cabang. Cabang utama tidak dapat dinonaktifkan.
 *     tags:
 *       - Branches
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
 *                 example: Cabang Dago Heritage
 *               address:
 *                 type: string
 *                 example: Jl. Ir. H. Juanda No. 125, Bandung
 *               phone:
 *                 type: string
 *                 example: 081299998888
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Data cabang berhasil diperbarui
 *       400:
 *         description: Validasi gagal atau mencoba menonaktifkan cabang utama
 *       404:
 *         description: Cabang tidak ditemukan
 *   delete:
 *     summary: Menghapus cabang toko
 *     description: Menghapus cabang outlet dari sistem. Cabang utama tidak dapat dihapus. Eksklusif untuk paket PRO.
 *     tags:
 *       - Branches
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
 *         description: Cabang berhasil dihapus
 *       400:
 *         description: Cabang utama tidak dapat dihapus
 *       403:
 *         description: Dibatasi paket PRO atau izin tidak mencukupi
 *       404:
 *         description: Cabang tidak ditemukan
 */
router.put(
  '/:id',
  authenticate,
  requirePermission('branches:manage'),
  updateBranch
);

router.delete(
  '/:id',
  authenticate,
  requirePlan('PRO'),
  requirePermission('branches:manage'),
  deleteBranch
);

export default router;
