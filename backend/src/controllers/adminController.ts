import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import User, { Role, CandidateStatus } from '../models/User';
import Attempt, { AttemptStatus } from '../models/Attempt';

export const getCandidates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, countOnly } = req.query;
    const query: any = { role: Role.CANDIDATE };
    if (status && status !== 'ALL') {
      if (status === 'PENDING') {
        query.status = { $in: [CandidateStatus.PENDING_VERIFICATION, 'PENDING'] };
      } else {
        query.status = status;
      }
    }

    if (countOnly === 'true') {
      const count = await User.countDocuments(query);
      return res.json({ success: true, count });
    }

    const candidates = await User.find(query)
      .select('-passwordHash -password')
      .sort({ createdAt: -1 })
      .lean();
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
    if (!user || (user.role && user.role.toUpperCase() !== Role.CANDIDATE)) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    user.status = CandidateStatus.APPROVED;
    await user.save();
    res.status(200).json({ success: true, message: 'Candidate approved successfully' });
  } catch (err) {
    next(err);
  }
};

import Assignment from '../models/Assignment';

export const deleteCandidate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (user.role && user.role.toUpperCase() === Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be deleted' });
    }

    await User.findByIdAndDelete(id);
    await Assignment.deleteMany({ candidateId: id });
    await Attempt.deleteMany({ candidateId: id });
    await Result.deleteMany({ candidateId: id });

    res.status(200).json({ 
      success: true, 
      message: `Candidate "${user.name || user.email}" deleted successfully` 
    });
  } catch (err) {
    next(err);
  }
};

import Result from '../models/Result';
import ViolationEvent from '../models/ViolationEvent';
import Question from '../models/Question';
import Answer from '../models/Answer';
import Exam from '../models/Exam';
import { googleDriveService } from '../services/googleDriveService';

