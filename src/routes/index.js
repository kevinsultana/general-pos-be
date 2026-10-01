import { Router } from 'express';
import healthRoute from './health.route.js';
import authRoute from './auth.route.js';
import subscriptionRoute from './subscription.route.js';

const router = Router();

/**
 * Registrasi seluruh sub-router aplikasi
 */
router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/subscriptions', subscriptionRoute);

export default router;
