import express from 'express';
import { uploadAndExtract } from '../controllers/parseController';
import { upload } from '../middleware/uploadMiddleware';
import { structureFromRaw } from '../controllers/structureController';
import { testGroq } from '../controllers/groqController';
import { uploadSRSAndExtract } from '../controllers/srsController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Public parse endpoint for any PDF (RFP, provider profile, etc.)
router.post('/upload', (upload as any).single('file'), uploadAndExtract);

// Convert raw extracted text into structured company profile JSON
router.post('/structure', structureFromRaw);
// Quick test endpoint to validate Groq SDK/key
router.get('/test-groq', testGroq);
// Upload SRS PDF and return structured SRS JSON (strict)
router.post('/srs/upload/overview', protect, (upload as any).single('file'), uploadSRSAndExtract);

export default router;

