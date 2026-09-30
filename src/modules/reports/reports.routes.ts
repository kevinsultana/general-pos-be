import { Router } from 'express';
import { ReportsController } from './reports.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('view_reports'));

/**
 * @swagger
 * /api/v1/reports/sales:
 *   get:
 *     summary: Mendapatkan laporan ringkasan omzet, HPP, diskon, refund, dan metode bayar
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 */
router.get('/sales', ReportsController.getSalesReport);

/**
 * @swagger
 * /api/v1/reports/products:
 *   get:
 *     summary: Mendapatkan laporan performa penjualan produk dan margin kotor
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 */
router.get('/products', ReportsController.getProductReport);

/**
 * @swagger
 * /api/v1/reports/inventory:
 *   get:
 *     summary: Mendapatkan laporan valuasi stok, stok menipis, dan stok negatif
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 */
router.get('/inventory', ReportsController.getInventoryReport);

export default router;
