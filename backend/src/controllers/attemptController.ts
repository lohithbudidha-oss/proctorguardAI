import { Request, Response, NextFunction } from 'express';
import Attempt, { AttemptStatus } from '../models/Attempt';
import Assignment, { AssignmentStatus } from '../models/Assignment';
import Exam from '../models/Exam';
import Answer from '../models/Answer';
import Result from '../models/Result';
import ViolationEvent from '../models/ViolationEvent';
import { AuthRequest } from '../middleware/authMiddleware';

export const startAttempt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const candidateId = req.user?.userId;

    const User = require('../models/User').default;
    const user = await User.findById(candidateId);
    if (!user || user.status !== 'APPROVED') {
      return res.status(403).json({ success: false, message: 'Your account is pending Admin approval. Please wait.' });
    }

    const assignment = await Assignment.findOne({ examId, candidateId });
    if (!assignment) {
      return res.status(403).json({ success: false, message: 'Valid assignment not found' });
    }
    
    if (assignment.status === AssignmentStatus.COMPLETED || assignment.status === AssignmentStatus.EXPIRED) {
      return res.status(403).json({ success: false, message: 'Assignment is completed or expired' });
    }

    const exam = await Exam.findById(examId);
    if (!exam || exam.status !== 'PUBLISHED') {
      return res.status(404).json({ success: false, message: 'Exam not found or not published' });
    }

    const now = new Date();
    if (exam.startAt && now < exam.startAt) {
      return res.status(403).json({ success: false, message: 'Exam has not started yet' });
    }
    if (exam.endAt && now > exam.endAt) {
      return res.status(403).json({ success: false, message: 'Exam has ended' });
    }

    // Check attempt limits using a transaction-like strict check
    const attemptCount = await Attempt.countDocuments({ assignmentId: assignment._id });
    if (attemptCount >= assignment.allowedAttempts) {
      return res.status(403).json({ success: false, message: 'Attempt limit reached' });
    }
    
    // Prevent concurrent active attempts
    const activeAttempt = await Attempt.findOne({ assignmentId: assignment._id, status: { $in: [AttemptStatus.IN_PROGRESS, AttemptStatus.PAUSED] } });
    if (activeAttempt) {
      return res.status(409).json({ success: false, message: 'You already have an active attempt for this exam.' });
    }

    const attempt = new Attempt({
      examId,
      candidateId,
      assignmentId: assignment._id,
      examVersion: exam.version,
      startedAt: now,
      durationSeconds: exam.duration * 60,
      expiresAt: new Date(now.getTime() + exam.duration * 60 * 1000),
      status: AttemptStatus.IN_PROGRESS
    });

    await attempt.save();

    assignment.status = AssignmentStatus.ACTIVE;
    await assignment.save();

    res.status(201).json({ success: true, attempt });
  } catch (err) {
    next(err);
  }
};

import Question from '../models/Question';

export const getAttempt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const candidateId = req.user?.userId;

    const attempt = await Attempt.findOne({ _id: attemptId, candidateId });
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });

    const exam = await Exam.findById(attempt.examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

    const questions = await Question.find({ examId: attempt.examId }).select('-correctAnswer');
    const answers = await Answer.find({ attemptId });

    res.status(200).json({
      success: true,
      attempt,
      exam,
      questions,
      answers
    });
  } catch (err) {
    next(err);
  }
};

