import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User, { Role } from '../models/User';
import Attempt, { AttemptStatus } from '../models/Attempt';
import ViolationEvent from '../models/ViolationEvent';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_replace_in_production';

interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string;
    role: Role;
  };
}

export const setupSockets = (io: Server) => {
  // Authentication middleware for sockets
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
    if (!token) return next(new Error('Authentication error'));

    jwt.verify(token.replace('Bearer ', ''), JWT_SECRET, (err: any, decoded: any) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userRole = socket.user?.role;
    const userId = socket.user?.userId;

    console.log(`[Socket] ${userRole} connected: ${userId}`);

    // Join room based on role
    if (userRole === Role.PROCTOR || userRole === Role.ADMIN) {
      socket.join('proctors');
    } else if (userRole === Role.CANDIDATE) {
      socket.join(`candidate_${userId}`);
    }

    // Candidate emitting heartbeat
    socket.on('candidate:heartbeat', async (data) => {
      if (userRole !== Role.CANDIDATE) return;
      // In a real scenario, update the session/attempt "lastActive" time in Redis or DB.
      // Broadcast to proctors
      io.to('proctors').emit('candidate:status_update', {
        candidateId: userId,
        status: 'ONLINE',
        timestamp: new Date()
      });
    });

    // Camera/Screen status
    socket.on('camera:status', (status: 'STARTED' | 'STOPPED') => {
      if (userRole !== Role.CANDIDATE) return;
      io.to('proctors').emit('candidate:camera_status', { candidateId: userId, status });
    });

    socket.on('screen:status', (status: 'STARTED' | 'STOPPED') => {
      if (userRole !== Role.CANDIDATE) return;
      io.to('proctors').emit('candidate:screen_status', { candidateId: userId, status });
    });

    // Receiving violation from candidate AI client
    socket.on('violation:created', async (data) => {
      if (userRole !== Role.CANDIDATE) return;
      
      // Store in DB, broadcast to proctors
      // Data contains: { attemptId, type, severity, source, ... }
      try {
        const violation = new ViolationEvent({
          attemptId: data.attemptId,
          candidateId: userId,
          type: data.type,
          severity: data.severity,
          source: data.source,
          detectedAt: new Date(),
          actionTaken: data.actionTaken || 'LOG' // Simplified
        });
        await violation.save();

        io.to('proctors').emit('violation:alert', {
          candidateId: userId,
          violation
        });
      } catch (err) {
        console.error('Socket violation save error', err);
      }
    });

    // Forward instant snapshots to proctors
    socket.on('evidence:snapshot', (data) => {
      if (userRole !== Role.CANDIDATE) return;
      io.to('proctors').emit('evidence:snapshot_alert', {
        candidateId: userId,
        ...data
      });
    });

    // Proctor Actions
    socket.on('admin:command', async (data: { candidateId: string, action: string, message?: string }) => {
      if (userRole !== Role.ADMIN && userRole !== Role.PROCTOR) return;
      
      try {
        // Attempt to find active exam for this candidate
        const attemptDoc = await Attempt.findOne({ candidateId: data.candidateId, status: { $in: [AttemptStatus.IN_PROGRESS, AttemptStatus.PAUSED] } });
        if (attemptDoc) {
          const attempt = attemptDoc as any;
          if (data.action === 'PAUSE') {
            attempt.status = AttemptStatus.PAUSED;
          } else if (data.action === 'RESUME') {
            attempt.status = AttemptStatus.IN_PROGRESS;
          } else if (data.action === 'TERMINATE') {
            attempt.status = AttemptStatus.TERMINATED;
            attempt.submittedAt = new Date();
          }
          await attempt.save();
        }
      } catch (err) {
        console.error('Failed to update DB on admin command', err);
      }

      io.to(`candidate_${data.candidateId}`).emit('admin:command_received', {
        action: data.action, // e.g. PAUSE, TERMINATE, MESSAGE
        message: data.message
      });
    });

    // WebRTC Signaling
    socket.on('webrtc:offer', (data: { candidateId: string, offer: any, adminId: string }) => {
      if (userRole !== Role.ADMIN && userRole !== Role.PROCTOR) return;
      io.to(`candidate_${data.candidateId}`).emit('webrtc:offer', { offer: data.offer, adminId: data.adminId || socket.id });
    });

    socket.on('webrtc:answer', (data: { adminId: string, answer: any, candidateId: string }) => {
      if (userRole !== Role.CANDIDATE) return;
      io.to('proctors').emit('webrtc:answer', { answer: data.answer, candidateId: data.candidateId || userId, adminId: data.adminId });
    });

    socket.on('webrtc:ice-candidate', (data: { target: 'CANDIDATE' | 'ADMIN', targetId: string, candidate: any, sourceId: string }) => {
      if (data.target === 'CANDIDATE') {
        io.to(`candidate_${data.targetId}`).emit('webrtc:ice-candidate', { candidate: data.candidate, sourceId: data.sourceId });
      } else {
        io.to('proctors').emit('webrtc:ice-candidate', { candidate: data.candidate, sourceId: data.sourceId });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${userRole} disconnected: ${userId}`);
      if (userRole === Role.CANDIDATE) {
        io.to('proctors').emit('candidate:status_update', {
          candidateId: userId,
          status: 'OFFLINE',
          timestamp: new Date()
        });
      }
    });
  });
};
