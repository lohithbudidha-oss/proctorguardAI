import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export interface DriveUploadResult {
  fileId?: string;
  webViewLink: string;
  downloadUrl?: string;
  fileName: string;
  syncedToCloud: boolean;
  localPath?: string;
}

export class GoogleDriveService {
  private drive: any = null;
  private isConfigured: boolean = false;
  private folderId: string = '1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1';
  private subfolderCache: Map<string, string> = new Map();
  private serviceAccountEmail: string = '';
  private localVaultPath: string = process.env.VERCEL
    ? path.join(require('os').tmpdir(), 'google_drive_vault')
    : path.join(__dirname, '../../temp_storage/google_drive_vault');

  private oauth2Client: any = null;

  constructor() {
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1';
    this.initAuth();
    this.ensureLocalVault();
  }

  private ensureLocalVault() {
    try {
      if (!fs.existsSync(this.localVaultPath)) {
        fs.mkdirSync(this.localVaultPath, { recursive: true });
      }
      const subdirs = ['Violations', 'Candidate_Proofs', 'Exam_Submissions', 'Recordings'];
      for (const dir of subdirs) {
        const full = path.join(this.localVaultPath, dir);
        if (!fs.existsSync(full)) {
          fs.mkdirSync(full, { recursive: true });
        }
      }
    } catch (e) {
      console.warn('[GoogleDrive] Could not initialize local vault directories:', e);
    }
  }

