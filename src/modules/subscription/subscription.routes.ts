import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { SubscriptionController } from './subscription.controller.js';

const router = Router();

// All subscription routes require authentication
router.use(requireAuth);

/**
 * @swagger
 * /api/v1/subscription:
 *   get:
 *     summary: Mendapatkan informasi langganan dan entitlement toko
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 */
router.get('/', SubscriptionController.getSubscription);

/**
 * @swagger
 * /api/v1/subscription/upgrade:
 *   post:
 *     summary: Mengubah paket langganan toko (Simulasi/Admin)
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 */
router.post('/upgrade', SubscriptionController.updatePlan);

export default router;
