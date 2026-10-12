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

import Result from '../models/Result';
import ViolationEvent from '../models/ViolationEvent';

export const getLiveCandidates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await Attempt.find()
      .populate('candidateId', 'name email')
      .populate('examId', 'title duration scoringRules')
      .sort({ updatedAt: -1, createdAt: -1 });

    const attemptsData = await Promise.all(
      attempts
        .filter((doc: any) => doc.candidateId && doc.examId)
        .map(async (doc: any) => {
          const candidate = doc.candidateId;
          const exam = doc.examId;
          const result = await Result.findOne({ attemptId: doc._id });
          const violations = await ViolationEvent.find({ attemptId: doc._id }).sort({ detectedAt: -1 });

          const riskScore = violations.reduce((acc, v) => acc + (v.severity === 'CRITICAL' ? 40 : v.severity === 'HIGH' ? 20 : 5), 0);

          return {
            attemptId: doc._id,
            candidateId: candidate._id,
            name: candidate.name,
            email: candidate.email,
            examId: exam._id,
            examName: exam.title,
            status: doc.status,
            startedAt: doc.startedAt,
            submittedAt: doc.submittedAt,
            expiresAt: doc.expiresAt,
            score: result ? result.obtainedMarks : doc.score ?? 0,
            totalMarks: result ? result.totalMarks : 0,
            percentage: result ? result.percentage : doc.percentage ?? 0,
            resultStatus: result ? (result.pass ? 'PASS' : 'FAIL') : doc.resultStatus ?? 'PENDING',
            totalQuestions: result ? result.totalQuestions : 0,
            attempted: result ? result.attempted : 0,
            correct: result ? result.correct : 0,
            wrong: result ? result.wrong : 0,
            unanswered: result ? result.unanswered : 0,
            timeTaken: result ? result.timeTaken : 0,
            riskScore: Math.min(100, result?.riskScore ?? riskScore),
            violations: violations.map(v => ({
              id: v._id,
              type: v.type,
              severity: v.severity,
              detectedAt: v.detectedAt,
              description: v.description || '',
              screenshot: v.screenshot || '',
              snapshotImage: v.screenshot || '',
              actionTaken: v.actionTaken
            })),
            camera: 'STARTED',
            screen: 'STARTED'
          };
        })
    );

    res.status(200).json({ success: true, candidates: attemptsData });
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

export const getResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await Result.find()
      .populate('candidateId', 'name email')
      .populate('examId', 'title')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, results });
  } catch (err) {
    next(err);
  }
};

export const verifyResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await Result.findByIdAndUpdate(id, { status }, { new: true });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
};

export const getDriveStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { googleDriveService } = require('../services/googleDriveService');
    const status = googleDriveService.getDriveStatus();
    res.status(200).json({ success: true, ...status });
  } catch (err) {
    next(err);
  }
};

