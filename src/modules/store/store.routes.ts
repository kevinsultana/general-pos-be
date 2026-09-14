import { Router } from 'express';
import { StoreController } from './store.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { updateStoreSchema } from './store.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('view_store'), StoreController.getStore);
router.patch('/', requirePermission('manage_store'), validateBody(updateStoreSchema), StoreController.updateStore);

export default router;
