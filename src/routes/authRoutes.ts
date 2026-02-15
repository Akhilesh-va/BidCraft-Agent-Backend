import express from 'express';
import { verifyToken } from '../controllers/authController';
import { createDevIdToken } from '../controllers/devAuthController';
import { debugVerifyToken } from '../controllers/authController';

const router = express.Router();

// Verify Firebase ID token and return/create user (no local JWT)
router.post('/verify-token', verifyToken);
// Dev helper: create an ID token (requires ENABLE_DEV_AUTH=true and FIREBASE_WEB_API_KEY)
router.post('/dev-token', createDevIdToken);
// Dev-only detailed verification diagnostics
router.post('/debug-verify', debugVerifyToken);

export default router;

