import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import RecordingSession, { RecordingStatus, RecordingType } from '../models/RecordingSession';
import RecordingChunk from '../models/RecordingChunk';
import Evidence, { EvidenceType } from '../models/Evidence';
import AuditLog, { AuditAction } from '../models/AuditLog';
import Attempt, { AttemptStatus } from '../models/Attempt';
import { storageService } from '../services/storageService';
import { AuthRequest } from '../middleware/authMiddleware';

export const startRecording = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId, type, mimeType, codec } = req.body;
    const userId = req.user!.userId;

    const attempt = await Attempt.findOne({ _id: attemptId, candidateId: userId });
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found or unauthorized' });

    if (![AttemptStatus.IN_PROGRESS, AttemptStatus.PAUSED].includes(attempt.status as any)) {
      return res.status(400).json({ success: false, message: 'Cannot start recording for inactive attempt' });
    }

    // Check if recording session already exists
    let session = await RecordingSession.findOne({ attemptId, candidateId: userId, type });
    if (session) {
      session.status = RecordingStatus.ACTIVE;
      await session.save();
    } else {
      const storagePrefix = `recordings/${attempt.examId}/${userId}/${attemptId}/${type.toLowerCase()}`;
      session = new RecordingSession({
        attemptId,
        candidateId: userId,
        examId: attempt.examId,
        type,
        mimeType,
        codec,
        storagePrefix,
        status: RecordingStatus.ACTIVE,
        startedAt: new Date()
      });
      await session.save();
    }

    await AuditLog.create({
      actorId: userId,
      actorRole: req.user!.role,
      attemptId,
      recordingSessionId: session._id,
      action: AuditAction.RECORDING_STARTED,
      result: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({ success: true, recordingSessionId: session._id, status: session.status });
  } catch (err) {
    next(err);
  }
};

