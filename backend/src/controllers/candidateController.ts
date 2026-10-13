import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Assignment from '../models/Assignment';
import Exam from '../models/Exam';

export const getAssignedExams = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const candidateId = req.user?.userId;
    const assignments = await Assignment.find({ candidateId }).populate('examId').lean();

    // Batch query: 1 query for all results of this candidate
    const results = await Result.find({ candidateId }).sort({ createdAt: -1 }).lean();
    const resultMap = new Map<string, any>();
    for (const r of results) {
      const examIdStr = r.examId ? r.examId.toString() : '';
      if (!resultMap.has(examIdStr)) {
        resultMap.set(examIdStr, r);
      }
    }
    
    const formattedExams = assignments.map((a: any) => {
      const exam = a.examId as any;
      if (!exam) return null;
      
      let resultStatus = 'NONE';
      let attemptId = null;
      if (a.status === 'COMPLETED') {
        const result = resultMap.get(exam._id.toString());
        if (result) {
          resultStatus = result.status;
          attemptId = result.attemptId;
        }
      }

      return {
        id: exam._id,
        title: exam.title,
        duration: exam.duration,
        scheduledFor: a.scheduledAt,
        status: a.status === 'COMPLETED' ? 'COMPLETED' : exam.status === 'PUBLISHED' ? 'AVAILABLE' : 'PENDING',
        resultStatus,
        attemptId
      };
    }).filter(Boolean);

    res.status(200).json({ success: true, exams: formattedExams });
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

    res.status(200).json({
      success: true,
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        duration: exam.duration,
        status: assignment.status
      }
    });
  } catch (err) {
    next(err);
  }
};

import mongoose from 'mongoose';
import Result from '../models/Result';
import Question from '../models/Question';
import Answer from '../models/Answer';
import Attempt from '../models/Attempt';
import { evaluateAttempt } from './attemptController';

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
