import { Router } from 'express';
import { SyncController } from './sync.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireAnyPermission } from '../../middlewares/rbac.middleware.js';
import { requirePlan } from '../../middlewares/entitlement.middleware.js';

const router = Router();

router.use(requireAuth);
router.use(requirePlan('PAID'));

router.post('/push', requireAnyPermission(['sync_data', 'create_transaction']), SyncController.push);
router.get('/pull', requireAnyPermission(['sync_data', 'create_transaction']), SyncController.pull);
router.get('/status', requireAnyPermission(['sync_data', 'create_transaction']), SyncController.getStatus);

export default router;