export const getLiveCandidates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    const attempts = await Attempt.find()
      .select('candidateId examId status startedAt submittedAt expiresAt score percentage resultStatus updatedAt createdAt')
      .populate('candidateId', 'name email')
      .populate('examId', 'title duration totalMarks passPercentage scoringRules')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    // Gather all candidate and exam IDs to backfill any unpopulated references
    const candidateIdSet = new Set<string>();
    const examIdSet = new Set<string>();

    attempts.forEach((doc: any) => {
      const cId = (doc.candidateId?._id || doc.candidateId)?.toString();
      if (cId && mongoose.Types.ObjectId.isValid(cId)) candidateIdSet.add(cId);

      const eId = (doc.examId?._id || doc.examId)?.toString();
      if (eId && mongoose.Types.ObjectId.isValid(eId)) examIdSet.add(eId);
    });

    const userMap = new Map<string, any>();
    const examMap = new Map<string, any>();

    // Query User model for any candidate that wasn't populated or needs backfill
    const cIdsToFetch = Array.from(candidateIdSet);
    if (cIdsToFetch.length > 0) {
      try {
        const users = await User.find({ _id: { $in: cIdsToFetch } }).select('name email').lean();
        users.forEach((u: any) => userMap.set(u._id.toString(), u));
      } catch (uErr) {
        console.warn('[AdminController] Error fetching users for live monitoring:', uErr);
      }
    }

    // Query Exam model for any exam that wasn't populated or needs backfill
    const eIdsToFetch = Array.from(examIdSet);
    if (eIdsToFetch.length > 0) {
      try {
        const exams = await Exam.find({ _id: { $in: eIdsToFetch } }).select('title duration totalMarks passPercentage scoringRules').lean();
        exams.forEach((e: any) => examMap.set(e._id.toString(), e));
      } catch (eErr) {
        console.warn('[AdminController] Error fetching exams for live monitoring:', eErr);
      }
    }

    // Normalize attempts so doc.candidateId and doc.examId are guaranteed valid objects
    const normalizedAttempts = attempts.map((doc: any) => {
      const cId = (doc.candidateId?._id || doc.candidateId)?.toString() || '';
      let candidate = doc.candidateId;
      if (!candidate || typeof candidate !== 'object' || !candidate.name) {
        if (cId && userMap.has(cId)) {
          candidate = userMap.get(cId);
        } else {
          candidate = { _id: cId, name: cId ? `Candidate (${cId.slice(-4)})` : 'Candidate', email: '' };
        }
      }

      const eId = (doc.examId?._id || doc.examId)?.toString() || '';
      let exam = doc.examId;
      if (!exam || typeof exam !== 'object' || !exam.title) {
        if (eId && examMap.has(eId)) {
          exam = examMap.get(eId);
        } else {
          exam = { _id: eId, title: 'Assessment', duration: 60, totalMarks: 100 };
        }
      }

      return {
        ...doc,
        candidateId: candidate,
        examId: exam
      };
    });

    const attemptIds = normalizedAttempts.map((doc: any) => doc._id);

    // Batch fetch results in ONE single query with lean projection
    const results = await Result.find({ attemptId: { $in: attemptIds } })
      .select('attemptId obtainedMarks totalMarks percentage pass status totalQuestions attempted correct wrong unanswered timeTaken riskScore createdAt')
      .lean();
    const resultMap = new Map<string, any>(results.map((r: any) => [r.attemptId.toString(), r]));

    // Batch fetch violations without heavy snapshotImage to prevent memory saturation
    const violations = await ViolationEvent.find({ attemptId: { $in: attemptIds } })
      .select('attemptId type severity detectedAt description actionTaken screenshot')
      .sort({ detectedAt: -1 })
      .limit(300)
      .lean();

    const violationMap = new Map<string, any[]>();
    for (const v of violations) {
      const attIdStr = v.attemptId.toString();
      if (!violationMap.has(attIdStr)) {
        violationMap.set(attIdStr, []);
      }
      const list = violationMap.get(attIdStr)!;
      if (list.length < 15) {
        list.push({
          id: v._id,
          type: v.type,
          severity: v.severity,
          detectedAt: v.detectedAt,
          description: v.description || '',
          screenshot: v.screenshot || '',
          actionTaken: v.actionTaken
        });
      }
    }

    const now = new Date();

    const attemptsData = normalizedAttempts.map((doc: any) => {
      const candidate = doc.candidateId;
      const exam = doc.examId;
      const attIdStr = doc._id.toString();
      const result = resultMap.get(attIdStr);
      const attemptViolations = violationMap.get(attIdStr) || [];
      const riskScore = attemptViolations.reduce(
        (acc: number, v: any) => acc + (v.severity === 'CRITICAL' ? 40 : v.severity === 'HIGH' ? 20 : 5),
        0
      );

      let effectiveStatus = doc.status;
      if (['SUBMITTED', 'AUTO_SUBMITTED', 'FORCE_SUBMITTED', 'COMPLETED', 'TERMINATED'].includes(doc.status)) {
        effectiveStatus = doc.status;
      } else if (result || doc.submittedAt) {
        effectiveStatus = 'SUBMITTED';
        Attempt.updateOne({ _id: doc._id }, { $set: { status: AttemptStatus.SUBMITTED } }).exec().catch(() => {});
      } else if (doc.status === 'IN_PROGRESS' && doc.expiresAt && now > new Date(doc.expiresAt)) {
        effectiveStatus = 'AUTO_SUBMITTED';
        Attempt.updateOne({ _id: doc._id }, { $set: { status: AttemptStatus.AUTO_SUBMITTED } }).exec().catch(() => {});
      }

      const verificationStatus = result ? result.status : (doc.resultStatus || 'PENDING');

      return {
        attemptId: doc._id,
        candidateId: candidate._id,
        name: candidate.name || 'Candidate',
        email: candidate.email || '',
        examId: exam._id,
        examName: exam.title || 'Assessment',
        status: effectiveStatus,
        verificationStatus,
        startedAt: doc.startedAt,
        submittedAt: doc.submittedAt || (result ? result.createdAt : undefined),
        expiresAt: doc.expiresAt,
        score: result ? result.obtainedMarks : doc.score ?? 0,
        totalMarks: result ? result.totalMarks : (exam.totalMarks || 100),
        percentage: result ? result.percentage : doc.percentage ?? 0,
        resultStatus: result ? (result.pass ? 'PASS' : 'FAIL') : doc.resultStatus ?? 'PENDING',
        totalQuestions: result ? result.totalQuestions : 0,
        attempted: result ? result.attempted : 0,
        correct: result ? result.correct : 0,
        wrong: result ? result.wrong : 0,
        unanswered: result ? result.unanswered : 0,
        timeTaken: result ? result.timeTaken : 0,
        riskScore: Math.min(100, result?.riskScore ?? riskScore),
        violations: attemptViolations,
        camera: 'STARTED',
        screen: 'STARTED'
      };
    });

    // Also include candidates who are assigned to exams but haven't started an attempt yet
    const existingPairs = new Set(
      normalizedAttempts.map((a: any) => {
        const cId = (a.candidateId?._id || a.candidateId)?.toString() || '';
        const eId = (a.examId?._id || a.examId)?.toString() || '';
        return `${cId}_${eId}`;
      })
    );

    let assignedCandidatesData: any[] = [];
    try {
      const assignments = await Assignment.find()
        .populate('candidateId', 'name email')
        .populate('examId', 'title duration totalMarks scoringRules')
        .sort({ createdAt: -1 })
        .lean();

      for (const a of assignments) {
        const cId = (a.candidateId?._id || a.candidateId)?.toString() || '';
        const eId = (a.examId?._id || a.examId)?.toString() || '';
        const pairKey = `${cId}_${eId}`;

        if (cId && eId && !existingPairs.has(pairKey)) {
          existingPairs.add(pairKey);
          const cand: any = (a.candidateId && typeof a.candidateId === 'object' && !(a.candidateId instanceof mongoose.Types.ObjectId)) 
            ? a.candidateId 
            : { _id: cId, name: `Candidate (${cId.slice(-4)})`, email: '' };
          const ex: any = (a.examId && typeof a.examId === 'object' && !(a.examId instanceof mongoose.Types.ObjectId)) 
            ? a.examId 
            : { _id: eId, title: 'Assessment', duration: 60, totalMarks: 100 };

          assignedCandidatesData.push({
            attemptId: 'assigned_' + a._id.toString(),
            candidateId: cand._id || cId,
            name: cand.name || 'Candidate',
            email: cand.email || '',
            examId: ex._id || eId,
            examName: ex.title || 'Assessment',
            status: 'ASSIGNED',
            verificationStatus: 'PENDING',
            startedAt: undefined,
            submittedAt: undefined,
            expiresAt: undefined,
            score: 0,
            totalMarks: (ex as any).totalMarks || 100,
            percentage: 0,
            resultStatus: 'PENDING',
            totalQuestions: 0,
            attempted: 0,
            correct: 0,
            wrong: 0,
            unanswered: 0,
            timeTaken: 0,
            riskScore: 0,
            violations: [],
            camera: 'READY',
            screen: 'READY'
          });
        }
      }
    } catch (assignErr) {
      console.warn('[AdminController] Error fetching assignments for live monitoring:', assignErr);
    }

    const allCandidates = [...attemptsData, ...assignedCandidatesData];
    res.status(200).json({ success: true, candidates: allCandidates });
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    const violations = await ViolationEvent.find()
      .select('-snapshotImage')
      .populate('candidateId', 'name email')
      .populate({
        path: 'attemptId',
        populate: [
          { path: 'examId', select: 'title description duration totalMarks passPercentage' },
          { path: 'candidateId', select: 'name email' }
        ]
      })
      .sort({ detectedAt: -1 })
      .limit(300)
      .lean();

    // Collect all candidate IDs and attempt IDs from violations
    const candidateIdSet = new Set<string>();
    const attemptIdSet = new Set<string>();

    violations.forEach((v: any) => {
      // 1. Direct candidate
      const directCandId = (v.candidateId?._id || v.candidateId)?.toString();
      if (directCandId && mongoose.Types.ObjectId.isValid(directCandId)) {
        candidateIdSet.add(directCandId);
      }
      // 2. Candidate from attemptId
      const attemptCandId = (v.attemptId?.candidateId?._id || v.attemptId?.candidateId)?.toString();
      if (attemptCandId && mongoose.Types.ObjectId.isValid(attemptCandId)) {
        candidateIdSet.add(attemptCandId);
      }
      // 3. Attempt ID
      const attId = (v.attemptId?._id || v.attemptId)?.toString();
      if (attId && mongoose.Types.ObjectId.isValid(attId)) {
        attemptIdSet.add(attId);
      }
    });

    const candidateIds = Array.from(candidateIdSet);
    const attemptIds = Array.from(attemptIdSet);

    // Fetch all related attempts (by candidateId or by attemptId)
    let candidateAttempts: any[] = [];
    if (candidateIds.length > 0 || attemptIds.length > 0) {
      try {
        candidateAttempts = await Attempt.find({
          $or: [
            ...(candidateIds.length > 0 ? [{ candidateId: { $in: candidateIds } }] : []),
            ...(attemptIds.length > 0 ? [{ _id: { $in: attemptIds } }] : [])
          ]
        })
          .populate('candidateId', 'name email')
          .populate('examId', 'title description duration totalMarks passPercentage')
          .sort({ createdAt: -1 })
          .lean();
      } catch (attemptErr) {
        console.warn('[AdminController] Error fetching candidate attempts for violations:', attemptErr);
      }
    }

    // Build lookup maps
    const attemptMap = new Map<string, any>();
    const userMap = new Map<string, any>();

    candidateAttempts.forEach((att: any) => {
      const attId = att._id?.toString();
      if (attId) attemptMap.set(attId, att);
      if (att.candidateId && typeof att.candidateId === 'object' && att.candidateId._id) {
        const cId = att.candidateId._id.toString();
        userMap.set(cId, att.candidateId);
        candidateIdSet.add(cId);
      }
    });

    // If there are candidates without user profile info in userMap, query User model
    const missingUserIds = Array.from(candidateIdSet).filter(id => !userMap.has(id));
    if (missingUserIds.length > 0) {
      try {
        const users = await User.find({ _id: { $in: missingUserIds } }).select('name email').lean();
        users.forEach((u: any) => {
          userMap.set(u._id.toString(), u);
        });
      } catch (uErr) {
        console.warn('[AdminController] Error fetching users for violations:', uErr);
      }
    }

    // Normalize violations: ensure candidateId has { _id, name, email } and attemptId has examId
    const normalizedViolations = violations.map((v: any) => {
      const attId = (v.attemptId?._id || v.attemptId)?.toString() || null;
      const matchedAttempt = attId ? attemptMap.get(attId) : null;

      let candidate = v.candidateId;
      const directCandId = (v.candidateId?._id || v.candidateId)?.toString();
      const matchedCandId = (matchedAttempt?.candidateId?._id || matchedAttempt?.candidateId)?.toString();
      const effectiveCandId = directCandId || matchedCandId;

      if (!candidate || typeof candidate !== 'object' || !candidate.name) {
        // Try candidate from matched attempt
        if (matchedAttempt?.candidateId && typeof matchedAttempt.candidateId === 'object' && matchedAttempt.candidateId.name) {
          candidate = matchedAttempt.candidateId;
        } else if (effectiveCandId && userMap.has(effectiveCandId)) {
          candidate = userMap.get(effectiveCandId);
        } else if (effectiveCandId) {
          candidate = { _id: effectiveCandId, name: `Candidate (${effectiveCandId.slice(-4)})`, email: '' };
        }
      }

      // Backfill attemptId if it was just an unpopulated string/ID
      let effectiveAttempt = v.attemptId;
      if ((!effectiveAttempt || typeof effectiveAttempt !== 'object' || !effectiveAttempt.examId) && matchedAttempt) {
        effectiveAttempt = matchedAttempt;
      }
      if (!effectiveAttempt || typeof effectiveAttempt !== 'object') {
        effectiveAttempt = {
          _id: attId || 'unknown_attempt',
          examId: { title: 'Assessment', _id: 'assessment' }
        };
      }

      // Heal MongoDB in background if candidate was missing
      if (!v.candidateId && candidate && candidate._id) {
        ViolationEvent.updateOne({ _id: v._id, candidateId: null } as any, { $set: { candidateId: candidate._id } }).exec().catch(() => {});
      }

      return {
        ...v,
        candidateId: candidate || { _id: 'unknown_candidate', name: 'Candidate', email: '' },
        attemptId: effectiveAttempt
      };
    });

    // Also fetch any remaining attempts for any newly discovered candidates
    const allFinalCandidateIds = Array.from(candidateIdSet);
    const existingAttemptCandIds = new Set(
      candidateAttempts.map((a: any) => (a.candidateId?._id || a.candidateId)?.toString()).filter(Boolean)
    );
    const newlyDiscoveredCandIds = allFinalCandidateIds.filter(id => !existingAttemptCandIds.has(id));
    if (newlyDiscoveredCandIds.length > 0) {
      try {
        const extraAttempts = await Attempt.find({ candidateId: { $in: newlyDiscoveredCandIds } })
          .populate('candidateId', 'name email')
          .populate('examId', 'title description duration totalMarks passPercentage')
          .sort({ createdAt: -1 })
          .lean();
        const existingAttemptIds = new Set(candidateAttempts.map((a: any) => a._id?.toString()));
        for (const ea of extraAttempts) {
          if (!existingAttemptIds.has(ea._id?.toString())) {
            candidateAttempts.push(ea);
            existingAttemptIds.add(ea._id?.toString());
          }
        }
      } catch (extraErr) {
        console.warn('[AdminController] Error fetching extra attempts:', extraErr);
      }
    }

    res.status(200).json({ success: true, violations: normalizedViolations, candidateAttempts });
  } catch (err) {
    next(err);
  }
};

