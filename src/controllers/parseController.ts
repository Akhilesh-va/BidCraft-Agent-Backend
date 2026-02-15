import { Request, Response } from 'express';
import { extractText } from '../utils/pdfParser';

export const uploadAndExtract = async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'PDF required' });
    const text = await extractText(file.buffer);
    return res.json({
      ok: true,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      },
      rawText: text
    });
  } catch (err) {
    console.error('Parse upload failed', err);
    return res.status(500).json({ error: 'Parse upload failed' });
  }
};

