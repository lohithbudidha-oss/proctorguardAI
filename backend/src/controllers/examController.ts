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
import Attempt from '../models/Attempt';

export const getExamStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exams = await Exam.find().select('_id title duration status').sort({ createdAt: -1 }).lean();

    const examIds = exams.map(e => e._id);
    const [attempts, assignments] = await Promise.all([
      Attempt.find({ examId: { $in: examIds } })
        .select('examId candidateId status startedAt submittedAt')
        .sort({ createdAt: -1 })
        .lean(),
      Assignment.find({ examId: { $in: examIds } })
        .select('examId candidateId status')
        .lean()
    ]);

    const statsMap = new Map<string, {
      examId: string;
      examTitle: string;
      duration: number;
      examStatus: string;
      total: number;
      inProgress: number;
      submitted: number;
      forceSubmitted: number;
      terminated: number;
      assigned: number;
    }>();

    for (const exam of exams) {
      statsMap.set(exam._id.toString(), {
        examId: exam._id.toString(),
        examTitle: exam.title,
        duration: exam.duration,
        examStatus: exam.status,
        total: 0,
        inProgress: 0,
        submitted: 0,
        forceSubmitted: 0,
        terminated: 0,
        assigned: 0
      });
    }

    const processedCandidateExamPairs = new Set<string>();

    for (const att of attempts) {
      const eId = att.examId?.toString();
      const cId = att.candidateId?.toString();
      if (!eId || !statsMap.has(eId)) continue;

      const key = `${eId}_${cId}`;
      if (processedCandidateExamPairs.has(key)) continue;
      processedCandidateExamPairs.add(key);

      const entry = statsMap.get(eId)!;
      entry.total++;

      const s = (att.status || '').toUpperCase();
      if (s === 'TERMINATED') {
        entry.terminated++;
      } else if (s === 'FORCE_SUBMITTED' || s === 'FORCEFULLY_SUBMITTED') {
        entry.forceSubmitted++;
      } else if (s === 'SUBMITTED' || s === 'AUTO_SUBMITTED' || s === 'COMPLETED') {
        entry.submitted++;
      } else if (s === 'IN_PROGRESS' || s === 'PAUSED' || s === 'LOCKED') {
        entry.inProgress++;
      } else {
        entry.assigned++;
      }
    }

    for (const assign of assignments) {
      const eId = assign.examId?.toString();
      const cId = assign.candidateId?.toString();
      if (!eId || !statsMap.has(eId)) continue;

      const key = `${eId}_${cId}`;
      if (processedCandidateExamPairs.has(key)) continue;
      processedCandidateExamPairs.add(key);

      const entry = statsMap.get(eId)!;
      entry.total++;
      entry.assigned++;
    }

    const stats = Array.from(statsMap.values());

    const totals = stats.reduce((acc, curr) => ({
      total: acc.total + curr.total,
      inProgress: acc.inProgress + curr.inProgress,
      submitted: acc.submitted + curr.submitted,
      forceSubmitted: acc.forceSubmitted + curr.forceSubmitted,
      terminated: acc.terminated + curr.terminated,
      assigned: acc.assigned + curr.assigned
    }), { total: 0, inProgress: 0, submitted: 0, forceSubmitted: 0, terminated: 0, assigned: 0 });

    res.status(200).json({ success: true, stats, totals });
  } catch (err) {
    next(err);
  }
};

