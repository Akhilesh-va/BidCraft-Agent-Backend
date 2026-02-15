import { Request, Response } from 'express';
import { extractText } from '../utils/pdfParser';
import { extractSRS } from '../utils/aiAgents';

export const uploadSRSAndExtract = async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'PDF required' });
    const rawText = await extractText(file.buffer);
    const srs = await extractSRS(rawText);
    return res.json({ ok: true, srs });
  } catch (err: any) {
    console.error('SRS extraction failed', err);
    return res.status(500).json({ error: 'SRS extraction failed', details: err.message || String(err) });
  }
};

