import mongoose, { Schema, Document } from 'mongoose';

export enum Role {
  CANDIDATE = 'CANDIDATE',
  ADMIN = 'ADMIN',
  PROCTOR = 'PROCTOR'
}

export enum CandidateStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  APPROVED = 'APPROVED',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED'
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

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: Object.values(Role), default: Role.CANDIDATE },
  status: { type: String, enum: Object.values(CandidateStatus), default: CandidateStatus.PENDING_VERIFICATION },
  emailVerifiedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);
