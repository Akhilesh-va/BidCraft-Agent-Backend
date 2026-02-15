import { Request, Response } from 'express';
import User from '../models/User';
import admin, { initFirebase } from '../config/firebase';

// ensure firebase is initialized when this controller is loaded
try {
  initFirebase();
} catch (err) {
  // initialization errors will be surfaced on usage
}

// Verify Firebase ID token, create/update user, return user object (no local JWT)
export const verifyToken = async (req: Request, res: Response) => {
  // Accept idToken in body or Authorization header
  const idToken = req.body.idToken || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!idToken) return res.status(400).json({ error: 'idToken required' });
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
      if (uid) user.googleId = user.googleId || uid;
      await user.save();
    }

    return res.json({ ok: true, user, firebase: decoded });
  } catch (err) {
    console.error('Firebase verify failed', err);
    return res.status(401).json({ error: 'Invalid Firebase ID token' });
  }
};

