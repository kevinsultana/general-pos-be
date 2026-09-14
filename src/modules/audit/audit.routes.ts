import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', requirePermission('view_audit_logs'), AuditController.getLogs);

export default router;
