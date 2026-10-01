import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePlan, requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Mendapatkan daftar semua staf / karyawan toko
 *     description: Mengambil seluruh user karyawan di tenant aktif beserta role dan cabang yang ditugaskan. Membutuhkan paket PLUS/PRO dan permission users:view.
 *     tags:
 *       - Users & Employees
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar karyawan
 *       403:
 *         description: Fitur dibatasi paket atau izin tidak mencukupi
 *   post:
 *     summary: Menambahkan staf / karyawan baru
 *     description: Mendaftarkan akun karyawan baru. Pada paket PLUS akun otomatis ditugaskan ke Cabang Utama.
 *     tags:
 *       - Users & Employees
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
 *               - email
 *               - password
 *               - roleId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Siti Rahma
 *               email:
 *                 type: string
 *                 format: email
 *                 example: siti.kasir@omnipos.app
 *               password:
 *                 type: string
 *                 format: password
 *                 example: kasirpass123
 *               roleId:
 *                 type: string
 *                 example: uuid-role-kasir
 *               phone:
 *                 type: string
 *                 example: 08123456789
 *               pin:
 *                 type: string
 *                 example: "1234"
 *               branchIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["uuid-branch-1"]
 *               allBranchesAccess:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Karyawan baru berhasil ditambahkan
 *       400:
 *         description: Validasi input gagal
 *       409:
 *         description: Email sudah terdaftar di toko ini
 */
router.get(
  '/',
  authenticate,
  requirePlan('PLUS'),
  requirePermission('users:view'),
  getUsers
);

router.post(
  '/',
  authenticate,
  requirePlan('PLUS'),
  requirePermission('users:manage'),
  createUser
);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Memperbarui data karyawan
 *     description: Memperbarui nama, nomor telepon, status aktif, PIN, role, atau cabang karyawan. Akun owner tidak dapat dinonaktifkan.
 *     tags:
 *       - Users & Employees
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
 *                 example: Siti Rahmawati
 *               phone:
 *                 type: string
 *                 example: 08129876543
 *               pin:
 *                 type: string
 *                 example: "5678"
 *               password:
 *                 type: string
 *                 example: passwordbaru123
 *               roleId:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               branchIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               allBranchesAccess:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Karyawan berhasil diperbarui
 *       400:
 *         description: Validasi gagal atau mencoba menonaktifkan akun owner
 *   delete:
 *     summary: Menghapus akun karyawan
 *     description: Menghapus user karyawan dari toko. Akun Owner tidak dapat dihapus.
 *     tags:
 *       - Users & Employees
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
 *         description: Karyawan berhasil dihapus
 *       400:
 *         description: Akun Owner tidak dapat dihapus
 */
router.put(
  '/:id',
  authenticate,
  requirePlan('PLUS'),
  requirePermission('users:manage'),
  updateUser
);

router.delete(
  '/:id',
  authenticate,
  requirePlan('PLUS'),
  requirePermission('users:manage'),
  deleteUser
);

export default router;
