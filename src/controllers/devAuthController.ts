import type { Request, Response } from 'express';
import admin, { initFirebase } from '../config/firebase';

// ensure firebase admin
try { initFirebase(); } catch (e) { /* will surface on use */ }

// Dev-only endpoint: create a custom token and exchange for ID token (for Postman testing)
export const createDevIdToken = async (req: Request, res: Response) => {
  if (process.env.ENABLE_DEV_AUTH !== 'true') {
    return res.status(403).json({ error: 'Dev auth disabled. Set ENABLE_DEV_AUTH=true to enable.' });
  }
  try {
    const uid = req.body.uid || 'dev-user';
    const webApiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!webApiKey) return res.status(500).json({ error: 'FIREBASE_WEB_API_KEY not configured' });

    const customToken = await admin.auth().createCustomToken(uid);

    // Exchange custom token for ID token via Firebase REST
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(500).json({ error: 'Failed to exchange custom token', details: data });

    return res.json({ ok: true, idToken: data.idToken, refreshToken: data.refreshToken, raw: data });
  } catch (err: any) {
    console.error('createDevIdToken failed', err);
    return res.status(500).json({ error: 'createDevIdToken failed', details: err.message || String(err) });
  }
};