export const getResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await Result.find()
      .populate('candidateId', 'name email status')
      .populate('examId', 'title duration passingPercentage passMark')
      .populate('attemptId', 'startedAt submittedAt status attemptNumber durationSeconds expiresAt')
      .sort({ createdAt: -1 })
      .lean();
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
    const status = googleDriveService.getDriveStatus();
    res.status(200).json({ success: true, ...status });
  } catch (err) {
    next(err);
  }
};

export const getDriveFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = googleDriveService.getDriveStatus();
    const remoteFiles = await googleDriveService.listFilesFromGoogleDrive();

    // 1. Fetch Exam Submissions
    const results = await Result.find()
      .populate('candidateId', 'name email')
      .populate('examId', 'title')
      .sort({ createdAt: -1 });

    // 2. Fetch Violations with evidence screenshots
    const violations = await ViolationEvent.find()
      .populate('candidateId', 'name email')
      .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } })
      .sort({ detectedAt: -1, createdAt: -1 });

    const submissionFiles = results.map((r: any) => ({
      id: r._id,
      name: `[Exam-Answers]_${(r.candidateId?.name || 'Candidate').replace(/\s+/g, '_')}_${(r.examId?.title || 'Exam').replace(/\s+/g, '_')}_Report.html`,
      category: 'Submissions',
      candidateName: r.candidateId?.name || 'Candidate',
      candidateEmail: r.candidateId?.email || 'N/A',
      examTitle: r.examId?.title || 'Exam',
      score: `${r.obtainedMarks}/${r.totalMarks} (${(r.percentage || 0).toFixed(1)}%)`,
      pass: r.pass,
      status: r.status,
      webViewLink: r.driveReportUrl || `https://drive.google.com/drive/folders/${status.linkedFolderId}?usp=sharing`,
      htmlReportUrl: `/api/admin/results/${r._id}/report-html`,
      jsonReportUrl: r.driveJsonUrl || null,
      createdAt: r.createdAt,
      mimeType: 'text/html',
      syncedToCloud: Boolean(r.driveReportUrl && !r.driveReportUrl.includes('folders/'))
    }));

    const violationFiles = violations
      .filter((v: any) => Boolean(v.screenshot || v.snapshotImage || v.driveUrl))
      .map((v: any) => {
        const candidateName = v.candidateName || v.candidateId?.name || 'Candidate';
        const candidateEmail = v.candidateEmail || v.candidateId?.email || 'N/A';
        const examTitle = v.examTitle || v.attemptId?.examId?.title || 'Exam';
        const violationType = v.type || 'VIOLATION';
        return {
          id: v._id,
          name: `[Violation]_${candidateName.replace(/\s+/g, '_')}_${examTitle.replace(/\s+/g, '_')}_${violationType}_Proof.jpg`,
          category: 'Violations',
          candidateName,
          candidateEmail,
          examTitle,
          violationType,
          severity: v.severity,
          description: v.description,
          webViewLink: v.driveUrl || `https://drive.google.com/drive/folders/${status.linkedFolderId}?usp=sharing`,
          previewUrl: v.screenshot || v.snapshotImage,
          createdAt: v.detectedAt || v.createdAt,
          mimeType: 'image/jpeg',
          syncedToCloud: Boolean(v.driveUrl && !v.driveUrl.includes('folders/'))
        };
      });

    const allFiles = [...submissionFiles, ...violationFiles];

    res.status(200).json({
      success: true,
      folderId: status.linkedFolderId,
      folderUrl: status.folderUrl,
      isConfigured: status.isConfigured,
      remoteDriveFilesCount: remoteFiles.length,
      remoteFiles,
      summary: {
        total: allFiles.length,
        submissions: submissionFiles.length,
        violations: violationFiles.length,
      },
      files: allFiles
    });
  } catch (err) {
    next(err);
  }
};

