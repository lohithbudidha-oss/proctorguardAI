import mongoose, { Schema, Document } from 'mongoose';

export enum RecordingType {
  CAMERA = 'CAMERA',
  SCREEN = 'SCREEN',
  AUDIO = 'AUDIO'
}

export enum RecordingStatus {
  NOT_STARTED = 'NOT_STARTED',
  REQUESTING = 'REQUESTING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  UPLOADING = 'UPLOADING',
  INTERRUPTED = 'INTERRUPTED',
  RECOVERING = 'RECOVERING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  STOPPED = 'STOPPED'
}

export interface IRecordingSession extends Document {
  attemptId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  type: RecordingType;
  status: RecordingStatus;
  startedAt?: Date;
  stoppedAt?: Date;
  lastChunkAt?: Date;
  totalDurationSeconds: number;
  totalChunks: number;
  totalBytes: number;
  mimeType?: string;
  codec?: string;
  storageProvider: string;
  storagePrefix: string;
  finalObjectKey?: string;
  checksum?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecordingSessionSchema: Schema = new Schema({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  type: { type: String, enum: Object.values(RecordingType), required: true },
  status: { type: String, enum: Object.values(RecordingStatus), default: RecordingStatus.NOT_STARTED },
  startedAt: { type: Date },
  stoppedAt: { type: Date },
  lastChunkAt: { type: Date },
  totalDurationSeconds: { type: Number, default: 0 },
  totalChunks: { type: Number, default: 0 },
  totalBytes: { type: Number, default: 0 },
  mimeType: { type: String },
  codec: { type: String },
  storageProvider: { type: String, default: 's3' },
  storagePrefix: { type: String, required: true },
  finalObjectKey: { type: String },
  checksum: { type: String }
}, { timestamps: true });

RecordingSessionSchema.index({ attemptId: 1, type: 1 });
RecordingSessionSchema.index({ status: 1 });

export default mongoose.model<IRecordingSession>('RecordingSession', RecordingSessionSchema);
