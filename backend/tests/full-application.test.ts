import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import mongoose from 'mongoose';
import app from '../src/app';
import User, { Role, CandidateStatus } from '../src/models/User';
import Session from '../src/models/Session';
import Exam, { ExamStatus } from '../src/models/Exam';
import Question, { QuestionType } from '../src/models/Question';
import Assignment, { AssignmentStatus } from '../src/models/Assignment';
import Attempt, { AttemptStatus } from '../src/models/Attempt';
import Answer from '../src/models/Answer';
import Result from '../src/models/Result';
import ViolationEvent from '../src/models/ViolationEvent';
import SupportTicket from '../src/models/SupportTicket';
import RecordingSession from '../src/models/RecordingSession';
import RecordingChunk from '../src/models/RecordingChunk';
import { QuestionParserService } from '../src/services/questionParserService';

process.env.JWT_SECRET = 'flair_production_secure_jwt_fallback_key_2026';
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/flair_full_test_suite';

describe('Flair Examination & Proctoring Platform — Full Application Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  // Shared test state
  let adminToken: string;
  let candidateToken: string;
  let candidateId: string;
  let candidateEmail: string;
  let examId: string;
  let question1Id: string;
  let question2Id: string;
  let attemptId: string;
  let recordingSessionId: string;
  let supportTicketId: string;

  before(async () => {
    // 1. Connect to MongoDB test database
    await mongoose.connect(TEST_DB_URI);

    // 2. Clear previous test data in test database
    await Promise.all([
      User.deleteMany({ email: { $regex: /test/i } }),
      User.deleteMany({ email: { $in: ['admin@flair.local', 'admin@proctorguard.local'] } }),
      Session.deleteMany({}),
      Exam.deleteMany({ title: { $regex: /test|assessment/i } }),
      Question.deleteMany({}),
      Assignment.deleteMany({}),
      Attempt.deleteMany({}),
      Answer.deleteMany({}),
      Result.deleteMany({}),
      ViolationEvent.deleteMany({}),
      SupportTicket.deleteMany({ email: { $regex: /test/i } }),
      RecordingSession.deleteMany({}),
      RecordingChunk.deleteMany({})
    ]);

    // 3. Start ephemeral test server on random free port (port 0)
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    // Clean up server and test database
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ==========================================
  // SUITE 1: System Health & Base Routes
  // ==========================================
  describe('1. Health & Serverless Handshake Routes', () => {
    it('GET / should return platform metadata and online status', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'online');
      assert.strictEqual(data.version, '1.0.0');
    });

    it('GET /api/health and /health should return status ok', async () => {
      const res1 = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.strictEqual(data1.status, 'ok');

      const res2 = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.status, 'ok');
    });

    it('GET /socket.io should return serverless handshake fallback response', async () => {
      const res = await fetch(`${baseUrl}/socket.io`);
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert.ok(text.includes('serverless_noop'));
    });
  });

  // ==========================================
  // SUITE 2: Auth, Validation & Session Management
  // ==========================================
  describe('2. Authentication, Validation & Session Management', () => {
    const timestamp = Date.now();
    candidateEmail = `cand_${timestamp}@gmail.com`;

    it('Candidate registration should reject non-gmail addresses with 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid Candidate',
          email: 'invalid@example.com',
          password: 'Password123'
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('@gmail.com'));
    });

    it('Candidate registration should reject passwords under 8 characters with 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Short Pass',
          email: `shortpass_${Date.now()}@gmail.com`,
          password: 'pass'
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('8 characters'));
    });

    it('Candidate registration should succeed with valid @gmail.com and password', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Candidate',
          email: candidateEmail,
          password: 'SecurePassword123'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.role, Role.CANDIDATE);
      assert.strictEqual(data.user.status, CandidateStatus.PENDING_VERIFICATION);
      candidateId = data.user.id;
    });

    it('Candidate duplicate registration should be rejected with 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Candidate',
          email: candidateEmail,
          password: 'SecurePassword123'
        })
      });
      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    it('Candidate login should be blocked with 403 while PENDING_VERIFICATION', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: candidateEmail,
          password: 'SecurePassword123',
          portalRole: 'CANDIDATE'
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('administrator approval'));
    });

    it('Admin login should auto-provision and succeed with admin credentials', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@flair.local',
          password: 'admin123',
          portalRole: 'ADMIN'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.role, Role.ADMIN);
      assert.ok(data.token);
      adminToken = data.token;
    });

    it('Portal Segregation: Candidate cannot use Administrator portal (403)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: candidateEmail,
          password: 'SecurePassword123',
          portalRole: 'ADMIN'
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    it('Portal Segregation: Admin cannot use Candidate portal (403)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@flair.local',
          password: 'admin123',
          portalRole: 'CANDIDATE'
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    it('Admin approves the candidate account via PATCH /api/admin/candidates/:id/approve', async () => {
      const res = await fetch(`${baseUrl}/api/admin/candidates/${candidateId}/approve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify DB status
      const updatedUser = await User.findById(candidateId);
      assert.strictEqual(updatedUser?.status, CandidateStatus.APPROVED);
    });

    it('Candidate login succeeds after approval and issues valid JWT + Session record', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: candidateEmail,
          password: 'SecurePassword123',
          portalRole: 'CANDIDATE'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.token);
      candidateToken = data.token;

      // Verify Session record in MongoDB
      const session = await Session.findOne({ tokenIdentifier: candidateToken });
      assert.ok(session);
      assert.strictEqual(session.isValid, true);
    });

    it('Access protected route without token should return 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/exams`);
      assert.strictEqual(res.status, 401);
    });

    it('Access protected route with invalid/tampered token should return 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/exams`, {
        headers: { 'Authorization': 'Bearer invalid_tampered_token_string' }
      });
      assert.strictEqual(res.status, 401);
    });

    it('Session Revocation: Logout revokes session and subsequent token use returns 401', async () => {
      // 1. Issue temporary token for logout test
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: candidateEmail,
          password: 'SecurePassword123',
          portalRole: 'CANDIDATE'
        })
      });
      const loginData = await loginRes.json();
      const tempToken = loginData.token;

      // 2. Token works initially
      const check1 = await fetch(`${baseUrl}/api/candidate/exams`, {
        headers: { 'Authorization': `Bearer ${tempToken}` }
      });
      assert.strictEqual(check1.status, 200);

      // 3. Logout
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tempToken}` }
      });
      assert.strictEqual(logoutRes.status, 200);

      // 4. Token is now rejected
      const check2 = await fetch(`${baseUrl}/api/candidate/exams`, {
        headers: { 'Authorization': `Bearer ${tempToken}` }
      });
      assert.strictEqual(check2.status, 401);
      const check2Data = await check2.json();
      assert.ok(check2Data.message.includes('revoked'));
    });
  });

  // ==========================================
  // SUITE 3: Question Parser Service Unit Tests
  // ==========================================
  describe('3. Question Parser Service Unit Tests', () => {
    it('Should parse plain text format with questions, options, and answer keys', () => {
      const sampleText = `
