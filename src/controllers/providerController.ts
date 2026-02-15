import { Request, Response } from 'express';
import { extractText, parseProviderProfile } from '../utils/pdfParser';
import User from '../models/User';

export const onboard = async (req: Request & { user?: any }, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'PDF required' });
    const text = await extractText(file.buffer);
    const parsed = parseProviderProfile(text);
    const user = req.user;
    if (parsed.companyName) user.companyName = parsed.companyName;
    if (parsed.techStack && parsed.techStack.length) user.techStack = parsed.techStack;
    if (parsed.baseRate) user.baseRate = parsed.baseRate;
    await user.save();
    return res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Onboarding failed' });
  }
};

