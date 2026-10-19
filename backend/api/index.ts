import app from '../src/app';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL || (process.env.NODE_ENV === 'production'
  ? undefined
  : 'mongodb://localhost:27017/aptitude_portal');

// Serverless DB Connection Middleware: Ensures MongoDB connection is ready before processing API routes
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const pathname = (req.url || '').split('?')[0];
  // Health checks and root routes should never be blocked by DB state
  if (req.method === 'OPTIONS' || pathname === '/' || pathname === '' || pathname === '/health' || pathname === '/api/health') {
    return next();
  }

  if (mongoose.connection.readyState === 1) {
    return next();
  }

  if (!MONGODB_URI) {
    console.error('MONGODB_URI or MONGODB_URL is missing in environment variables.');
    return res.status(503).json({
      success: false,
      error: { code: 'DATABASE_CONFIG_MISSING', message: 'Database configuration missing in environment variables.' }
    });
  }

  try {
    if (mongoose.connection.readyState === 2) {
      await mongoose.connection.asPromise();
    } else {
      await mongoose.connect(MONGODB_URI);
    }
    next();
  } catch (error: any) {
    console.error('Vercel MongoDB connection failed:', error);
    const reqOrigin = (req.headers.origin as string) || '';
    const cleanOrigin = reqOrigin.trim().replace(/\/+$/, '');
    const isAllowed = cleanOrigin === 'https://flair.flyhii.in' || cleanOrigin.endsWith('.flyhii.in') || cleanOrigin === 'https://flair-oqvv.vercel.app' || cleanOrigin.endsWith('.vercel.app') || cleanOrigin.includes('localhost');
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? reqOrigin : 'https://flair.flyhii.in');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-request-id, Accept, Cache-Control, Pragma, Expires, If-Modified-Since, Origin');
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database unavailable: ' + (error?.message || 'Connection error'),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

// Primary serverless export for Vercel
module.exports = app;
export default app;
