import mongoose, { Document } from 'mongoose';
export declare enum AttemptStatus {
    IN_PROGRESS = "IN_PROGRESS",
    SUBMITTED = "SUBMITTED",
    LOCKED = "LOCKED",
    EVALUATED = "EVALUATED",
    TERMINATED = "TERMINATED"
}
export interface IAttempt extends Document {
    examId: mongoose.Types.ObjectId;
    candidateId: mongoose.Types.ObjectId;
    assignmentId: mongoose.Types.ObjectId;
    examVersion: number;
    startedAt: Date;
    submittedAt?: Date;
    status: AttemptStatus;
    score?: number;
    percentage?: number;
    resultStatus?: 'PASS' | 'FAIL';
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IAttempt, {}, {}, {}, Document<unknown, {}, IAttempt, {}, mongoose.DefaultSchemaOptions> & IAttempt & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IAttempt & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
export default _default;
//# sourceMappingURL=Attempt.d.ts.map