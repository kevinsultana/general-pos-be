import { Router } from 'express';
import { register, login, getMe, updateStoreSettings } from '../controllers/auth.controller.js';
import { switchBranch } from '../controllers/branch.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Registrasi Tenant Toko & Akun Pemilik (First User)
 *     description: Mendaftarkan toko baru beserta akun pemilik (Owner), cabang utama, dan default role dalam 1 transaksi atomic database.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeName
 *               - storeSlug
 *               - ownerName
 *               - email
 *               - password
 *             properties:
 *               storeName:
 *                 type: string
 *                 example: Kopi Senja
 *                 description: Nama bisnis / brand toko
 *               storeSlug:
 *                 type: string
 *                 example: kopi-senja
 *                 description: Slug unik subdomain/URL toko (hanya huruf, angka, dan dash)
 *               ownerName:
 *                 type: string
 *                 example: Kevin
 *                 description: Nama lengkap akun pemilik pertama
 *               email:
 *                 type: string
 *                 format: email
 *                 example: owner@kopisenja.com
 *                 description: Alamat email login akun pemilik
 *               password:
 *                 type: string
 *                 format: password
 *                 example: rahasia123password
 *                 description: Kata sandi akun (minimal 8 karakter)
 *     responses:
 *       201:
 *         description: Registrasi berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Registrasi toko dan akun pemilik berhasil
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: 550e8400-e29b-41d4-a716-446655440000
 *                         name:
 *                           type: string
 *                           example: Kopi Senja
 *                         slug:
 *                           type: string
 *                           example: kopi-senja
 *                         plan:
 *                           type: string
 *                           example: FREE
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: 710e8400-e29b-41d4-a716-446655440111
 *                         name:
 *                           type: string
 *                           example: Kevin
 *                         email:
 *                           type: string
 *                           example: owner@kopisenja.com
 *                         isOwner:
 *                           type: boolean
 *                           example: true
 *                     branch:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: 810e8400-e29b-41d4-a716-446655440222
 *                         name:
 *                           type: string
 *                           example: Cabang Utama
 *       400:
 *         description: Parameter input tidak lengkap
 *       409:
 *         description: Slug toko sudah digunakan oleh tenant lain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Slug toko sudah digunakan
 */
router.post('/register', register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login Pengguna berdasarkan Store Slug & Kredensial
 *     description: Autentikasi pengguna pada tenant toko tertentu. Mendukung pemeriksaan restriksi platform Web vs Mobile POS untuk paket langganan FREE.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeSlug
 *               - email
 *               - password
 *             properties:
 *               storeSlug:
 *                 type: string
 *                 example: kopi-senja
 *                 description: Slug unik tenant toko
 *               email:
 *                 type: string
 *                 format: email
 *                 example: owner@kopisenja.com
 *                 description: Alamat email pengguna
 *               password:
 *                 type: string
 *                 format: password
 *                 example: rahasia123password
 *                 description: Kata sandi pengguna
 *               clientType:
 *                 type: string
 *                 enum: [web, mobile]
 *                 default: web
 *                 description: Tipe aplikasi klien yang mengakses ("web" | "mobile")
 *     responses:
 *       200:
 *         description: Login berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login berhasil
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         slug:
 *                           type: string
 *                         plan:
 *                           type: string
 *                         planStatus:
 *                           type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         isOwner:
 *                           type: boolean
 *                         role:
 *                           type: string
 *                     activeBranch:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         isMain:
 *                           type: boolean
 *       400:
 *         description: Input tidak lengkap
 *       401:
 *         description: Kredensial tidak valid
 *       403:
 *         description: Restriksi akses paket (FREE dilarang via Web) atau akun non-aktif
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: PLAN_RESTRICTED
 *                 message:
 *                   type: string
 *                   example: Paket FREE hanya dapat diakses melalui Aplikasi Mobile POS. Silakan upgrade ke paket PLUS untuk membuka akses Web Dashboard.
 *       404:
 *         description: Toko tidak ditemukan
 */
router.post('/login', login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Mendapatkan Profil Pengguna Saat Ini (Protected)
 *     description: Mengembalikan data detail user, status tenant toko, role RBAC, dan cabang yang dapat diakses oleh user yang sedang login.
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profil berhasil diambil
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         isOwner:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         slug:
 *                           type: string
 *                         plan:
 *                           type: string
 *                         planStatus:
 *                           type: string
 *                     role:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                     activeBranchId:
 *                       type: string
 *                     branches:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           isMain:
 *                             type: boolean
 *       401:
 *         description: Token otentikasi tidak ditemukan atau tidak valid
 *       403:
 *         description: Akun pengguna dinonaktifkan
 */
router.get('/me', authenticate, getMe);

/**
 * @openapi
 * /api/auth/store-settings:
 *   put:
 *     summary: Memperbarui Pengaturan / Nama Toko (Protected)
 *     description: Mengubah nama bisnis atau pengaturan profil toko milik tenant yang sedang aktif.
 *     tags:
 *       - Auth
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
 *                 example: Toko Berkah Jaya
 *                 description: Nama baru untuk toko
 *     responses:
 *       200:
 *         description: Pengaturan toko berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Pengaturan toko berhasil diperbarui.
 *                 data:
 *                   type: object
 *                   properties:
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         slug:
 *                           type: string
 *                         plan:
 *                           type: string
 *                         planStatus:
 *                           type: string
 *                         billingCycle:
 *                           type: string
 *                         subscriptionExpiresAt:
 *                           type: string
 *                         proJoinedAt:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                         updatedAt:
 *                           type: string
 *       400:
 *         description: Nama toko wajib diisi
 *       401:
 *         description: Tidak terautentikasi
 */
router.put(
  '/store-settings',
  authenticate,
  requirePermission('settings:manage'),
  updateStoreSettings
);

/**
 * @openapi
 * /api/auth/switch-branch:
 *   post:
 *     summary: Berpindah cabang aktif operasional toko (Protected)
 *     description: Mengganti cabang aktif dan menerbitkan token JWT baru dengan activeBranchId yang diperbarui.
 *     tags:
 *       - Auth
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
 *         description: Pengguna tidak memiliki izin penugasan ke cabang ini
 *       404:
 *         description: Cabang tidak ditemukan
 */
router.post(
  '/switch-branch',
  authenticate,
  switchBranch
);

export default router;
