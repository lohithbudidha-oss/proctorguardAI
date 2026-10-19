import app from '../src/app';
import mongoose from 'mongoose';
import { Request, Response } from 'express';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL || (process.env.NODE_ENV === 'production'
  ? undefined
  : 'mongodb://localhost:27017/aptitude_portal');

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (!MONGODB_URI) throw new Error('MONGODB_URI or MONGODB_URL is required in production');

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }

  await mongoose.connect(MONGODB_URI);
}

export default async function handler(req: Request, res: Response) {
  const pathname = (req.url || '').split('?')[0];
  // Health checks, root, socket.io, and OPTIONS requests should never be blocked by DB connection
  if (
    req.method === 'OPTIONS' ||
    pathname === '/' ||
    pathname === '' ||
    pathname === '/health' ||
    pathname === '/api/health' ||
    pathname.startsWith('/socket.io')
  ) {
    return app(req, res);
  }

  try {
    await connectToDatabase();
    return app(req, res);
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
}
