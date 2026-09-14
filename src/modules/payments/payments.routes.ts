import { Router } from 'express';
import { PaymentsController } from './payments.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createPaymentMethodSchema, updatePaymentMethodSchema } from './payments.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('view_sales'), PaymentsController.getPaymentMethods);
router.post('/', requirePermission('manage_store'), validateBody(createPaymentMethodSchema), PaymentsController.createPaymentMethod);
router.patch('/:id', requirePermission('manage_store'), validateBody(updatePaymentMethodSchema), PaymentsController.updatePaymentMethod);

export default router;
