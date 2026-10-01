import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getFinancialSummary,
  getSalesChart,
  getTopProducts,
  exportReportData,
} from '../controllers/report.controller.js';

const router = Router();

/**
 * @openapi
 * /api/reports/summary:
 *   get:
 *     summary: Mendapatkan ringkasan metrik keuangan riil (Omzet, HPP, Laba Bersih, Pengeluaran)
 *     tags:
 *       - Reports & Analytics
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: Berhasil memuat ringkasan keuangan
 */
router.get('/summary', authenticate, requirePermission('reports:view'), getFinancialSummary);

/**
 * @openapi
 * /api/reports/sales-chart:
 *   get:
 *     summary: Mendapatkan data grafik tren penjualan harian
 *     tags:
 *       - Reports & Analytics
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: Berhasil memuat data tren grafik
 */
router.get('/sales-chart', authenticate, requirePermission('reports:view'), getSalesChart);

/**
 * @openapi
 * /api/reports/top-products:
 *   get:
 *     summary: Mendapatkan Top 5 produk terlaris berdasarkan kuantitas & omzet
 *     tags:
 *       - Reports & Analytics
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: Berhasil memuat top produk
 */
router.get('/top-products', authenticate, requirePermission('reports:view'), getTopProducts);

/**
 * @openapi
 * /api/reports/export:
 *   get:
 *     summary: Ekspor rekapan data transaksi pesanan siap CSV
 *     tags:
 *       - Reports & Analytics
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: Berhasil mengekspor data
 */
router.get('/export', authenticate, requirePermission('reports:export'), exportReportData);

export default router;
