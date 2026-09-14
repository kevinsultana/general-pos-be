import { Router } from 'express';
import { PrintersController } from './printers.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createPrinterSchema, updatePrinterSchema } from './printers.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('view_store'), PrintersController.getPrinters);
router.get('/:id', requirePermission('view_store'), PrintersController.getPrinterById);
router.post('/', requirePermission('manage_printers'), validateBody(createPrinterSchema), PrintersController.createPrinter);
router.patch('/:id', requirePermission('manage_printers'), validateBody(updatePrinterSchema), PrintersController.updatePrinter);
router.delete('/:id', requirePermission('manage_printers'), PrintersController.deletePrinter);

export default router;
