import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User, { Role, CandidateStatus } from '../models/User';
import Session from '../models/Session';
import Assignment, { AssignmentStatus } from '../models/Assignment';
import Exam from '../models/Exam';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_replace_in_production';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // If first user, make them ADMIN
    const isFirstUser = (await User.countDocuments()) === 0;
    const role = isFirstUser ? Role.ADMIN : Role.CANDIDATE;
    // Set new candidates to pending so admin must approve them
    const status = CandidateStatus.PENDING_VERIFICATION;

    const user = new User({ name, email, passwordHash, role, status });
    await user.save();

    // TODO: Send verification email here if role is CANDIDATE

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status }
    });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    // For MVP, we can simulate token validation or decode JWT email token
    // Example: verify token -> find user -> update status to VERIFIED
    res.status(200).json({ success: true, message: 'Email verified. Awaiting admin approval.' });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Role specific checks
    if (user.role === Role.CANDIDATE && user.status === CandidateStatus.PENDING_VERIFICATION) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }
    
    if (user.role === Role.CANDIDATE && (user.status === CandidateStatus.SUSPENDED || user.status === CandidateStatus.DEACTIVATED)) {
      return res.status(403).json({ success: false, message: 'Account is suspended or deactivated' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // REM-08: Create server-side session for revocation
    const session = new Session({
      userId: user._id,
      tokenIdentifier: token,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
    });
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status }
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      // REM-08: Invalidate session
      await Session.findOneAndUpdate({ tokenIdentifier: token }, { isValid: false });
    }
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

import bcrypt from 'bcrypt';

export const publicExamRegister = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const { name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    if (exam.status !== 'PUBLISHED') {
      return res.status(403).json({ success: false, message: 'This exam is not currently published.' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(-10), 12);
      user = new User({ name, email, passwordHash, role: Role.CANDIDATE, status: CandidateStatus.PENDING_VERIFICATION });
      await user.save();
    }

    let assignment = await Assignment.findOne({ candidateId: user._id, examId });
    if (!assignment) {
      assignment = new Assignment({
        examId,
        candidateId: user._id,
        status: AssignmentStatus.PENDING,
        allowedAttempts: 1,
        scheduledAt: new Date(),
        assignedBy: user._id
      });
      await assignment.save();
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const session = new Session({
      userId: user._id,
      tokenIdentifier: token,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
    });
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Successfully registered for exam',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    next(err);
  }
};
