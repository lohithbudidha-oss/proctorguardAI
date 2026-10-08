import mongoose from 'mongoose';
import Assignment from '../models/Assignment';
import Attempt from '../models/Attempt';
import Result from '../models/Result';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aptitude_portal';

const reset = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    // Reset assignments to PENDING
    const result = await Assignment.updateMany({}, { status: 'PENDING' });
    console.log('Updated assignments:', result.modifiedCount);

    // Clear attempts and results to allow fresh starts
    await Attempt.deleteMany({});
    await Result.deleteMany({});
    console.log('Cleared attempts and results.');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

reset();
