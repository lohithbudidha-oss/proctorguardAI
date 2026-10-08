import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Assignment from '../models/Assignment';
import Exam from '../models/Exam';

export const getAssignedExams = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const candidateId = req.user?.userId;
    const assignments = await Assignment.find({ candidateId }).populate('examId');
    
    const formattedExams = assignments.map(a => {
      const exam = a.examId as any;
      if (!exam) return null;
      return {
        id: exam._id,
        title: exam.title,
        duration: exam.duration,
        scheduledFor: a.scheduledAt,
        status: a.status === 'COMPLETED' ? 'COMPLETED' : exam.status === 'PUBLISHED' ? 'AVAILABLE' : 'PENDING'
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

export const getAttemptResult = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const candidateId = req.user?.userId;

    const result = await Result.findOne({ attemptId, candidateId }).populate('examId', 'title duration');
    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
};
