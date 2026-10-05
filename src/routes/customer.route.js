import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Customers
 *   description: Manajemen database pelanggan terdaftar
 */

// Seluruh rute customer membutuhkan autentikasi
router.use(authenticate);

/**
 * @openapi
 * /api/customers:
 *   get:
 *     summary: Mendapatkan daftar semua pelanggan terdaftar
 *     description: Mengambil seluruh data pelanggan pada tenant aktif. Mendukung pencarian berdasarkan nama atau nomor telepon via query parameter `search`.
 *     tags:
 *       - Customers
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: Budi
 *         description: Filter pencarian berdasarkan nama atau nomor HP pelanggan
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *     responses:
 *       200:
 *         description: Daftar pelanggan berhasil dimuat
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
 *                     $ref: '#/components/schemas/Customer'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     summary: Menambahkan pelanggan baru
 *     description: Mendaftarkan pelanggan baru ke database toko. Nomor HP harus unik per tenant.
 *     tags:
 *       - Customers
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
 *                 example: Budi Santoso
 *               phone:
 *                 type: string
 *                 example: "08123456789"
 *                 description: Nomor HP pelanggan (opsional, tapi unik jika diisi)
 *               email:
 *                 type: string
 *                 format: email
 *                 example: budi@gmail.com
 *               address:
 *                 type: string
 *                 example: Jl. Merdeka No. 1, Jakarta
 *               notes:
 *                 type: string
 *                 example: Pelanggan setia, suka kopi tanpa gula
 *     responses:
 *       201:
 *         description: Pelanggan berhasil ditambahkan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Nama pelanggan wajib diisi
 *       409:
 *         description: Nomor HP sudah terdaftar di toko ini
 */
router.get('/', requirePermission('customers:view'), getCustomers);
router.post('/', requirePermission('customers:manage'), createCustomer);

/**
 * @openapi
 * /api/customers/{id}:
 *   get:
 *     summary: Mendapatkan detail satu pelanggan
 *     description: Mengambil detail profil pelanggan beserta riwayat transaksi terakhirnya.
 *     tags:
 *       - Customers
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID pelanggan
 *         schema:
 *           type: string
 *           example: uuid-customer-xyz
 *     responses:
 *       200:
 *         description: Detail pelanggan berhasil dimuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Memperbarui data pelanggan
 *     description: Mengubah nama, nomor telepon, email, alamat, atau catatan pelanggan.
 *     tags:
 *       - Customers
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
 *                 example: Budi Santoso Jr.
 *               phone:
 *                 type: string
 *                 example: "08987654321"
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Data pelanggan berhasil diperbarui
 *       400:
 *         description: Validasi gagal
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Nomor HP sudah digunakan pelanggan lain
 *   delete:
 *     summary: Menghapus data pelanggan
 *     description: Menghapus data pelanggan secara permanen. Riwayat transaksi yang sudah ada tidak akan terhapus.
 *     tags:
 *       - Customers
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
 *         description: Pelanggan berhasil dihapus
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', requirePermission('customers:view'), getCustomerById);
router.put('/:id', requirePermission('customers:manage'), updateCustomer);
router.delete('/:id', requirePermission('customers:manage'), deleteCustomer);

export default router;
