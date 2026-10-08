import mongoose, { Schema, Document } from 'mongoose';

export enum RecordingType {
  CAMERA = 'CAMERA',
  SCREEN = 'SCREEN',
  AUDIO = 'AUDIO'
}

export enum RecordingStatus {
  RECORDING = 'RECORDING',
  UPLOADING = 'UPLOADING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface IRecording extends Document {
  attemptId: mongoose.Types.ObjectId;
  type: RecordingType;
  status: RecordingStatus;
  storageBucket: string;
  objectKey: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  size?: number;
  checksum?: string;
  retentionUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RecordingSchema: Schema = new Schema({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true },
  type: { type: String, enum: Object.values(RecordingType), required: true },
  status: { type: String, enum: Object.values(RecordingStatus), default: RecordingStatus.RECORDING },
  storageBucket: { type: String, required: true },
  objectKey: { type: String, required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  duration: { type: Number },
  size: { type: Number },
  checksum: { type: String },
  retentionUntil: { type: Date }
}, { timestamps: true });

export default mongoose.model<IRecording>('Recording', RecordingSchema);
