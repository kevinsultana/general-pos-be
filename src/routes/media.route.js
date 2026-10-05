import { Router } from 'express';
import { getMediaList, deleteMedia } from '../controllers/media.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

router.get('/', authenticate, requirePermission('settings:view'), getMediaList);
router.delete('/', authenticate, requirePermission('settings:manage'), deleteMedia);

export default router;
