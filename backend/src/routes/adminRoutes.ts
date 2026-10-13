import { Router } from 'express';
import { getCandidates, updateCandidateStatus, approveCandidate, deleteCandidate, getLiveCandidates, lockAttempt, unlockAttempt, forceSubmitAttempt } from '../controllers/adminController';
import { createExam, getExams, getExamById, updateExam, deleteExam, publishExam, getExamCandidates, assignCandidate, assignAllCandidates, unassignCandidate, allowRewriteAll, allowRewrite } from '../controllers/examController';
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
router.delete('/candidates/:id', deleteCandidate);

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
router.post('/exams/:id/assign-all', assignAllCandidates);
router.delete('/exams/:id/assign/:candidateId', unassignCandidate);
router.post('/exams/:id/allow-rewrite-all', allowRewriteAll);
router.post('/exams/:id/allow-rewrite/:candidateId', allowRewrite);

// REM-04: Real Admin Live Monitoring
router.get('/live', getLiveCandidates);

// REM-05 & REM-06: Remote Controls
router.post('/live/:attemptId/lock', lockAttempt);
router.post('/live/:attemptId/unlock', unlockAttempt);
router.post('/live/:attemptId/force-submit', forceSubmitAttempt);

// Results and Violations
import { 
  getViolations, 
  getResults, 
  verifyResult, 
  getDriveStatus, 
  getDriveFiles,
  syncPendingDriveProofs,
  getCandidateAnswers, 
  getCandidateReportHtml 
} from '../controllers/adminController';
import { 
  getSupportTickets, 
  updateSupportTicket, 
  deleteSupportTicket 
} from '../controllers/supportController';

router.get('/violations', getViolations);
router.get('/results', getResults);
router.get('/results/:id/answers', getCandidateAnswers);
router.get('/results/:id/report-html', getCandidateReportHtml);
router.get('/attempts/:id/answers', getCandidateAnswers);
router.get('/attempts/:id/report-html', getCandidateReportHtml);
router.patch('/results/:id/verify', verifyResult);
router.get('/drive/status', getDriveStatus);
router.get('/drive/files', getDriveFiles);
router.post('/drive/sync-pending', syncPendingDriveProofs);

// Help Desk & Support Inquiries Management
router.get('/support', getSupportTickets);
router.get('/helpdesk', getSupportTickets);
router.patch('/support/:id', updateSupportTicket);
router.patch('/helpdesk/:id', updateSupportTicket);
router.delete('/support/:id', deleteSupportTicket);
router.delete('/helpdesk/:id', deleteSupportTicket);

export default router;
