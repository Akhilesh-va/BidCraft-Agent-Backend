import multer from 'multer';

// Limit uploads to 10MB for in-memory parsing. Larger files are rejected.
const TEN_MB = 10 * 1024 * 1024;
const storage = multer.memoryStorage();
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files are allowed'));
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: TEN_MB } });

