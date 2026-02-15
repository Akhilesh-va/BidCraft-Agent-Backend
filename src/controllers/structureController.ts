import { Request, Response } from 'express';
import { extractCompanyProfile } from '../utils/aiAgents';

export const structureFromRaw = async (req: Request, res: Response) => {
  try {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: 'rawText required' });
    const profile = await extractCompanyProfile(rawText);
    return res.json({ ok: true, profile });
  } catch (err) {
    console.error('Structure extraction failed', err);
    // Return error message/details in development to help debugging
    const message = (err as any)?.message || String(err);
    return res.status(500).json({ error: 'Structure extraction failed', details: message });
  }
};

