import { Request, Response, NextFunction } from 'express';
import Attempt, { AttemptStatus } from '../models/Attempt';
import Assignment, { AssignmentStatus } from '../models/Assignment';
import Exam from '../models/Exam';
import Answer from '../models/Answer';
import Result from '../models/Result';
import ViolationEvent from '../models/ViolationEvent';
import Question from '../models/Question';
import User from '../models/User';
import { googleDriveService } from '../services/googleDriveService';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../sockets/proctorSocket';

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

export const getAttempt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const candidateId = req.user?.userId;

    const attempt = await Attempt.findOne({ _id: attemptId, candidateId }).lean();
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });

    const [exam, questions, answers] = await Promise.all([
      Exam.findById(attempt.examId).lean(),
      Question.find({ examId: attempt.examId }).select('-correctAnswer').lean(),
      Answer.find({ attemptId }).lean()
    ]);

    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

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
      if (attempt.status === AttemptStatus.IN_PROGRESS || attempt.status === AttemptStatus.PAUSED) {
        attempt.status = AttemptStatus.AUTO_SUBMITTED;
        attempt.submittedAt = now;
        await attempt.save();

        const assignment = await Assignment.findById(attempt.assignmentId);
        if (assignment) {
          assignment.status = AssignmentStatus.COMPLETED;
          await assignment.save();
        }

        await evaluateAttempt(attemptId as string, candidateId as string);
      }
      return res.status(200).json({ success: true, message: 'Exam time expired. Attempt auto-submitted.' });
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

    const { isTermination, status: requestedStatus, reason } = req.body || {};

    // If already submitted, auto-submitted, or terminated, return success idempotently
    if (attempt.status === AttemptStatus.SUBMITTED || attempt.status === AttemptStatus.AUTO_SUBMITTED || attempt.status === AttemptStatus.TERMINATED) {
      return res.status(200).json({ success: true, message: 'Exam already finalized and submitted' });
    }

    if (![AttemptStatus.IN_PROGRESS, AttemptStatus.PAUSED].includes(attempt.status)) {
       return res.status(403).json({ success: false, message: 'Attempt already finalized' });
    }

    const now = new Date();
    const isTimerExpired = Boolean(attempt.expiresAt && now > attempt.expiresAt);
    
    if (isTermination || requestedStatus === 'TERMINATED') {
      attempt.status = AttemptStatus.TERMINATED;
    } else {
      attempt.status = isTimerExpired ? AttemptStatus.AUTO_SUBMITTED : AttemptStatus.SUBMITTED;
    }
    attempt.submittedAt = now;
    await attempt.save();

    const assignment = await Assignment.findById(attempt.assignmentId);
    if (assignment) {
      assignment.status = AssignmentStatus.COMPLETED;
      await assignment.save();
    }

    await evaluateAttempt(attemptId as string, candidateId as string);

    // Notify proctors via socket if terminated
    try {
      const io = getIO();
      if (io) {
        io.to('proctors').emit('attempt:status_change', {
          attemptId,
          candidateId,
          status: attempt.status,
          reason: reason || (isTermination ? 'Terminated due to prohibited device infractions' : 'Exam finalized')
        });
      }
    } catch (sErr) {}

    res.status(200).json({ 
      success: true, 
      message: attempt.status === AttemptStatus.TERMINATED
        ? 'Exam terminated due to violation policy'
        : (isTimerExpired ? 'Exam timer completed. Exam automatically submitted.' : 'Exam submitted successfully')
    });
  } catch (err) {
    next(err);
  }
};

