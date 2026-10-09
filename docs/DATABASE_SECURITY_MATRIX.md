# Database Security Matrix

| Model | Sensitive Fields | Ownership | Validation | Indexes | Security Status |
|---|---|---|---|---|---|
| User | `passwordHash` | Candidate | Mongoose schema | `email` (unique) | SECURE |
| Session | `tokenIdentifier` | User | Mongoose schema | `tokenIdentifier` | SECURE |
| Exam | None | Admin | Mongoose schema | None | SECURE |
| Assignment | None | Candidate / Admin | Mongoose schema | `examId`, `candidateId` | SECURE |
| Attempt | None | Candidate | Mongoose schema | `examId`, `candidateId` | SECURE |
| Question | `correctAnswer` | Admin | Mongoose schema | `examId` | SECURE |
| Answer | None | Candidate (via Attempt) | Mongoose schema | `attemptId`, `questionId` | SECURE |
| Result | None | Candidate | Mongoose schema | `attemptId` | SECURE |
| ViolationEvent | None | Candidate (via Attempt) | Mongoose schema | `attemptId` | SECURE |
| Evidence | `storageKey` | Candidate (via Attempt) | Mongoose schema | `attemptId` | SECURE |
| RecordingSession| `storagePrefix` | Candidate | Mongoose schema | `examId`, `candidateId` | SECURE |
| RecordingChunk | `storageKey` | Candidate (via Session)| Mongoose schema | `recordingSessionId` | SECURE |
| AuditLog | `ipAddress`, `userAgent`| System | Mongoose schema | `actorId`, `attemptId` | SECURE |
