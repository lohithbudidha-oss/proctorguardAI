import mongoose, { Document } from 'mongoose';
export declare enum ExamStatus {
    DRAFT = "DRAFT",
    PUBLISHED = "PUBLISHED",
    SCHEDULED = "SCHEDULED",
    ACTIVE = "ACTIVE",
    CLOSED = "CLOSED",
    ARCHIVED = "ARCHIVED"
}
export declare enum ResultVisibility {
    IMMEDIATE = "IMMEDIATE",
    DELAYED = "DELAYED",
    HIDDEN = "HIDDEN"
}
export interface IExam extends Document {
    title: string;
    description: string;
    instructions: string;
    duration: number;
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
        tabSwitchPolicy: string;
        networkGracePeriod: number;
        recordingRetentionPeriod: number;
    };
    status: ExamStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IExam, {}, {}, {}, Document<unknown, {}, IExam, {}, mongoose.DefaultSchemaOptions> & IExam & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IExam & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
export default _default;
//# sourceMappingURL=Exam.d.ts.map