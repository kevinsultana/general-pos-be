import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createStockMovementSchema } from './inventory.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/stock-movements', requirePermission('view_inventory'), InventoryController.getStockMovements);
router.post('/stock-movements', requirePermission('manage_inventory'), validateBody(createStockMovementSchema), InventoryController.adjustStock);

export default router;