// Helper to clean and normalize strings for matching
function cleanAnswerValue(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim().toLowerCase();
  // Strip outer quotes
  str = str.replace(/^["']|["']$/g, '');
  // Strip latex markers like $, \
  str = str.replace(/\$/g, '').replace(/\\/g, '');
  // Collapse whitespace
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

// Extract canonical representation tokens from an option or answer
function extractTokens(val: any): string[] {
  const cleaned = cleanAnswerValue(val);
  if (!cleaned) return [];
  const tokens = new Set<string>([cleaned]);

  // If formatted like "(B) 800" or "B) 800" or "B. 800" or "B - 800"
  const prefixMatch = cleaned.match(/^\(?([a-z0-9])\)?[.\s\-:]+(.*)$/);
  if (prefixMatch) {
    tokens.add(prefixMatch[1]); // option letter e.g. "b"
    const rest = cleanAnswerValue(prefixMatch[2]);
    if (rest) tokens.add(rest); // option content e.g. "800"
  }

  return Array.from(tokens);
}

// Compare candidate answer with correct answer considering option structure
function isSingleAnswerMatch(q: any, candidateVal: any, correctVal: any): boolean {
  if (candidateVal === null || candidateVal === undefined) return false;
  if (correctVal === null || correctVal === undefined) return false;

  const candidateTokens = extractTokens(candidateVal);
  const correctTokens = extractTokens(correctVal);

  // 1. Direct token overlap (e.g. "800" === "800", or "b" === "b", or "true" === "true")
  for (const cToken of candidateTokens) {
    for (const corrToken of correctTokens) {
      if (cToken === corrToken) return true;
    }
  }

  // 2. Check if both refer to the same option in q.options
  if (Array.isArray(q.options) && q.options.length > 0) {
    for (let idx = 0; idx < q.options.length; idx++) {
      const opt = q.options[idx];
      const optLetter = String.fromCharCode(97 + idx); // 'a', 'b', 'c', 'd'

      const optTokens = new Set<string>([
        optLetter
      ]);

      if (typeof opt === 'string' || typeof opt === 'number') {
        extractTokens(opt).forEach(t => optTokens.add(t));
      } else if (typeof opt === 'object' && opt !== null) {
        if (opt.id) extractTokens(opt.id).forEach(t => optTokens.add(t));
        if (opt.text) extractTokens(opt.text).forEach(t => optTokens.add(t));
        if (opt.value) extractTokens(opt.value).forEach(t => optTokens.add(t));
        if (opt.title) extractTokens(opt.title).forEach(t => optTokens.add(t));
      }

      // Check if correctVal points to this option
      const correctMatchesThisOpt = correctTokens.some(t => optTokens.has(t));
      // Check if candidateVal points to this option
      const candidateMatchesThisOpt = candidateTokens.some(t => optTokens.has(t));

      if (correctMatchesThisOpt && candidateMatchesThisOpt) {
        return true;
      }
    }
  }

  return false;
}

// Check answer correctness supporting single-choice, multiple-choice, and array values
function checkAnswerCorrectness(q: any, candidateAns: any): boolean {
  if (candidateAns === null || candidateAns === undefined) return false;

  const correct = q.correctAnswer;
  if (correct === null || correct === undefined) return false;

  // Multiple choice (array of correct answers)
  if (Array.isArray(correct)) {
    const candidateList = Array.isArray(candidateAns) ? candidateAns : [candidateAns];
    if (candidateList.length !== correct.length) return false;

    // Every correct answer must match a candidate selection
    const allCorrectMatched = correct.every(corrItem =>
      candidateList.some(candItem => isSingleAnswerMatch(q, candItem, corrItem))
    );
    // Every candidate selection must match a correct answer
    const allCandidateValid = candidateList.every(candItem =>
      correct.some(corrItem => isSingleAnswerMatch(q, candItem, corrItem))
    );

    return allCorrectMatched && allCandidateValid;
  }

  // Single choice, but candidate passed an array of 1
  if (Array.isArray(candidateAns)) {
    if (candidateAns.length !== 1) return false;
    return isSingleAnswerMatch(q, candidateAns[0], correct);
  }

  return isSingleAnswerMatch(q, candidateAns, correct);
}

export const evaluateAttempt = async (attemptId: string, candidateId: string) => {
    const attempt = await Attempt.findOne({ _id: attemptId, candidateId });
    if (!attempt) return null;
    const questions = await Question.find({ examId: attempt.examId });
    const answers = await Answer.find({ attemptId });
    const violations = await ViolationEvent.find({ attemptId });

    let correct = 0;
    let wrong = 0;
    let obtainedMarks = 0;
    let totalMarks = 0;

    // Evaluate each question with robust representation matching
    for (const q of questions) {
      const qMarks = Number(q.marks) || 1;
      const qNegative = Number(q.negativeMarks) || 0;
      totalMarks += qMarks;

      const ans = answers.find(a => a.questionId.toString() === q._id.toString());
      const hasAnswer = ans && ans.selectedAnswer !== undefined && ans.selectedAnswer !== null && ans.selectedAnswer !== '';

      if (hasAnswer) {
        const isCorrect = checkAnswerCorrectness(q, ans.selectedAnswer);

        if (isCorrect) {
          correct++;
          obtainedMarks += qMarks;
        } else {
          wrong++;
          obtainedMarks -= qNegative;
        }

        // Save correctness back to individual Answer document
        ans.isCorrect = isCorrect;
        ans.marksAwarded = isCorrect ? qMarks : -qNegative;
        await ans.save();
      }
    }

    const attempted = answers.filter(a => a.selectedAnswer !== undefined && a.selectedAnswer !== null && a.selectedAnswer !== '').length;
    const unanswered = Math.max(0, questions.length - attempted);
    obtainedMarks = Math.max(0, obtainedMarks);
    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    const roundedPercentage = Math.round(percentage * 100) / 100;
    // Assuming 50% passing marks
    const pass = percentage >= 50;

    let timeTaken = 0;
    if (attempt.submittedAt && attempt.startedAt) {
      timeTaken = Math.max(0, Math.floor((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000));
    } else if (attempt.startedAt) {
      timeTaken = Math.max(0, Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000));
    }

    const riskScore = violations.reduce((acc, v) => acc + (v.severity === 'CRITICAL' ? 50 : v.severity === 'HIGH' ? 25 : 10), 0);

    // Find or create result document
    let result = await Result.findOne({ attemptId });
    if (!result) {
      result = new Result({
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
        percentage: roundedPercentage,
        pass,
        timeTaken,
        riskScore: Math.min(riskScore, 100),
        violations: violations.length
      });
    } else {
      result.totalQuestions = questions.length;
      result.attempted = attempted;
      result.correct = correct;
      result.wrong = wrong;
      result.unanswered = unanswered;
      result.totalMarks = totalMarks;
      result.obtainedMarks = obtainedMarks;
      result.percentage = roundedPercentage;
      result.pass = pass;
      result.timeTaken = timeTaken;
      result.riskScore = Math.min(riskScore, 100);
      result.violations = violations.length;
    }
    
    await result.save();

    // Update Attempt document with score and resultStatus
    attempt.score = obtainedMarks;
    attempt.percentage = roundedPercentage;
    attempt.resultStatus = pass ? 'PASS' : 'FAIL';
    await attempt.save();

    // Sync Examination Submission and Answers Report to Google Drive Folder: 1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1
    try {
      const candidate = await User.findById(candidateId);
      const exam = await Exam.findById(attempt.examId);
      const driveUpload = await googleDriveService.uploadExamSubmission(
        { id: candidateId, name: candidate?.name || 'Candidate', email: candidate?.email },
        { id: attempt.examId.toString(), title: exam?.title || 'Exam', duration: exam?.duration, totalMarks },
        questions,
        answers,
        result,
        violations
      );

      result.driveReportUrl = driveUpload.htmlResult.webViewLink;
      result.driveJsonUrl = driveUpload.jsonResult.webViewLink;
      result.driveFolderUrl = `https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing`;
      await result.save();

      attempt.driveReportUrl = driveUpload.htmlResult.webViewLink;
      attempt.driveFolderUrl = result.driveFolderUrl;
      await attempt.save();
    } catch (driveErr) {
      console.warn('[GoogleDrive] Syncing exam answers report error:', driveErr);
    }

    return result;
};

export const recordViolation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const { type, severity, source, description, screenshot } = req.body;
    const candidateId = req.user?.userId || (req.user as any)?.id || req.body?.candidateId;

    let attempt = candidateId ? await Attempt.findOne({ _id: attemptId, candidateId }) : null;
    if (!attempt) {
      attempt = await Attempt.findById(attemptId);
    }
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }
    const finalCandidateId = candidateId || attempt.candidateId;

    // Do not record violations once the exam is submitted, completed, or terminated
    if (['SUBMITTED', 'AUTO_SUBMITTED', 'FORCE_SUBMITTED', 'COMPLETED', 'TERMINATED', 'INVALIDATED'].includes(attempt.status)) {
      return res.status(200).json({ success: false, message: 'Exam attempt finalized. Violation detection is closed.' });
    }

    const shot = screenshot || req.body.image || req.body.snapshotImage || '';
    const driveFolderUrl = `https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing`;

    // Deduplicate identical violation event received within 3 seconds
    const recentDuplicate = await ViolationEvent.findOne({
      attemptId,
      type: type || 'VIOLATION',
      detectedAt: { $gte: new Date(Date.now() - 3000) }
    });
    if (recentDuplicate) {
      return res.status(200).json({ success: true, violation: recentDuplicate, deduplicated: true });
    }

    // 1. Save violation immediately to MongoDB
    const violation = new ViolationEvent({
      attemptId,
      candidateId: finalCandidateId,
      type: type || 'VIOLATION',
      severity: severity || 'CRITICAL',
      source: source || 'BROWSER',
      detectedAt: new Date(),
      actionTaken: req.body.actionTaken || 'LOG',
      description: description || '',
      screenshot: shot,
      snapshotImage: shot,
      driveFolderUrl
    });
    await violation.save();

    // 2. Broadcast immediately to all connected proctors & admins via socket
    try {
      const io = getIO();
      if (io) {
        const populatedViolation = await ViolationEvent.findById(violation._id)
          .populate('candidateId', 'name email')
          .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } });

        io.to('proctors').emit('violation:alert', {
          candidateId,
          violation: populatedViolation || violation
        });

        if (shot) {
          io.to('proctors').emit('evidence:snapshot_alert', {
            candidateId,
            attemptId,
            type: type || 'VIOLATION',
            severity: severity || 'CRITICAL',
            description,
            image: shot,
            screenshot: shot
          });
        }
      }
    } catch (socketBroadcastErr) {
      console.warn('[AttemptController] Real-time socket broadcast warning:', socketBroadcastErr);
    }

    // 3. Upload violation screenshot asynchronously to Google Drive folder: 1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1
    if (shot) {
      (async () => {
        try {
          const candidate = await User.findById(candidateId);
          const exam = await Exam.findById(attempt.examId);
          const uploadRes = await googleDriveService.uploadViolationImage(
            shot,
            candidate?.name || 'Candidate',
            exam?.title || 'Exam',
            type || 'VIOLATION',
            new Date()
          );
          if (uploadRes?.webViewLink) {
            const updated = await ViolationEvent.findByIdAndUpdate(
              violation._id, 
              { driveUrl: uploadRes.webViewLink },
              { new: true }
            ).populate('candidateId', 'name email')
             .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } });

            try {
              const io = getIO();
              if (io) {
                io.to('proctors').emit('violation:updated', {
                  violationId: violation._id,
                  driveUrl: uploadRes.webViewLink,
                  violation: updated
                });
              }
            } catch (sockErr) {}
          }
        } catch (uploadErr) {
          console.warn('[GoogleDrive] Violation screenshot sync warning:', uploadErr);
        }
      })();
    }

    res.status(200).json({ success: true, violation, driveFolderUrl });
  } catch (err) {
    next(err);
  }
};

