import { Router } from 'express';
import {
  getActiveShift,
  openShift,
  closeShift,
  getShifts,
} from '../controllers/shift.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Shifts
 *   description: Manajemen shift kasir (buka & tutup sesi operasional)
 */

/**
 * @openapi
 * /api/shifts/active:
 *   get:
 *     summary: Mendapatkan shift kasir yang sedang aktif
 *     description: Mengambil data shift yang sedang berjalan pada cabang aktif user. Mengembalikan null/404 jika belum ada shift yang dibuka hari ini.
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Shift aktif ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Shift'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tidak ada shift aktif saat ini
 */
router.get('/active', authenticate, requirePermission('pos:shift'), getActiveShift);

/**
 * @openapi
 * /api/shifts:
 *   get:
 *     summary: Mendapatkan riwayat semua shift
 *     description: Mengambil daftar semua shift (aktif maupun sudah ditutup) pada cabang aktif. Berguna untuk laporan rekap harian kasir.
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Halaman data (pagination)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *         description: Jumlah data per halaman
 *     responses:
 *       200:
 *         description: Riwayat shift berhasil dimuat
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
 *                     $ref: '#/components/schemas/Shift'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Membuka shift kasir baru
 *     description: Memulai sesi shift kasir baru pada cabang aktif. Satu cabang hanya boleh memiliki satu shift aktif dalam satu waktu.
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startingCash:
 *                 type: number
 *                 example: 500000
 *                 description: Modal awal uang tunai di laci kasir (Rp). Boleh 0.
 *     responses:
 *       201:
 *         description: Shift berhasil dibuka
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
 *                   example: Shift berhasil dibuka
 *                 data:
 *                   $ref: '#/components/schemas/Shift'
 *       400:
 *         description: Sudah ada shift aktif yang belum ditutup
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', authenticate, requirePermission('pos:shift'), getShifts);
router.post('/', authenticate, requirePermission('pos:shift'), openShift);

/**
 * @openapi
 * /api/shifts/{id}/close:
 *   put:
 *     summary: Menutup shift kasir
 *     description: Mengakhiri sesi shift yang sedang berjalan, menghitung rekap penjualan (total transaksi, total tunai, QRIS, transfer), dan menyimpan selisih uang laci. Menghasilkan data Z-Report untuk ditampilkan ke kasir.
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID shift yang ingin ditutup
 *         schema:
 *           type: string
 *           example: uuid-shift-abc123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endingCash:
 *                 type: number
 *                 example: 1250000
 *                 description: Jumlah uang tunai aktual di laci kasir saat tutup shift (Rp)
 *     responses:
 *       200:
 *         description: Shift berhasil ditutup beserta data rekap
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
 *                   example: Shift berhasil ditutup
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Shift'
 *                     - type: object
 *                       properties:
 *                         totalTransactions:
 *                           type: integer
 *                           example: 42
 *                         totalRevenue:
 *                           type: number
 *                           example: 2850000
 *                         totalCash:
 *                           type: number
 *                           example: 1850000
 *                         totalQris:
 *                           type: number
 *                           example: 700000
 *                         totalTransfer:
 *                           type: number
 *                           example: 300000
 *                         cashDifference:
 *                           type: number
 *                           example: 0
 *                           description: Selisih antara uang tunai yang diharapkan vs aktual
 *       400:
 *         description: Shift tidak ditemukan atau bukan milik user ini
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/close', authenticate, requirePermission('pos:shift'), closeShift);

export default router;
