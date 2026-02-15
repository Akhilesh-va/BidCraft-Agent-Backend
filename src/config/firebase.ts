import admin from 'firebase-admin';

let initialized = false;

export const initFirebase = () => {
  if (initialized) return admin;

  // Prefer a JSON string in FIREBASE_SERVICE_ACCOUNT, otherwise rely on GOOGLE_APPLICATION_CREDENTIALS env var
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  try {
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
      initialized = true;
      console.log('Firebase admin initialized from env JSON');
      return admin;
    }

    // Fallback: rely on GOOGLE_APPLICATION_CREDENTIALS being set to a file path
    admin.initializeApp();
    initialized = true;
    console.log('Firebase admin initialized (default credentials)');
    return admin;
  } catch (err) {
    // Do not throw here; allow callers to handle missing credentials gracefully.
    console.error('Failed to initialize Firebase admin (credentials may be missing):', err?.message || err);
    return undefined as unknown as typeof admin;
  }
};

export default admin;

