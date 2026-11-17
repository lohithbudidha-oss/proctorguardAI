import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

const port = process.env.PORT || 5000;
const server = http.createServer(app);

import { setupSockets } from './sockets/proctorSocket';

const socketAllowedOrigins = [
  'https://flair.flyhii.in',
  'https://flair.flyhiibackend.in',
  'https://flair-oqvv.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : [])
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const clean = origin.trim().replace(/\/+$/, '');
      if (socketAllowedOrigins.includes(clean) || clean.endsWith('.vercel.app') || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

setupSockets(io);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017/aptitude_portal';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB');
    
    // Background migration: set hasScreenshot: true on past violations with screenshots/drive proofs
    import('./models/ViolationEvent').then(({ default: ViolationEvent }) => {
      ViolationEvent.updateMany(
        {
          hasScreenshot: { $ne: true },
          $or: [
            { screenshot: { $exists: true, $ne: '' } },
            { snapshotImage: { $exists: true, $ne: '' } },
            { driveUrl: { $exists: true, $ne: '' } }
          ]
        },
        { $set: { hasScreenshot: true } }
      ).exec().catch(() => {});
    }).catch(() => {});
  } catch (err: any) {
    console.error('Failed to connect to MongoDB:', err?.message || err);
    console.warn(`[Database] MongoDB is offline or MONGODB_URI is unconfigured in backend/.env.`);
    console.warn(`[Database] Server continues running on port ${port} for health checks and sockets. Set MONGODB_URI to connect to MongoDB Atlas.`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

connectToDatabase();

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
