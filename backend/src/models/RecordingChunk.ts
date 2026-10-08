import mongoose, { Schema, Document } from 'mongoose';

export interface IRecordingChunk extends Document {
  recordingSessionId: mongoose.Types.ObjectId;
  attemptId: mongoose.Types.ObjectId;
  sequenceNumber: number;
  storageKey: string;
  byteSize: number;
  mimeType: string;
  checksum: string;
  startedAt: Date;
  endedAt: Date;
  uploadStatus: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  uploadedAt?: Date;
  retryCount: number;
}

const RecordingChunkSchema: Schema = new Schema({
  recordingSessionId: { type: Schema.Types.ObjectId, ref: 'RecordingSession', required: true },
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true },
  sequenceNumber: { type: Number, required: true },
  storageKey: { type: String, required: true },
  byteSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  checksum: { type: String, required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  uploadStatus: { type: String, enum: ['PENDING', 'UPLOADING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  uploadedAt: { type: Date },
  retryCount: { type: Number, default: 0 }
}, { timestamps: true });

RecordingChunkSchema.index({ recordingSessionId: 1, sequenceNumber: 1 }, { unique: true });
RecordingChunkSchema.index({ attemptId: 1 });

export default mongoose.model<IRecordingChunk>('RecordingChunk', RecordingChunkSchema);
