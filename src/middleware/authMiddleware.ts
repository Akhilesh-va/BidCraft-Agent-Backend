import { Request, Response, NextFunction } from 'express';
import { initFirebase } from '../config/firebase';
import admin from 'firebase-admin';
import User from '../models/User';

// protect middleware supports a local dev bypass when SKIP_FIREBASE_VERIFY=true
export const protect = async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  // Dev bypass
  if (process.env.SKIP_FIREBASE_VERIFY === 'true') {
    const devEmail = (req.headers['x-dev-user-email'] as string) || 'dev@local';
    try {
      let user = await User.findOne({ email: devEmail });
      if (!user) {
        user = await User.create({ email: devEmail, name: 'Dev User', verified: true });
      }
      req.user = user;
      return next();
    } catch (e) {
      console.error('Dev bypass user creation failed', e);
      return res.status(500).json({ error: 'Dev bypass failed' });
    }
  }

  // Normal flow: expect Authorization header with Bearer token
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  const idToken = auth.split(' ')[1];

  // Lazy init Firebase admin
  const adminInst = initFirebase();
  if (!adminInst) {
    console.error('Firebase admin not initialized; cannot verify tokens.');
    return res.status(500).json({ error: 'Firebase not initialized' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = (decoded as any).uid as string | undefined;
    const email = (decoded as any).email as string | undefined;

    let user = null;
    if (uid) user = await User.findOne({ googleId: uid });
    if (!user && email) user = await User.findOne({ email });
    if (!user) {
      // create minimal user record
      user = await User.create({
        email,
        googleId: uid,
        name: (decoded as any).name,
        picture: (decoded as any).picture,
        verified: true
      });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('Firebase token verify failed', err);
    return res.status(401).json({ error: 'Token invalid' });
  }
};

