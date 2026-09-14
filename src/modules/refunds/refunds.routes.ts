import { Router } from 'express';
import { RefundsController } from './refunds.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createRefundSchema } from './refunds.schemas.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/:id/refunds', requirePermission('view_sales'), RefundsController.getRefunds);
router.post('/:id/refunds', requirePermission('refund_transaction'), validateBody(createRefundSchema), RefundsController.createRefund);

export default router;