1. What is the output of 2 + 2 in JavaScript?
A. 3
B. 4
C. 5
D. 22
Answer: B

2. Which data structure operates on a FIFO basis?
A. Stack
B. Queue
C. Tree
D. Graph
Answer: Queue
      `;

      const parsed = QuestionParserService.parseText(sampleText, 'Computer Science');
      assert.strictEqual(parsed.length, 2);
      assert.ok(parsed[0].text.includes('2 + 2'));
      assert.strictEqual(parsed[0].options.length, 4);
      assert.strictEqual(parsed[0].correctAnswer, 'B');

      assert.ok(parsed[1].text.includes('FIFO'));
      assert.strictEqual(parsed[1].options.length, 4);
      assert.ok(parsed[1].correctAnswer === 'B' || parsed[1].correctAnswer === 'Queue');
    });

    it('Should parse JSON formatted questions', () => {
      const sampleJson = JSON.stringify([
        {
          text: 'What does CPU stand for?',
          type: 'SINGLE_CHOICE',
          category: 'Hardware',
          marks: 2,
          options: [
            { id: 'A', text: 'Central Processing Unit' },
            { id: 'B', text: 'Central Program Unit' }
          ],
          correctAnswer: 'A'
        }
      ]);

      const parsed = QuestionParserService.parseJSON(sampleJson, 'Hardware');
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].marks, 2);
      assert.strictEqual(parsed[0].correctAnswer, 'A');
    });
  });

  // ==========================================
  // SUITE 4: Admin Exam & Question Management
  // ==========================================
  describe('4. Admin Exam & Question Management', () => {
    it('Exam creation should reject title starting with a number (400)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '123 Assessment',
          duration: 30
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('alphabet letter'));
    });

    it('Exam creation should reject title containing emojis (400)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Assessment Test 🎯',
          duration: 30
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('Emojis'));
    });

    it('Admin can successfully create a draft Exam', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Full Stack Engineering Evaluation',
          description: 'Comprehensive assessment of backend and frontend engineering skills.',
          instructions: 'Please answer all questions. Proctoring is strictly enforced.',
          duration: 45,
          scoringRules: {
            positiveMarks: 2,
            negativeMarks: 0.5
          },
          status: 'DRAFT'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.exam.status, ExamStatus.DRAFT);
      examId = data.exam._id;
    });

    it('Admin can update draft Exam details', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams/${examId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Updated assessment of software development competence.'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.exam.description, 'Updated assessment of software development competence.');
    });

    it('Admin can create a single question for the exam', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams/${examId}/questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'Which protocol is used for secure HTTP communication?',
          type: 'SINGLE_CHOICE',
          category: 'Web Networking',
          marks: 2,
          negativeMarks: 0.5,
          options: [
            { id: 'A', text: 'FTP' },
            { id: 'B', text: 'HTTPS' },
            { id: 'C', text: 'SMTP' },
            { id: 'D', text: 'TELNET' }
          ],
          correctAnswer: 'B',
          explanation: 'HTTPS encrypts data with TLS/SSL.'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      question1Id = data.question._id;
    });

    it('Admin can bulk create questions for the exam', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams/${examId}/questions/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questions: [
            {
              text: 'In Node.js, which module is used for handling file operations?',
              type: 'SINGLE_CHOICE',
              category: 'NodeJS',
              marks: 2,
              negativeMarks: 0.5,
              options: [
                { id: 'A', text: 'http' },
                { id: 'B', text: 'fs' },
                { id: 'C', text: 'path' },
                { id: 'D', text: 'crypto' }
              ],
              correctAnswer: 'B'
            },
            {
              text: 'Which SQL statement is used to retrieve data from a database?',
              type: 'SINGLE_CHOICE',
              category: 'Databases',
              marks: 2,
              negativeMarks: 0.5,
              options: [
                { id: 'A', text: 'SELECT' },
                { id: 'B', text: 'UPDATE' },
                { id: 'C', text: 'INSERT' },
                { id: 'D', text: 'DELETE' }
              ],
              correctAnswer: 'A'
            }
          ]
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.count, 2);
      question2Id = data.questions[0]._id;
    });

    it('Admin can fetch all questions for the exam', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams/${examId}/questions`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.questions.length, 3);
    });

    it('Admin publishes the exam via POST /api/admin/exams/:id/publish', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams/${examId}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify exam is now published
      const updatedExam = await Exam.findById(examId);
      assert.strictEqual(updatedExam?.status, ExamStatus.PUBLISHED);
    });

    it('Editing a published exam should be rejected (400 - DRAFT only)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams/${examId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: 'New Forbidden Title' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('draft'));
    });
  });

  // ==========================================
  // SUITE 5: Candidate Assignment & Exam Attempt Execution
  // ==========================================
  describe('5. Candidate Assignment & Exam Attempt Execution', () => {
    it('Admin assigns candidate to the published exam', async () => {
      const res = await fetch(`${baseUrl}/api/admin/exams/${examId}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ candidateId })
      });
      assert.ok(res.status === 200 || res.status === 201, `Expected 200 or 201, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    it('Candidate retrieves assigned exams and sees AVAILABLE status', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/exams`, {
        headers: { 'Authorization': `Bearer ${candidateToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      const assignedExam = data.exams.find((e: any) => e.id.toString() === examId);
      assert.ok(assignedExam);
      assert.strictEqual(assignedExam.status, 'AVAILABLE');
    });

    it('Candidate starts exam attempt (POST /api/candidate/exams/:id/start)', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/exams/${examId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': 'application/json'
        }
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.attempt.status, AttemptStatus.IN_PROGRESS);
      assert.ok(data.attempt.expiresAt);
      attemptId = data.attempt._id;
    });

    it('Candidate starting again resumes existing active attempt (isResume: true)', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/exams/${examId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': 'application/json'
        }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.isResume, true);
      assert.strictEqual(data.attempt._id.toString(), attemptId);
    });

    it('Anti-Cheat Check: Candidate fetching attempt questions NEVER receives correctAnswer', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/attempts/${attemptId}`, {
        headers: { 'Authorization': `Bearer ${candidateToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.questions.length, 3);

      // Verify each question does NOT have correctAnswer exposed
      for (const q of data.questions) {
        assert.strictEqual(q.correctAnswer, undefined, `Anti-cheat failed: correctAnswer was leaked in question ${q._id}`);
      }
    });

    it('Candidate saves correct answer for Question 1', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/attempts/${attemptId}/answers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId: question1Id,
          answerValue: 'B' // Correct answer is HTTPS (B)
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify answer recorded in DB
      const ans = await Answer.findOne({ attemptId, questionId: question1Id });
      assert.ok(ans);
      assert.strictEqual(ans.selectedAnswer, 'B');
    });

    it('Candidate saves incorrect answer for Question 2 with review flag', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/attempts/${attemptId}/answers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId: question2Id,
          answerValue: 'A', // Incorrect (Correct is fs / B)
          isMarkedForReview: true
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      const ans = await Answer.findOne({ attemptId, questionId: question2Id });
      assert.ok(ans);
      assert.strictEqual(ans.isMarkedForReview, true);
    });

    it('Saving answer for non-existent question should return 400', async () => {
      const fakeQuestionId = new mongoose.Types.ObjectId();
      const res = await fetch(`${baseUrl}/api/candidate/attempts/${attemptId}/answers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionId: fakeQuestionId.toString(),
          answerValue: 'A'
        })
      });
      assert.strictEqual(res.status, 400);
    });

    it('Candidate records a proctoring violation event', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/attempts/${attemptId}/violations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'TAB_SWITCH',
          severity: 'HIGH',
          details: 'Candidate navigated away from examination window'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify recorded in DB
      const vEvent = await ViolationEvent.findOne({ attemptId, type: 'TAB_SWITCH' });
      assert.ok(vEvent);
    });

    it('Admin can retrieve violation events via GET /api/admin/violations', async () => {
      const res = await fetch(`${baseUrl}/api/admin/violations`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.violations.length >= 1);
    });

    it('Candidate finalizes and submits exam attempt', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify Attempt in DB is SUBMITTED
      const finalAttempt = await Attempt.findById(attemptId);
      assert.strictEqual(finalAttempt?.status, AttemptStatus.SUBMITTED);
      assert.ok(finalAttempt?.submittedAt);
    });

    it('Submitting already submitted attempt should be idempotent (200)', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.message.includes('already'));
    });

    it('Auto-Grading Evaluation: Result document is generated with computed marks', async () => {
      const result = await Result.findOne({ attemptId });
      assert.ok(result, 'Result document should exist after exam submission');
      assert.strictEqual(result.candidateId.toString(), candidateId);
      assert.strictEqual(result.totalQuestions, 3);
      assert.strictEqual(result.attempted, 2);
      assert.strictEqual(result.correct, 1);
      assert.strictEqual(result.wrong, 1);
      assert.strictEqual(result.unanswered, 1);

      // Question 1: +2 marks. Question 2: -0.5 marks. Total: 1.5 marks out of 6
      assert.strictEqual(result.obtainedMarks, 1.5);
      assert.strictEqual(result.totalMarks, 6);
      assert.strictEqual(result.percentage, 25);
    });

    it('Candidate can view their evaluated Result', async () => {
      const res = await fetch(`${baseUrl}/api/candidate/results/${attemptId}`, {
        headers: { 'Authorization': `Bearer ${candidateToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.result.obtainedMarks, 1.5);
      assert.strictEqual(data.result.correct, 1);
    });

    it('Admin can verify candidate result (APPROVED)', async () => {
      const result = await Result.findOne({ attemptId });
      assert.ok(result);

      const res = await fetch(`${baseUrl}/api/admin/results/${result._id}/verify`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'APPROVED' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.result.status, 'APPROVED');
    });
  });

  // ==========================================
  // SUITE 6: Live Monitoring & Remote Admin Controls
  // ==========================================
  describe('6. Live Monitoring & Remote Admin Controls', () => {
    let secondExamId: string;
    let liveAttemptId: string;

    before(async () => {
      // Create a second exam for live monitoring tests
      const exam = new Exam({
        title: 'Realtime Proctoring Monitoring Exam',
        description: 'Exam for testing remote lock/unlock controls.',
        instructions: 'Follow proctor guidance.',
        duration: 30,
        status: ExamStatus.PUBLISHED,
        version: 1
      });
      await exam.save();
      secondExamId = exam._id.toString();

      // Assign candidate
      const assignment = await Assignment.create({
        examId: secondExamId,
        candidateId,
        status: AssignmentStatus.PENDING,
        allowedAttempts: 1,
        scheduledAt: new Date()
      });

      // Start attempt
      const attempt = new Attempt({
        examId: secondExamId,
        candidateId,
        assignmentId: assignment._id,
        examVersion: 1,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });
      await attempt.save();
      liveAttemptId = attempt._id.toString();
    });

    it('Admin live dashboard displays active and completed attempts', async () => {
      const res = await fetch(`${baseUrl}/api/admin/live`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.candidates));
      const liveItem = data.candidates.find((c: any) => c.attemptId.toString() === liveAttemptId);
      assert.ok(liveItem);
      assert.strictEqual(liveItem.status, 'IN_PROGRESS');
    });

    it('Admin locks attempt (status becomes LOCKED)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/live/${liveAttemptId}/lock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.message, 'Attempt locked');

      const attempt = await Attempt.findById(liveAttemptId);
      assert.strictEqual(attempt?.status, 'LOCKED');
    });

    it('Admin unlocks attempt (status restored to IN_PROGRESS)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/live/${liveAttemptId}/unlock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.message, 'Attempt unlocked');

      const attempt = await Attempt.findById(liveAttemptId);
      assert.strictEqual(attempt?.status, AttemptStatus.IN_PROGRESS);
    });

    it('Admin force-submits attempt (status becomes FORCE_SUBMITTED)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/live/${liveAttemptId}/force-submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.message, 'Attempt force submitted');

      const attempt = await Attempt.findById(liveAttemptId);
      assert.strictEqual(attempt?.status, 'FORCE_SUBMITTED');
    });
  });

  // ==========================================
  // SUITE 7: Public Help Desk / Support Ticket System
  // ==========================================
  describe('7. Support & Help Desk System', () => {
    it('Support submission rejects invalid non-gmail email (400)', async () => {
      const res = await fetch(`${baseUrl}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Candidate',
          email: 'jane@yahoo.com',
          category: 'TECHNICAL',
          message: 'My screen resolution is causing display issues.'
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('@gmail.com'));
    });

    it('Support submission rejects emojis in description (400)', async () => {
      const res = await fetch(`${baseUrl}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Candidate',
          email: 'jane_test@gmail.com',
          category: 'TECHNICAL',
          message: 'Need help with my webcam test! 📷🚨'
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('emojis'));
    });

    it('Valid support ticket is created successfully (201)', async () => {
      const res = await fetch(`${baseUrl}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane_doe_test@gmail.com',
          category: 'TECHNICAL',
          message: 'Unable to grant webcam permission in Firefox browser.'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.ticket.email, 'jane_doe_test@gmail.com');
      supportTicketId = data.ticket.id;
    });

    it('Admin can retrieve support tickets list via GET /api/admin/support', async () => {
      const res = await fetch(`${baseUrl}/api/admin/support`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.tickets.length >= 1);
    });

    it('Admin can update support ticket status to IN_PROGRESS', async () => {
      const res = await fetch(`${baseUrl}/api/admin/support/${supportTicketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'IN_PROGRESS',
          adminNotes: 'Contacted candidate with browser permission steps.'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.ticket.status, 'IN_PROGRESS');
    });

    it('Admin can delete support ticket', async () => {
      const res = await fetch(`${baseUrl}/api/admin/support/${supportTicketId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      const ticket = await SupportTicket.findById(supportTicketId);
      assert.strictEqual(ticket, null);
    });
  });

  // ==========================================
  // SUITE 8: Chunked Recording & Storage Service
  // ==========================================
  describe('8. Chunked Recording & Storage Service', () => {
    let recordingAttemptId: string;

    before(async () => {
      // Create an active attempt for recording tests
      const exam = new Exam({
        title: 'Video Recording Proctoring Test Exam',
        duration: 20,
        status: ExamStatus.PUBLISHED,
        version: 1
      });
      await exam.save();

      const assignment = await Assignment.create({
        examId: exam._id,
        candidateId,
        status: AssignmentStatus.PENDING,
        allowedAttempts: 1,
        scheduledAt: new Date()
      });

      const attempt = new Attempt({
        examId: exam._id,
        candidateId,
        assignmentId: assignment._id,
        examVersion: 1,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000)
      });
      await attempt.save();
      recordingAttemptId = attempt._id.toString();
    });

    it('Candidate starts recording session (POST /api/recordings/start)', async () => {
      const res = await fetch(`${baseUrl}/api/recordings/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attemptId: recordingAttemptId,
          type: 'CAMERA',
          mimeType: 'video/webm;codecs=vp8',
          codec: 'vp8'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.recordingSessionId);
      recordingSessionId = data.recordingSessionId;
    });

    it('Candidate uploads a video chunk via multipart form-data', async () => {
      const boundary = '----WebKitFormBoundaryTest12345';
      const chunkData = Buffer.from('mock webm video chunk binary data 001');

      let body = `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="sequenceNumber"\r\n\r\n1\r\n`;
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="startTime"\r\n\r\n${Date.now()}\r\n`;
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="endTime"\r\n\r\n${Date.now() + 5000}\r\n`;
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="duration"\r\n\r\n5\r\n`;
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="chunk"; filename="chunk_001.webm"\r\n`;
      body += `Content-Type: video/webm\r\n\r\n`;

      const payload = Buffer.concat([
        Buffer.from(body, 'utf-8'),
        chunkData,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
      ]);

      const res = await fetch(`${baseUrl}/api/recordings/${recordingSessionId}/chunks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: payload
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.chunkId);
    });

    it('Idempotent chunk re-upload with same sequence number succeeds without error', async () => {
      const boundary = '----WebKitFormBoundaryTest12345';
      const chunkData = Buffer.from('mock webm video chunk binary data 001');

      let body = `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="sequenceNumber"\r\n\r\n1\r\n`;
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="startTime"\r\n\r\n${Date.now()}\r\n`;
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="chunk"; filename="chunk_001.webm"\r\n`;
      body += `Content-Type: video/webm\r\n\r\n`;

      const payload = Buffer.concat([
        Buffer.from(body, 'utf-8'),
        chunkData,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
      ]);

      const res = await fetch(`${baseUrl}/api/recordings/${recordingSessionId}/chunks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${candidateToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: payload
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.message.includes('idempotent'));
    });
  });
});
