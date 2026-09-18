import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { loginSchema, refreshTokenSchema, registerStoreSchema } from './auth.schemas.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

router.post('/register-store', validateBody(registerStoreSchema), AuthController.registerStore);
router.post('/login', validateBody(loginSchema), AuthController.login);
router.post('/refresh', validateBody(refreshTokenSchema), AuthController.refresh);
router.get('/me', requireAuth, AuthController.me);
router.post('/logout', requireAuth, AuthController.logout);

export default router;
