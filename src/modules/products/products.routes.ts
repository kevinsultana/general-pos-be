import { Router } from 'express';
import { ProductsController } from './products.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createProductSchema, updateProductSchema } from './products.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('view_products'), ProductsController.getProducts);
router.get('/:id', requirePermission('view_products'), ProductsController.getProductById);
router.post('/', requirePermission('manage_products'), validateBody(createProductSchema), ProductsController.createProduct);
router.patch('/:id', requirePermission('manage_products'), validateBody(updateProductSchema), ProductsController.updateProduct);
router.put('/:id', requirePermission('manage_products'), validateBody(updateProductSchema), ProductsController.updateProduct);
router.delete('/:id', requirePermission('manage_products'), ProductsController.deleteProduct);

export default router;