export const uploadChunk = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { recordingSessionId } = req.params;
    const { sequenceNumber, startTime, endTime, duration } = req.body;
    const userId = req.user!.userId;

    if (!req.file) return res.status(400).json({ success: false, message: 'No chunk data provided' });

    const session = await RecordingSession.findOne({ _id: recordingSessionId, candidateId: userId });
    if (!session) return res.status(404).json({ success: false, message: 'Recording session not found' });

    if (![RecordingStatus.ACTIVE, RecordingStatus.RECOVERING, RecordingStatus.INTERRUPTED].includes(session.status)) {
      return res.status(400).json({ success: false, message: 'Recording session is not active' });
    }

    // Idempotency: Check if chunk already exists
    const existingChunk = await RecordingChunk.findOne({ recordingSessionId, sequenceNumber });
    if (existingChunk) {
      return res.status(200).json({ success: true, message: 'Chunk already uploaded (idempotent)', chunkId: existingChunk._id });
    }

    // Calculate checksum
    const hash = crypto.createHash('sha256');
    hash.update(req.file.buffer);
    const checksum = hash.digest('hex');

    const storageKey = `${session.storagePrefix}/${sequenceNumber.toString().padStart(6, '0')}.webm`;
    
    // Upload to Storage
    await storageService.uploadChunk(storageKey, req.file.buffer, req.file.mimetype);

    const chunk = new RecordingChunk({
      recordingSessionId,
      attemptId: session.attemptId,
      sequenceNumber,
      storageKey,
      byteSize: req.file.size,
      mimeType: req.file.mimetype,
      checksum,
      startedAt: new Date(Number(startTime)),
      endedAt: new Date(Number(endTime)),
      uploadStatus: 'COMPLETED',
      uploadedAt: new Date()
    });
    await chunk.save();

    // Update Session Metadata
    session.totalBytes += req.file.size;
    session.totalChunks += 1;
    session.totalDurationSeconds += (Number(duration) / 1000);
    session.lastChunkAt = new Date();
    await session.save();

    res.status(200).json({ success: true, chunkId: chunk._id });
  } catch (err) {
    if (req.params.recordingSessionId) {
      await AuditLog.create({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        recordingSessionId: req.params.recordingSessionId as any,
        action: AuditAction.RECORDING_FAILED,
        result: 'UPLOAD_FAILED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }).catch(() => {});
    }
    next(err);
  }
};

import fs from 'fs';
import path from 'path';
import { googleDriveService } from '../services/googleDriveService';
import Exam from '../models/Exam';
import User from '../models/User';

export const completeRecording = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { recordingSessionId } = req.params;
    const userId = req.user!.userId;

    const session = await RecordingSession.findOne({ _id: recordingSessionId, candidateId: userId });
    if (!session) return res.status(404).json({ success: false, message: 'Recording session not found' });

    session.status = RecordingStatus.COMPLETED;
    session.stoppedAt = new Date();
    await session.save();

    // 1. Fetch chunks and merge
    const chunks = await RecordingChunk.find({ recordingSessionId }).sort({ sequenceNumber: 1 });
    const mergedFilePath = path.join(__dirname, `../../temp_storage/merged_${recordingSessionId}.webm`);
    
    const writeStream = fs.createWriteStream(mergedFilePath);
    for (const chunk of chunks) {
      const chunkPath = storageService.getFilePath(chunk.storageKey);
      if (fs.existsSync(chunkPath)) {
        writeStream.write(fs.readFileSync(chunkPath));
      }
    }
    writeStream.end();

    // 2. Fetch User and Exam info for naming
    const exam = await Exam.findById(session.examId);
    const candidate = await User.findById(userId);
    
    // 3. Upload to Google Drive
    if (exam && candidate) {
      await new Promise(resolve => writeStream.on('finish', resolve));
      const driveLink = await googleDriveService.uploadVideo(mergedFilePath, candidate.name, exam.title, session.type);
      if (driveLink) {
        session.storagePrefix = driveLink; // Store the Google Drive link
        await session.save();
      }
      // Cleanup merged file
      if (fs.existsSync(mergedFilePath)) {
        fs.unlinkSync(mergedFilePath);
      }
      // Cleanup raw chunk files
      for (const chunk of chunks) {
        const chunkPath = storageService.getFilePath(chunk.storageKey);
        if (fs.existsSync(chunkPath)) {
          fs.unlinkSync(chunkPath);
        }
      }
    }

    await AuditLog.create({
      actorId: userId,
      actorRole: req.user!.role,
      recordingSessionId: session._id,
      action: AuditAction.RECORDING_COMPLETED,
      result: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({ success: true, message: 'Recording marked as completed and uploaded to Drive' });
  } catch (err) {
    next(err);
  }
};

// Admin endpoints for playback
export const getRecordingPlayback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { recordingSessionId } = req.params;
    // Assume req.user has been checked for Admin/Proctor role by middleware
    
    const chunks = await RecordingChunk.find({ recordingSessionId, uploadStatus: 'COMPLETED' })
                                       .sort({ sequenceNumber: 1 });
    
    if (chunks.length === 0) return res.status(404).json({ success: false, message: 'No chunks available' });

    // Generate signed URLs for all chunks (in a real advanced implementation, you'd merge them or use HLS streaming)
    // For Phase 11 MVP: return ordered array of signed URLs
    const signedUrls = await Promise.all(chunks.map(async chunk => {
      const url = await storageService.generateSignedUrl(chunk.storageKey);
      return { sequence: chunk.sequenceNumber, url, duration: chunk.endedAt.getTime() - chunk.startedAt.getTime() };
    }));

    await AuditLog.create({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      recordingSessionId: recordingSessionId as any,
      action: AuditAction.PLAYBACK_REQUESTED,
      result: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    await AuditLog.create({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      recordingSessionId: recordingSessionId as any,
      action: AuditAction.SIGNED_URL_GENERATED,
      result: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({ success: true, chunks: signedUrls });
  } catch (err) {
    next(err);
  }
};

export const uploadSnapshot = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId, violationId, severity, description } = req.body;
    const userId = req.user!.userId;

    if (!req.file) return res.status(400).json({ success: false, message: 'No image data provided' });
    
    // SEC-08: Verify ownership and attempt status
    const Attempt = require('../models/Attempt').default;
    const attempt = await Attempt.findOne({ _id: attemptId, candidateId: userId });
    if (!attempt || attempt.status !== 'IN_PROGRESS') {
      return res.status(403).json({ success: false, message: 'Invalid or inactive attempt' });
    }

    const storageKey = `evidence/${attemptId}/${Date.now()}.jpg`;
    await storageService.uploadChunk(storageKey, req.file.buffer, req.file.mimetype);

    const evidence = new Evidence({
      attemptId,
      candidateId: userId,
      violationId: violationId || undefined,
      type: EvidenceType.CAMERA_SNAPSHOT,
      captureTime: new Date(),
      storageKey,
      mimeType: req.file.mimetype,
      byteSize: req.file.size,
      severity,
      description
    });
    await evidence.save();

    await AuditLog.create({
      actorId: userId,
      actorRole: req.user!.role,
      attemptId,
      evidenceId: evidence._id,
      action: AuditAction.EVIDENCE_CREATED,
      result: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({ success: true, evidenceId: evidence._id });
  } catch (err) {
    next(err);
  }
};
