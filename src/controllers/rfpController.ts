import { Request, Response } from 'express';
import { extractText, parseRFP } from '../utils/pdfParser';
import RFP from '../models/RFP';

export const uploadRFP = async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'PDF required' });
    const text = await extractText(file.buffer);
    // Return raw extracted text in JSON so frontend / AI can process it.
    return res.json({ rawText: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'RFP upload failed' });
  }
};