export const recordCandidateProof = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const { image, proofType, deviceInfo } = req.body;
    const candidateId = req.user?.userId;

    const attempt = await Attempt.findOne({ _id: attemptId, candidateId });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    const candidate = await User.findById(candidateId);
    const exam = await Exam.findById(attempt.examId);
    const driveFolderUrl = `https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing`;

    let driveLink = driveFolderUrl;
    if (image) {
      try {
        const uploadRes = await googleDriveService.uploadCandidateProof(
          image,
          { id: candidateId, name: candidate?.name || 'Candidate', email: candidate?.email },
          exam?.title || 'Exam',
          proofType || 'Identity_Verification'
        );
        if (uploadRes?.webViewLink) {
          driveLink = uploadRes.webViewLink;
        }
      } catch (err) {
        console.warn('[GoogleDrive] Candidate proof upload warning:', err);
      }
    }

    attempt.candidateProofUrl = driveLink;
    attempt.driveFolderUrl = driveFolderUrl;
    await attempt.save();

    res.status(200).json({
      success: true,
      message: 'Candidate proof linked to Google Drive successfully',
      candidateProofUrl: driveLink,
      driveFolderUrl
    });
  } catch (err) {
    next(err);
  }
};

export const startAttemptTimer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { attemptId } = req.params;
    const candidateId = req.user?.userId;

    const attempt = await Attempt.findOne({ _id: attemptId, candidateId });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      return res.status(400).json({ success: false, message: 'Attempt is not in progress' });
    }

    const exam = await Exam.findById(attempt.examId);
    const durationMinutes = exam?.duration || 60;
    const now = new Date();

    const existingStarted = attempt.startedAt ? new Date(attempt.startedAt).getTime() : 0;
    const isRecentlyStarted = !existingStarted || (now.getTime() - existingStarted < 10 * 60 * 1000);

    if (isRecentlyStarted) {
      attempt.startedAt = now;
      attempt.expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
      attempt.durationSeconds = durationMinutes * 60;
      await attempt.save();
    }

    res.status(200).json({
      success: true,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      durationSeconds: attempt.durationSeconds || durationMinutes * 60
    });
  } catch (err) {
    next(err);
  }
};

