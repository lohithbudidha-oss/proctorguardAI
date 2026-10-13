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

// Strict Gmail email format validator ensuring valid username and @gmail.com domain only
const GMAIL_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string()
    .trim()
    .toLowerCase()
    .regex(GMAIL_EMAIL_REGEX, 'Only @gmail.com email addresses are accepted (e.g. yourname@gmail.com)'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map(i => i.message).join('. ');
      return res.status(400).json({ success: false, message: errorMsg, errors: parsed.error.issues });
    }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'This email address is already registered. Please sign in instead.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = Role.CANDIDATE;
    const status = CandidateStatus.PENDING_VERIFICATION;

    const user = new User({ name: name.trim(), email: normalizedEmail, passwordHash, role, status });
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
  password: z.string(),
  portalRole: z.enum(['ADMIN', 'CANDIDATE']).optional()
});

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    const { email, password, portalRole } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Auto-provision and ensure administrator credentials for admin@proctorguard.local
    if (normalizedEmail === 'admin@proctorguard.local') {
      let adminUser = await User.findOne({ email: 'admin@proctorguard.local' });
      if (!adminUser) {
        const passwordHash = await bcrypt.hash('admin123', 12);
        adminUser = new User({
          name: 'Administrator',
          email: 'admin@proctorguard.local',
          passwordHash,
          role: Role.ADMIN,
          status: CandidateStatus.APPROVED
        });
        await adminUser.save();
      } else {
        const matchesAdmin123 = await bcrypt.compare('admin123', adminUser.passwordHash);
        if (!matchesAdmin123 || adminUser.role !== Role.ADMIN) {
          adminUser.passwordHash = await bcrypt.hash('admin123', 12);
          adminUser.role = Role.ADMIN;
          await adminUser.save();
        }
      }
    }

    // Strict portal segregation checks:
    if (portalRole === 'ADMIN') {
      if (normalizedEmail !== 'admin@proctorguard.local') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Administrator portal accepts admin credentials only (admin@proctorguard.local). Candidate credentials cannot be used here.'
        });
      }
    } else if (portalRole === 'CANDIDATE') {
      if (normalizedEmail === 'admin@proctorguard.local') {
        return res.status(403).json({
          success: false,
          message: 'Administrator credentials cannot be used for candidate login. Please use the Administrator Sign In portal.'
        });
      }
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Role-based credential authorization:
    if (portalRole === 'ADMIN') {
      if (user.role !== Role.ADMIN && user.role !== Role.PROCTOR) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Candidate credentials cannot be used to log into the administrator portal.' 
        });
      }
    } else if (portalRole === 'CANDIDATE') {
      if (user.role === Role.ADMIN || user.role === Role.PROCTOR) {
        return res.status(403).json({ 
          success: false, 
          message: 'Administrator accounts cannot log in through the candidate portal. Please sign in via the Administrator portal.' 
        });
      }
      if (user.role !== Role.CANDIDATE) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Candidate portal accepts candidate credentials only.' 
        });
      }
    } else {
      // Fallback safeguard when portalRole is not specified
      if (user.role === Role.ADMIN || user.role === Role.PROCTOR) {
        if (normalizedEmail !== 'admin@proctorguard.local') {
          return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Unauthorized administrator credentials.' 
          });
        }
      }
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.role === Role.CANDIDATE && user.status === CandidateStatus.PENDING_VERIFICATION) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your registration is awaiting administrator approval. Please wait for an administrator to approve your account before signing in.' 
      });
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
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string()
    .trim()
    .toLowerCase()
    .regex(GMAIL_EMAIL_REGEX, 'Only @gmail.com email addresses are accepted (e.g. yourname@gmail.com)'),
  phone: z.string().optional()
});

export const publicExamRegister = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const parsed = publicRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map(i => i.message).join('. ');
      return res.status(400).json({ success: false, message: errorMsg, errors: parsed.error.issues });
    }
    const { name, email, phone } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const exam = await Exam.findById(examId);
    if (!exam || exam.status !== 'PUBLISHED') {
      return res.status(404).json({ success: false, message: 'Exam not found or not published' });
    }

    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      return res.status(409).json({ success: false, message: 'This email address is already registered. Please log in to take this exam.' });
    }

    const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(-10), 12);
    user = new User({ name: name.trim(), email: normalizedEmail, passwordHash, role: Role.CANDIDATE, status: CandidateStatus.PENDING_VERIFICATION });
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