export const getExamCandidates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: examId } = req.params;
    const assignments = await Assignment.find({ examId }).populate('candidateId', 'name email status').lean();

    const attempts = await Attempt.find({ examId }).select('candidateId status score percentage submittedAt startedAt').sort({ createdAt: -1 }).lean();
    const attemptMap = new Map<string, any>();
    for (const att of attempts) {
      const cId = att.candidateId?.toString();
      if (cId && !attemptMap.has(cId)) {
        attemptMap.set(cId, att);
      }
    }

    const candidatesWithAttemptStatus = assignments.map((a: any) => {
      const cId = (a.candidateId?._id || a.candidateId)?.toString();
      const att = cId ? attemptMap.get(cId) : null;
      return {
        ...a,
        attemptStatus: att ? att.status : 'ASSIGNED',
        score: att?.score,
        percentage: att?.percentage,
        submittedAt: att?.submittedAt,
        startedAt: att?.startedAt
      };
    });

    res.status(200).json({ success: true, candidates: candidatesWithAttemptStatus });
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
      // Re-assigning an already assigned candidate: authorize them for a new attempt / rewrite!
      const currentAttempts = await Attempt.countDocuments({
        $or: [{ assignmentId: assignment._id }, { candidateId, examId }]
      });
      assignment.allowedAttempts = Math.max(assignment.allowedAttempts || 1, currentAttempts) + 1;
      assignment.status = AssignmentStatus.PENDING;
      if (scheduledAt) assignment.scheduledAt = scheduledAt;
      await assignment.save();
      return res.status(200).json({ 
        success: true, 
        message: 'Candidate re-assigned and authorized for new examination session', 
        assignment 
      });
    }

    const priorAttempts = await Attempt.countDocuments({ candidateId, examId });
    const initialAllowed = Math.max(allowedAttempts || 1, priorAttempts + 1);

    assignment = new Assignment({
      examId,
      candidateId,
      scheduledAt: scheduledAt || new Date(),
      allowedAttempts: initialAllowed,
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
    });

    const existingCandidateIds = new Set(
      existingAssignments.map(a => a.candidateId.toString())
    );

    // For any existing assignments that are completed/expired, re-authorize them
    for (const exAssign of existingAssignments) {
      if (exAssign.status === AssignmentStatus.COMPLETED || exAssign.status === AssignmentStatus.EXPIRED) {
        const currentAttempts = await Attempt.countDocuments({
          $or: [{ assignmentId: exAssign._id }, { candidateId: exAssign.candidateId, examId }]
        });
        exAssign.allowedAttempts = Math.max(exAssign.allowedAttempts || 1, currentAttempts) + 1;
        exAssign.status = AssignmentStatus.PENDING;
        if (scheduledAt) exAssign.scheduledAt = scheduledAt;
        await exAssign.save();
      }
    }

    const newCandidateIds = targetIds.filter(id => !existingCandidateIds.has(id));

    if (newCandidateIds.length > 0) {
      const assignmentsToInsert = [];
      for (const candidateId of newCandidateIds) {
        const priorAttempts = await Attempt.countDocuments({ candidateId, examId });
        assignmentsToInsert.push({
          examId,
          candidateId,
          scheduledAt: scheduledAt || new Date(),
          allowedAttempts: Math.max(allowedAttempts || 1, priorAttempts + 1),
          status: AssignmentStatus.PENDING
        });
      }
      await Assignment.insertMany(assignmentsToInsert, { ordered: false });
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${targetIds.length} candidate(s) for this exam`,
      count: targetIds.length
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
      const currentAttempts = await Attempt.countDocuments({
        $or: [{ assignmentId: assignment._id }, { candidateId: assignment.candidateId, examId: assignment.examId }]
      });
      assignment.allowedAttempts = Math.max(assignment.allowedAttempts || 1, currentAttempts) + 1;
      assignment.status = AssignmentStatus.PENDING;
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
    
    let assignment = await Assignment.findOne({ examId: id, candidateId });
    if (!assignment) {
      // Auto-create assignment if it was somehow missing or unassigned
      assignment = new Assignment({
        examId: id,
        candidateId,
        scheduledAt: new Date(),
        allowedAttempts: 1,
        status: AssignmentStatus.PENDING
      });
    }
    
    const currentAttempts = await Attempt.countDocuments({
      $or: [{ assignmentId: assignment._id }, { candidateId: assignment.candidateId, examId: assignment.examId }]
    });
    assignment.allowedAttempts = Math.max(assignment.allowedAttempts || 1, currentAttempts) + 1;
    assignment.status = AssignmentStatus.PENDING;
    await assignment.save();
    
    res.status(200).json({ success: true, message: 'Granted rewrite to candidate' });
  } catch (err) {
    next(err);
  }
};
