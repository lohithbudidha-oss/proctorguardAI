import { Router } from 'express';
import { startAttempt, saveAnswer, submitAttempt, getAttempt } from '../controllers/attemptController';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { Role } from '../models/User';

const router = Router();

// Apply auth and candidate check to all candidate routes
router.use(authenticate, requireRole([Role.CANDIDATE]));

// Attempt execution routes
router.get('/attempts/:attemptId', getAttempt);
router.post('/exams/:examId/start', startAttempt);
router.post('/attempts/:attemptId/answers', saveAnswer);
router.post('/attempts/:attemptId/submit', submitAttempt);

import { getAssignedExams, getExamDetails, getAttemptResult } from '../controllers/candidateController';

// Exam info routes
router.get('/exams', getAssignedExams);
router.get('/exams/:examId', getExamDetails);
router.get('/results/:attemptId', getAttemptResult);

export default router;
