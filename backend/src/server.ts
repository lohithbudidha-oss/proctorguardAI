import app from './app';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 5000;
const server = http.createServer(app);

import { setupSockets } from './sockets/proctorSocket';

const socketAllowedOrigins = [
  'https://flair.flyhii.in',
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

mongoose.connect(MONGODB_URI)
  .then(() => {
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

    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
