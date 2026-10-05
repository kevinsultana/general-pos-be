import { Router } from 'express';
import healthRoute from './health.route.js';
import authRoute from './auth.route.js';
import subscriptionRoute from './subscription.route.js';
import roleRoute from './role.route.js';
import userRoute from './user.route.js';
import branchRoute from './branch.route.js';
import productRoute from './product.route.js';
import categoryRoute from './category.route.js';
import shiftRoute from './shift.route.js';
import transactionRoute from './transaction.route.js';
import customerRoute from './customer.route.js';
import publicRoute from './public.route.js';
import orderRoute from './order.route.js';
import promotionRoute from './promotion.route.js';
import mediaRoute from './media.route.js';

const router = Router();

router.use('/public', publicRoute);
router.use('/orders', orderRoute);
router.use('/media', mediaRoute);
router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/subscriptions', subscriptionRoute);
router.use('/roles', roleRoute);
router.use('/users', userRoute);
router.use('/branches', branchRoute);

// POS MVP Routes
router.use('/products', productRoute);
router.use('/categories', categoryRoute);
router.use('/shifts', shiftRoute);
router.use('/transactions', transactionRoute);
router.use('/customers', customerRoute);
router.use('/promotions', promotionRoute);

export default router;
