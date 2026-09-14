import { Router } from 'express';
import { TransactionsController } from './transactions.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { completeTransactionSchema, cancelTransactionSchema } from './transactions.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('view_sales'), TransactionsController.getTransactions);
router.get('/:id', requirePermission('view_sales'), TransactionsController.getTransactionById);
router.post('/', requirePermission('create_transaction'), validateBody(completeTransactionSchema), TransactionsController.completeTransaction);
router.post('/:id/cancel', requirePermission('cancel_transaction'), validateBody(cancelTransactionSchema), TransactionsController.cancelTransaction);

export default router;
