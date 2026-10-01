import { Router } from 'express';
import healthRoute from './health.route.js';

const router = Router();

/**
 * Registrasi seluruh sub-router aplikasi
 */
router.use('/health', healthRoute);

export default router;
