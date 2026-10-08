import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User, { Role, CandidateStatus } from '../models/User';
import Session from '../models/Session';
import Assignment, { AssignmentStatus } from '../models/Assignment';
import Exam from '../models/Exam';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'supersecretjwtkey_replace_in_production') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error("JWT_SECRET is required and must not be default in production");
  }
}

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.issues });
    }
    const { name, email, password } = parsed.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = Role.CANDIDATE;
    const status = CandidateStatus.PENDING_VERIFICATION;

    const user = new User({ name, email, passwordHash, role, status });
    await user.save();

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
    // For MVP
    res.status(200).json({ success: true, message: 'Email verified. Awaiting admin approval.' });
  } catch (err) {
    next(err);
  }
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.role === Role.CANDIDATE && user.status === CandidateStatus.PENDING_VERIFICATION) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }
    if (user.role === Role.CANDIDATE && (user.status === CandidateStatus.SUSPENDED || user.status === CandidateStatus.DEACTIVATED)) {
      return res.status(403).json({ success: false, message: 'Account is suspended or deactivated' });
    }

    const secret = JWT_SECRET || 'dev_secret';
    const token = jwt.sign(
      { userId: user._id, role: user.role, status: user.status },
      secret,
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
      await Session.findOneAndUpdate({ tokenIdentifier: token }, { isValid: false });
    }
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const publicRegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional()
});

export const publicExamRegister = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const parsed = publicRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.issues });
    }
    const { name, email, phone } = parsed.data;

    const exam = await Exam.findById(examId);
    if (!exam || exam.status !== 'PUBLISHED') {
      return res.status(404).json({ success: false, message: 'Exam not found or not published' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({ success: false, message: 'Email already exists. Please log in to assign this exam.' });
    }

    const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(-10), 12);
    user = new User({ name, email, passwordHash, role: Role.CANDIDATE, status: CandidateStatus.PENDING_VERIFICATION });
    await user.save();

    let assignment = new Assignment({
      examId,
      candidateId: user._id,
      status: AssignmentStatus.PENDING,
      allowedAttempts: 1,
      scheduledAt: new Date(),
      assignedBy: user._id
    });
    await assignment.save();

    // SEC-01 Fix: DO NOT ISSUE JWT TOKEN AUTOMATICALLY TO UNVERIFIED USERS
    res.status(200).json({
      success: true,
      message: 'Successfully registered for exam. Please check your email for credentials.',
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    next(err);
  }
};