export const saveAnswer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const { questionId, answerValue, isMarkedForReview } = req.body;
    const candidateId = req.user?.userId;

    const attempt = await Attempt.findOne({ _id: attemptId, candidateId });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }
    
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      return res.status(403).json({ success: false, message: `Cannot save answer. Status is ${attempt.status}` });
    }

    // Strict Backend Timer Check
    const now = new Date();
    if (attempt.expiresAt && now > attempt.expiresAt) {
      attempt.status = AttemptStatus.AUTO_SUBMITTED;
      attempt.submittedAt = now;
      await attempt.save();
      return res.status(403).json({ success: false, message: 'Exam time expired. Attempt auto-submitted.' });
    }

    // SEC-21: Verify question belongs to the exam
    const question = await Question.findOne({ _id: questionId, examId: attempt.examId });
    if (!question) {
      return res.status(400).json({ success: false, message: 'Invalid question for this exam' });
    }

    let answer = await Answer.findOne({ attemptId, questionId });
    if (answer) {
      answer.selectedAnswer = answerValue;
      answer.savedAt = now;
      if (isMarkedForReview !== undefined) answer.isMarkedForReview = isMarkedForReview;
      await answer.save();
    } else {
      answer = new Answer({
        attemptId,
        questionId,
        selectedAnswer: answerValue,
        isMarkedForReview: isMarkedForReview || false,
        savedAt: now
      });
      await answer.save();
    }

    res.status(200).json({ success: true, message: 'Answer saved' });
  } catch (err) {
    next(err);
  }
};

export const submitAttempt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const candidateId = req.user?.userId;

    const attempt = await Attempt.findOne({ _id: attemptId, candidateId });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    if (![AttemptStatus.IN_PROGRESS, AttemptStatus.PAUSED].includes(attempt.status)) {
       return res.status(403).json({ success: false, message: 'Attempt already finalized' });
    }

    attempt.status = AttemptStatus.SUBMITTED;
    attempt.submittedAt = new Date();
    await attempt.save();

    const assignment = await Assignment.findById(attempt.assignmentId);
    if (assignment) {
      assignment.status = AssignmentStatus.COMPLETED;
      await assignment.save();
    }

    await evaluateAttempt(attemptId as string, candidateId as string);

    res.status(200).json({ success: true, message: 'Exam submitted successfully' });
  } catch (err) {
    next(err);
  }
};

export const evaluateAttempt = async (attemptId: string, candidateId: string) => {
    const attempt = await Attempt.findOne({ _id: attemptId, candidateId });
    if (!attempt) return;
    const questions = await Question.find({ examId: attempt.examId });
    const answers = await Answer.find({ attemptId });
    const violations = await ViolationEvent.find({ attemptId });

    let correct = 0;
    let wrong = 0;
    let obtainedMarks = 0;
    let totalMarks = 0;
    let attempted = answers.length;

    questions.forEach(q => {
      totalMarks += q.marks;
      const ans = answers.find(a => a.questionId.toString() === q._id.toString());
      if (ans && ans.selectedAnswer) {
        let isCorrect = false;
        
        // Handle Multiple Choice
        if (Array.isArray(q.correctAnswer)) {
          const selected = Array.isArray(ans.selectedAnswer) ? ans.selectedAnswer : [ans.selectedAnswer];
          isCorrect = q.correctAnswer.length === selected.length && q.correctAnswer.every(val => selected.includes(val));
        } else {
          isCorrect = ans.selectedAnswer === q.correctAnswer;
        }

        if (isCorrect) {
          correct++;
          obtainedMarks += q.marks;
        } else {
          wrong++;
          obtainedMarks -= q.negativeMarks || 0;
        }
      }
    });

    const unanswered = questions.length - attempted;
    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    // Assuming 50% passing marks for demo
    const pass = percentage >= 50;
    const timeTaken = Math.floor((attempt.submittedAt!.getTime() - attempt.startedAt.getTime()) / 1000);

    const riskScore = violations.reduce((acc, v) => acc + (v.severity === 'CRITICAL' ? 50 : v.severity === 'HIGH' ? 25 : 10), 0);

    const result = new Result({
      attemptId,
      candidateId,
      examId: attempt.examId,
      totalQuestions: questions.length,
      attempted,
      correct,
      wrong,
      unanswered,
      totalMarks,
      obtainedMarks,
      percentage,
      pass,
      timeTaken,
      riskScore: Math.min(riskScore, 100),
      violations: violations.length
    });
    
    await result.save();
    return result;
};
