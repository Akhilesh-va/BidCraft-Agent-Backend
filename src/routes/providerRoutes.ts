import express from 'express';
import { onboard } from '../controllers/providerController';
import { protect } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';
import { uploadProfileAndSave, updateProfile, getProfile } from '../controllers/providerProfileController';

const router = express.Router();

// multer types can conflict with express type versions — cast to any for route wiring
router.post('/onboard', protect, (upload as any).single('file'), onboard);

// Upload company profile PDF, extract with Groq, save structured profile to user
router.post('/profile/upload', protect, (upload as any).single('file'), uploadProfileAndSave);

// Update profile JSON manually from frontend (profile editing)
router.put('/profile', protect, updateProfile);
// Get stored profile for current user
router.get('/profile', protect, getProfile);

export default router;

