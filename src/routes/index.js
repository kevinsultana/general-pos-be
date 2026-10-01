import { Router } from 'express';
import healthRoute from './health.route.js';
import authRoute from './auth.route.js';

const router = Router();

/**
 * Registrasi seluruh sub-router aplikasi
 */
router.use('/health', healthRoute);
router.use('/auth', authRoute);

export default router;
