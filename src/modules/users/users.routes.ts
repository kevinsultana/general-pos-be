import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createUserSchema, updateUserSchema } from './users.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('view_users'), UsersController.getUsers);
router.get('/:id', requirePermission('view_users'), UsersController.getUserById);
router.post('/', requirePermission('manage_users'), validateBody(createUserSchema), UsersController.createUser);
router.patch('/:id', requirePermission('manage_users'), validateBody(updateUserSchema), UsersController.updateUser);

export default router;
