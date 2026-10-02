import { Router } from 'express';
import {
  getActiveShift,
  openShift,
  closeShift,
  getShifts,
} from '../controllers/shift.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

/**
 * GET  /api/shifts/active   - Cek shift aktif saat ini
 * GET  /api/shifts          - Riwayat shift
 * POST /api/shifts          - Buka shift baru
 * PUT  /api/shifts/:id/close - Tutup shift
 */

router.get('/active', authenticate, requirePermission('pos:shift'), getActiveShift);
router.get('/', authenticate, requirePermission('pos:shift'), getShifts);
router.post('/', authenticate, requirePermission('pos:shift'), openShift);
router.put('/:id/close', authenticate, requirePermission('pos:shift'), closeShift);

export default router;
