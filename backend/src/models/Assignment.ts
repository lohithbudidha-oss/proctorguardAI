import mongoose, { Schema, Document } from 'mongoose';

export enum AssignmentStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED'
}

export interface IAssignment extends Document {
  examId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  allowedAttempts: number;
  scheduledAt: Date;
  status: AssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema: Schema = new Schema({
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  allowedAttempts: { type: Number, default: 1 },
  scheduledAt: { type: Date, required: true },
  status: { type: String, enum: Object.values(AssignmentStatus), default: AssignmentStatus.PENDING }
}, { timestamps: true });

export default mongoose.model<IAssignment>('Assignment', AssignmentSchema);
