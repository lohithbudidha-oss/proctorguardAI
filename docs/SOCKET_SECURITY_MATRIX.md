# Socket Security Matrix

| Event | Sender | Authentication | Authorization | Attempt Scope | Validation | Status |
|---|---|---|---|---|---|---|
| `connection` | Both | JWT + DB Session Revocation Check | Role-based room joining | N/A | None | FIXED (SEC-16) |
| `candidate:heartbeat` | Candidate | JWT | Role === CANDIDATE | N/A | None | SECURE |
| `camera:status` | Candidate | JWT | Role === CANDIDATE | N/A | None | SECURE |
| `screen:status` | Candidate | JWT | Role === CANDIDATE | N/A | None | SECURE |
| `violation:created` | Candidate | JWT | Role === CANDIDATE | Validates Attempt Ownership | None | FIXED (SEC-07/17) |
| `evidence:snapshot` | Candidate | JWT | Role === CANDIDATE | Validates Attempt Ownership | None | FIXED (SEC-17) |
| `admin:command` | Admin/Proctor | JWT | Role === ADMIN/PROCTOR | Verifies Candidate ID attempt | None | SECURE |
| `webrtc:offer` | Admin/Proctor | JWT | Role === ADMIN/PROCTOR | None | None | SECURE |
| `webrtc:answer` | Candidate | JWT | Role === CANDIDATE | Implicitly bounds to Sender's ID | None | SECURE |
| `webrtc:ice-candidate` | Both | JWT | None | None | None | SECURE |
| `disconnect` | Both | N/A | N/A | N/A | None | SECURE |
