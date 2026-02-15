import express from 'express';
import { onboard } from '../controllers/providerController';
import { protect } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

// multer types can conflict with express type versions — cast to any for route wiring
router.post('/onboard', protect, (upload as any).single('file'), onboard);

export default router;

