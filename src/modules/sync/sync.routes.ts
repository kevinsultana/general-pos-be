import { Router } from 'express';
import { SyncController } from './sync.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { requirePlan } from '../../middlewares/entitlement.middleware.js';

const router = Router();

router.use(requireAuth);
router.use(requirePlan('PAID'));

router.post('/push', requirePermission('sync_data'), SyncController.push);
router.get('/pull', requirePermission('sync_data'), SyncController.pull);

export default router;

