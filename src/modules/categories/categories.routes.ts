import { Router } from 'express';
import { CategoriesController } from './categories.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createCategorySchema, updateCategorySchema } from './categories.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('view_products'), CategoriesController.getCategories);
router.get('/:id', requirePermission('view_products'), CategoriesController.getCategoryById);
router.post('/', requirePermission('manage_categories'), validateBody(createCategorySchema), CategoriesController.createCategory);
router.patch('/:id', requirePermission('manage_categories'), validateBody(updateCategorySchema), CategoriesController.updateCategory);
router.delete('/:id', requirePermission('manage_categories'), CategoriesController.deleteCategory);

export default router;
