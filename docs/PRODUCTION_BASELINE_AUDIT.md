# ProctorGuard AI - Production Baseline Audit

## 1. Current Architecture
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Axios for API calls, Socket.io-client.
- **Backend:** Node.js, Express, TypeScript, Socket.io for WebSockets.
- **Database:** MongoDB via Mongoose.
- **Object Storage:** MinIO (S3-compatible) or AWS S3 for storing recording chunks and evidence.
- **Authentication:** JWT (JSON Web Tokens), stored in `localStorage` on the client.
- **WebRTC / WebSockets:** Socket.io is heavily used for real-time signaling, proctor monitoring, and violation events.

## 2. Component Analysis
### Frontend
- Located in `frontend/src/app`
- Features roles: Candidate (`/candidate`), Admin (`/admin`), Public Exam pages (`/public`).
- Uses `localStorage` to store JWT tokens (susceptible to XSS).
- Uses `MediaPipe` for AI vision tasks (likely face/eye tracking).
- Handles WebRTC/WebSockets for proctoring.

### Backend
- Located in `backend/src`
- Exposes REST API routes: `/api/auth`, `/api/admin`, `/api/candidate`, `/api/recordings`.
- Sets up Socket.io for real-time exam monitoring (`/sockets/proctorSocket.ts`).
- Storage managed via `@aws-sdk/client-s3` (compatible with MinIO).

### Database
- MongoDB models include: `User`, `Exam`, `Question`, `Answer`, `Assignment`, `Attempt`, `Evidence`, `AuditLog`, `Recording`, `Result`, `Session`, `ViolationEvent`.

### Storage
- Temp storage handles evidence and recording chunks before uploading to MinIO.
- Handled by `multer` and AWS SDK.

## 3. Known Vulnerabilities & Limitations
1. **SEC-01:** Account takeover through public exam registration (needs verification of token/OTP validation).
2. **SEC-02:** Hardcoded JWT and Session Secrets in environment or codebase (e.g. `supersecretjwtkey_replace_in_production`).
3. **SEC-03:** Admin bootstrap security - First user might be becoming admin without checks.
4. **SEC-04:** MinIO storage credentials might be exposed or hardcoded.
5. **SEC-05:** Exam attempt limits need strict backend enforcement to prevent race conditions.
6. **SEC-06:** Exam scheduling isn't strictly validated on the backend.
7. **SEC-07:** Proctoring violation events can be forged by the client.
8. **SEC-08:** IDOR in evidence upload - lack of proper ownership checks.
9. **SEC-09:** Path traversal risk in temp storage for chunks and files.
10. **SEC-10:** Snapshot storage key path generation trusts client inputs.
11. **SEC-11:** Upload memory DOS - no proper chunk size/quota validation.
12. **SEC-12:** No recording quota, potentially filling up storage.
13. **SEC-13:** Loose RBAC controls (Admin vs Candidate vs Proctor).
14. **SEC-14:** IDOR in remote admin controls (lock/unlock exam).
15. **SEC-15:** Recording access control uses permanent URLs instead of signed URLs.
16. **SEC-16:** Socket.io sessions don't re-validate JWT expiration/revocation properly.
17. **SEC-17:** Socket.io attempt ownership verification relies on client ID.
18. **SEC-18:** Lack of real email verification.
19. **SEC-19:** Tokens stored in `localStorage` instead of `HttpOnly` cookies.
20. **SEC-20:** Missing strict input validation (Zod is installed on frontend but needs to be heavily enforced on backend).
21. **SEC-21:** Question/Answer integrity missing server-side checks.
22. **SEC-22:** Error handling exposes stack traces and DB paths.
23. **SEC-23:** Password hashing missing proper constraints (Argon2/Bcrypt are installed, need to ensure proper usage).

## 4. Remediation Plan
1. Systematically review backend controllers (`authController.ts`, `candidateController.ts`, `adminController.ts`, `attemptController.ts`, `recordingController.ts`).
2. Add input validation (Zod) in backend middleware.
3. Fix authentication mechanism (move from localStorage to cookies if feasible, or implement strict CSRF/CSP).
4. Update WebSocket logic to strongly verify socket state.
5. Upgrade file upload logic to prevent Path Traversal and implement Chunk size limits.
