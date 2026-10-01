import { Router } from 'express';
import healthRoute from './health.route.js';
import authRoute from './auth.route.js';
import subscriptionRoute from './subscription.route.js';
import roleRoute from './role.route.js';
import userRoute from './user.route.js';
import branchRoute from './branch.route.js';

const router = Router();

/**
 * Registrasi seluruh sub-router aplikasi
 */
router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/subscriptions', subscriptionRoute);
router.use('/roles', roleRoute);
router.use('/users', userRoute);
router.use('/branches', branchRoute);

export default router;
