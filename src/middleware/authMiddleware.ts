import { Request, Response, NextFunction } from 'express';
import admin, { initFirebase } from '../config/firebase';
import User from '../models/User';

export const protect = async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  const idToken = auth.split(' ')[1];
  try {
    // Allow bypass during development via SKIP_FIREBASE_VERIFY env flag.
    if (process.env.SKIP_FIREBASE_VERIFY === 'true') {
      // If provided, prefer an explicit debug header to identify the dev user
      const devEmail = (req.headers['x-dev-user-email'] as string) || 'dev@local';
      let user = await User.findOne({ email: devEmail });
      if (!user) {
        user = await User.create({
          email: devEmail,
          name: 'Dev User',
          verified: true
        });
      }
      req.user = user;
      return next();
    }

    try { initFirebase(); } catch (e) { /* will surface on admin usage */ }
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

