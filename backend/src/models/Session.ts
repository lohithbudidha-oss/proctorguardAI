import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  tokenIdentifier: string; // The specific JWT fingerprint or token string to invalidate
  isValid: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const SessionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenIdentifier: { type: String, required: true, unique: true },
  isValid: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Auto-delete expired sessions (TTL index)
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ISession>('Session', SessionSchema);
