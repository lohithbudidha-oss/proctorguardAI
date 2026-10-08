import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { Role } from '../models/User';
import { startRecording, uploadChunk, completeRecording, getRecordingPlayback, uploadSnapshot } from '../controllers/recordingController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max chunk size

// Candidate recording endpoints
router.post('/start', authenticate, requireRole([Role.CANDIDATE]), startRecording);
router.post('/:recordingSessionId/chunks', authenticate, requireRole([Role.CANDIDATE]), upload.single('chunk'), uploadChunk);
router.post('/:recordingSessionId/complete', authenticate, requireRole([Role.CANDIDATE]), completeRecording);

// Candidate evidence endpoints
router.post('/evidence/snapshot', authenticate, requireRole([Role.CANDIDATE]), upload.single('snapshot'), uploadSnapshot);

// Admin playback endpoints
router.get('/:recordingSessionId/playback', authenticate, requireRole([Role.ADMIN, Role.PROCTOR]), getRecordingPlayback);

export default router;
