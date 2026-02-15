import express from 'express';
import { runAgents, dashboardStats } from '../controllers/bidCraftController';
import { protect } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';
import { generateProposalFromOverview } from '../controllers/proposalController';
import { refineProposal } from '../controllers/proposalRefineController';

const router = express.Router();

router.post('/run', protect, runAgents);
router.get('/dashboard/stats', protect, dashboardStats);
// Generate enterprise RFP response from approved overview + optional SRS PDF (protected)
router.post('/generate-proposal', protect, (upload as any).single('file'), generateProposalFromOverview);
// Refine an existing proposal (protected)
router.post('/refine-proposal', protect, refineProposal);

export default router;

