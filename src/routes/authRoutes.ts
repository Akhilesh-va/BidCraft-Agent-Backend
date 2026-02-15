import express from 'express';
import { verifyToken } from '../controllers/authController';

const router = express.Router();

// Verify Firebase ID token and return/create user (no local JWT)
router.post('/verify-token', verifyToken);

export default router;

