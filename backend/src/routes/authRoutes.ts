import { Router } from 'express';
import { register, login, logout, verifyEmail, publicExamRegister } from '../controllers/authController';
import rateLimit from 'express-rate-limit';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 auth requests per windowMs
  message: { success: false, message: 'Too many requests, please try again later.' }
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/verify-email', verifyEmail);
router.post('/public/exams/:examId/register', authLimiter, publicExamRegister);
// router.post('/forgot-password', forgotPassword);

export default router;
