import { Router } from 'express';
import healthRoute from './health.route.js';
import authRoute from './auth.route.js';
import subscriptionRoute from './subscription.route.js';
import roleRoute from './role.route.js';
import userRoute from './user.route.js';
import branchRoute from './branch.route.js';
import categoryRoute from './category.route.js';
import modifierRoute from './modifier.route.js';
import productRoute from './product.route.js';
import shiftRoute from './shift.route.js';
import orderRoute from './order.route.js';
import supplierRoute from './supplier.route.js';
import purchaseOrderRoute from './purchaseOrder.route.js';
import opnameRoute from './opname.route.js';
import expenseRoute from './expense.route.js';
import reportRoute from './report.route.js';
import businessConfigRoute from './businessConfig.route.js';
import customerRoute from './customer.route.js';
import transferRoute from './transfer.route.js';
import receiptSettingRoute from './receiptSetting.route.js';

const router = Router();

/**
 * Registrasi seluruh sub-router aplikasi
 */
router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/subscriptions', subscriptionRoute);
router.use('/roles', roleRoute);
router.use('/users', userRoute);
router.use('/branches', branchRoute);
router.use('/categories', categoryRoute);
router.use('/modifiers', modifierRoute);
router.use('/products', productRoute);
router.use('/shifts', shiftRoute);
router.use('/orders', orderRoute);
router.use('/suppliers', supplierRoute);
router.use('/purchase-orders', purchaseOrderRoute);
router.use('/opnames', opnameRoute);
router.use('/inventory/opname', opnameRoute);
router.use('/expenses', expenseRoute);
router.use('/reports', reportRoute);
router.use('/business-config', businessConfigRoute);
router.use('/customers', customerRoute);
router.use('/transfers', transferRoute);
router.use('/receipt-settings', receiptSettingRoute);

export default router;
