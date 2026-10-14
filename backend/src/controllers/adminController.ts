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

import Assignment, { AssignmentStatus } from '../models/Assignment';

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

    // 1. Fetch most recent 60 attempts using indexed primary key sort {_id: -1} (sub-millisecond scan)
    const attempts = await Attempt.find()
      .select('candidateId examId status startedAt submittedAt expiresAt score percentage resultStatus updatedAt createdAt')
      .sort({ _id: -1 })
      .limit(60)
      .lean();

    // 2. Fetch pending or active assignments (scheduled candidates who haven't attempted yet)
    let assignments: any[] = [];
    try {
      assignments = await Assignment.find({ status: { $in: [AssignmentStatus.PENDING, AssignmentStatus.ACTIVE] } })
        .select('candidateId examId status scheduledAt createdAt')
        .sort({ _id: -1 })
        .limit(30)
        .lean();
    } catch (assignErr) {
      console.warn('[AdminController] Error fetching assignments:', assignErr);
    }

    // Collect all candidate, exam, and attempt IDs
    const candidateIdSet = new Set<string>();
    const examIdSet = new Set<string>();
    const attemptIdList: mongoose.Types.ObjectId[] = [];

    attempts.forEach((a: any) => {
      attemptIdList.push(a._id);
      const cId = a.candidateId?.toString();
      if (cId && mongoose.Types.ObjectId.isValid(cId)) candidateIdSet.add(cId);
      const eId = a.examId?.toString();
      if (eId && mongoose.Types.ObjectId.isValid(eId)) examIdSet.add(eId);
    });

    assignments.forEach((a: any) => {
      const cId = a.candidateId?.toString();
      if (cId && mongoose.Types.ObjectId.isValid(cId)) candidateIdSet.add(cId);
      const eId = a.examId?.toString();
      if (eId && mongoose.Types.ObjectId.isValid(eId)) examIdSet.add(eId);
    });

    const cIdsToFetch = Array.from(candidateIdSet);
    const eIdsToFetch = Array.from(examIdSet);

    // 3. Parallel fetch of Users, Exams, Results, and Violations with lean projections
    const [users, exams, results, violations] = await Promise.all([
      User.find({ _id: { $in: cIdsToFetch } }).select('name email').lean(),
      Exam.find({ _id: { $in: eIdsToFetch } }).select('title duration totalMarks passPercentage scoringRules').lean(),
      Result.find({ attemptId: { $in: attemptIdList } })
        .select('attemptId obtainedMarks totalMarks percentage pass status totalQuestions attempted correct wrong unanswered timeTaken riskScore createdAt')
        .lean(),
      ViolationEvent.find({
        $or: [
          { attemptId: { $in: attemptIdList } },
          { candidateId: { $in: cIdsToFetch } }
        ]
      })
        // IMPORTANT: Exclude snapshotImage/screenshot from initial fetch to prevent 45s timeouts.
        // Heavy base64 images are served on-demand via GET /api/admin/violations/:id/proof
        .select('_id attemptId candidateId type severity detectedAt description actionTaken hasScreenshot driveUrl driveFolderUrl')
        .sort({ detectedAt: -1 })
        .limit(250)
        .lean()
    ]);

    const userMap = new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));
    const examMap = new Map<string, any>(exams.map((e: any) => [e._id.toString(), e]));
    const resultMap = new Map<string, any>(results.map((r: any) => [r.attemptId.toString(), r]));

    const violationMapByAttempt = new Map<string, any[]>();
    const violationMapByCandidate = new Map<string, any[]>();

    for (const v of violations) {
      const candIdStr = v.candidateId ? v.candidateId.toString() : '';

      const vObj = {
        id: v._id,
        _id: v._id,
        type: v.type,
        severity: v.severity,
        detectedAt: v.detectedAt,
        description: v.description || '',
        // No inline screenshot — use /api/admin/violations/:id/proof for on-demand loading
        screenshot: '',
        // If hasScreenshot field is not yet set on past records, allow on-demand proof check
        hasScreenshot: (v as any).hasScreenshot !== undefined ? Boolean((v as any).hasScreenshot) : true,
        driveUrl: (v as any).driveUrl || '',
        actionTaken: v.actionTaken
      };

      if (v.attemptId) {
        const attStr = v.attemptId.toString();
        if (!violationMapByAttempt.has(attStr)) violationMapByAttempt.set(attStr, []);
        const aList = violationMapByAttempt.get(attStr)!;
        if (aList.length < 25) aList.push(vObj);
      }

      if (candIdStr) {
        if (!violationMapByCandidate.has(candIdStr)) violationMapByCandidate.set(candIdStr, []);
        const cList = violationMapByCandidate.get(candIdStr)!;
        if (cList.length < 25) cList.push(vObj);
      }
    }

    const now = new Date();

    const attemptsData = attempts.map((doc: any) => {
      const cId = doc.candidateId?.toString() || '';
      const eId = doc.examId?.toString() || '';
      const candidate = userMap.get(cId) || { _id: cId, name: cId ? `Candidate (${cId.slice(-4)})` : 'Candidate', email: '' };
      const exam = examMap.get(eId) || { _id: eId, title: 'Assessment', duration: 60, totalMarks: 100 };
      const attIdStr = doc._id.toString();
      const result = resultMap.get(attIdStr);

      // Match violations by attemptId first, fallback to candidateId so past violations always show
      let attemptViolations = violationMapByAttempt.get(attIdStr);
      if (!attemptViolations || attemptViolations.length === 0) {
        attemptViolations = violationMapByCandidate.get(cId) || [];
      }

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

    const existingPairs = new Set(
      attempts.map((a: any) => `${a.candidateId?.toString() || ''}_${a.examId?.toString() || ''}`)
    );

    const assignedCandidatesData: any[] = [];
    for (const a of assignments) {
      const cId = a.candidateId?.toString() || '';
      const eId = a.examId?.toString() || '';
      const pairKey = `${cId}_${eId}`;

      if (cId && eId && !existingPairs.has(pairKey)) {
        existingPairs.add(pairKey);
        const cand = userMap.get(cId) || { _id: cId, name: `Candidate (${cId.slice(-4)})`, email: '' };
        const ex = examMap.get(eId) || { _id: eId, title: 'Assessment', duration: 60, totalMarks: 100 };
        const candidateViolations = violationMapByCandidate.get(cId) || [];

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
          totalMarks: ex.totalMarks || 100,
          percentage: 0,
          resultStatus: 'PENDING',
          totalQuestions: 0,
          attempted: 0,
          correct: 0,
          wrong: 0,
          unanswered: 0,
          timeTaken: 0,
          riskScore: 0,
          violations: candidateViolations,
          camera: 'READY',
          screen: 'READY'
        });
      }
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

    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 60));

    // 1. Fetch violations with flat lean projection to eliminate memory saturation and timeouts
    const rawViolations = await ViolationEvent.find()
      // IMPORTANT: Exclude screenshot/snapshotImage to prevent memory saturation and 45s timeouts.
      // Full screenshot data is served on-demand via GET /api/admin/violations/:id/proof
      .select('_id candidateId attemptId type severity detectedAt description actionTaken hasScreenshot driveUrl driveFolderUrl')
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean();

    const candidateIdSet = new Set<string>();
    const attemptIdSet = new Set<string>();

    rawViolations.forEach((v: any) => {
      const cId = (v.candidateId?._id || v.candidateId)?.toString();
      if (cId && mongoose.Types.ObjectId.isValid(cId)) candidateIdSet.add(cId);
      const aId = (v.attemptId?._id || v.attemptId)?.toString();
      if (aId && mongoose.Types.ObjectId.isValid(aId)) attemptIdSet.add(aId);
    });

    const candidateIds = Array.from(candidateIdSet);
    const attemptIds = Array.from(attemptIdSet);

    // 2. Parallel flat lookups (no nested Mongoose populates)
    const [attempts, users] = await Promise.all([
      (candidateIds.length > 0 || attemptIds.length > 0)
        ? Attempt.find({
            $or: [
              ...(candidateIds.length > 0 ? [{ candidateId: { $in: candidateIds } }] : []),
              ...(attemptIds.length > 0 ? [{ _id: { $in: attemptIds } }] : [])
            ]
          })
            .select('_id candidateId examId status startedAt submittedAt score percentage createdAt')
            .sort({ createdAt: -1 })
            .lean()
        : Promise.resolve([]),
      candidateIds.length > 0
        ? User.find({ _id: { $in: candidateIds } }).select('_id name email').lean()
        : Promise.resolve([])
    ]);

    // Collect exam IDs and candidate IDs from attempts
    const examIdSet = new Set<string>();
    attempts.forEach((att: any) => {
      const eId = (att.examId?._id || att.examId)?.toString();
      if (eId && mongoose.Types.ObjectId.isValid(eId)) examIdSet.add(eId);
      const cId = (att.candidateId?._id || att.candidateId)?.toString();
      if (cId && mongoose.Types.ObjectId.isValid(cId)) candidateIdSet.add(cId);
    });

    // Fetch missing users & exams in parallel
    const missingUserIds = Array.from(candidateIdSet).filter(id => !users.some((u: any) => u._id.toString() === id));
    const [extraUsers, exams] = await Promise.all([
      missingUserIds.length > 0
        ? User.find({ _id: { $in: missingUserIds } }).select('_id name email').lean()
        : Promise.resolve([]),
      examIdSet.size > 0
        ? Exam.find({ _id: { $in: Array.from(examIdSet) } }).select('_id title duration totalMarks passPercentage').lean()
        : Promise.resolve([])
    ]);

    const allUsers = [...users, ...extraUsers];
    const userMap = new Map<string, any>(allUsers.map((u: any) => [u._id.toString(), u]));
    const examMap = new Map<string, any>(exams.map((e: any) => [e._id.toString(), e]));

    // Format attempts with resolved candidateId and examId objects
    const populatedAttempts = attempts.map((att: any) => {
      const cId = (att.candidateId?._id || att.candidateId)?.toString() || '';
      const eId = (att.examId?._id || att.examId)?.toString() || '';
      return {
        ...att,
        candidateId: userMap.get(cId) || { _id: cId, name: 'Candidate', email: '' },
        examId: examMap.get(eId) || { _id: eId, title: 'Assessment', duration: 60, totalMarks: 100 }
      };
    });

    const attemptMap = new Map<string, any>(populatedAttempts.map((att: any) => [att._id.toString(), att]));

    // 3. Format violations: no inline screenshot — use /api/admin/violations/:id/proof for on-demand loading
    const normalizedViolations = rawViolations.map((v: any) => {
      const attId = (v.attemptId?._id || v.attemptId)?.toString() || null;
      const matchedAttempt = attId ? attemptMap.get(attId) : null;

      const directCandId = (v.candidateId?._id || v.candidateId)?.toString() || '';
      const matchedCandId = (matchedAttempt?.candidateId?._id || matchedAttempt?.candidateId)?.toString() || '';
      const effectiveCandId = directCandId || matchedCandId;

      const candidate = (effectiveCandId && userMap.get(effectiveCandId)) || 
        matchedAttempt?.candidateId || 
        (effectiveCandId ? { _id: effectiveCandId, name: `Candidate (${effectiveCandId.slice(-4)})`, email: '' } : { _id: 'unknown', name: 'Candidate', email: '' });

      const effectiveAttempt = matchedAttempt || {
        _id: attId || 'unknown_attempt',
        examId: { _id: 'assessment', title: 'Assessment' }
      };

      return {
        _id: v._id,
        candidateId: candidate,
        attemptId: effectiveAttempt,
        type: v.type,
        severity: v.severity,
        detectedAt: v.detectedAt,
        description: v.description || '',
        actionTaken: v.actionTaken || 'LOG',
        // hasScreenshot reflects whether proof image exists — fallback to true if not yet migrated
        hasScreenshot: (v as any).hasScreenshot !== undefined ? Boolean((v as any).hasScreenshot) : true,
        screenshot: '', // fetch on-demand via GET /api/admin/violations/:id/proof
        driveUrl: v.driveUrl || v.driveFolderUrl
      };
    });

    res.status(200).json({
      success: true,
      violations: normalizedViolations,
      candidateAttempts: populatedAttempts
    });
  } catch (err) {
    next(err);
  }
};

export const getViolationProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const v = await ViolationEvent.findById(id).select('screenshot snapshotImage driveUrl driveFolderUrl').lean();
    if (!v) return res.status(404).json({ success: false, message: 'Violation record not found' });
    res.status(200).json({
      success: true,
      screenshot: v.screenshot || (v as any).snapshotImage || '',
      driveUrl: v.driveUrl || (v as any).driveFolderUrl || ''
    });
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
    const violations = await ViolationEvent.find({ attemptId: result.attemptId })
      .select('_id type severity description detectedAt actionTaken hasScreenshot driveUrl driveFolderUrl createdAt')
      .sort({ detectedAt: -1 })
      .lean();

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
        // screenshot served on-demand via GET /api/admin/violations/:id/proof
        hasScreenshot: (v as any).hasScreenshot !== undefined ? Boolean((v as any).hasScreenshot) : true,
        screenshot: '',
        driveUrl: v.driveUrl || v.driveFolderUrl || '',
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
    const violations = await ViolationEvent.find({ attemptId: result.attemptId })
      .select('_id type severity description detectedAt actionTaken hasScreenshot driveUrl driveFolderUrl createdAt')
      .sort({ detectedAt: -1 })
      .lean();

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

