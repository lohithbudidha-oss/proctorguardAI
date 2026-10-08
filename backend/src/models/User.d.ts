import mongoose, { Document } from 'mongoose';
export declare enum Role {
    CANDIDATE = "CANDIDATE",
    ADMIN = "ADMIN",
    PROCTOR = "PROCTOR"
}
export declare enum CandidateStatus {
    PENDING_VERIFICATION = "PENDING_VERIFICATION",
    VERIFIED = "VERIFIED",
    APPROVED = "APPROVED",
    SUSPENDED = "SUSPENDED",
    DEACTIVATED = "DEACTIVATED"
}
export interface IUser extends Document {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
    status: CandidateStatus;
    emailVerifiedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IUser, {}, {}, {}, Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
export default _default;
//# sourceMappingURL=User.d.ts.map