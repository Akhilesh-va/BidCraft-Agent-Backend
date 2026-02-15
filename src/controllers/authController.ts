import { Request, Response } from 'express';
import User from '../models/User';
import admin, { initFirebase } from '../config/firebase';

// Verify Firebase ID token, create/update user, return user object (no local JWT)
export const verifyToken = async (req: Request, res: Response) => {
  // Accept idToken in body or Authorization header
  const idToken = req.body.idToken || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!idToken) return res.status(400).json({ error: 'idToken required' });
  // Lazy init firebase
  const adminInst = initFirebase();
  if (!adminInst) {
    return res.status(500).json({ error: 'Firebase not initialized' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = (decoded as any).email as string | undefined;
    const uid = (decoded as any).uid as string | undefined;
    const name = (decoded as any).name as string | undefined;
    const picture = (decoded as any).picture as string | undefined;

    let user = null;
    if (uid) user = await User.findOne({ googleId: uid });
    if (!user && email) user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        googleId: uid,
        name,
        picture,
        verified: true
      });
    } else {
      user.verified = true;
      if (name) user.name = user.name || name;
      if (picture) user.picture = user.picture || picture;
      if (email && !user.email) user.email = email;
      if (uid) user.googleId = user.googleId || uid;
      await user.save();
    }

    return res.json({ ok: true, user, firebase: decoded });
  } catch (err) {
    console.error('Firebase verify failed', err);
    return res.status(401).json({ error: 'Invalid Firebase ID token' });
  }
};

// Dev-only: return detailed verification diagnostics (errors + decoded claims)
export const debugVerifyToken = async (req: Request, res: Response) => {
  if (process.env.ENABLE_DEV_AUTH !== 'true') {
    return res.status(403).json({ error: 'Dev debug verify disabled. Set ENABLE_DEV_AUTH=true to enable.' });
  }
  const idToken = req.body.idToken || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!idToken) return res.status(400).json({ error: 'idToken required' });
  const adminInst = initFirebase();
  if (!adminInst) {
    return res.status(500).json({ error: 'Firebase not initialized' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return res.json({ ok: true, decoded });
  } catch (err: any) {
    console.error('debugVerifyToken failed', err);
    return res.status(400).json({ ok: false, error: err.message || String(err), stack: err.stack });
  }
};

