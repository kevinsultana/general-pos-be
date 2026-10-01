import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getExpenseCategories,
  createExpenseCategory,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expense.controller.js';

const router = Router();

/**
 * @openapi
 * /api/expenses/categories:
 *   get:
 *     summary: Mendapatkan daftar kategori beban pengeluaran
 *     tags:
 *       - Expenses
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar kategori biaya
 *   post:
 *     summary: Membuat kategori beban baru
 *     tags:
 *       - Expenses
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
 *                 example: Listrik & Utilitas
 *     responses:
 *       201:
 *         description: Kategori berhasil dibuat
 */
router.get('/categories', authenticate, requirePermission('reports:view'), getExpenseCategories);
router.post('/categories', authenticate, requirePermission('reports:view'), createExpenseCategory);

/**
 * @openapi
 * /api/expenses:
 *   get:
 *     summary: Mendapatkan riwayat pengeluaran biaya operasional
 *     tags:
 *       - Expenses
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Berhasil memuat data pengeluaran
 *   post:
 *     summary: Mencatat transaksi pengeluaran operasional baru
 *     tags:
 *       - Expenses
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryId
 *               - amount
 *             properties:
 *               categoryId:
 *                 type: string
 *               amount:
 *                 type: integer
 *                 example: 350000
 *               expenseDate:
 *                 type: string
 *                 format: date-time
 *               recipient:
 *                 type: string
 *                 example: Token Listrik PLN
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Pengeluaran berhasil dicatat
 */
router.get('/', authenticate, requirePermission('reports:view'), getExpenses);
router.post('/', authenticate, requirePermission('reports:view'), createExpense);

/**
 * @openapi
 * /api/expenses/{id}:
 *   put:
 *     summary: Memperbarui catatan pengeluaran
 *     tags:
 *       - Expenses
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
 *         description: Pengeluaran berhasil diperbarui
 *   delete:
 *     summary: Menghapus catatan pengeluaran
 *     tags:
 *       - Expenses
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
 *         description: Pengeluaran berhasil dihapus
 */
router.put('/:id', authenticate, requirePermission('reports:view'), updateExpense);
router.delete('/:id', authenticate, requirePermission('reports:view'), deleteExpense);

export default router;
