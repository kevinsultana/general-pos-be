import { Router } from 'express';
import { RolesController } from './roles.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createRoleSchema, updateRoleSchema } from './roles.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/permissions', RolesController.getPermissions);
router.get('/', requirePermission('manage_roles'), RolesController.getRoles);
router.get('/:id', requirePermission('manage_roles'), RolesController.getRoleById);
router.post('/', requirePermission('manage_roles'), validateBody(createRoleSchema), RolesController.createRole);
router.patch('/:id', requirePermission('manage_roles'), validateBody(updateRoleSchema), RolesController.updateRole);
router.delete('/:id', requirePermission('manage_roles'), RolesController.deleteRole);

export default router;
