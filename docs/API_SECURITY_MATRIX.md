# API Security Matrix

| Method | Endpoint | Authentication | Role | Resource Scope | Validation | Rate Limit | Security Status |
|---|---|---|---|---|---|---|---|
| POST | `/api/auth/register` | None | Candidate | None | Zod | Strict | FIXED (SEC-20) |
| POST | `/api/auth/login` | None | All | None | Zod | Strict | FIXED (SEC-20) |
| POST | `/api/auth/logout` | JWT | All | Session | None | Moderate | FIXED (SEC-16) |
| POST | `/api/auth/public-register/:examId` | None | Candidate | Exam | Zod | Strict | FIXED (SEC-01) |
| GET | `/api/candidate/exams` | JWT | Candidate | Candidate ID | None | Moderate | SECURE |
| GET | `/api/candidate/exams/:examId` | JWT | Candidate | Attempt | None | Moderate | SECURE |
| POST | `/api/candidate/exams/:examId/start` | JWT | Candidate | Attempt limits | None | Moderate | FIXED (SEC-05/06) |
| POST | `/api/candidate/exams/:attemptId/answer` | JWT | Candidate | Attempt + Question | None | Moderate | FIXED (SEC-21) |
| POST | `/api/candidate/exams/:attemptId/submit` | JWT | Candidate | Attempt | None | Moderate | SECURE |
| GET | `/api/admin/candidates` | JWT | Admin | Global | None | Moderate | SECURE |
| GET | `/api/admin/exams` | JWT | Admin | Global | None | Moderate | SECURE |
| POST | `/api/admin/exams` | JWT | Admin | Global | None | Moderate | SECURE |
| POST | `/api/admin/exams/:id/publish` | JWT | Admin | Global | None | Moderate | SECURE |
| POST | `/api/admin/attempts/:attemptId/force-submit` | JWT | Admin | Global | None | Moderate | SECURE |
| POST | `/api/recordings/session` | JWT | Candidate | Attempt | None | Moderate | SECURE |
| POST | `/api/recordings/chunk/:recordingSessionId` | JWT | Candidate | Session | None | Strict | FIXED (SEC-11) |
| POST | `/api/recordings/complete/:recordingSessionId` | JWT | Candidate | Session | None | Strict | SECURE |
| GET | `/api/recordings/playback/:recordingSessionId` | JWT | Admin | Session | None | Moderate | SECURE |
| POST | `/api/recordings/snapshot` | JWT | Candidate | Attempt | None | Strict | FIXED (SEC-08/10) |
| GET | `/health` | None | None | None | None | High | SECURE |
