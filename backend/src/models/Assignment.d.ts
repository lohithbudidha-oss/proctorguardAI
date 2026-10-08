import mongoose, { Document } from 'mongoose';
export declare enum AssignmentStatus {
    PENDING = "PENDING",
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    EXPIRED = "EXPIRED"
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
declare const _default: mongoose.Model<IAssignment, {}, {}, {}, Document<unknown, {}, IAssignment, {}, mongoose.DefaultSchemaOptions> & IAssignment & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IAssignment & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
export default _default;
//# sourceMappingURL=Assignment.d.ts.map