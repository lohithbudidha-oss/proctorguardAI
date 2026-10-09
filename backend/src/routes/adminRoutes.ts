import { Router } from 'express';
import { getCandidates, updateCandidateStatus, approveCandidate, getLiveCandidates, lockAttempt, unlockAttempt, forceSubmitAttempt } from '../controllers/adminController';
import { createExam, getExams, getExamById, updateExam, deleteExam, publishExam, getExamCandidates, assignCandidate, allowRewriteAll } from '../controllers/examController';
import { getQuestions, createQuestion, updateQuestion, deleteQuestion } from '../controllers/questionController';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { Role } from '../models/User';

const router = Router();

// Apply auth and admin check to all admin routes
router.use(authenticate, requireRole([Role.ADMIN, Role.PROCTOR]));

router.get('/dashboard', (req, res) => {
  res.json({ success: true, message: 'Admin dashboard stats' });
});

router.get('/candidates', getCandidates);
router.patch('/candidates/:id/status', updateCandidateStatus);
router.patch('/candidates/:id/approve', approveCandidate);

router.post('/exams', createExam);
router.get('/exams', getExams);
router.get('/exams/:id', getExamById);
router.patch('/exams/:id', updateExam);
router.delete('/exams/:id', deleteExam);
router.post('/exams/:id/publish', publishExam);

// Questions
router.get('/exams/:examId/questions', getQuestions);
router.post('/exams/:examId/questions', createQuestion);
router.patch('/questions/:id', updateQuestion);
router.delete('/questions/:id', deleteQuestion);

// Assignments
router.get('/exams/:id/candidates', getExamCandidates);
router.post('/exams/:id/assign', assignCandidate);
router.post('/exams/:id/allow-rewrite-all', allowRewriteAll);

// REM-04: Real Admin Live Monitoring
router.get('/live', getLiveCandidates);

// REM-05 & REM-06: Remote Controls
router.post('/live/:attemptId/lock', lockAttempt);
router.post('/live/:attemptId/unlock', unlockAttempt);
router.post('/live/:attemptId/force-submit', forceSubmitAttempt);

// Results and Violations
import { getViolations, getResults, verifyResult } from '../controllers/adminController';
router.get('/violations', getViolations);
router.get('/results', getResults);
router.patch('/results/:id/verify', verifyResult);

export default router;
