import express from 'express';
import { uploadAndExtract } from '../controllers/parseController';
import { upload } from '../middleware/uploadMiddleware';
import { structureFromRaw } from '../controllers/structureController';
import { testGroq } from '../controllers/groqController';

const router = express.Router();

// Public parse endpoint for any PDF (RFP, provider profile, etc.)
router.post('/upload', (upload as any).single('file'), uploadAndExtract);

// Convert raw extracted text into structured company profile JSON
router.post('/structure', structureFromRaw);
// Quick test endpoint to validate Groq SDK/key
router.get('/test-groq', testGroq);

export default router;

