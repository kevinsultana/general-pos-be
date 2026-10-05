import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { initialUpload, pushSync, pullSync } from '../controllers/sync.controller.js';

const router = Router();

// Semua rute sinkronisasi cloud dilindungi dengan token autentikasi toko
router.use(authenticate);

router.post('/initial-upload', initialUpload);
router.post('/push', pushSync);
router.get('/pull', pullSync);

export default router;
