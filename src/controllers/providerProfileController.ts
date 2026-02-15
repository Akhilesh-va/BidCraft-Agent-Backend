import { Request, Response } from 'express';
import { extractText } from '../utils/pdfParser';
import { extractCompanyProfile } from '../utils/aiAgents';

export const uploadProfileAndSave = async (req: Request & { user?: any }, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'PDF required' });
    const rawText = await extractText(file.buffer);
    const profile = await extractCompanyProfile(rawText);

    const user = req.user;
    // If user has email and profile doesn't include it, store email inside profile.company_identity.contact.email
    if (user?.email) {
      profile.company_identity = profile.company_identity || {};
      profile.company_identity.contact = profile.company_identity.contact || {};
      if (!profile.company_identity.contact.email) {
        profile.company_identity.contact.email = user.email;
      }
    }
    user.companyProfile = profile;
    if (profile?.company_identity?.name) user.companyName = profile.company_identity.name;
    await user.save();

    return res.json({ ok: true, profile, user });
  } catch (err: any) {
    console.error('Upload profile failed', err);
    return res.status(500).json({ error: 'Upload profile failed', details: err.message || String(err) });
  }
};

export const updateProfile = async (req: Request & { user?: any }, res: Response) => {
  try {
    const profile = req.body.profile;
    if (!profile) return res.status(400).json({ error: 'profile required in body' });
    const user = req.user;
    user.companyProfile = profile;
    if (profile?.company_identity?.name) user.companyName = profile.company_identity.name;
    await user.save();
    return res.json({ ok: true, profile, user });
  } catch (err: any) {
    console.error('Update profile failed', err);
    return res.status(500).json({ error: 'Update profile failed', details: err.message || String(err) });
  }
};

export const getProfile = async (req: Request & { user?: any }, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ ok: true, profile: user.companyProfile || null, user });
  } catch (err: any) {
    console.error('Get profile failed', err);
    return res.status(500).json({ error: 'Get profile failed', details: err.message || String(err) });
  }
};

