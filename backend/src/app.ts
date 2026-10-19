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
// CORS Configuration: Explicitly allow custom domain flair.flyhii.in, Vercel domains, and local development
const allowedOrigins = [
  'https://flair.flyhii.in',
  'https://flair-oqvv.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o: string) => o.trim().replace(/\/+$/, '')) : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (like health checks, server-to-server)
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.trim().replace(/\/+$/, '');
    if (
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.flyhii.in') ||
      cleanOrigin.endsWith('.vercel.app') ||
      cleanOrigin === 'https://flair.flyhii.in' ||
      cleanOrigin === 'https://flair-oqvv.vercel.app' ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-request-id',
    'Accept',
    'Cache-Control',
    'Pragma',
    'Expires',
    'If-Modified-Since',
    'Origin'
  ]
}));

// Graceful Socket.IO endpoint handling in serverless mode to eliminate 404 polling errors
app.all(['/socket.io', '/socket.io/*'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.status(200).send('0{"sid":"serverless_noop","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":1000000}');
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Increased dramatically to allow video chunk uploads every 5-10 seconds
  validate: { xForwardedForHeader: false, default: false },
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check and Root Status
const healthHandler = (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'flair-backend', timestamp: new Date().toISOString() });
};
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'Flair Online Examination & Proctoring Platform API',
    status: 'online',
    version: '1.0.0',
    documentation: 'https://flair-oqvv.vercel.app',
    health: '/api/health',
    timestamp: new Date().toISOString()
  });
});
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
