import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/db';

import authRoutes from './routes/authRoutes';
import providerRoutes from './routes/providerRoutes';
import rfpRoutes from './routes/rfpRoutes';
import bidCraftRoutes from './routes/bidCraftRoutes';
import parseRoutes from './routes/parseRoutes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Strict startup checks for required env when using Firebase auth
const requireFirebaseEnv = () => {
  const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  const hasCredPath = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!hasServiceAccount && !hasCredPath) {
    console.error('FATAL: Firebase credentials are required. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS in .env.');
    process.exit(1);
  }
};

requireFirebaseEnv();

// Connect to DB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/rfp', rfpRoutes);
app.use('/api/bidcraft', bidCraftRoutes);
app.use('/api/parse', parseRoutes);

// Basic health
app.get('/', (req: Request, res: Response) => res.json({ ok: true, service: 'BidCraft Backend' }));

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  // Multer file too large
  if (err && (err.code === 'LIMIT_FILE_SIZE' || err.code === 'ETOOBIG')) {
    return res.status(413).json({ error: 'Uploaded file is too large. Max size is 10MB.' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Server Error' });
});

export default app;

