import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import Assignment, { AssignmentStatus } from '../models/Assignment';
import Exam from '../models/Exam';
import User from '../models/User';
import Result from '../models/Result';
import Question from '../models/Question';
import Answer from '../models/Answer';
import Attempt, { AttemptStatus } from '../models/Attempt';
import { evaluateAttempt } from './attemptController';

export const getAssignedExams = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const candidateId = req.user?.userId;
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const candidateUser = await User.findById(candidateId).select('name email role status').lean();
    const assignments = await Assignment.find({ candidateId }).populate('examId').lean();

    // 1. Fetch all results of this candidate
    const results = await Result.find({ candidateId }).sort({ createdAt: -1 }).lean();
    const resultMap = new Map<string, any>();
    for (const r of results) {
      const examIdStr = r.examId ? r.examId.toString() : '';
      if (!resultMap.has(examIdStr)) {
        resultMap.set(examIdStr, r);
      }
    }

    // 2. Fetch all attempts of this candidate to accurately detect completed and in-progress exams
    const attempts = await Attempt.find({ candidateId }).sort({ createdAt: -1 }).lean();
    const attemptsByExam = new Map<string, any[]>();
    for (const att of attempts) {
      const eId = att.examId ? att.examId.toString() : '';
      if (!attemptsByExam.has(eId)) {
        attemptsByExam.set(eId, []);
      }
      attemptsByExam.get(eId)!.push(att);
    }
    
    const formattedExams = assignments.map((a: any) => {
      const exam = a.examId as any;
      if (!exam) return null;
      const examIdStr = exam._id.toString();
      
      const examAttempts = attemptsByExam.get(examIdStr) || [];
      const allowedAttempts = a.allowedAttempts || 1;
      const resObj = resultMap.get(examIdStr);

      // Check for finalized attempt
      const completedAttempt = examAttempts.find((att: any) => 
        ['SUBMITTED', 'AUTO_SUBMITTED', 'FORCE_SUBMITTED', 'COMPLETED', 'TERMINATED', 'INVALIDATED'].includes(att.status) ||
        Boolean(att.submittedAt) ||
        Boolean(resObj && (att._id.toString() === resObj.attemptId?.toString() || att._id.toString() === resObj.attemptId))
      );

      // Check for active in-progress attempt that hasn't expired and hasn't been submitted
      const now = new Date();
      const activeAttempt = examAttempts.find((att: any) => 
        [AttemptStatus.IN_PROGRESS, AttemptStatus.PAUSED].includes(att.status) &&
        !att.submittedAt &&
        (!resObj || (att._id.toString() !== resObj.attemptId?.toString() && att._id.toString() !== resObj.attemptId)) &&
        (!att.expiresAt || now < new Date(att.expiresAt))
      );

      const isCompleted = Boolean(
        completedAttempt || 
        Boolean(resObj) ||
        a.status === AssignmentStatus.COMPLETED || 
        (examAttempts.length >= allowedAttempts && examAttempts.length > 0)
      );

      let status = 'PENDING';
      let resultStatus = 'NONE';
      let attemptId = null;

      if (isCompleted) {
        status = 'COMPLETED';
        const targetAttempt = completedAttempt || (resObj?.attemptId ? examAttempts.find(att => att._id.toString() === resObj.attemptId.toString()) : null) || examAttempts[0];
        attemptId = targetAttempt ? targetAttempt._id.toString() : (resObj?.attemptId ? resObj.attemptId.toString() : null);
        resultStatus = resObj?.status || (targetAttempt?.percentage !== undefined || targetAttempt?.score !== undefined ? 'APPROVED' : 'APPROVED');

        // Heal Assignment status in MongoDB if needed
        if (a.status !== AssignmentStatus.COMPLETED) {
          Assignment.updateOne({ _id: a._id }, { status: AssignmentStatus.COMPLETED }).exec().catch(() => {});
        }
        if (targetAttempt && !['SUBMITTED', 'AUTO_SUBMITTED', 'FORCE_SUBMITTED', 'COMPLETED', 'TERMINATED'].includes(targetAttempt.status)) {
          Attempt.updateOne({ _id: targetAttempt._id }, { status: AttemptStatus.SUBMITTED, submittedAt: targetAttempt.submittedAt || new Date() }).exec().catch(() => {});
        }
      } else if (activeAttempt) {
        status = 'IN_PROGRESS';
        attemptId = activeAttempt._id.toString();
        resultStatus = 'NONE';
      } else {
        const isPublished = exam.status === 'PUBLISHED';
        const isStarted = !exam.startAt || now >= new Date(exam.startAt);
        status = (isPublished && isStarted) ? 'AVAILABLE' : 'PENDING';
      }

      return {
        id: exam._id,
        title: exam.title,
        duration: exam.duration,
        scheduledFor: a.scheduledAt || exam.startAt || exam.createdAt,
        status,
        resultStatus,
        attemptId,
        attemptsCount: examAttempts.length,
        allowedAttempts
      };
    }).filter(Boolean);

    res.status(200).json({ 
      success: true, 
      exams: formattedExams,
      candidateProfile: {
        name: candidateUser?.name || 'Candidate',
        email: candidateUser?.email || '',
        role: candidateUser?.role || 'CANDIDATE'
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getExamDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const candidateId = req.user?.userId;
    
    const assignment = await Assignment.findOne({ examId, candidateId });
    if (!assignment) {
      return res.status(403).json({ success: false, message: 'Not assigned to this exam' });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    // Check attempts for this exam
    const attempts = await Attempt.find({ candidateId, examId }).sort({ createdAt: -1 }).lean();
    const allowedAttempts = assignment.allowedAttempts || 1;
    const resultObj = await Result.findOne({ candidateId, examId }).sort({ createdAt: -1 }).lean();

    const completedAttempt = attempts.find((att: any) => 
      ['SUBMITTED', 'AUTO_SUBMITTED', 'FORCE_SUBMITTED', 'COMPLETED', 'TERMINATED', 'INVALIDATED'].includes(att.status) ||
      Boolean(att.submittedAt) ||
      Boolean(resultObj && att._id.toString() === resultObj.attemptId?.toString())
    );

    const now = new Date();
    const activeAttempt = attempts.find((att: any) => 
      [AttemptStatus.IN_PROGRESS, AttemptStatus.PAUSED].includes(att.status) &&
      !att.submittedAt &&
      (!resultObj || att._id.toString() !== resultObj.attemptId?.toString()) &&
      (!att.expiresAt || now < new Date(att.expiresAt))
    );

    const isCompleted = Boolean(
      completedAttempt || 
      Boolean(resultObj) ||
      assignment.status === AssignmentStatus.COMPLETED || 
      (attempts.length >= allowedAttempts && attempts.length > 0)
    );

    res.status(200).json({
      success: true,
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        duration: exam.duration,
        startAt: exam.startAt,
        endAt: exam.endAt,
        status: isCompleted ? 'COMPLETED' : assignment.status,
        isCompleted,
        completedAttemptId: completedAttempt?._id?.toString() || resultObj?.attemptId?.toString() || attempts[0]?._id?.toString() || null,
        hasActiveAttempt: Boolean(activeAttempt),
        activeAttemptId: activeAttempt?._id?.toString() || null,
        attemptsUsed: attempts.length,
        allowedAttempts
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getAttemptResult = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user?.userId;

    // 1. Try finding attempt by attemptId
    let attempt: any = null;
    if (mongoose.isValidObjectId(attemptId)) {
      attempt = await Attempt.findById(attemptId).lean();
    }
    if (!attempt) {
      attempt = await Attempt.findOne({ _id: attemptId }).lean();
    }

    // 2. Try finding result by attemptId or _id
    let result: any = null;
    if (mongoose.isValidObjectId(attemptId)) {
      result = await Result.findOne({ $or: [{ attemptId }, { _id: attemptId }] }).populate('examId', 'title duration description instructions totalMarks');
    } else {
      result = await Result.findOne({ attemptId }).populate('examId', 'title duration description instructions totalMarks');
    }

    // If attempt wasn't found by param, get it from result
    if (!attempt && result?.attemptId) {
      attempt = await Attempt.findById(result.attemptId).lean();
    }

    // If result not found, but attempt exists, auto-evaluate attempt
    if (!result && attempt) {
      try {
        await evaluateAttempt(attempt._id.toString(), attempt.candidateId.toString());
        result = await Result.findOne({ attemptId: attempt._id }).populate('examId', 'title duration description instructions totalMarks');
      } catch (e) {
        console.warn('[Candidate] Auto-evaluate attempt error:', e);
      }
    }

    if (!result && !attempt) {
      return res.status(404).json({ success: false, message: 'Result not found for this attempt' });
    }

    const effectiveExamId = result?.examId?._id || result?.examId || attempt?.examId;
    const effectiveAttemptId = result?.attemptId || attempt?._id;

    // 3. Fetch all questions from the exam and candidate answers
    const questions = await Question.find({ examId: effectiveExamId }).sort({ order: 1, createdAt: 1 }).lean();
    const answers = await Answer.find({ attemptId: effectiveAttemptId }).lean();

    const answersBreakdown = questions.map((q: any, idx: number) => {
      const ans = answers.find((a: any) => String(a.questionId) === String(q._id));
      const candidateSelectedAnswer = ans ? ans.selectedAnswer : null;
      const isAttempted = Boolean(ans && ans.selectedAnswer !== undefined && ans.selectedAnswer !== null && ans.selectedAnswer !== '');
      
      let isCorrect = false;
      if (ans && typeof ans.isCorrect === 'boolean') {
        isCorrect = ans.isCorrect;
      } else if (isAttempted) {
        // Fallback comparison
        isCorrect = JSON.stringify(candidateSelectedAnswer) === JSON.stringify(q.correctAnswer);
      }

      return {
        questionNumber: idx + 1,
        questionId: q._id,
        questionText: q.text || q.questionText || `Question ${idx + 1}`,
        type: q.type || 'SINGLE_CHOICE',
        options: q.options || [],
        marks: q.marks || 1,
        negativeMarks: q.negativeMarks || 0,
        marksAwarded: ans?.marksAwarded ?? (isCorrect ? (q.marks || 1) : 0),
        candidateSelectedAnswer,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        isCorrect,
        isAttempted,
        isMarkedForReview: ans?.isMarkedForReview || false,
        answeredAt: ans?.savedAt || ans?.createdAt || null
      };
    });

    res.status(200).json({ 
      success: true, 
      result: result || {
        attemptId: effectiveAttemptId,
        candidateId: attempt?.candidateId,
        examId: effectiveExamId,
        totalQuestions: questions.length,
        attempted: answers.length,
        correct: answersBreakdown.filter(a => a.isCorrect).length,
        wrong: answersBreakdown.filter(a => a.isAttempted && !a.isCorrect).length,
        unanswered: Math.max(0, questions.length - answers.length),
        totalMarks: questions.reduce((acc, q) => acc + (q.marks || 1), 0),
        obtainedMarks: answersBreakdown.reduce((acc, a) => acc + a.marksAwarded, 0),
        percentage: 0,
        pass: true,
        timeTaken: 0,
        riskScore: 0,
        violations: 0,
        status: 'APPROVED'
      }, 
      answers: answersBreakdown 
    });
  } catch (err) {
    next(err);
  }
};
