import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Exam, { ExamStatus } from '../models/Exam';

export const createExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const examData = req.body;
    
    // In a real app, apply thorough validation here
    const exam = new Exam(examData);
    await exam.save();

    res.status(201).json({ success: true, message: 'Exam created successfully', exam });
  } catch (err) {
    next(err);
  }
};

export const getExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exams = await Exam.find().sort({ createdAt: -1 });
    console.log(`[getExams] Retrieved ${exams.length} exams. IDs:`, exams.map(e => e._id.toString()));
    res.status(200).json({ success: true, exams });
  } catch (err) {
    next(err);
  }
};

export const getExamById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    res.status(200).json({ success: true, exam });
  } catch (err) {
    next(err);
  }
};

export const updateExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    if (exam.status !== ExamStatus.DRAFT) {
      return res.status(400).json({ success: false, message: 'Only draft exams can be freely edited' });
    }

    Object.assign(exam, updateData);
    await exam.save();

    res.status(200).json({ success: true, message: 'Exam updated', exam });
  } catch (err) {
    next(err);
  }
};

export const deleteExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    console.log(`[deleteExam] Attempting to delete exam with ID: ${id}`);
    
    // Check if it exists first
    const existing = await Exam.findById(id);
    console.log(`[deleteExam] Found before delete?`, !!existing);
    
    const exam = await Exam.findByIdAndDelete(id);
    console.log(`[deleteExam] Deleted result:`, !!exam);
    
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    
    // Cascade delete questions and assignments
    await mongoose.model('Question').deleteMany({ examId: id });
    await mongoose.model('Assignment').deleteMany({ examId: id });

    res.status(200).json({ success: true, message: 'Exam deleted successfully' });
  } catch (err) {
    console.error(`[deleteExam] Error:`, err);
    next(err);
  }
};

export const publishExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id);
    
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    if (exam.status !== ExamStatus.DRAFT) {
      return res.status(400).json({ success: false, message: 'Only draft exams can be published' });
    }

    exam.status = ExamStatus.PUBLISHED;
    exam.version += 1;
    await exam.save();

    res.status(200).json({ success: true, message: 'Exam published', exam });
  } catch (err) {
    next(err);
  }
};

import Assignment, { AssignmentStatus } from '../models/Assignment';
import User from '../models/User';

export const getExamCandidates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: examId } = req.params;
    const assignments = await Assignment.find({ examId }).populate('candidateId', 'name email status');
    res.status(200).json({ success: true, candidates: assignments });
  } catch (err) {
    next(err);
  }
};

export const assignCandidate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: examId } = req.params;
    const { candidateId, scheduledAt, allowedAttempts } = req.body;

    let assignment = await Assignment.findOne({ examId, candidateId });
    if (assignment) {
      return res.status(400).json({ success: false, message: 'Candidate already assigned' });
    }

    assignment = new Assignment({
      examId,
      candidateId,
      scheduledAt: scheduledAt || new Date(),
      allowedAttempts: allowedAttempts || 1,
      status: AssignmentStatus.PENDING
    });
    
    await assignment.save();
    res.status(201).json({ success: true, message: 'Candidate assigned', assignment });
  } catch (err) {
    next(err);
  }
};

export const allowRewriteAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Find all assignments for this exam
    const assignments = await Assignment.find({ examId: id });
    
    for (const assignment of assignments) {
      assignment.allowedAttempts += 1;
      if (['COMPLETED', 'TERMINATED', 'EXPIRED'].includes(assignment.status)) {
        assignment.status = AssignmentStatus.PENDING;
      }
      await assignment.save();
    }
    
    res.status(200).json({ success: true, message: `Granted rewrite to ${assignments.length} candidates` });
  } catch (err) {
    next(err);
  }
};
