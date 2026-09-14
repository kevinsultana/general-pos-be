import { Router } from 'express';
import { CustomersController } from './customers.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createCustomerSchema, updateCustomerSchema } from './customers.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('manage_customers'), CustomersController.getCustomers);
router.get('/:id', requirePermission('manage_customers'), CustomersController.getCustomerById);
router.post('/', requirePermission('manage_customers'), validateBody(createCustomerSchema), CustomersController.createCustomer);
router.patch('/:id', requirePermission('manage_customers'), validateBody(updateCustomerSchema), CustomersController.updateCustomer);
router.delete('/:id', requirePermission('manage_customers'), CustomersController.deleteCustomer);

export default router;
