import { Router } from 'express';
import {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
} from '../controllers/promotion.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Promotions
 *   description: Manajemen promo & diskon toko
 */

/**
 * @openapi
 * /api/promotions:
 *   get:
 *     summary: Mendapatkan daftar semua promo toko
 *     description: |
 *       Mengambil seluruh promo pada tenant aktif. Gunakan query `?activeOnly=true` untuk hanya mendapatkan promo yang sedang aktif (digunakan oleh POS saat kasir memilih promo di keranjang).
 *     tags:
 *       - Promotions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *           example: true
 *         description: Jika true, hanya mengembalikan promo yang sedang aktif dan belum kedaluwarsa
 *     responses:
 *       200:
 *         description: Daftar promo berhasil dimuat
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
 *                     $ref: '#/components/schemas/Promotion'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Membuat promo baru
 *     description: |
 *       Mendaftarkan promo baru. Mendukung dua jenis diskon:
 *       - **PERCENTAGE** — Diskon persen dari subtotal (contoh: 10%)
 *       - **FIXED** — Diskon nominal tetap (contoh: Rp 5.000)
 *
 *       Scope promo bisa untuk **ORDER** (seluruh transaksi) atau **PRODUCT** (produk/varian tertentu saja).
 *     tags:
 *       - Promotions
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
 *               - discountType
 *               - discountValue
 *             properties:
 *               name:
 *                 type: string
 *                 example: Promo Hari Kemerdekaan
 *               code:
 *                 type: string
 *                 example: MERDEKA17
 *                 description: Kode promo (opsional, jika kosong promo bisa dipilih tanpa kode)
 *               description:
 *                 type: string
 *                 example: Diskon 17% untuk semua menu
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED]
 *                 example: PERCENTAGE
 *               discountValue:
 *                 type: number
 *                 example: 17
 *                 description: Nilai diskon (persen atau nominal tergantung discountType)
 *               maxDiscount:
 *                 type: number
 *                 example: 50000
 *                 description: Batas maksimal diskon dalam Rupiah (hanya untuk PERCENTAGE)
 *               minPurchase:
 *                 type: number
 *                 example: 50000
 *                 description: Minimum pembelian untuk promo berlaku
 *               scope:
 *                 type: string
 *                 enum: [ORDER, PRODUCT]
 *                 example: ORDER
 *               scopeVariantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["uuid-variant-1", "uuid-variant-2"]
 *                 description: Daftar UUID varian yang masuk scope promo (wajib jika scope=PRODUCT)
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-17T00:00:00.000Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-17T23:59:59.000Z"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Promo berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Promotion'
 *       400:
 *         description: Validasi gagal atau kode promo sudah digunakan
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', authenticate, requirePermission('inventory:view'), getPromotions);
router.post('/', authenticate, requirePermission('inventory:manage'), createPromotion);

/**
 * @openapi
 * /api/promotions/{id}:
 *   get:
 *     summary: Mendapatkan detail satu promo
 *     description: Mengambil detail promo termasuk konfigurasi diskon, scope produk, dan jadwal berlaku.
 *     tags:
 *       - Promotions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID promo
 *         schema:
 *           type: string
 *           example: uuid-promo-abc
 *     responses:
 *       200:
 *         description: Detail promo berhasil dimuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Promotion'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Memperbarui promo
 *     description: Mengubah seluruh konfigurasi promo. Semua field bersifat opsional — hanya field yang dikirim yang akan diperbarui.
 *     tags:
 *       - Promotions
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
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED]
 *               discountValue:
 *                 type: number
 *               maxDiscount:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Promo berhasil diperbarui
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Menghapus promo
 *     description: Menghapus promo secara permanen. Promo yang sedang digunakan dalam transaksi aktif tidak disarankan untuk dihapus.
 *     tags:
 *       - Promotions
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
 *         description: Promo berhasil dihapus
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authenticate, requirePermission('inventory:view'), getPromotionById);
router.put('/:id', authenticate, requirePermission('inventory:manage'), updatePromotion);
router.delete('/:id', authenticate, requirePermission('inventory:manage'), deletePromotion);

/**
 * @openapi
 * /api/promotions/{id}/toggle:
 *   patch:
 *     summary: Mengaktifkan / menonaktifkan promo
 *     description: Toggle status aktif promo tanpa mengubah konfigurasi lainnya. Berguna untuk cepat mematikan/menghidupkan promo sementara.
 *     tags:
 *       - Promotions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID promo
 *         schema:
 *           type: string
 *           example: uuid-promo-abc
 *     responses:
 *       200:
 *         description: Status promo berhasil diubah
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
 *                   example: Promo berhasil dinonaktifkan
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                       example: false
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/toggle', authenticate, requirePermission('inventory:manage'), togglePromotion);

export default router;
