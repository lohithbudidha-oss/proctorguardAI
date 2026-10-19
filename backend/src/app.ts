import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import compression from 'compression';

dotenv.config();

const app: Application = express();

// Trust reverse proxy (e.g. Render, Vercel, Cloudflare) for accurate client IP in rate limiters
app.set('trust proxy', true);

// Performance Middleware: Enable Gzip Compression for all API payloads
app.use(compression());

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'https://flair.flyhii.in', 'https://proctorguard-ai.vercel.app'] }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Increased dramatically to allow video chunk uploads every 5-10 seconds
  validate: { xForwardedForHeader: false, default: false },
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check (both /health and /api/health for frontend keepalive & status checks)
const healthHandler = (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import candidateRoutes from './routes/candidateRoutes';
import recordingRoutes from './routes/recordingRoutes';
import supportRoutes from './routes/supportRoutes';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/candidate', candidateRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/support', supportRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  const isProduction = process.env.NODE_ENV === 'production';
  
  let message = 'Internal Server Error';
  if (!isProduction || err.status < 500) {
    message = err.message || message;
  }

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: message,
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  });
});

export default app;
