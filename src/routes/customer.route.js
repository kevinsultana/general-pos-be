import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerDebts,
  payCustomerDebt,
} from '../controllers/customer.controller.js';

const router = Router();

/**
 * @openapi
 * /api/customers:
 *   get:
 *     summary: Mendapatkan daftar pelanggan milik tenant
 *     tags:
 *       - Customers & Debt
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: hasDebt
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar pelanggan
 */
router.get('/', authenticate, getCustomers);

/**
 * @openapi
 * /api/customers:
 *   post:
 *     summary: Mendaftarkan pelanggan baru
 *     tags:
 *       - Customers & Debt
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
 *         description: Pelanggan berhasil ditambahkan
 */
router.post('/', authenticate, createCustomer);

/**
 * @openapi
 * /api/customers/{id}:
 *   put:
 *     summary: Memperbarui data pelanggan
 *     tags:
 *       - Customers & Debt
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
 *         description: Pelanggan berhasil diperbarui
 */
router.put('/:id', authenticate, updateCustomer);

/**
 * @openapi
 * /api/customers/{id}:
 *   delete:
 *     summary: Menghapus pelanggan (hanya jika saldo kasbon 0)
 *     tags:
 *       - Customers & Debt
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
 */
router.delete('/:id', authenticate, requirePermission('users:manage'), deleteCustomer);

/**
 * @openapi
 * /api/customers/{id}/debts:
 *   get:
 *     summary: Mendapatkan buku kasbon / tagihan piutang dan riwayat pembayaran pelanggan
 *     tags:
 *       - Customers & Debt
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
 *         description: Berhasil memuat buku kasbon
 */
router.get('/:id/debts', authenticate, getCustomerDebts);

/**
 * @openapi
 * /api/customers/{id}/pay-debt:
 *   post:
 *     summary: Mencatat pelunasan kasbon / piutang pelanggan
 *     tags:
 *       - Customers & Debt
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
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: integer
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, QRIS, TRANSFER, DEBIT]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pembayaran kasbon berhasil dicatat
 */
router.post('/:id/pay-debt', authenticate, requirePermission('pos:access'), payCustomerDebt);

export default router;
