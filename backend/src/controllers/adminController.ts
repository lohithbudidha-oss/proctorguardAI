import { Request, Response, NextFunction } from 'express';
import User, { Role } from '../models/User';
import Attempt, { AttemptStatus } from '../models/Attempt';

export const getCandidates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const candidates = await User.find({ role: Role.CANDIDATE }).select('-password');
    res.json({ success: true, candidates });
  } catch (err) {
    next(err);
  }
};

export const updateCandidateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Candidate not found' });
    user.status = status;
    await user.save();
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    next(err);
  }
};

export const approveCandidate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user || user.role !== Role.CANDIDATE) return res.status(404).json({ success: false, message: 'Candidate not found' });
    user.status = 'APPROVED' as any;
    await user.save();
    res.status(200).json({ success: true, message: 'Candidate approved successfully' });
  } catch (err) {
    next(err);
  }
};

export const getLiveCandidates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await Attempt.find({ 
      status: { $in: [AttemptStatus.IN_PROGRESS, AttemptStatus.PAUSED, AttemptStatus.LOCKED] },
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: { $exists: false } },
        { expiresAt: null }
      ]
    })
      .populate('candidateId', 'name email')
      .populate('examId', 'title');

    const liveData = attempts
      .filter((doc: any) => doc.candidateId && doc.examId)
      .map((doc: any) => {
        const candidate = doc.candidateId;
        const exam = doc.examId;
        return {
          attemptId: doc._id,
          candidateId: candidate._id,
          name: candidate.name,
          examId: exam._id,
          examName: exam.title,
          status: doc.status,
          startedAt: doc.startedAt,
          expiresAt: doc.expiresAt,
          camera: 'STARTED',
          screen: 'STARTED',
          riskScore: 0,
          violations: []
        };
    });
    res.status(200).json({ success: true, candidates: liveData });
  } catch (err) {
    next(err);
  }
};

export const lockAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const attempt = await Attempt.findById(attemptId);
    if (!attempt || !['IN_PROGRESS', 'PAUSED'].includes(attempt.status)) return res.status(400).json({ success: false, message: 'Attempt cannot be locked' });
    attempt.status = 'LOCKED' as any;
    await attempt.save();
    res.status(200).json({ success: true, message: 'Attempt locked' });
  } catch (err) {
    next(err);
  }
};

export const unlockAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const attempt = await Attempt.findById(attemptId);
    if (!attempt || attempt.status !== 'LOCKED') return res.status(400).json({ success: false, message: 'Attempt is not locked' });
    attempt.status = 'IN_PROGRESS' as any;
    await attempt.save();
    res.status(200).json({ success: true, message: 'Attempt unlocked' });
  } catch (err) {
    next(err);
  }
};

export const forceSubmitAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const attempt = await Attempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (['TERMINATED', 'SUBMITTED', 'AUTO_SUBMITTED', 'FORCE_SUBMITTED'].includes(attempt.status)) return res.status(400).json({ success: false, message: 'Already finalized' });
    attempt.status = 'FORCE_SUBMITTED' as any;
    attempt.submittedAt = new Date();
    await attempt.save();

    const Assignment = require('../models/Assignment').default;
    const assignment = await Assignment.findById(attempt.assignmentId);
    if (assignment) {
      assignment.status = 'COMPLETED';
      await assignment.save();
    }

    const { evaluateAttempt } = require('./attemptController');
    await evaluateAttempt(attemptId, attempt.candidateId.toString());
    res.status(200).json({ success: true, message: 'Attempt force submitted' });
  } catch (err) {
    next(err);
  }
};

import ViolationEvent from '../models/ViolationEvent';

export const getViolations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const violations = await ViolationEvent.find()
      .populate('candidateId', 'name email')
      .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } })
      .sort({ detectedAt: -1 })
      .limit(100);
      
    res.status(200).json({ success: true, violations });
  } catch (err) {
    next(err);
  }
};
