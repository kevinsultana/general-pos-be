import { Router } from 'express';
import { PromotionsController } from './promotions.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createPromotionSchema,
  updatePromotionSchema,
  validatePromoCodeSchema,
} from './promotions.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('view_promotions'), PromotionsController.getPromotions);
router.get('/:id', requirePermission('view_promotions'), PromotionsController.getPromotionById);
router.post('/', requirePermission('manage_promotions'), validateBody(createPromotionSchema), PromotionsController.createPromotion);
router.patch('/:id', requirePermission('manage_promotions'), validateBody(updatePromotionSchema), PromotionsController.updatePromotion);
router.post('/validate', requirePermission('create_transaction'), validateBody(validatePromoCodeSchema), PromotionsController.validatePromoCode);

export default router;
