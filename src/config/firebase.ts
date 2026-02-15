import admin from 'firebase-admin';

let initialized = false;

export const initFirebase = () => {
  if (initialized) return admin;

  // Prefer a JSON string in FIREBASE_SERVICE_ACCOUNT, otherwise rely on GOOGLE_APPLICATION_CREDENTIALS env var
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
      initialized = true;
      console.log('Firebase admin initialized from env JSON');
      return admin;
    } catch (err) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON', err);
      throw err;
    }
  }

  // Fallback: rely on GOOGLE_APPLICATION_CREDENTIALS being set to a file path
  try {
    admin.initializeApp();
    initialized = true;
    console.log('Firebase admin initialized (default credentials)');
    return admin;
  } catch (err) {
    console.error('Failed to initialize Firebase admin', err);
    throw err;
  }
};

export default admin;

