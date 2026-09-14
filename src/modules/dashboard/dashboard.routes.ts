import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePlan } from '../../middlewares/entitlement.middleware.js';
import { DashboardController } from './dashboard.controller.js';

const router = Router();

// All dashboard endpoints require Auth and PRO plan
router.use(requireAuth);
router.use(requirePlan('PRO'));

/**
 * @swagger
 * /api/v1/dashboard/summary:
 *   get:
 *     summary: Mendapatkan ringkasan KPI, omzet, laba, dan transaksi untuk Web Dashboard (Khusus PRO)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 */
router.get('/summary', DashboardController.getSummary);

export default router;
