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
  RECORDING_FAILURE = 'RECORDING_FAILURE'
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
  type: ViolationType;
  severity: ViolationSeverity;
  source: 'BROWSER' | 'AI' | 'SYSTEM' | 'PROCTOR';
  confidence?: number;
  detectedAt: Date;
  duration?: number;
  actionTaken: 'LOG' | 'WARNING' | 'PAUSE' | 'FLAG' | 'TERMINATE';
  evidenceIds: mongoose.Types.ObjectId[];
  reviewerId?: mongoose.Types.ObjectId;
  reviewerDecision?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ViolationEventSchema: Schema = new Schema({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: Object.values(ViolationType), required: true },
  severity: { type: String, enum: Object.values(ViolationSeverity), required: true },
  source: { type: String, enum: ['BROWSER', 'AI', 'SYSTEM', 'PROCTOR'], required: true },
  confidence: { type: Number },
  detectedAt: { type: Date, default: Date.now },
  duration: { type: Number },
  actionTaken: { type: String, enum: ['LOG', 'WARNING', 'PAUSE', 'FLAG', 'TERMINATE'], required: true },
  evidenceIds: [{ type: Schema.Types.ObjectId, ref: 'Evidence' }],
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewerDecision: { type: String },
  notes: { type: String }
}, { timestamps: true });

export default mongoose.model<IViolationEvent>('ViolationEvent', ViolationEventSchema);
