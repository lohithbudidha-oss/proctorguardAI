import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User, { Role } from '../models/User';
import Attempt, { AttemptStatus } from '../models/Attempt';
import ViolationEvent from '../models/ViolationEvent';
import Session from '../models/Session';
import Exam from '../models/Exam';
import { googleDriveService } from '../services/googleDriveService';

const JWT_SECRET = process.env.JWT_SECRET;

interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string;
    role: Role;
  };
}

let ioInstance: Server | null = null;
export const getIO = (): Server | null => ioInstance;

export const setupSockets = (io: Server) => {
  ioInstance = io;
  // Authentication middleware for sockets
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
    if (!token) return next(new Error('Authentication error'));

    const actualToken = token.replace('Bearer ', '');
    const secret = JWT_SECRET || 'dev_secret';
    
    jwt.verify(actualToken, secret, async (err: any, decoded: any) => {
      if (err) return next(new Error('Authentication error'));
      
      // SEC-16: Session Revocation Check
      try {
        const activeSession = await Session.findOne({ tokenIdentifier: actualToken });
        if (!activeSession || !activeSession.isValid) {
          return next(new Error('Authentication error: Session revoked'));
        }
        socket.user = decoded;
        next();
      } catch (dbErr) {
        return next(new Error('Authentication error: DB failure'));
      }
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
      
      try {
        const attempt = await Attempt.findOne({ _id: data.attemptId });
        if (!attempt || ['SUBMITTED', 'AUTO_SUBMITTED', 'FORCE_SUBMITTED', 'COMPLETED', 'TERMINATED', 'INVALIDATED'].includes(attempt.status)) {
          return;
        }

        const screenshot = data.screenshot || data.image || data.snapshotImage || '';
        const driveFolderUrl = `https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing`;

        // 1. Immediately create and save violation in database
        const violation = new ViolationEvent({
          attemptId: data.attemptId,
          candidateId: userId,
          type: data.type || 'VIOLATION',
          severity: data.severity || 'CRITICAL',
          source: data.source || 'BROWSER',
          detectedAt: new Date(),
          actionTaken: data.actionTaken || 'LOG',
          description: data.description || '',
          screenshot,
          snapshotImage: screenshot,
          driveFolderUrl
        });
        await violation.save();

        // 2. Immediately populate and broadcast to all proctors & admins
        const populatedViolation = await ViolationEvent.findById(violation._id)
          .populate('candidateId', 'name email')
          .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } });

        io.to('proctors').emit('violation:alert', {
          candidateId: userId,
          violation: populatedViolation || violation
        });

        // Also emit snapshot alert for instant proof lightbox
        if (screenshot) {
          io.to('proctors').emit('evidence:snapshot_alert', {
            candidateId: userId,
            attemptId: data.attemptId,
            type: data.type,
            severity: data.severity || 'CRITICAL',
            description: data.description,
            image: screenshot,
            screenshot
          });
        }

        // 3. Sync to Google Drive asynchronously in background (never blocks socket delivery)
        if (screenshot) {
          (async () => {
            try {
              const candidate = await User.findById(userId);
              const exam = await Exam.findById(attempt.examId);
              const uploadRes = await googleDriveService.uploadViolationImage(
                screenshot,
                candidate?.name || 'Candidate',
                exam?.title || 'Exam',
                data.type || 'VIOLATION',
                new Date()
              );
              if (uploadRes?.webViewLink) {
                const updated = await ViolationEvent.findByIdAndUpdate(
                  violation._id,
                  { driveUrl: uploadRes.webViewLink },
                  { new: true }
                ).populate('candidateId', 'name email')
                 .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } });

                io.to('proctors').emit('violation:updated', {
                  violationId: violation._id,
                  driveUrl: uploadRes.webViewLink,
                  violation: updated
                });
              }
            } catch (uploadErr) {
              console.warn('[GoogleDrive] Async screenshot sync warning:', uploadErr);
            }
          })();
        }
      } catch (err) {
        console.error('Socket violation save error', err);
      }
    });

    // Forward instant snapshots to proctors and link to latest violation if available
    socket.on('evidence:snapshot', async (data) => {
      if (userRole !== Role.CANDIDATE) return;
      
      try {
        const attempt = await Attempt.findOne({ _id: data.attemptId });
        if (!attempt || ['SUBMITTED', 'AUTO_SUBMITTED', 'FORCE_SUBMITTED', 'COMPLETED', 'TERMINATED', 'INVALIDATED'].includes(attempt.status)) return;

        const img = data.image || data.screenshot || data.snapshotImage || '';

        if (img) {
          // If a recent violation exists, attach this screenshot to it
          const recentViolation = await ViolationEvent.findOne({
            attemptId: data.attemptId,
            candidateId: userId,
            type: data.type
          }).sort({ detectedAt: -1 });

          let savedViolationId: any = null;

          if (recentViolation) {
            recentViolation.screenshot = img;
            recentViolation.snapshotImage = img;
            if (data.description && !recentViolation.description) {
              recentViolation.description = data.description;
            }
            await recentViolation.save();
            savedViolationId = recentViolation._id;

            const populatedViolation = await ViolationEvent.findById(recentViolation._id)
              .populate('candidateId', 'name email')
              .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } });

            io.to('proctors').emit('violation:alert', {
              candidateId: userId,
              violation: populatedViolation || recentViolation
            });
          } else {
            // If no violation was logged yet, create one now with this snapshot proof
            const fallbackViolation = new ViolationEvent({
              attemptId: data.attemptId,
              candidateId: userId,
              type: data.type || 'VIOLATION',
              severity: data.severity || 'CRITICAL',
              source: data.source || 'AI',
              detectedAt: new Date(),
              actionTaken: 'LOG',
              description: data.description || 'Proctor surveillance snapshot captured.',
              screenshot: img,
              snapshotImage: img,
              driveFolderUrl: `https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing`
            });
            await fallbackViolation.save();
            savedViolationId = fallbackViolation._id;

            const populatedFallback = await ViolationEvent.findById(fallbackViolation._id)
              .populate('candidateId', 'name email')
              .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } });

            io.to('proctors').emit('violation:alert', {
              candidateId: userId,
              violation: populatedFallback || fallbackViolation
            });
          }

          // Background Google Drive sync
          (async () => {
            try {
              const candidate = await User.findById(userId);
              const exam = await Exam.findById(attempt.examId);
              const uploadRes = await googleDriveService.uploadViolationImage(
                img,
                candidate?.name || 'Candidate',
                exam?.title || 'Exam',
                data.type || 'EVIDENCE',
                new Date()
              );
              if (uploadRes?.webViewLink && savedViolationId) {
                const updated = await ViolationEvent.findByIdAndUpdate(
                  savedViolationId,
                  { driveUrl: uploadRes.webViewLink },
                  { new: true }
                ).populate('candidateId', 'name email')
                 .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } });

                io.to('proctors').emit('violation:updated', {
                  violationId: savedViolationId,
                  driveUrl: uploadRes.webViewLink,
                  violation: updated
                });
              }
            } catch (e) {
              console.warn('[GoogleDrive] Evidence snapshot drive upload error:', e);
            }
          })();
        }

        io.to('proctors').emit('evidence:snapshot_alert', {
          candidateId: userId,
          image: img,
          screenshot: img,
          ...data
        });
      } catch (err) {
        console.error('Socket evidence snapshot error', err);
      }
    });

    // Proctor Actions
    socket.on('admin:command', async (data: { candidateId: string, action: string, message?: string }) => {
      if (userRole !== Role.ADMIN && userRole !== Role.PROCTOR) return;
      
      try {
        // SEC-14: Remote Control IDOR check (Checking if admin is allowed - assumes PROCTOR/ADMIN are global for MVP, but should scope by exam)
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
        action: data.action,
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
      // Force candidateId to be the actual userId
      io.to('proctors').emit('webrtc:answer', { answer: data.answer, candidateId: userId, adminId: data.adminId });
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
