import mongoose, { Schema, Document } from 'mongoose';

export enum AttemptStatus {
  ASSIGNED = 'ASSIGNED',
  READY = 'READY',
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  LOCKED = 'LOCKED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  SUBMITTED = 'SUBMITTED',
  AUTO_SUBMITTED = 'AUTO_SUBMITTED',
  FORCE_SUBMITTED = 'FORCE_SUBMITTED',
  TERMINATED = 'TERMINATED',
  INVALIDATED = 'INVALIDATED',
  COMPLETED = 'COMPLETED'
}

export interface IAttempt extends Document {
  examId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  assignmentId: mongoose.Types.ObjectId;
  examVersion: number;
  startedAt: Date;
  expiresAt?: Date;
  durationSeconds?: number;
  submittedAt?: Date;
  status: AttemptStatus;
  score?: number;
  percentage?: number;
  resultStatus?: 'PASS' | 'FAIL';
  createdAt: Date;
  updatedAt: Date;
}

const AttemptSchema: Schema = new Schema({
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
  examVersion: { type: Number, required: true },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date },
  durationSeconds: { type: Number },
  submittedAt: { type: Date },
  status: { type: String, enum: Object.values(AttemptStatus), default: AttemptStatus.IN_PROGRESS },
  score: { type: Number },
  percentage: { type: Number },
  resultStatus: { type: String, enum: ['PASS', 'FAIL'] }
}, { timestamps: true });

export default mongoose.model<IAttempt>('Attempt', AttemptSchema);
