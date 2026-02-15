import express from 'express';
import { uploadRFP } from '../controllers/rfpController';
import { upload } from '../middleware/uploadMiddleware';

const router = express.Router();

// Public upload (no Authorization) - multer types can conflict with express type versions — cast to any for route wiring
router.post('/upload', (upload as any).single('file'), uploadRFP);

export default router;

