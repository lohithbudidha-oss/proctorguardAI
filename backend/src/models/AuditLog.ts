import mongoose, { Schema, Document } from 'mongoose';

export enum AuditAction {
  RECORDING_STARTED = 'RECORDING_STARTED',
  RECORDING_STOPPED = 'RECORDING_STOPPED',
  RECORDING_COMPLETED = 'RECORDING_COMPLETED',
  RECORDING_FAILED = 'RECORDING_FAILED',
  EVIDENCE_CREATED = 'EVIDENCE_CREATED',
  EVIDENCE_VIEWED = 'EVIDENCE_VIEWED',
  PLAYBACK_REQUESTED = 'PLAYBACK_REQUESTED',
  SIGNED_URL_GENERATED = 'SIGNED_URL_GENERATED',
  EVIDENCE_DOWNLOAD_REQUESTED = 'EVIDENCE_DOWNLOAD_REQUESTED',
  EVIDENCE_ACCESS_DENIED = 'EVIDENCE_ACCESS_DENIED'
}

export interface IAuditLog extends Document {
  actorId: mongoose.Types.ObjectId;
  actorRole: string;
  attemptId?: mongoose.Types.ObjectId;
  recordingSessionId?: mongoose.Types.ObjectId;
  evidenceId?: mongoose.Types.ObjectId;
  action: AuditAction;
  timestamp: Date;
  result: string;
  ipAddress?: string;
  userAgent?: string;
}

const AuditLogSchema: Schema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actorRole: { type: String, required: true },
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt' },
  recordingSessionId: { type: Schema.Types.ObjectId, ref: 'RecordingSession' },
  evidenceId: { type: Schema.Types.ObjectId, ref: 'Evidence' },
  action: { type: String, enum: Object.values(AuditAction), required: true },
  timestamp: { type: Date, default: Date.now },
  result: { type: String, required: true },
  ipAddress: { type: String },
  userAgent: { type: String }
});

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
