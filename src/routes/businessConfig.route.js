import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  getBusinessPresets,
  updateBusinessConfig,
} from '../controllers/businessConfig.controller.js';

const router = Router();

/**
 * @openapi
 * /api/business-config/presets:
 *   get:
 *     summary: Mendapatkan 6 preset model bisnis standar beserta feature flags
 *     tags:
 *       - Business Configuration & Onboarding
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar preset bisnis
 */
router.get('/presets', authenticate, getBusinessPresets);

/**
 * @openapi
 * /api/business-config:
 *   put:
 *     summary: Memperbarui preset dan feature flags konfigurasi bisnis tenant
 *     tags:
 *       - Business Configuration & Onboarding
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessPreset:
 *                 type: string
 *                 enum: [FNB, RETAIL, SERVICE, BOOKING, PHARMACY, CUSTOM]
 *               businessConfig:
 *                 type: object
 *               isOnboardingCompleted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Konfigurasi berhasil disimpan
 */
router.put('/', authenticate, requirePermission('settings:manage'), updateBusinessConfig);

export default router;
