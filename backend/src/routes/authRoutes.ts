import { Router } from 'express';
import { register, login, logout, verifyEmail, publicExamRegister } from '../controllers/authController';
import rateLimit from 'express-rate-limit';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 auth requests per windowMs
  message: { success: false, message: 'Too many requests, please try again later.' }
});

import { googleDriveService } from '../services/googleDriveService';

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/verify-email', verifyEmail);
router.post('/public/exams/:examId/register', authLimiter, publicExamRegister);
// router.post('/forgot-password', forgotPassword);

// Google OAuth 2.0 Drive authorization routes
router.get('/google/drive-auth', (req, res) => {
  try {
    const authUrl = googleDriveService.getAuthUrl();
    res.redirect(authUrl);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).send('Google Authorization code is missing.');
    }
    const tokens = await googleDriveService.setAuthCode(code);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Google Drive Connected</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
          <div style="background: white; border-radius: 16px; padding: 40px; max-width: 500px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; border: 1px solid #e2e8f0;">
            <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 28px;">✓</div>
            <h2 style="color: #0f172a; margin: 0 0 8px 0;">Google Drive Connected!</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">
              ProctorGuard AI has successfully authorized your Google Drive account. Violation evidence and exam reports will now sync automatically to your Google Drive folder.
            </p>
            ${tokens?.refresh_token ? `<div style="background:#f1f5f9; padding:8px 12px; border-radius:8px; font-size:11px; word-break:break-all; font-family:monospace; margin-bottom:20px; color:#334155;"><strong>Refresh Token:</strong> ${tokens.refresh_token}</div>` : ''}
            <a href="http://localhost:3000/admin/monitoring" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; border-radius: 10px; font-weight: bold; text-decoration: none; font-size: 14px;">Return to Admin Dashboard</a>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send('Google Drive Authorization Error: ' + err.message);
  }
});

export default router;
