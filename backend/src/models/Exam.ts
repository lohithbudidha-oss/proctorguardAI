import mongoose, { Schema, Document } from 'mongoose';

export enum ExamStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED'
}

export enum ResultVisibility {
  IMMEDIATE = 'IMMEDIATE',
  DELAYED = 'DELAYED',
  HIDDEN = 'HIDDEN'
}

export interface IExam extends Document {
  title: string;
  description: string;
  instructions: string;
  duration: number; // in minutes
  startAt?: Date;
  endAt?: Date;
  attemptLimit: number;
  scoringRules: {
    positiveMarks: number;
    negativeMarks: number;
  };
  resultVisibility: ResultVisibility;
  proctoringConfig: {
    cameraRequired: boolean;
    screenShareRequired: boolean;
    fullscreenRequired: boolean;
    tabSwitchPolicy: string; // e.g., 'STRICT', 'LENIENT'
    networkGracePeriod: number; // in seconds
    recordingRetentionPeriod: number; // in days
  };
  status: ExamStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const ExamSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  instructions: { type: String },
  duration: { type: Number, required: true },
  startAt: { type: Date },
  endAt: { type: Date },
  attemptLimit: { type: Number, default: 1 },
  scoringRules: {
    positiveMarks: { type: Number, default: 1 },
    negativeMarks: { type: Number, default: 0 }
  },
  resultVisibility: { type: String, enum: Object.values(ResultVisibility), default: ResultVisibility.HIDDEN },
  proctoringConfig: {
    cameraRequired: { type: Boolean, default: false },
    screenShareRequired: { type: Boolean, default: false },
    fullscreenRequired: { type: Boolean, default: false },
    tabSwitchPolicy: { type: String, default: 'STRICT' },
    networkGracePeriod: { type: Number, default: 300 },
    recordingRetentionPeriod: { type: Number, default: 30 }
  },
  status: { type: String, enum: Object.values(ExamStatus), default: ExamStatus.DRAFT },
  version: { type: Number, default: 1 }
}, { timestamps: true });

export default mongoose.model<IExam>('Exam', ExamSchema);
