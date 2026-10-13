import mongoose, { Schema, Document } from 'mongoose';

export type TicketCategory = 'TECHNICAL' | 'EXAM_ACCESS' | 'ORGANIZATION' | 'OTHER';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ISupportTicket extends Document {
  name: string;
  email: string;
  category: TicketCategory;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  adminNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  category: { 
    type: String, 
    enum: ['TECHNICAL', 'EXAM_ACCESS', 'ORGANIZATION', 'OTHER'], 
    default: 'TECHNICAL' 
  },
  message: { type: String, required: true, trim: true },
  status: { 
    type: String, 
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], 
    default: 'OPEN' 
  },
  priority: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], 
    default: 'MEDIUM' 
  },
  adminNotes: { type: String, default: '' },
  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  ipAddress: { type: String },
  userAgent: { type: String }
}, { timestamps: true });

SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ email: 1 });
SupportTicketSchema.index({ category: 1 });

export default mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
