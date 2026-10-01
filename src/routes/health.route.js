import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Pengecekan status kesehatan server & koneksi database
 *     description: Mengembalikan uptime proses server, timestamp ISO terkini, dan status konektivitas ke database PostgreSQL melalui Prisma.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Layanan server berjalan dengan normal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: number
 *                   description: Waktu aktif server dalam detik
 *                   example: 12.3456
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-10-01T15:30:00.000Z"
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [connected, disconnected]
 *                       example: connected
 */
router.get('/', getHealth);

export default router;
