import mongoose, { Document } from 'mongoose';
export declare enum QuestionType {
    SINGLE_CHOICE = "SINGLE_CHOICE",
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
    TRUE_FALSE = "TRUE_FALSE",
    NUMERIC = "NUMERIC",
    SHORT_TEXT = "SHORT_TEXT"
}
export declare enum Difficulty {
    EASY = "EASY",
    MEDIUM = "MEDIUM",
    HARD = "HARD"
}
export interface IQuestion extends Document {
    examId?: mongoose.Types.ObjectId;
    questionBankId?: mongoose.Types.ObjectId;
    type: QuestionType;
    text: string;
    options: {
        id: string;
        text: string;
    }[];
    correctAnswer: any;
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
declare const _default: mongoose.Model<IQuestion, {}, {}, {}, Document<unknown, {}, IQuestion, {}, mongoose.DefaultSchemaOptions> & IQuestion & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IQuestion & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
export default _default;
//# sourceMappingURL=Question.d.ts.map