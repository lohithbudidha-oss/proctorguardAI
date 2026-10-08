import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { CandidateStatus } from '../models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aptitude_portal';

async function approveAll() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await User.updateMany(
      { status: CandidateStatus.PENDING_VERIFICATION },
      { $set: { status: CandidateStatus.APPROVED } }
    );

    console.log(`Successfully approved ${result.modifiedCount} pending users.`);
    process.exit(0);
  } catch (err) {
    console.error('Error approving users:', err);
    process.exit(1);
  }
}

approveAll();