  private initAuth() {
    try {
      let credentials: any = null;

      // 1. Check raw env JSON or base64 JSON
      if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
        const raw = process.env.GOOGLE_DRIVE_CREDENTIALS.trim();
        if (raw.startsWith('{')) {
          credentials = JSON.parse(raw);
        } else {
          // Attempt base64 decode
          const decoded = Buffer.from(raw, 'base64').toString('utf-8');
          credentials = JSON.parse(decoded);
        }
      } 
      // 2. Check credentials.json in backend/ or Portal/ root
      else if (fs.existsSync(path.join(__dirname, '../../credentials.json'))) {
        credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../../credentials.json'), 'utf-8'));
      } else if (fs.existsSync(path.join(__dirname, '../../../credentials.json'))) {
        credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../credentials.json'), 'utf-8'));
      }
      // 3. Check client email + private key individual env vars
      else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        credentials = {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
      }

      if (credentials) {
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive'],
        });
        this.drive = google.drive({ version: 'v3', auth });
        this.isConfigured = true;
        this.serviceAccountEmail = credentials.client_email || 'Service Account';
        console.log(`[GoogleDrive] Initialized Drive client with account: ${this.serviceAccountEmail}. Target folder: ${this.folderId}`);
      } 
      // 4. Check OAuth 2.0 Client ID & Secret
      else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || (process.env.NODE_ENV === 'production'
          ? 'https://flair-sigma-red.vercel.app/api/auth/google/callback'
          : 'http://localhost:5000/api/auth/google/callback');
        this.oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          redirectUri
        );

        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
        if (refreshToken) {
          this.oauth2Client.setCredentials({ refresh_token: refreshToken });
          this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
          this.isConfigured = true;
          console.log(`[GoogleDrive] Initialized Drive client via OAuth2 Client ID: ${process.env.GOOGLE_CLIENT_ID.substring(0, 15)}... Target folder: ${this.folderId}`);
          setTimeout(() => {
            this.syncPendingLocalProofsToDrive().catch(() => {});
          }, 3000);
        } else {
          console.info(`[GoogleDrive] OAuth2 Client ID & Secret configured. To authorize Drive access, visit /api/auth/google/drive-auth`);
        }
      } else {
        console.info(`[GoogleDrive] Linked target folder: ${this.folderId}. Cloud credentials not provided yet - fallback local sync vault active.`);
      }
    } catch (err) {
      console.warn('[GoogleDrive] Authentication initialization error:', err);
      this.isConfigured = false;
    }
  }

  public getAuthUrl(): string {
    if (!this.oauth2Client) {
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );
    }
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });
  }

  public async setAuthCode(code: string): Promise<any> {
    if (!this.oauth2Client) {
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );
    }
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    this.isConfigured = true;

    if (tokens.refresh_token) {
      try {
        process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
        const envPath = path.join(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf-8');
          if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
            envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
          } else {
            envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
          }
          fs.writeFileSync(envPath, envContent, 'utf-8');
          console.log('[GoogleDrive] Persisted GOOGLE_REFRESH_TOKEN to .env file');
        }
      } catch (e) {
        console.warn('[GoogleDrive] Could not persist refresh token:', e);
      }
    }

    // Trigger auto-sync of any pending local proofs to Google Drive
    setTimeout(() => {
      this.syncPendingLocalProofsToDrive().catch(err => {
        console.warn('[GoogleDrive] Auto-sync after auth warning:', err);
      });
    }, 1500);

    return tokens;
  }

  /**
   * Directly configure a refresh token (e.g. from Google OAuth Playground or admin manual input)
   */
  public async setRefreshToken(refreshToken: string): Promise<boolean> {
    try {
      const cleanToken = refreshToken.trim();
      if (!this.oauth2Client) {
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
        this.oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          redirectUri
        );
      }
      this.oauth2Client.setCredentials({ refresh_token: cleanToken });
      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      this.isConfigured = true;
      process.env.GOOGLE_REFRESH_TOKEN = cleanToken;

      const envPath = path.join(__dirname, '../../.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${cleanToken}`);
        } else {
          envContent += `\nGOOGLE_REFRESH_TOKEN=${cleanToken}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf-8');
      }

      console.log('[GoogleDrive] Configured and persisted refresh token.');
      setTimeout(() => {
        this.syncPendingLocalProofsToDrive().catch(() => {});
      }, 1500);
      return true;
    } catch (e) {
      console.error('[GoogleDrive] Error setting refresh token:', e);
      return false;
    }
  }

  /**
   * List files directly stored in the Google Drive target folder (if configured)
   */
  public async listFilesFromGoogleDrive(): Promise<any[]> {
    if (!this.isConfigured || !this.drive) return [];
    try {
      const q = `'${this.folderId}' in parents and trashed = false`;
      const res = await this.drive.files.list({
        q,
        fields: 'files(id, name, mimeType, webViewLink, webContentLink, createdTime, size, thumbnailLink)',
        orderBy: 'createdTime desc',
        pageSize: 50,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      return res.data.files || [];
    } catch (err: any) {
      console.warn('[GoogleDrive] Could not fetch remote file list:', err?.message || err);
      return [];
    }
  }

  public getDriveStatus() {
    return {
      linkedFolderId: this.folderId,
      folderUrl: `https://drive.google.com/drive/folders/${this.folderId}?usp=sharing`,
      isConfigured: this.isConfigured,
      serviceAccountEmail: this.serviceAccountEmail || null,
      oauthClientConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
      localVaultActive: true,
      localVaultPath: this.localVaultPath,
    };
  }

  /**
   * Resolve or create a category subfolder inside target Google Drive folder
   */
  private async getOrCreateSubfolder(subfolderName: string): Promise<string> {
    if (!this.isConfigured || !this.drive) return this.folderId;
    if (this.subfolderCache.has(subfolderName)) {
      return this.subfolderCache.get(subfolderName)!;
    }

    try {
      const q = `'${this.folderId}' in parents and name = '${subfolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const res = await this.drive.files.list({
        q,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      if (res.data.files && res.data.files.length > 0) {
        const existingId = res.data.files[0].id;
        this.subfolderCache.set(subfolderName, existingId);
        return existingId;
      }

      // Create subfolder
      const createRes = await this.drive.files.create({
        requestBody: {
          name: subfolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [this.folderId],
        },
        fields: 'id',
        supportsAllDrives: true,
      });

      const newId = createRes.data.id;
      this.subfolderCache.set(subfolderName, newId);
      return newId;
    } catch (err) {
      console.warn(`[GoogleDrive] Could not resolve subfolder '${subfolderName}', falling back to root folder:`, err);
      return this.folderId;
    }
  }

  /**
   * Generic buffer upload to Google Drive with local backup fallback
   */
  async uploadFileBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    subfolderName: 'Violations' | 'Candidate_Proofs' | 'Exam_Submissions' | 'Recordings' = 'Violations'
  ): Promise<DriveUploadResult> {
    const cleanFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
    
    // Always persist to local vault for 100% resilience
    const localDir = path.join(this.localVaultPath, subfolderName);
    try {
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
    } catch (e) {}

    const localPath = path.join(localDir, `${Date.now()}_${cleanFileName}`);
    try {
      fs.writeFileSync(localPath, buffer);
    } catch (e) {
      console.warn('[GoogleDrive] Local vault write warning:', e);
    }

    // Attempt cloud upload if authenticated (with automatic retries & backoff)
    if (this.isConfigured && this.drive) {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const targetParentId = await this.getOrCreateSubfolder(subfolderName);
          
          const media = {
            mimeType,
            body: Readable.from(buffer),
          };

          const fileMetadata: any = {
            name: cleanFileName,
            parents: [targetParentId],
          };

          const response = await this.drive.files.create({
            requestBody: fileMetadata,
            media,
            fields: 'id, name, webViewLink, webContentLink',
            supportsAllDrives: true,
          });

          const fileId = response.data.id;
          let webViewLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

          // Attempt to make file readable by anyone with link
          try {
            await this.drive.permissions.create({
              fileId,
              requestBody: {
                role: 'reader',
                type: 'anyone',
              },
              supportsAllDrives: true,
            });
          } catch (permErr) {
            // Non-fatal if domain policies restrict permissions
          }

          console.log(`[GoogleDrive] (Attempt ${attempt}/${maxRetries}) Successfully uploaded '${cleanFileName}' to Google Drive: ${webViewLink}`);
          return {
            fileId,
            webViewLink,
            downloadUrl: response.data.webContentLink,
            fileName: cleanFileName,
            syncedToCloud: true,
            localPath,
          };
        } catch (cloudErr: any) {
          console.warn(`[GoogleDrive] Upload attempt ${attempt}/${maxRetries} failed for '${cleanFileName}': ${cloudErr?.message || cloudErr}`);
          if (attempt < maxRetries) {
            // Wait with exponential backoff before retrying
            await new Promise((resolve) => setTimeout(resolve, attempt * 600));
          } else {
            console.error(`[GoogleDrive] All ${maxRetries} upload retries failed for '${cleanFileName}', preserved in local vault.`);
          }
        }
      }
    }

    // Fallback: Local vault record with direct folder reference link
    return {
      webViewLink: `https://drive.google.com/drive/folders/${this.folderId}?usp=sharing`,
      fileName: cleanFileName,
      syncedToCloud: false,
      localPath,
    };
  }

  /**
   * Upload violation screenshot proof to Google Drive automatically
   */
  async uploadViolationImage(
    dataUrlOrBuffer: string | Buffer,
    candidateName: string = 'Candidate',
    examTitle: string = 'Exam',
    violationType: string = 'VIOLATION',
    timestamp: Date = new Date()
  ): Promise<DriveUploadResult> {
    if (!dataUrlOrBuffer) {
      return {
        webViewLink: `https://drive.google.com/drive/folders/${this.folderId}?usp=sharing`,
        fileName: 'empty_violation_proof.jpg',
        syncedToCloud: false,
      };
    }

    let buffer: Buffer;
    let mimeType = 'image/jpeg';

    if (Buffer.isBuffer(dataUrlOrBuffer)) {
      buffer = dataUrlOrBuffer;
    } else if (typeof dataUrlOrBuffer === 'string') {
      if (dataUrlOrBuffer.startsWith('data:')) {
        const matches = dataUrlOrBuffer.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          const base64Data = dataUrlOrBuffer.split(',')[1] || dataUrlOrBuffer;
          buffer = Buffer.from(base64Data, 'base64');
        }
      } else if (fs.existsSync(dataUrlOrBuffer)) {
        buffer = fs.readFileSync(dataUrlOrBuffer);
      } else {
        buffer = Buffer.from(dataUrlOrBuffer, 'base64');
      }
    } else {
      return {
        webViewLink: `https://drive.google.com/drive/folders/${this.folderId}?usp=sharing`,
        fileName: 'invalid_payload.jpg',
        syncedToCloud: false,
      };
    }

    const timeStr = timestamp.toISOString().replace(/[:.]/g, '-');
    const safeCandidate = (candidateName || 'Candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeExam = (examTitle || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeType = (violationType || 'VIOLATION').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `[Violation]_${safeCandidate}_${safeExam}_${safeType}_${timeStr}.${ext}`;

    return await this.uploadFileBuffer(buffer, fileName, mimeType, 'Violations');
  }

  /**
   * Synchronize all unsynced violation image proofs from database to Google Drive
   */
  public async syncPendingLocalProofsToDrive(): Promise<number> {
    if (!this.isConfigured || !this.drive) return 0;
    try {
      const ViolationEvent = (await import('../models/ViolationEvent')).default;
      const unSynced = await ViolationEvent.find({
        $or: [
          { driveUrl: { $exists: false } },
          { driveUrl: null },
          { driveUrl: '' },
          { driveUrl: { $regex: /drive\.google\.com\/drive\/folders/ } }
        ],
        $and: [
          {
            $or: [
              { screenshot: { $exists: true, $ne: '' } },
              { snapshotImage: { $exists: true, $ne: '' } }
            ]
          }
        ]
      })
      .populate('candidateId', 'name email')
      .populate({ path: 'attemptId', populate: { path: 'examId', select: 'title' } })
      .limit(50);

      let count = 0;
      for (const v of unSynced) {
        const img = v.screenshot || v.snapshotImage;
        if (!img) continue;
        const candidateName = (v.candidateId as any)?.name || 'Candidate';
        const examTitle = (v.attemptId as any)?.examId?.title || 'Exam';
        try {
          const res = await this.uploadViolationImage(img, candidateName, examTitle, v.type, v.detectedAt || v.createdAt);
          if (res.syncedToCloud && res.webViewLink && !res.webViewLink.includes('folders/')) {
            v.driveUrl = res.webViewLink;
            await v.save();
            count++;
          }
        } catch (e) {
          console.warn('[GoogleDrive] Sync error for violation proof:', v._id, e);
        }
      }
      if (count > 0) {
        console.log(`[GoogleDrive] Automatically synced ${count} violation proofs to Google Drive.`);
      }
      return count;
    } catch (err) {
      console.warn('[GoogleDrive] syncPendingLocalProofsToDrive error:', err);
      return 0;
    }
  }

  /**
   * Upload candidate identity verification proof photo
   */
  async uploadCandidateProof(
    dataUrlOrBuffer: string | Buffer,
    candidate: { name: string; email?: string; id?: string },
    examTitle: string = 'Assessment',
    proofType: string = 'Selfie_Verification'
  ): Promise<DriveUploadResult> {
    let buffer: Buffer;
    let mimeType = 'image/jpeg';

    if (Buffer.isBuffer(dataUrlOrBuffer)) {
      buffer = dataUrlOrBuffer;
    } else if (typeof dataUrlOrBuffer === 'string') {
      const base64Data = dataUrlOrBuffer.includes(',') ? dataUrlOrBuffer.split(',')[1] : dataUrlOrBuffer;
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      throw new Error('Invalid image data for candidate proof');
    }

    const timeStr = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = (candidate.name || 'Candidate').replace(/\s+/g, '_');
    const safeExam = examTitle.replace(/\s+/g, '_');
    const fileName = `[Candidate-Proof]_${safeName}_${safeExam}_${proofType}_${timeStr}.jpg`;

    return await this.uploadFileBuffer(buffer, fileName, mimeType, 'Candidate_Proofs');
  }

  /**
   * Upload examination answers and comprehensive result summary
   */
  async uploadExamSubmission(
    candidate: { name: string; email?: string; id?: string },
    exam: { title: string; id?: string; duration?: number; totalMarks?: number },
    questions: any[],
    answers: any[],
    result: any,
    violations: any[]
  ): Promise<{ jsonResult: DriveUploadResult; htmlResult: DriveUploadResult }> {
    const timestamp = new Date();
    const timeStr = timestamp.toISOString().replace(/[:.]/g, '-');
    const safeCandidate = (candidate.name || 'Candidate').replace(/\s+/g, '_');
    const safeExam = (exam.title || 'Exam').replace(/\s+/g, '_');

    // 1. Structured JSON Report
    const jsonPayload = {
      reportType: 'CANDIDATE_EXAMINATION_SUBMISSION',
      generatedAt: timestamp.toISOString(),
      driveFolder: `https://drive.google.com/drive/folders/${this.folderId}?usp=sharing`,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
      },
      examination: {
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.duration,
        totalMarks: exam.totalMarks,
      },
      evaluation: {
        totalQuestions: result?.totalQuestions ?? questions.length,
        attempted: result?.attempted ?? answers.length,
        correct: result?.correct ?? 0,
        wrong: result?.wrong ?? 0,
        unanswered: result?.unanswered ?? (questions.length - answers.length),
        obtainedMarks: result?.obtainedMarks ?? 0,
        percentage: result?.percentage ?? 0,
        passed: result?.pass ?? false,
        timeTakenSeconds: result?.timeTaken ?? 0,
        riskScore: result?.riskScore ?? 0,
        violationsCount: result?.violations ?? violations.length,
      },
      proctoringViolations: violations.map(v => ({
        type: v.type,
        severity: v.severity,
        detectedAt: v.detectedAt,
        description: v.description,
        screenshotUrl: v.screenshot || v.snapshotImage || null,
      })),
      answersBreakdown: questions.map((q, idx) => {
        const ans = answers.find(a => (a.questionId?.toString() || a.questionId) === q._id?.toString());
        return {
          questionNumber: idx + 1,
          questionId: q._id,
          questionText: q.text || q.questionText,
          options: q.options,
          marks: q.marks,
          candidateSelectedAnswer: ans ? ans.selectedAnswer : null,
          correctAnswer: q.correctAnswer,
          isCorrect: ans ? (ans.isCorrect ?? (JSON.stringify(ans.selectedAnswer) === JSON.stringify(q.correctAnswer))) : false,
          answeredAt: ans?.savedAt || null,
        };
      })
    };

    const jsonBuffer = Buffer.from(JSON.stringify(jsonPayload, null, 2), 'utf-8');
    const jsonFileName = `[Exam-Answers]_${safeCandidate}_${safeExam}_Submission_${timeStr}.json`;
    const jsonResult = await this.uploadFileBuffer(jsonBuffer, jsonFileName, 'application/json', 'Exam_Submissions');

    // 2. Beautiful HTML Printable Report Sheet
    const htmlReport = this.generateHtmlReport(jsonPayload);
    const htmlBuffer = Buffer.from(htmlReport, 'utf-8');
    const htmlFileName = `[Exam-Answers]_${safeCandidate}_${safeExam}_Report_${timeStr}.html`;
    const htmlResult = await this.uploadFileBuffer(htmlBuffer, htmlFileName, 'text/html', 'Exam_Submissions');

    return { jsonResult, htmlResult };
  }

  /**
   * Generate styled HTML evaluation report
   */
  public generateHtmlReport(data: any): string {
    const { candidate, examination, evaluation, answersBreakdown, proctoringViolations } = data;
    const passStatus = evaluation.passed ? 'PASSED' : 'FAILED';
    const statusColor = evaluation.passed ? '#059669' : '#dc2626';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Examination Report - ${candidate.name} - ${examination.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
    .card { background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; max-width: 900px; margin: 0 auto 24px auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
    .badge { font-weight: bold; padding: 6px 14px; border-radius: 20px; color: #fff; background: ${statusColor}; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
    .stat { background: #f1f5f9; padding: 12px 16px; border-radius: 8px; }
    .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; }
    .stat-val { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px; }
    .q-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #fff; }
    .q-correct { border-left: 6px solid #10b981; }
    .q-wrong { border-left: 6px solid #ef4444; }
    .q-unanswered { border-left: 6px solid #94a3b8; }
    .q-title { font-weight: 600; font-size: 15px; margin-bottom: 8px; color: #0f172a; }
    .ans-row { display: flex; gap: 24px; font-size: 14px; margin-top: 8px; }
    .violation-tag { background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1 class="title">Flair - Examination & Answers Report</h1>
        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Exam: <strong>${examination.title}</strong> | Candidate: <strong>${candidate.name}</strong> (${candidate.email || 'N/A'})</p>
      </div>
      <div class="badge">${passStatus} (${evaluation.percentage.toFixed(1)}%)</div>
    </div>

    <div class="grid">
      <div class="stat"><div class="stat-label">Marks Obtained</div><div class="stat-val">${evaluation.obtainedMarks} / ${examination.totalMarks || evaluation.totalQuestions}</div></div>
      <div class="stat"><div class="stat-label">Questions Summary</div><div class="stat-val">${evaluation.correct} Correct, ${evaluation.wrong} Wrong</div></div>
      <div class="stat"><div class="stat-label">Proctor Risk Score</div><div class="stat-val">${evaluation.riskScore} / 100 (${evaluation.violationsCount} Violations)</div></div>
    </div>

    <h3>Proctoring & Violation Audit Log (${proctoringViolations.length})</h3>
    ${proctoringViolations.length === 0 ? '<p style="color:#64748b;">No violations detected during this exam session. Clean attempt!</p>' : `
      <ul style="padding-left: 20px;">
        ${proctoringViolations.map((v: any) => `
          <li style="margin-bottom: 8px;">
            <span class="violation-tag">${v.type} (${v.severity})</span>
            <span>${v.description || 'Violation detected'}</span>
            <small style="color:#64748b; margin-left:8px;">[${new Date(v.detectedAt).toLocaleTimeString()}]</small>
            ${v.screenshotUrl ? `<a href="${v.screenshotUrl}" target="_blank" style="margin-left: 8px; color: #2563eb; font-weight: 500;">[View Proof]</a>` : ''}
          </li>
        `).join('')}
      </ul>
    `}

    <h3 style="margin-top: 28px;">Candidate Answers Breakdown (${answersBreakdown.length} Questions)</h3>
    ${answersBreakdown.map((q: any) => {
      const cls = q.candidateSelectedAnswer == null ? 'q-unanswered' : (q.isCorrect ? 'q-correct' : 'q-wrong');
      return `
        <div class="q-box ${cls}">
          <div class="q-title">Q${q.questionNumber}: ${q.questionText} (${q.marks} Marks)</div>
          <div class="ans-row">
            <div>Candidate Answer: <strong style="color: ${q.isCorrect ? '#059669' : '#dc2626'}">${q.candidateSelectedAnswer !== null ? JSON.stringify(q.candidateSelectedAnswer) : 'Not Answered'}</strong></div>
            <div>Correct Answer: <strong>${JSON.stringify(q.correctAnswer)}</strong></div>
            <div>Status: <strong>${q.isCorrect ? 'Correct (+'+q.marks+')' : (q.candidateSelectedAnswer ? 'Incorrect' : 'Unanswered')}</strong></div>
          </div>
        </div>
      `;
    }).join('')}
  </div>
</body>
</html>`;
  }

  /**
   * Upload merged recording video
   */
  async uploadVideo(filePath: string, candidateName: string, examName: string, type: string) {
    if (!this.isConfigured || !this.drive) {
      console.warn('[GoogleDrive] Cloud upload skipped (no credentials), file saved locally.');
      return null;
    }

    try {
      const targetParentId = await this.getOrCreateSubfolder('Recordings');
      const fileName = `${candidateName} - ${examName} - ${type}.webm`.replace(/[<>:"/\\|?*]/g, '_');
      
      const fileMetadata: any = {
        name: fileName,
        parents: [targetParentId],
      };

      const media = {
        mimeType: 'video/webm',
        body: fs.createReadStream(filePath),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, webViewLink',
      });

      console.log(`[GoogleDrive] Video uploaded successfully: ${response.data.webViewLink}`);
      return response.data.webViewLink;
    } catch (err) {
      console.error('[GoogleDrive] Video Upload Failed:', err);
      return null;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
