import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Exam, { ExamStatus } from '../models/Exam';

const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF]|[\u2600-\u26FF\u2700-\u27BF])/u;

export const createExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, instructions, duration, ...rest } = req.body;
    
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Exam title is required.' });
    }
    if (title.trim().length > 250) {
      return res.status(400).json({ success: false, message: 'Exam title cannot exceed 250 characters.' });
    }
    if (EMOJI_REGEX.test(title)) {
      return res.status(400).json({ success: false, message: 'Emojis are not accepted in the exam creation form.' });
    }
    if (!/^[a-zA-Z]/.test(title.trim())) {
      return res.status(400).json({ success: false, message: 'Exam title must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.' });
    }

    if (description && typeof description === 'string' && description.trim()) {
      if (description.trim().length > 250) {
        return res.status(400).json({ success: false, message: 'Exam description cannot exceed 250 characters.' });
      }
      if (EMOJI_REGEX.test(description)) {
        return res.status(400).json({ success: false, message: 'Emojis are not accepted in exam description.' });
      }
      if (!/^[a-zA-Z]/.test(description.trim())) {
        return res.status(400).json({ success: false, message: 'Exam description must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.' });
      }
    }

    if (instructions && typeof instructions === 'string' && instructions.trim()) {
      if (instructions.trim().length > 250) {
        return res.status(400).json({ success: false, message: 'Exam guidelines & instructions cannot exceed 250 characters.' });
      }
      if (EMOJI_REGEX.test(instructions)) {
        return res.status(400).json({ success: false, message: 'Emojis are not accepted in guidelines & instructions.' });
      }
      if (!/^[a-zA-Z]/.test(instructions.trim())) {
        return res.status(400).json({ success: false, message: 'Exam guidelines & instructions must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.' });
      }
    }

    const exam = new Exam({
      title: title.trim(),
      description: description ? description.trim() : '',
      instructions: instructions ? instructions.trim() : '',
      duration,
      ...rest
    });
    await exam.save();

    res.status(201).json({ success: true, message: 'Exam created successfully', exam });
  } catch (err) {
    next(err);
  }
};

export const getExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exams = await Exam.find().sort({ createdAt: -1 }).lean();
    console.log(`[getExams] Retrieved ${exams.length} exams. IDs:`, exams.map((e: any) => e._id.toString()));
    res.status(200).json({ success: true, exams });
  } catch (err) {
    next(err);
  }
};

export const getExamById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id).lean();
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

    if (updateData.title !== undefined) {
      if (!updateData.title || typeof updateData.title !== 'string' || !updateData.title.trim()) {
        return res.status(400).json({ success: false, message: 'Exam title is required.' });
      }
      if (updateData.title.trim().length > 250) {
        return res.status(400).json({ success: false, message: 'Exam title cannot exceed 250 characters.' });
      }
      if (EMOJI_REGEX.test(updateData.title)) {
        return res.status(400).json({ success: false, message: 'Emojis are not accepted in the exam title.' });
      }
      if (!/^[a-zA-Z]/.test(updateData.title.trim())) {
        return res.status(400).json({ success: false, message: 'Exam title must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.' });
      }
      updateData.title = updateData.title.trim();
    }

    if (updateData.description !== undefined && typeof updateData.description === 'string' && updateData.description.trim()) {
      if (updateData.description.trim().length > 250) {
        return res.status(400).json({ success: false, message: 'Exam description cannot exceed 250 characters.' });
      }
      if (EMOJI_REGEX.test(updateData.description)) {
        return res.status(400).json({ success: false, message: 'Emojis are not accepted in exam description.' });
      }
      if (!/^[a-zA-Z]/.test(updateData.description.trim())) {
        return res.status(400).json({ success: false, message: 'Exam description must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.' });
      }
      updateData.description = updateData.description.trim();
    }

    if (updateData.instructions !== undefined && typeof updateData.instructions === 'string' && updateData.instructions.trim()) {
      if (updateData.instructions.trim().length > 250) {
        return res.status(400).json({ success: false, message: 'Exam guidelines & instructions cannot exceed 250 characters.' });
      }
      if (EMOJI_REGEX.test(updateData.instructions)) {
        return res.status(400).json({ success: false, message: 'Emojis are not accepted in guidelines & instructions.' });
      }
      if (!/^[a-zA-Z]/.test(updateData.instructions.trim())) {
        return res.status(400).json({ success: false, message: 'Exam guidelines & instructions must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.' });
      }
      updateData.instructions = updateData.instructions.trim();
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
import User, { Role } from '../models/User';

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

export const assignAllCandidates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: examId } = req.params;
    const { candidateIds, scheduledAt, allowedAttempts } = req.body;

    let targetIds: string[] = [];

    if (Array.isArray(candidateIds) && candidateIds.length > 0) {
      targetIds = candidateIds.map((id: any) => id.toString());
    } else {
      const candidates = await User.find({ role: Role.CANDIDATE }).select('_id');
      targetIds = candidates.map(c => c._id.toString());
    }

    if (targetIds.length === 0) {
      return res.status(200).json({ success: true, message: 'No candidates available to assign', count: 0 });
    }

    // Find candidates who are already assigned to this exam
    const existingAssignments = await Assignment.find({
      examId,
      candidateId: { $in: targetIds }
    }).select('candidateId');

    const existingCandidateIds = new Set(
      existingAssignments.map(a => a.candidateId.toString())
    );

    const newCandidateIds = targetIds.filter(id => !existingCandidateIds.has(id));

    if (newCandidateIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All candidates are already assigned to this exam',
        count: 0
      });
    }

    const assignmentsToInsert = newCandidateIds.map(candidateId => ({
      examId,
      candidateId,
      scheduledAt: scheduledAt || new Date(),
      allowedAttempts: allowedAttempts || 1,
      status: AssignmentStatus.PENDING
    }));

    await Assignment.insertMany(assignmentsToInsert, { ordered: false });

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${assignmentsToInsert.length} candidate(s) to this exam`,
      count: assignmentsToInsert.length
    });
  } catch (err) {
    next(err);
  }
};

export const unassignCandidate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: examId, candidateId } = req.params;
    const assignment = await Assignment.findOneAndDelete({ examId, candidateId });
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    res.status(200).json({ success: true, message: 'Candidate unassigned' });
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

export const allowRewrite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, candidateId } = req.params;
    
    const assignment = await Assignment.findOne({ examId: id, candidateId });
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    
    assignment.allowedAttempts += 1;
    if (['COMPLETED', 'TERMINATED', 'EXPIRED'].includes(assignment.status)) {
      assignment.status = AssignmentStatus.PENDING;
    }
    await assignment.save();
    
    res.status(200).json({ success: true, message: 'Granted rewrite to candidate' });
  } catch (err) {
    next(err);
  }
};
