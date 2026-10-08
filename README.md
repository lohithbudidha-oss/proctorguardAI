# Secure AI-Assisted Online Examination & Real-Time Proctoring Platform

## Platform Architecture

The platform follows a highly modular, real-time architecture:

1. **Candidate Examination System**: Next.js client for test taking, system validation, and media capturing.
2. **Real-Time Proctoring Engine**: Socket.IO signaling service broadcasting violations, camera statuses, and WebRTC video feeds.
3. **Administration System**: Real-time admin dashboard for monitoring, reviewing evidence, and issuing candidate commands (Pause, Terminate, Warn).

## Tech Stack
- **Frontend**: Next.js 16, React, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, TypeScript, Mongoose, Socket.IO, WebRTC
- **Database**: MongoDB
- **Security**: JWT, Argon2id, Helmet, Rate Limiting, RBAC

## Running the Application Locally

1. **Database Requirements**
   Ensure MongoDB is running locally on port `27017` or update the `MONGODB_URI` environment variable in the backend.

2. **Backend Services**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   The backend will be available at `http://localhost:5000`

3. **Frontend Services**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`

## Development Phases

This project is built iteratively following a strict phase-gate approach. 
Currently, the foundational architecture, real-time sockets, and authentication flows are fully functional.
