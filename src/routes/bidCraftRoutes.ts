import express from 'express';
import { runAgents, dashboardStats } from '../controllers/bidCraftController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/run', protect, runAgents);
router.get('/dashboard/stats', protect, dashboardStats);

export default router;

