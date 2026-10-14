import { Router } from 'express';
import { register, login, logout, verifyEmail, publicExamRegister } from '../controllers/authController';
import rateLimit from 'express-rate-limit';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit failed attempts per IP
  skipSuccessfulRequests: true, // Successful logins never count against rate limit
  validate: { xForwardedForHeader: false, default: false },
  message: { success: false, message: 'Too many failed login attempts, please try again in a few minutes.' }
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

router.post('/google/set-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }
    const success = await googleDriveService.setRefreshToken(refreshToken);
    if (success) {
      return res.status(200).json({ success: true, message: 'Google Drive refresh token configured and saved successfully!' });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to configure Google Drive with the provided token.' });
    }
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
        <head>
          <title>Google Drive Connected - ProctorGuard AI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px;">
          <div style="background: #1e293b; border-radius: 20px; padding: 40px; max-width: 480px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.4); text-align: center; border: 1px solid #334155;">
            <div style="width: 64px; height: 64px; background: #064e3b; color: #34d399; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; font-size: 32px; font-weight: bold; border: 2px solid #059669;">✓</div>
            <h2 style="color: #ffffff; margin: 0 0 10px 0; font-size: 22px; font-weight: 800;">Google Drive Connected!</h2>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
              ProctorGuard AI is now authorized with Google Drive. All candidate violation proofs, surveillance snapshots, and exam answer sheets will automatically sync to folder <strong style="color:#60a5fa; font-family:monospace;">1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1</strong>.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <a href="http://localhost:3000/admin/violations" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; border-radius: 10px; font-weight: bold; text-decoration: none; font-size: 14px;">View Violation Queue</a>
              <a href="http://localhost:3000/admin/reports" style="display: inline-block; padding: 12px 24px; background: #334155; color: white; border-radius: 10px; font-weight: bold; text-decoration: none; font-size: 14px;">Drive Vault & Reports</a>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Window will auto-close or redirect shortly...</p>
          </div>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_DRIVE_CONNECTED' }, '*');
                setTimeout(() => window.close(), 2500);
              } else {
                setTimeout(() => { window.location.href = 'http://localhost:3000/admin/violations'; }, 3000);
              }
            } catch (e) {}
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send('Google Drive Authorization Error: ' + err.message);
  }
});

export default router;
