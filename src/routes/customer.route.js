import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

// Seluruh rute customer membutuhkan autentikasi
router.use(authenticate);

// List & Detail Pelanggan
router.get('/', requirePermission('customers:view'), getCustomers);
router.get('/:id', requirePermission('customers:view'), getCustomerById);

// Tambah, Edit, Hapus Pelanggan
router.post('/', requirePermission('customers:manage'), createCustomer);
router.put('/:id', requirePermission('customers:manage'), updateCustomer);
router.delete('/:id', requirePermission('customers:manage'), deleteCustomer);

export default router;