export const syncPendingDriveProofs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const syncedCount = await googleDriveService.syncPendingLocalProofsToDrive();
    const status = googleDriveService.getDriveStatus();
    res.status(200).json({
      success: true,
      syncedCount,
      isConfigured: status.isConfigured,
      message: status.isConfigured
        ? `Successfully synchronized ${syncedCount} violation proof(s) to Google Drive folder ${status.linkedFolderId}.`
        : `Google Drive is not yet authorized. Violation proofs remain safely preserved in local Drive vault.`
    });
  } catch (err) {
    next(err);
  }
};

export const getCandidateAnswers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Support lookup by Result ID, Attempt ID, or candidate ID
    let result = await Result.findById(id)
      .populate('candidateId', 'name email status role')
      .populate('examId', 'title duration description totalMarks');

    if (!result) {
      result = await Result.findOne({ attemptId: id })
        .populate('candidateId', 'name email status role')
        .populate('examId', 'title duration description totalMarks');
    }

    if (!result) {
      return res.status(404).json({ success: false, message: 'Candidate examination result not found' });
    }

    const attempt = await Attempt.findById(result.attemptId);
    const candidate: any = result.candidateId;
    const exam: any = result.examId;

    const questions = await Question.find({ examId: result.examId }).sort({ order: 1, createdAt: 1 });
    const answers = await Answer.find({ attemptId: result.attemptId });
    const violations = await ViolationEvent.find({ attemptId: result.attemptId }).sort({ detectedAt: -1 });

    const answersBreakdown = questions.map((q: any, idx: number) => {
      const ans = answers.find(a => String(a.questionId) === String(q._id));
      const candidateSelectedAnswer = ans ? ans.selectedAnswer : null;
      const isAttempted = Boolean(ans && ans.selectedAnswer !== undefined && ans.selectedAnswer !== null && ans.selectedAnswer !== '');
      const isCorrect = ans ? (ans.isCorrect ?? (JSON.stringify(ans.selectedAnswer) === JSON.stringify(q.correctAnswer))) : false;

      return {
        questionNumber: idx + 1,
        questionId: q._id,
        questionText: q.questionText || q.text || `Question ${idx + 1}`,
        type: q.type || 'MCQ',
        options: q.options || [],
        marks: q.marks || 1,
        negativeMarks: q.negativeMarks || 0,
        marksAwarded: ans?.marksAwarded ?? (isCorrect ? (q.marks || 1) : 0),
        candidateSelectedAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        isAttempted,
        isMarkedForReview: ans?.isMarkedForReview || false,
        answeredAt: ans?.savedAt || ans?.createdAt || null
      };
    });

    const driveReportUrl = result.driveReportUrl || attempt?.driveReportUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing';
    const driveFolderUrl = result.driveFolderUrl || attempt?.driveFolderUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing';

    res.status(200).json({
      success: true,
      candidate: {
        id: candidate?._id,
        name: candidate?.name || 'Unknown Candidate',
        email: candidate?.email || 'N/A'
      },
      exam: {
        id: exam?._id,
        title: exam?.title || 'Examination',
        duration: exam?.duration || 0,
        totalMarks: result.totalMarks || exam?.totalMarks || 100
      },
      result: {
        id: result._id,
        attemptId: result.attemptId,
        obtainedMarks: result.obtainedMarks,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        pass: result.pass,
        correct: result.correct,
        wrong: result.wrong,
        unanswered: result.unanswered,
        totalQuestions: result.totalQuestions,
        riskScore: result.riskScore,
        violations: result.violations,
        timeTaken: result.timeTaken,
        status: result.status,
        driveReportUrl,
        driveFolderUrl,
        createdAt: result.createdAt
      },
      answers: answersBreakdown,
      violations: violations.map((v: any) => ({
        id: v._id,
        type: v.type,
        severity: v.severity,
        description: v.description,
        screenshot: v.screenshot || v.snapshotImage || v.image || '',
        detectedAt: v.detectedAt || v.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
};

export const getCandidateReportHtml = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    let result = await Result.findById(id)
      .populate('candidateId', 'name email')
      .populate('examId', 'title duration totalMarks');

    if (!result) {
      result = await Result.findOne({ attemptId: id })
        .populate('candidateId', 'name email')
        .populate('examId', 'title duration totalMarks');
    }

    if (!result) {
      return res.status(404).send('<h1>Examination Result Not Found</h1>');
    }

    const candidate: any = result.candidateId;
    const exam: any = result.examId;
    const questions = await Question.find({ examId: result.examId }).sort({ order: 1, createdAt: 1 });
    const answers = await Answer.find({ attemptId: result.attemptId });
    const violations = await ViolationEvent.find({ attemptId: result.attemptId }).sort({ detectedAt: -1 });

    const answersBreakdown = questions.map((q: any, idx: number) => {
      const ans = answers.find(a => String(a.questionId) === String(q._id));
      const candidateSelectedAnswer = ans ? ans.selectedAnswer : null;
      const isCorrect = ans ? (ans.isCorrect ?? (JSON.stringify(ans.selectedAnswer) === JSON.stringify(q.correctAnswer))) : false;

      return {
        questionNumber: idx + 1,
        questionId: q._id,
        questionText: q.questionText || q.text || `Question ${idx + 1}`,
        options: q.options || [],
        marks: q.marks || 1,
        candidateSelectedAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        answeredAt: ans?.savedAt || null
      };
    });

    const reportData = {
      candidate: {
        id: candidate?._id,
        name: candidate?.name || 'Candidate',
        email: candidate?.email || 'N/A'
      },
      examination: {
        id: exam?._id,
        title: exam?.title || 'Exam',
        duration: exam?.duration,
        totalMarks: result.totalMarks || exam?.totalMarks
      },
      evaluation: {
        totalQuestions: result.totalQuestions,
        attempted: result.attempted,
        correct: result.correct,
        wrong: result.wrong,
        unanswered: result.unanswered,
        obtainedMarks: result.obtainedMarks,
        percentage: result.percentage,
        passed: result.pass,
        timeTakenSeconds: result.timeTaken,
        riskScore: result.riskScore,
        violationsCount: result.violations
      },
      proctoringViolations: violations.map((v: any) => ({
        type: v.type,
        severity: v.severity,
        detectedAt: v.detectedAt || v.createdAt,
        description: v.description,
        screenshotUrl: v.screenshot || v.snapshotImage || null
      })),
      answersBreakdown
    };

    const html = googleDriveService.generateHtmlReport(reportData);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
};

