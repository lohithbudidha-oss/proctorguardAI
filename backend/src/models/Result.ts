import mongoose, { Schema, Document } from 'mongoose';

export interface IResult extends Document {
  attemptId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  pass: boolean;
  timeTaken: number; // in seconds
  riskScore: number;
  violations: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
}

const ResultSchema: Schema = new Schema({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  totalQuestions: { type: Number, required: true },
  attempted: { type: Number, required: true },
  correct: { type: Number, required: true },
  wrong: { type: Number, required: true },
  unanswered: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  obtainedMarks: { type: Number, required: true },
  percentage: { type: Number, required: true },
  pass: { type: Boolean, required: true },
  timeTaken: { type: Number, required: true },
  riskScore: { type: Number, default: 0 },
  violations: { type: Number, default: 0 },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' }
}, { timestamps: true });

export default mongoose.model<IResult>('Result', ResultSchema);
