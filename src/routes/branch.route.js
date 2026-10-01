import { Router } from 'express';
import { getBranches } from '../controllers/branch.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @openapi
 * /api/branches:
 *   get:
 *     summary: Mendapatkan daftar cabang toko aktif
 *     tags:
 *       - Branches
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar cabang
 */
router.get('/', authenticate, getBranches);

export default router;
