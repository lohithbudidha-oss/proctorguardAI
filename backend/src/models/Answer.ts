import mongoose, { Schema, Document } from 'mongoose';

export interface IAnswer extends Document {
  attemptId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  selectedAnswer: any; // Format depends on question type
  isMarkedForReview: boolean;
  isCorrect?: boolean;
  marksAwarded?: number;
  savedAt: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnswerSchema: Schema = new Schema({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true },
  questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
  selectedAnswer: { type: Schema.Types.Mixed },
  isMarkedForReview: { type: Boolean, default: false },
  isCorrect: { type: Boolean },
  marksAwarded: { type: Number },
  savedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date }
}, { timestamps: true });

// Create a compound index so there's only one answer document per attempt/question combo
AnswerSchema.index({ attemptId: 1, questionId: 1 }, { unique: true });

export default mongoose.model<IAnswer>('Answer', AnswerSchema);
