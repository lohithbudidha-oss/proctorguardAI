import mongoose, { Schema, Document } from 'mongoose';

export enum ViolationType {
  FACE_NOT_VISIBLE = 'FACE_NOT_VISIBLE',
  CANDIDATE_NOT_PRESENT = 'CANDIDATE_NOT_PRESENT',
  FACE_PARTIALLY_VISIBLE = 'FACE_PARTIALLY_VISIBLE',
  ANOTHER_PERSON = 'ANOTHER_PERSON',
  IMPERSONATION_SUSPECTED = 'IMPERSONATION_SUSPECTED',
  LOOKING_AWAY = 'LOOKING_AWAY',
  MOBILE_PHONE_DETECTED = 'MOBILE_PHONE_DETECTED',
  PROHIBITED_OBJECT = 'PROHIBITED_OBJECT',
  SCREEN_SHARE_STOPPED = 'SCREEN_SHARE_STOPPED',
  CAMERA_STOPPED = 'CAMERA_STOPPED',
  MICROPHONE_STOPPED = 'MICROPHONE_STOPPED',
  TAB_SWITCH = 'TAB_SWITCH',
  WINDOW_FOCUS_LOST = 'WINDOW_FOCUS_LOST',
  FULLSCREEN_EXIT = 'FULLSCREEN_EXIT',
  NETWORK_DISCONNECT = 'NETWORK_DISCONNECT',
  REFRESH_ATTEMPT = 'REFRESH_ATTEMPT',
  MULTIPLE_SESSION = 'MULTIPLE_SESSION',
  RECORDING_FAILURE = 'RECORDING_FAILURE',
  MULTIPLE_FACES = 'MULTIPLE_FACES',
  FACE_NOT_FOUND = 'FACE_NOT_FOUND',
  NO_FACE_DETECTED = 'NO_FACE_DETECTED',
  MEDIA_STOPPED = 'MEDIA_STOPPED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  COPY_PASTE = 'COPY_PASTE',
  COPY_PASTE_ATTEMPT = 'COPY_PASTE_ATTEMPT',
  UNAUTHORIZED_DEVICE = 'UNAUTHORIZED_DEVICE',
  DEVTOOLS_OPEN = 'DEVTOOLS_OPEN',
  VOICE_DETECTED = 'VOICE_DETECTED',
  SUSPICIOUS_OBJECT = 'SUSPICIOUS_OBJECT'
}

export enum ViolationSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface IViolationEvent extends Document {
  attemptId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  type: ViolationType | string;
  severity: ViolationSeverity | string;
  source: 'BROWSER' | 'AI' | 'SYSTEM' | 'PROCTOR' | string;
  confidence?: number;
  detectedAt: Date;
  duration?: number;
  actionTaken: 'LOG' | 'WARNING' | 'PAUSE' | 'FLAG' | 'TERMINATE' | string;
  evidenceIds: mongoose.Types.ObjectId[];
  reviewerId?: mongoose.Types.ObjectId;
  reviewerDecision?: string;
  notes?: string;
  description?: string;
  screenshot?: string;
  snapshotImage?: string;
  driveUrl?: string;
  driveFolderUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ViolationEventSchema: Schema = new Schema({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  severity: { type: String, default: 'CRITICAL' },
  source: { type: String, default: 'BROWSER' },
  confidence: { type: Number },
  detectedAt: { type: Date, default: Date.now },
  duration: { type: Number },
  actionTaken: { type: String, default: 'LOG' },
  evidenceIds: [{ type: Schema.Types.ObjectId, ref: 'Evidence' }],
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewerDecision: { type: String },
  notes: { type: String },
  description: { type: String },
  screenshot: { type: String },
  snapshotImage: { type: String },
  driveUrl: { type: String },
  driveFolderUrl: { type: String }
}, { timestamps: true, strict: false });

export default mongoose.model<IViolationEvent>('ViolationEvent', ViolationEventSchema);
