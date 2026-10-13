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

import Result from '../models/Result';
import Question from '../models/Question';
import Answer from '../models/Answer';

export const getAttemptResult = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const candidateId = req.user?.userId;

    let result: any = await Result.findOne({ attemptId, candidateId }).populate('examId', 'title duration description instructions totalMarks');
    if (!result || (result.attempted > 0 && result.correct === 0)) {
      try {
        const { evaluateAttempt } = require('./attemptController');
        await evaluateAttempt(attemptId, candidateId as string);
        result = await Result.findOne({ attemptId, candidateId }).populate('examId', 'title duration description instructions totalMarks');
      } catch (e) {
        console.warn('[Candidate] Auto-evaluate attempt error:', e);
      }
    }

    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }

    const examId = result.examId?._id || result.examId;
    const questions = await Question.find({ examId }).sort({ order: 1, createdAt: 1 }).lean();
    const answers = await Answer.find({ attemptId }).lean();

    const answersBreakdown = questions.map((q: any, idx: number) => {
      const ans = answers.find((a: any) => String(a.questionId) === String(q._id));
      const candidateSelectedAnswer = ans ? ans.selectedAnswer : null;
      const isAttempted = Boolean(ans && ans.selectedAnswer !== undefined && ans.selectedAnswer !== null && ans.selectedAnswer !== '');
      const isCorrect = ans ? (ans.isCorrect ?? (JSON.stringify(ans.selectedAnswer) === JSON.stringify(q.correctAnswer))) : false;

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
      result, 
      answers: answersBreakdown 
    });
  } catch (err) {
    next(err);
  }
};
