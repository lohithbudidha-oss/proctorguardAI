import mongoose, { Schema, Document } from 'mongoose';

export enum EvidenceType {
  VIDEO_SEGMENT = 'VIDEO_SEGMENT',
  SCREEN_SEGMENT = 'SCREEN_SEGMENT',
  CAMERA_SNAPSHOT = 'CAMERA_SNAPSHOT',
  SCREENSHOT = 'SCREENSHOT',
  AUDIO_SEGMENT = 'AUDIO_SEGMENT',
  EVENT_METADATA = 'EVENT_METADATA'
}

export interface IEvidence extends Document {
  attemptId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  violationId?: mongoose.Types.ObjectId;
  recordingSessionId?: mongoose.Types.ObjectId;
  recordingChunkId?: mongoose.Types.ObjectId;
  type: EvidenceType;
  captureTime: Date;
  startTime?: Date;
  endTime?: Date;
  storageKey?: string;
  mimeType?: string;
  byteSize?: number;
  checksum?: string;
  severity: string;
  description: string;
  createdAt: Date;
  accessCount: number;
  lastAccessedAt?: Date;
}

const EvidenceSchema: Schema = new Schema({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  violationId: { type: Schema.Types.ObjectId, ref: 'ViolationEvent' },
  recordingSessionId: { type: Schema.Types.ObjectId, ref: 'RecordingSession' },
  recordingChunkId: { type: Schema.Types.ObjectId, ref: 'RecordingChunk' },
  type: { type: String, enum: Object.values(EvidenceType), required: true },
  captureTime: { type: Date, required: true },
  startTime: { type: Date },
  endTime: { type: Date },
  storageKey: { type: String },
  mimeType: { type: String },
  byteSize: { type: Number },
  checksum: { type: String },
  severity: { type: String, required: true },
  description: { type: String, required: true },
  accessCount: { type: Number, default: 0 },
  lastAccessedAt: { type: Date }
}, { timestamps: true });

EvidenceSchema.index({ attemptId: 1 });
EvidenceSchema.index({ violationId: 1 });

export default mongoose.model<IEvidence>('Evidence', EvidenceSchema);
