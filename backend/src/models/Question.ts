import mongoose, { Schema, Document } from 'mongoose';

export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  NUMERIC = 'NUMERIC',
  SHORT_TEXT = 'SHORT_TEXT'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface IQuestion extends Document {
  examId?: mongoose.Types.ObjectId; // Optional: Can belong directly to an exam
  questionBankId?: mongoose.Types.ObjectId; // Or belong to a bank
  type: QuestionType;
  text: string;
  options: { id: string; text: string }[];
  correctAnswer: any; // The structure depends on the question type
  marks: number;
  negativeMarks: number;
  category: string;
  topic?: string;
  difficulty: Difficulty;
  explanation?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema: Schema = new Schema({
  examId: { type: Schema.Types.ObjectId, ref: 'Exam' },
  questionBankId: { type: Schema.Types.ObjectId, ref: 'QuestionBank' },
  type: { type: String, enum: Object.values(QuestionType), required: true },
  text: { type: String, required: true },
  options: [{ id: String, text: String }], // Optional for SHORT_TEXT/NUMERIC
  correctAnswer: { type: Schema.Types.Mixed, required: true },
  marks: { type: Number, default: 1 },
  negativeMarks: { type: Number, default: 0 },
  category: { type: String, required: true },
  topic: { type: String },
  difficulty: { type: String, enum: Object.values(Difficulty), default: Difficulty.MEDIUM },
  explanation: { type: String },
  status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' }
}, { timestamps: true });

export default mongoose.model<IQuestion>('Question', QuestionSchema);
