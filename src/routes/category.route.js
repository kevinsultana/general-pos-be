import { Router } from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

router.get('/', authenticate, requirePermission('inventory:view'), getCategories);
router.post('/', authenticate, requirePermission('inventory:manage'), createCategory);
router.put('/:id', authenticate, requirePermission('inventory:manage'), updateCategory);
router.delete('/:id', authenticate, requirePermission('inventory:manage'), deleteCategory);

export default router;
