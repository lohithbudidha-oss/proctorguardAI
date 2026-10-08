import app from './app';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 5000;
const server = http.createServer(app);

import { setupSockets } from './sockets/proctorSocket';

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'https://proctorguard-ai.vercel.app'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

setupSockets(io);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aptitude_portal';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
