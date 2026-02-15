import { Request, Response } from 'express';
import RFP from '../models/RFP';
import User from '../models/User';
import { analyzeRequirements, architectSolution, calculatePricing, draftProposal } from '../utils/aiAgents';

export const runAgents = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { rfpId, strategy } = req.body;
    if (!rfpId) return res.status(400).json({ error: 'rfpId required' });
    const rfp = await RFP.findById(rfpId);
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });
    const provider = await User.findById(req.user._id);

    const analysis = await analyzeRequirements(rfp);
    const solution = await architectSolution(analysis, provider);
    const pricing = await calculatePricing(solution, provider, rfp);
    const proposal = await draftProposal(analysis, solution, pricing, rfp, provider, strategy);

    rfp.generatedProposal = proposal;
    rfp.status = 'Completed';
    await rfp.save();

    return res.json({ ok: true, proposal });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Agent run failed' });
  }
};

export const dashboardStats = async (req: Request, res: Response) => {
  try {
    const totalBids = await RFP.countDocuments();
    const pendingApprovals = await RFP.countDocuments({ status: 'Processing' });
    const recent = await RFP.find().sort({ createdAt: -1 }).limit(10);
    return res.json({ totalBids, pendingApprovals, recent });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

