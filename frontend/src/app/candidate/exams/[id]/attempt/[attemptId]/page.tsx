'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import io from 'socket.io-client';
import api, { getBaseURL } from '@/lib/api';
import { 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  Monitor, 
  Video, 
  VideoOff, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Send,
  CheckCircle2,
  CheckCircle,
  HelpCircle,
  ListChecks,
  X,
  ArrowLeft,
  Loader2,
  Maximize2,
  RefreshCw,
  Smartphone,
  Camera,
  AlertOctagon,
  Ban
} from 'lucide-react';
import { useRecordings } from '../../../../../../hooks/useRecordings';

function AttemptContent() {
  const router = useRouter();
  const params = useParams();
  const attemptId = params.attemptId as string;
  const examId = params.id as string;

  const { startRecording, stopRecording, stopAllRecordings, recordingStatus } = useRecordings(attemptId);
  const [cameraSessionId, setCameraSessionId] = useState<string | undefined>();
  const [screenSessionId, setScreenSessionId] = useState<string | undefined>();

  const [socket, setSocket] = useState<ReturnType<typeof import('socket.io-client').io> | null>(null);
  const socketRef = useRef<any>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showReviewCatalogModal, setShowReviewCatalogModal] = useState(false);
  const [submissionOverlay, setSubmissionOverlay] = useState<{
    isOpen: boolean;
    isAutoSubmitted: boolean;
    title: string;
    message: string;
  } | null>(null);

  const [cameraBlockedMessage, setCameraBlockedMessage] = useState<string | null>(null);
  const [isRetryingCamera, setIsRetryingCamera] = useState(false);

  const [timeRemaining, setTimeRemaining] = useState(3600); // Updated dynamically with wall-clock time
  const expiresAtMsRef = useRef<number | null>(null);

  const [exam, setExam] = useState<any>(null);
  const [isFullscreenReady, setIsFullscreenReady] = useState(false);
  const isFullscreenReadyRef = useRef(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const timerStartedRef = useRef(false);

  const [streamsStarted, setStreamsStarted] = useState(false);
  const [aiStatus, setAiStatus] = useState('Initializing AI...');
  const [examStatus, setExamStatus] = useState<'IN_PROGRESS' | 'PAUSED' | 'TERMINATED' | 'SUBMITTED'>('IN_PROGRESS');
  const examStatusRef = useRef<'IN_PROGRESS' | 'PAUSED' | 'TERMINATED' | 'SUBMITTED'>('IN_PROGRESS');
  useEffect(() => {
    examStatusRef.current = examStatus;
  }, [examStatus]);
  const [violationReviewState, setViolationReviewState] = useState({ active: false, reason: '', reminders: 0 });
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);

  const startExamTimer = React.useCallback((forceRestored = false) => {
    if (timerStartedRef.current) return;
    timerStartedRef.current = true;
    setTimerStarted(true);

    if (forceRestored && expiresAtMsRef.current !== null) {
      const remaining = Math.max(0, Math.floor((expiresAtMsRef.current - Date.now()) / 1000));
      setTimeRemaining(remaining);
      return;
    }

    const durationMinutes = (exam?.duration || 60);
    const durationSeconds = durationMinutes * 60;
    const nowMs = Date.now();
    const expiryMs = nowMs + durationSeconds * 1000;

    expiresAtMsRef.current = expiryMs;
    setTimeRemaining(durationSeconds);

    // Sync timer start with backend
    api.post(`/candidate/attempts/${attemptId}/start-timer`).catch(err => {
      console.warn('Could not sync timer start with backend (using local timer):', err);
    });
  }, [attemptId, exam]);
  
  const noFaceFrames = useRef(0);
  const multipleFaceFrames = useRef(0);
  const headTurnFrames = useRef(0);
  const lastViolationTimeRef = useRef<Record<string, number>>({});
  const isSubmittedRef = useRef(false);
  // Dedicated synchronous lock for candidate clicking "Confirm & Submit" - prevents any post-submit violations
  const isConfirmSubmittedRef = useRef(false);
  const isSubmittingRef = useRef(false);

  // Mobile phone & electronic device tracking: 3 warnings limit, auto-terminate on 4th infraction
  const [mobilePhoneStrikes, setMobilePhoneStrikes] = useState<number>(0);
  const mobilePhoneStrikesRef = useRef<number>(0);
  const mobilePhoneCooldownUntilRef = useRef<number>(0);
  const phoneDetectedFramesRef = useRef<number>(0);
  const [mobilePhoneModal, setMobilePhoneModal] = useState<{
    isOpen: boolean;
    strike: number;
    title: string;
    message: string;
    evidenceImg?: string;
  } | null>(null);
  
  const [questions, setQuestions] = useState<{ id: string; text: string; imageUrl?: string; type: string; options: string[]; marks: number; negativeMarks: number; correctAnswer: string }[]>([]);
  const currentQuestionIdxRef = useRef(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const questionScrollRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Auto-scroll question viewport to top whenever navigating to another question
  useEffect(() => {
    if (questionScrollRef.current) {
      questionScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentQuestionIdx]);

  useEffect(() => {
    // Fetch attempt details
    api.get(`/candidate/attempts/${attemptId}`).then((res: any) => {
      const { attempt, exam, questions, answers } = res.data;
      setExam(exam);
      
      const mappedQuestions = questions.map((q: any) => ({
        id: q._id || q.id || '',
        text: q.text || '',
        imageUrl: q.imageUrl || '',
        type: q.type || 'SINGLE_CHOICE',
        options: q.options ? q.options.map((opt: any) => opt.text || opt.id || '') : [],
        marks: q.marks || 1,
        negativeMarks: q.negativeMarks || 0,
        correctAnswer: q.correctAnswer || ''
      }));
      setQuestions(mappedQuestions);

      // Restore previously saved answers
      const restoredAnswers: Record<string, string> = {};
      const restoredMarks: Record<string, boolean> = {};
      answers.forEach((ans: { questionId: string; selectedAnswer: string; isMarkedForReview: boolean }) => {
        restoredAnswers[ans.questionId] = ans.selectedAnswer;
        restoredMarks[ans.questionId] = ans.isMarkedForReview;
      });
      setAnswers(restoredAnswers);
      setMarkedForReview(restoredMarks);

      const durationMinutes = exam?.duration || 60;
      const durationSeconds = durationMinutes * 60;

      // Check if this attempt was already started and ongoing previously (e.g. reload during exam)
      const isRestoredAttempt = Boolean(
        attempt.startedAt && 
        attempt.expiresAt && 
        (Date.now() - new Date(attempt.startedAt).getTime() > 20000)
      );

      if (isRestoredAttempt && attempt.expiresAt) {
        const expiryMs = new Date(attempt.expiresAt).getTime();
        expiresAtMsRef.current = expiryMs;
        const remaining = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
        setTimeRemaining(remaining);

        if (remaining <= 0 && !isSubmittedRef.current && attempt.status !== 'SUBMITTED' && attempt.status !== 'AUTO_SUBMITTED') {
          submitExam('Exam timer has expired. Your exam has been automatically submitted.', false, true);
        }
      } else {
        // Pre-exam: hold initial timer display at full duration; timer starts strictly upon entering fullscreen
        setTimeRemaining(durationSeconds);
      }
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to load attempt', err);
      setIsLoading(false);
    });
  }, [attemptId]);

  useEffect(() => {
    if (resumeCountdown === null) return;
    
    if (resumeCountdown > 0) {
      const timer = setTimeout(() => setResumeCountdown(prev => prev! - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setExamStatus('IN_PROGRESS');
      setViolationReviewState({ active: false, reason: '', reminders: 0 });
      setResumeCountdown(null);
    }
  }, [resumeCountdown]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(document.fullscreenElement);

      // Before exam has officially started in fullscreen:
      if (!isFullscreenReadyRef.current) {
        if (isCurrentlyFullscreen && streamsStarted) {
          isFullscreenReadyRef.current = true;
          setIsFullscreenReady(true);
          startExamTimer();
        }
        return;
      }

      // Do not process fullscreen exit if exam is already submitted/terminating or streams not active
      if (
        isSubmittedRef.current || 
        isConfirmSubmittedRef.current || 
        examStatusRef.current === 'SUBMITTED' || 
        examStatusRef.current === 'TERMINATED' || 
        examStatus !== 'IN_PROGRESS' || 
        !streamsStarted
      ) {
        return;
      }
      if (!isCurrentlyFullscreen) {
        handleViolation('FULLSCREEN_EXIT', 'CRITICAL', 'Candidate exited fullscreen mode.');
        submitExam('You have been terminated for exiting fullscreen mode. Redirecting to dashboard...', true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [examStatus, attemptId, socket, streamsStarted, startExamTimer]);

  const mediaInitialized = useRef(false);

  // Initialize Socket and Devices
  useEffect(() => {
    if (isLoading || mediaInitialized.current) return;
    if (examStatus !== 'IN_PROGRESS' && examStatus !== 'PAUSED') return;
    
    mediaInitialized.current = true;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : 'https://flair-sigma-red.vercel.app');
    const initSocket = io(wsUrl, {
      auth: { token: localStorage.getItem('token') } // Use the real token
    });

    initSocket.on('admin:command_received', (data: { action: string; message?: string }) => {
      if (data.action === 'PAUSE') {
        setExamStatus('PAUSED');
        addWarning('Examination paused by Proctor: ' + (data.message || ''));
      } else if (data.action === 'RESUME') {
        setResumeCountdown(10);
        addWarning('Exam will resume in 10 seconds...');
      } else if (data.action === 'TERMINATE') {
        alert('Examination terminated by Proctor: ' + (data.message || ''));
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => {
            try { t.stop(); } catch (e) {}
          });
          streamRef.current = null;
        }
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => {
            try {
              t.onended = null;
              t.stop();
            } catch (e) {}
          });
          screenStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
          try { peerConnectionRef.current.close(); } catch (e) {}
          peerConnectionRef.current = null;
        }
        stopAllRecordings();
        router.push('/candidate/dashboard');
      } else if (data.action === 'MESSAGE') {
        addWarning('Message from Proctor: ' + data.message);
      }
    });

    // WebRTC Peer Connection logic
    let peerConnection: RTCPeerConnection | null = null;

    initSocket.on('webrtc:offer', async (data) => {
      console.log('Received WebRTC offer from admin', data.adminId);
      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = peerConnection;

      // Add local stream tracks to the connection
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          if (streamRef.current) peerConnection?.addTrack(track, streamRef.current);
        });
      }

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          initSocket.emit('webrtc:ice-candidate', {
            target: 'ADMIN',
            targetId: data.adminId,
            candidate: event.candidate,
            sourceId: attemptId // or candidateId
          });
        }
      };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      initSocket.emit('webrtc:answer', {
        adminId: data.adminId,
        answer,
        candidateId: attemptId // mock candidate ID
      });
    });

    initSocket.on('webrtc:ice-candidate', async (data) => {
      if (peerConnection && data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    setSocket(initSocket);
    socketRef.current = initSocket;

    // Request full screen
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.error('Fullscreen request failed', err);
      }
    };
    enterFullscreen();

    // Start Camera, Mic, and Screen Share
    const startStreams = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
            audio: false
          });
          const camTrack = stream.getVideoTracks()[0];
          if (!camTrack || camTrack.readyState !== 'live') {
            throw new Error('Webcam track is not live or delivering video.');
          }

          camTrack.onended = () => {
            if (isSubmittedRef.current || isConfirmSubmittedRef.current || examStatusRef.current === 'SUBMITTED' || examStatusRef.current === 'TERMINATED' || examStatus !== 'IN_PROGRESS') return;
            addWarning('Webcam was closed or disconnected.');
          };
        } catch (camErr: any) {
          console.warn('Webcam closed or unavailable during attempt:', camErr);
          // Candidate is permitted to take the examination even if webcam is closed
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Webcam Closed / Inactive', 320, 240);
          }
          stream = canvas.captureStream(10);
          addWarning('Webcam is closed or not detected. Exam proceeding in standard mode.');
        }
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(err => console.warn('Webcam play error in attempt:', err));
        }

        // REM-03: Enforce Screen Share
        let screenStream: MediaStream;
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } catch (err: any) {
          if (err.name === 'NotFoundError' || err.message.includes('not found') || err.message.includes('denied') || err.message.includes('Permission')) {
            // DEMO FALLBACK: Create dummy stream for screen share
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            setInterval(() => {
              if (ctx) {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, 1280, 720);
                ctx.fillStyle = '#ffffff';
                ctx.font = '36px Arial';
                ctx.fillText('NO SCREEN SHARE (DEMO MODE)', 300, 360);
              }
            }, 1000);
            screenStream = canvas.captureStream(30);
            addWarning('Demo Mode: Using mock screen share stream because permission failed.');
          } else {
            throw err;
          }
        }

        screenStreamRef.current = screenStream;

        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
          screenTrack.onended = () => {
            if (isSubmittedRef.current || isConfirmSubmittedRef.current || examStatusRef.current === 'SUBMITTED' || examStatusRef.current === 'TERMINATED' || examStatus !== 'IN_PROGRESS') return;
            handleViolation('SCREEN_SHARE_STOPPED', 'CRITICAL', 'Screen sharing was stopped.');
          };
        }

        initSocket.emit('camera:status', 'STARTED');
        
        // Phase 11: Start chunked recordings
        const camSession = await startRecording('CAMERA', stream);
        if (camSession) setCameraSessionId(camSession);
        
        const scrSession = await startRecording('SCREEN', screenStream);
        if (scrSession) setScreenSessionId(scrSession);

        // Re-enter full screen if already permitted, or try to enter
        if (document.fullscreenElement) {
          isFullscreenReadyRef.current = true;
          setIsFullscreenReady(true);
          startExamTimer();
        } else {
          try {
            await document.documentElement.requestFullscreen();
            if (document.fullscreenElement) {
              isFullscreenReadyRef.current = true;
              setIsFullscreenReady(true);
              startExamTimer();
            }
          } catch (e) {
            console.warn('Fullscreen entry requires user gesture:', e);
          }
        }

        setStreamsStarted(true); // Now proctoring streams are active

        // Capture Candidate Identity Proof snapshot and sync to Google Drive
        setTimeout(() => {
          try {
            const video = videoRef.current;
            if (video && video.videoWidth > 0 && video.videoHeight > 0) {
              const c = document.createElement('canvas');
              c.width = video.videoWidth;
              c.height = video.videoHeight;
              const ctx = c.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0, c.width, c.height);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(0, c.height - 30, c.width, 30);
                ctx.fillStyle = '#10b981';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText(`[CANDIDATE IDENTITY PROOF] Attempt: ${attemptId} | ${new Date().toISOString()}`, 10, c.height - 10);
                const proofImg = c.toDataURL('image/jpeg', 0.85);
                api.post(`/candidate/attempts/${attemptId}/proof`, {
                  image: proofImg,
                  proofType: 'Candidate_Identity_Proof',
                  deviceInfo: {
                    userAgent: navigator.userAgent,
                    resolution: `${window.screen.width}x${window.screen.height}`
                  }
                }).catch(() => {});
              }
            }
          } catch (e) {
            console.warn('Candidate proof capture warning:', e);
          }
        }, 3000);
      } catch (err) {
        handleViolation('MEDIA_STOPPED', 'CRITICAL', 'Camera/Screen access denied or lost');
      }
    };
    startStreams();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => {
          try { t.stop(); } catch (e) {}
        });
        streamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => {
          try {
            t.onended = null;
            t.stop();
          } catch (e) {}
        });
        screenStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        try { peerConnectionRef.current.close(); } catch (e) {}
        peerConnectionRef.current = null;
      }
      if (initSocket) {
        initSocket.disconnect();
      }
    };
  }, [isLoading, examStatus, attemptId, examId]);

  // Window Unload & Exam Closure Detection:
  // Detects if candidate closes the browser window, tab, or navigates away during an active exam.
  useEffect(() => {
    const reportExamClosedViolation = () => {
      // Only report if exam is active, timer started, and not submitted
      if (
        isSubmittedRef.current || 
        isConfirmSubmittedRef.current ||
        examStatusRef.current === 'SUBMITTED' || 
        examStatusRef.current === 'TERMINATED' ||
        examStatus === 'SUBMITTED' ||
        examStatus === 'TERMINATED' ||
        !timerStartedRef.current
      ) {
        return;
      }

      const violationType = 'WINDOW_CLOSED';
      const severity = 'CRITICAL';
      const description = 'Candidate closed or navigated away from the exam window while examination was in progress.';

      // 1. Send via active socket if connected
      const activeSocket = socketRef.current || socket;
      if (activeSocket && activeSocket.connected) {
        try {
          activeSocket.emit('violation:created', {
            attemptId,
            type: violationType,
            severity,
            source: 'BROWSER',
            actionTaken: 'FLAG',
            description
          });
        } catch (e) {}
      }

      // 2. Transmit guaranteed delivery via navigator.sendBeacon
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const token = localStorage.getItem('token') || '';
          const payload = JSON.stringify({
            type: violationType,
            severity,
            source: 'BROWSER',
            actionTaken: 'FLAG',
            description,
            token
          });
          const blob = new Blob([payload], { type: 'application/json' });
          const beaconUrl = `${getBaseURL()}/candidate/attempts/${attemptId}/violations?token=${encodeURIComponent(token)}`;
          navigator.sendBeacon(beaconUrl, blob);
        } catch (beaconErr) {
          console.warn('Beacon transmission error:', beaconErr);
        }
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        !isSubmittedRef.current && 
        !isConfirmSubmittedRef.current &&
        examStatusRef.current === 'IN_PROGRESS' && 
        examStatus === 'IN_PROGRESS' &&
        timerStartedRef.current
      ) {
        reportExamClosedViolation();
        const confirmationMessage = 'WARNING: You are in an active examination! Closing or leaving this window is recorded as a CRITICAL violation and will result in test termination.';
        e.preventDefault();
        e.returnValue = confirmationMessage;
        return confirmationMessage;
      }
      
      // Clean up media tracks on normal unload
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => {
          try { t.onended = null; t.stop(); } catch (e) {}
        });
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => {
          try { t.stop(); } catch (e) {}
        });
      }
    };

    const handlePageHide = () => {
      if (
        !isSubmittedRef.current && 
        !isConfirmSubmittedRef.current &&
        examStatusRef.current === 'IN_PROGRESS' && 
        examStatus === 'IN_PROGRESS' &&
        timerStartedRef.current
      ) {
        reportExamClosedViolation();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [attemptId, socket]);

  const requestAdminReview = (reason: string) => {
    const activeSocket = socketRef.current || socket;
    if (activeSocket) {
      activeSocket.emit('violation:created', { attemptId, type: 'MANUAL_REVIEW', severity: 'CRITICAL', source: 'AI', actionTaken: 'LOG', description: reason });
    }
  };

  const playProctorTone = (mode: 'warning' | 'final' | 'terminated') => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (mode === 'terminated') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.8);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } else if (mode === 'final') {
        [0, 0.14, 0.28].forEach((t) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, ctx.currentTime + t);
          gain.gain.setValueAtTime(0.3, ctx.currentTime + t);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.11);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + t);
          osc.stop(ctx.currentTime + t + 0.11);
        });
      } else {
        [0, 0.16].forEach((t) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(659, ctx.currentTime + t);
          gain.gain.setValueAtTime(0.35, ctx.currentTime + t);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.13);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + t);
          osc.stop(ctx.currentTime + t + 0.13);
        });
      }
    } catch (e) {}
  };

  const dismissMobilePhoneModal = () => {
    setMobilePhoneModal(null);
    // Give 5 seconds grace cooldown after user manually acknowledges so they can safely put the device away
    mobilePhoneCooldownUntilRef.current = Date.now() + 5000;
  };

  const triggerMobilePhoneViolation = (customMsg?: string) => {
    if (
      isSubmittedRef.current || 
      isConfirmSubmittedRef.current || 
      examStatusRef.current === 'SUBMITTED' || 
      examStatusRef.current === 'TERMINATED' || 
      examStatus === 'SUBMITTED' || 
      examStatus === 'TERMINATED'
    ) {
      return;
    }
    const now = Date.now();
    // Enforce cooldown so multiple strikes aren't fired on a single occurrence
    if (now < mobilePhoneCooldownUntilRef.current) {
      return;
    }

    const nextStrike = mobilePhoneStrikesRef.current + 1;
    mobilePhoneStrikesRef.current = nextStrike;
    setMobilePhoneStrikes(nextStrike);

    // Set cooldown window of 10s so candidate has time to see notification and remove phone
    mobilePhoneCooldownUntilRef.current = now + 10000;

    // Capture visual snapshot evidence immediately
    let evidenceSnapshot = '';
    try {
      const video = videoRef.current;
      if (video && (video.readyState >= 1 || (video.videoWidth > 0 && video.videoHeight > 0))) {
        const c = document.createElement('canvas');
        c.width = video.videoWidth || 640;
        c.height = video.videoHeight || 480;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, c.width, c.height);
          // Highlight violation overlay on snapshot
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 6;
          ctx.strokeRect(10, 10, c.width - 20, c.height - 20);
          ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
          ctx.fillRect(0, 0, c.width, 36);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText(`[AI PROCTOR ALERT] MOBILE PHONE DETECTED - STRIKE ${nextStrike > 3 ? '4 (AUTO-TERMINATED)' : `${nextStrike}/3`}`, 12, 23);
          evidenceSnapshot = c.toDataURL('image/jpeg', 0.85);
        }
      }
    } catch (e) {}

    if (nextStrike <= 3) {
      // 1ST, 2ND, OR 3RD WARNING
      playProctorTone(nextStrike === 3 ? 'final' : 'warning');

      const warningTitles: Record<number, string> = {
        1: 'Warning 1 of 3: Mobile Phone / Electronic Device Detected',
        2: 'Warning 2 of 3: Mobile Phone Detected!',
        3: '🚨 FINAL WARNING (3 of 3): Mobile Phone Detected!'
      };

      const warningDescriptions: Record<number, string> = {
        1: 'Strike 1/3: Candidate detected holding or using an electronic device (mobile phone/camera) in front of the exam screen.',
        2: 'Strike 2/3: Repeated mobile phone or electronic device usage to photograph or view exam content.',
        3: 'Strike 3/3 (FINAL WARNING): Critical mobile phone infraction. Next occurrence will automatically terminate the exam immediately.'
      };

      const warningExplanations: Record<number, string> = {
        1: 'An electronic device (mobile phone / camera) was detected in your camera frame. Photographing exam questions and using mobile devices are strictly prohibited. This is your 1st warning out of 3.',
        2: 'Mobile phone detected again! Photographing or recording exam questions violates strict academic integrity rules. This is your 2nd warning out of 3. Any further infractions will trigger your final warning before automatic termination.',
        3: 'CRITICAL ALERT: This is your 3rd and FINAL WARNING. You have reached 3 warnings for electronic device usage. If a mobile phone or electronic device is detected ONE MORE TIME, your exam will be AUTOMATICALLY AND PERMANENTLY TERMINATED immediately without further notice!'
      };

      setMobilePhoneModal({
        isOpen: true,
        strike: nextStrike,
        title: warningTitles[nextStrike] || `Warning ${nextStrike} of 3`,
        message: customMsg || warningExplanations[nextStrike],
        evidenceImg: evidenceSnapshot
      });

      handleViolation(
        'MOBILE_PHONE_DETECTED',
        'CRITICAL',
        customMsg || warningDescriptions[nextStrike],
        'WARNING'
      );
      addWarning(warningExplanations[nextStrike]);
    } else {
      // 4TH STRIKE -> IMMEDIATE AUTO-TERMINATION!
      // Requirement: "give the warning notification for 3 times after three times that candidate should done the same thing then that candidate should make automatically terminated from the exam"
      playProctorTone('terminated');
      setMobilePhoneModal(null);

      captureSnapshotAndReport(
        'MOBILE_PHONE_DETECTED',
        'CRITICAL',
        'AUTOMATIC TERMINATION: Candidate exceeded 3 warnings for electronic device (mobile phone) usage. Auto-terminated on 4th infraction.',
        'TERMINATE'
      );

      submitExam(
        'Your examination has been automatically terminated due to repeated electronic device (mobile phone) infractions after receiving 3 warnings. Your attempt is locked and submitted for proctor investigation.',
        true, // isTermination
        false
      );
    }
  };

  function triggerAIViolation(
    type: 'MULTIPLE_FACES' | 'FACE_NOT_FOUND' | 'LOOKING_AWAY' | 'UNAUTHORIZED_DEVICE' | 'TAB_SWITCH' | 'COPY_PASTE' | 'SCREEN_SHARE_STOPPED' | 'MOBILE_PHONE_DETECTED',
    customMessage?: string
  ) {
    if (
      isSubmittedRef.current || 
      isConfirmSubmittedRef.current || 
      examStatusRef.current === 'SUBMITTED' || 
      examStatusRef.current === 'TERMINATED' || 
      examStatus === 'SUBMITTED' || 
      examStatus === 'TERMINATED'
    ) {
      return;
    }
    if (type === 'MOBILE_PHONE_DETECTED') {
      triggerMobilePhoneViolation(customMessage);
      return;
    }
    if (type === 'MULTIPLE_FACES') {
      handleViolation('MULTIPLE_FACES', 'CRITICAL', customMessage || 'Multiple faces detected in the camera frame.');
      addWarning('Multiple individuals detected in camera view! Academic integrity policy breached.');
    } else if (type === 'FACE_NOT_FOUND') {
      handleViolation('FACE_NOT_FOUND', 'CRITICAL', customMessage || 'Candidate face not detected in camera frame (turned away or left seat).');
      addWarning('Your face is not visible in camera! Please face the webcam directly.');
      playProctorTone('warning');
    } else if (type === 'LOOKING_AWAY') {
      handleViolation('LOOKING_AWAY', 'HIGH', customMessage || 'Candidate turned their face away from the examination screen.');
      addWarning('Head turned away! Please maintain focus directly on the examination screen.');
      playProctorTone('warning');
    } else if (type === 'TAB_SWITCH') {
      handleViolation('TAB_SWITCH', 'CRITICAL', customMessage || 'Switched away from active exam tab.');
      addWarning('Switching tabs is strictly forbidden during the test.');
      playProctorTone('warning');
    } else if (type === 'COPY_PASTE') {
      handleViolation('COPY_PASTE', 'HIGH', customMessage || 'Candidate attempted an unauthorized copy/paste action.');
      addWarning('Copying or pasting exam content is prohibited.');
    } else if (type === 'SCREEN_SHARE_STOPPED') {
      handleViolation('SCREEN_SHARE_STOPPED', 'CRITICAL', customMessage || 'Screen sharing stopped before exam submission.');
      addWarning('Screen sharing must remain active throughout the exam.');
      playProctorTone('warning');
    } else if (type === 'UNAUTHORIZED_DEVICE') {
      handleViolation('UNAUTHORIZED_DEVICE', 'CRITICAL', customMessage || 'Secondary display or external monitor detected.');
      addWarning('External displays and secondary monitors are prohibited.');
      playProctorTone('warning');
    }
  }

  // Helper: Filter real distinct human faces and eliminate multi-anchor duplicates, noise & background artifacts
  function filterDistinctHumanFaces(rawDetections: any[], frameWidth: number, frameHeight: number): any[] {
    if (!rawDetections || rawDetections.length === 0) return [];

    // Minimum bounding box dimension: at least 42px or 7% of frame dimension to ignore micro-artifacts
    const minDim = Math.max(42, Math.min(frameWidth, frameHeight) * 0.07);

    // 1. Initial filter: discard detections that are too small or have confidence < 0.48
    const candidateFaces = rawDetections.filter((d: any) => {
      const score = d.categories?.[0]?.score ?? 1;
      const box = d.boundingBox;
      if (!box) return score >= 0.52;
      if (box.width < minDim || box.height < minDim) return false;
      return score >= 0.48;
    });

    if (candidateFaces.length <= 1) return candidateFaces;

    // Sort by confidence score descending
    candidateFaces.sort((a: any, b: any) => (b.categories?.[0]?.score ?? 0) - (a.categories?.[0]?.score ?? 0));

    const distinctFaces: any[] = [];

    for (const face of candidateFaces) {
      const boxA = face.boundingBox;
      const scoreA = face.categories?.[0]?.score ?? 0;

      if (!boxA) {
        if (distinctFaces.length === 0) distinctFaces.push(face);
        continue;
      }

      let isDuplicate = false;

      for (const existing of distinctFaces) {
        const boxB = existing.boundingBox;
        if (!boxB) continue;

        // Calculate intersection rectangle
        const xLeft = Math.max(boxA.originX, boxB.originX);
        const yTop = Math.max(boxA.originY, boxB.originY);
        const xRight = Math.min(boxA.originX + boxA.width, boxB.originX + boxB.width);
        const yBottom = Math.min(boxA.originY + boxA.height, boxB.originY + boxB.height);

        if (xRight > xLeft && yBottom > yTop) {
          const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
          const areaA = boxA.width * boxA.height;
          const areaB = boxB.width * boxB.height;
          const unionArea = areaA + areaB - intersectionArea;
          const iou = unionArea > 0 ? intersectionArea / unionArea : 0;
          const minAreaRatio = Math.min(areaA, areaB) > 0 ? intersectionArea / Math.min(areaA, areaB) : 0;

          // Overlapping detection boxes belonging to the same individual
          if (iou > 0.16 || minAreaRatio > 0.28) {
            isDuplicate = true;
            break;
          }
        }

        // Check center distance: multi-anchor detections of the same face have nearby centers
        const centerAX = boxA.originX + boxA.width / 2;
        const centerAY = boxA.originY + boxA.height / 2;
        const centerBX = boxB.originX + boxB.width / 2;
        const centerBY = boxB.originY + boxB.height / 2;
        const centerDist = Math.hypot(centerAX - centerBX, centerAY - centerBY);
        const avgDim = (boxA.width + boxA.height + boxB.width + boxB.height) / 4;

        if (centerDist < avgDim * 0.58) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        // For any secondary or subsequent face, require higher confidence (>= 0.62)
        // to eliminate background wall shadows, shirt prints, and optical reflections
        if (distinctFaces.length >= 1 && scoreA < 0.62) {
          continue;
        }
        distinctFaces.push(face);
      }
    }

    return distinctFaces;
  }

  // AI Face & Object Detection (Mediapipe BlazeFace & EfficientDet)
  useEffect(() => {
    let faceDetector: import('@mediapipe/tasks-vision').FaceDetector;
    let objectDetector: any = null;
    let animationFrameId: number;
    let lastDetect = 0;
    let isRunning = false;

    const initAI = async () => {
      try {
        const { FaceDetector, ObjectDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "CPU"
          },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.45
        });

        // Initialize ObjectDetector for electronic device & mobile phone detection
        try {
          objectDetector = await ObjectDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
              delegate: "CPU"
            },
            runningMode: "IMAGE",
            scoreThreshold: 0.28
          });
        } catch (objErr) {
          console.warn('ObjectDetector load fallback:', objErr);
        }
        
        setAiStatus('AI Active: Face & Device Surveillance Active');
        isRunning = true;
        detectFaces();
      } catch (e) {
        console.error('Failed to init AI', e);
        setAiStatus('AI Init Failed');
      }
    };

    const detectFaces = async () => {
      if (!isRunning || isSubmittedRef.current || isConfirmSubmittedRef.current) return;
      if (examStatusRef.current !== 'IN_PROGRESS') {
        if (isRunning) {
          animationFrameId = requestAnimationFrame(detectFaces);
        }
        return;
      }
      const now = performance.now();

      if (videoRef.current && faceDetector && (now - lastDetect >= 250)) {
        lastDetect = now;
        try {
          const isVideoActive = 
            videoRef.current.readyState >= 2 && 
            videoRef.current.videoWidth > 0 && 
            !videoRef.current.paused &&
            Boolean(streamRef.current?.getVideoTracks().some(t => t.readyState === 'live' && t.enabled));

          if (!isVideoActive) {
            // Camera feed is paused, blank, obscured, or disconnected
            noFaceFrames.current += 1;
            headTurnFrames.current = 0;
            setAiStatus('AI Warning: Camera Stream Inactive / Obscured');
            if (noFaceFrames.current >= 4) { // ~1.0 second
              triggerAIViolation('FACE_NOT_FOUND', 'Candidate face not detected in camera frame (camera feed inactive, obstructed, or unavailable).');
              noFaceFrames.current = 0;
            }
          } else {
            // A. CHECK FOR ELECTRONIC DEVICE / MOBILE PHONE
            let isPhoneInFrame = false;
            if (objectDetector) {
              try {
                const objDets = objectDetector.detect(videoRef.current);
                const matched = objDets?.detections?.filter((d: any) =>
                  d.categories?.some((c: any) => {
                    const label = (c.categoryName || '').toLowerCase();
                    return (
                      label.includes('cell phone') ||
                      label.includes('phone') ||
                      label.includes('camera') ||
                      label.includes('remote') ||
                      label.includes('electronic')
                    ) && c.score >= 0.28;
                  })
                ) || [];
                if (matched.length > 0) {
                  isPhoneInFrame = true;
                }
              } catch (e) {}
            }

            if (isPhoneInFrame) {
              phoneDetectedFramesRef.current += 1;
              setAiStatus('AI Alert: Mobile Phone Detected!');
              if (phoneDetectedFramesRef.current >= 2) {
                triggerMobilePhoneViolation('Candidate was detected holding or using an electronic device (mobile phone/camera) in front of the examination screen.');
                phoneDetectedFramesRef.current = 0;
              }
            } else {
              phoneDetectedFramesRef.current = Math.max(0, phoneDetectedFramesRef.current - 1);
            }

            // B. FACE DETECTION WITH NMS OVERLAP SUPPRESSION
            const detections = faceDetector.detect(videoRef.current);
            const frameW = videoRef.current?.videoWidth || 640;
            const frameH = videoRef.current?.videoHeight || 480;

            const validFaces = filterDistinctHumanFaces(detections?.detections || [], frameW, frameH);
            const count = validFaces.length;

            // 1. MULTIPLE FACES CHECK
            if (count > 1) {
              multipleFaceFrames.current += 1;
              headTurnFrames.current = 0;
              noFaceFrames.current = 0;
              setAiStatus(`AI Alert: ${count} Faces Detected!`);
              if (multipleFaceFrames.current >= 8) { // ~2.0 seconds of persistent multiple faces (eliminates false positives)
                triggerAIViolation('MULTIPLE_FACES', `${count} distinct individuals detected in camera view simultaneously.`);
                multipleFaceFrames.current = 0;
              }
            } else {
              multipleFaceFrames.current = Math.max(0, multipleFaceFrames.current - 1);
            }

            // 2. NO FACE DETECTED (Face absent, turned away completely, camera obscured)
            if (count === 0) {
              noFaceFrames.current += 1;
              headTurnFrames.current = 0;
              setAiStatus('AI Warning: No Face Detected in Frame');
              if (noFaceFrames.current >= 4) { // ~1.0 second of continuous face absence
                triggerAIViolation('FACE_NOT_FOUND', 'Candidate face not detected in camera frame (turned away or left seat).');
                noFaceFrames.current = 0;
              }
            } else {
              noFaceFrames.current = Math.max(0, noFaceFrames.current - 1);
            }

            // 3. SINGLE FACE DETECTED: CHECK HEAD TURN / LOOKING AWAY
            if (count === 1) {
              const det = validFaces[0];
              const kp = det.keypoints;
              let isFaceTurned = false;
              let turnReason = '';

              if (kp && kp.length >= 3) {
                // Keypoints: 0: right eye, 1: left eye, 2: nose tip, 3: mouth center
                const rightEye = kp[0];
                const leftEye = kp[1];
                const noseTip = kp[2];

                const eyeDistX = Math.abs(leftEye.x - rightEye.x);
                const eyeMidX = (leftEye.x + rightEye.x) / 2;
                const yawRatio = Math.abs(noseTip.x - eyeMidX) / Math.max(0.005, eyeDistX);

                // Horizontal head turn (yaw): turning face left or right
                if (yawRatio > 0.30) {
                  isFaceTurned = true;
                  turnReason = 'Candidate turned face to the side (diverted gaze away from screen).';
                }

                // Vertical head tilt (pitch): looking down at notes/phone or looking up
                if (!isFaceTurned && kp[3]) {
                  const mouth = kp[3];
                  const eyeMidY = (leftEye.y + rightEye.y) / 2;
                  const faceHeight = Math.abs(mouth.y - eyeMidY);
                  const pitchRatio = (noseTip.y - eyeMidY) / Math.max(0.005, faceHeight);
                  if (pitchRatio > 0.80 || pitchRatio < 0.18) {
                    isFaceTurned = true;
                    turnReason = 'Candidate tilted head away from monitor (looking down or away).';
                  }
                }
              }

              if (isFaceTurned) {
                headTurnFrames.current += 1;
                setAiStatus('AI Warning: Face Turned Away from Monitor');
                if (headTurnFrames.current >= 4) { // ~1 second of sustained head turn
                  triggerAIViolation('LOOKING_AWAY', turnReason || 'Candidate turned face away from the examination screen.');
                  headTurnFrames.current = 0;
                }
              } else {
                headTurnFrames.current = Math.max(0, headTurnFrames.current - 1);
                if (!isPhoneInFrame) {
                  setAiStatus('AI Active: 1 Face Detected (Attentive)');
                }
              }
            }
          }
        } catch (err) {
          console.error('Detection error:', err);
        }
      }

      if (isRunning) {
        animationFrameId = requestAnimationFrame(detectFaces);
      }
    };

    if (streamsStarted) {
      initAI();
    }

    return () => {
      isRunning = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (faceDetector) {
        try { faceDetector.close(); } catch (e) {}
      }
      if (objectDetector && objectDetector.close) {
        try { objectDetector.close(); } catch (e) {}
      }
    };
  }, [streamsStarted]);

  // Browser & System Security Listeners
  useEffect(() => {
    if (!streamsStarted) return;

    // Check for multi-monitor / extended display
    try {
      if (typeof window !== 'undefined' && (window.screen as any).isExtended) {
        handleViolation('UNAUTHORIZED_DEVICE', 'CRITICAL', 'Multiple monitors or extended display configuration detected.');
      }
    } catch (e) {}

    const handleVisibilityChange = () => {
      if (
        isSubmittedRef.current || 
        isConfirmSubmittedRef.current || 
        examStatusRef.current === 'SUBMITTED' || 
        examStatusRef.current === 'TERMINATED' || 
        examStatus !== 'IN_PROGRESS'
      ) return;
      if (document.visibilityState === 'hidden') {
        handleViolation('TAB_SWITCH', 'CRITICAL', 'Candidate switched away from the active exam tab.');
        addWarning('Switching tabs is strictly forbidden during the test.');
      }
    };

    const handleFocusLoss = () => {
      if (
        isSubmittedRef.current || 
        isConfirmSubmittedRef.current || 
        examStatusRef.current === 'SUBMITTED' || 
        examStatusRef.current === 'TERMINATED' || 
        examStatus !== 'IN_PROGRESS'
      ) return;
      handleViolation('WINDOW_FOCUS_LOST', 'CRITICAL', 'Exam window lost focus (clicked outside or opened background app).');
      addWarning('Please keep the exam window active and focused.');
    };

    const handleCopy = (e: Event) => {
      e.preventDefault();
      if (
        isSubmittedRef.current || 
        isConfirmSubmittedRef.current || 
        examStatusRef.current === 'SUBMITTED' || 
        examStatusRef.current === 'TERMINATED' || 
        examStatus !== 'IN_PROGRESS'
      ) return;
      handleViolation('COPY_PASTE', 'HIGH', 'Candidate attempted to copy test questions or content.');
      addWarning('Copying exam content is strictly prohibited.');
    };

    const handlePaste = (e: Event) => {
      e.preventDefault();
      if (
        isSubmittedRef.current || 
        isConfirmSubmittedRef.current || 
        examStatusRef.current === 'SUBMITTED' || 
        examStatusRef.current === 'TERMINATED' || 
        examStatus !== 'IN_PROGRESS'
      ) return;
      handleViolation('COPY_PASTE', 'HIGH', 'Candidate attempted to paste content into the examination.');
      addWarning('Pasting content during the exam is strictly prohibited.');
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
      if (
        isSubmittedRef.current || 
        isConfirmSubmittedRef.current || 
        examStatusRef.current === 'SUBMITTED' || 
        examStatusRef.current === 'TERMINATED' || 
        examStatus !== 'IN_PROGRESS'
      ) return;
      handleViolation('COPY_PASTE', 'MEDIUM', 'Candidate attempted to open right-click context menu.');
      addWarning('Right-click context menu is disabled.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isSubmittedRef.current || 
        isConfirmSubmittedRef.current || 
        examStatusRef.current === 'SUBMITTED' || 
        examStatusRef.current === 'TERMINATED' || 
        examStatus !== 'IN_PROGRESS'
      ) return;

      // PrintScreen / Screenshot / Photographing screen attempt
      if (
        e.key === 'PrintScreen' ||
        (e.shiftKey && (e.metaKey || (e as any).winKey) && (e.key === 'S' || e.key === 's'))
      ) {
        e.preventDefault();
        triggerMobilePhoneViolation('Candidate attempted to capture a photograph or screenshot of the examination screen.');
        return;
      }

      // DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        handleViolation('WINDOW_FOCUS_LOST', 'CRITICAL', 'Candidate attempted to inspect page source / open developer tools.');
        addWarning('Developer tools access is strictly forbidden.');
        return;
      }

      // Copy / Cut / Paste shortcuts
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleViolation('COPY_PASTE', 'HIGH', 'Candidate attempted to copy content via Ctrl+C.');
        addWarning('Copying text is prohibited.');
        return;
      }
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handleViolation('COPY_PASTE', 'HIGH', 'Candidate attempted to paste content via Ctrl+V.');
        addWarning('Pasting text is prohibited.');
        return;
      }
      if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        handleViolation('COPY_PASTE', 'HIGH', 'Candidate attempted to cut content via Ctrl+X.');
        addWarning('Cutting text is prohibited.');
        return;
      }

      // Alt+Tab
      if (e.altKey && e.key === 'Tab') {
        handleViolation('TAB_SWITCH', 'CRITICAL', 'Candidate attempted to switch application via Alt+Tab.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [streamsStarted]);

  // Timer (Wall-clock accurate; automatically submits wherever candidate is upon timer completion)
  // Starts STRICTLY when the page enters into full screen mode
  useEffect(() => {
    if (isLoading || !timerStarted) return;

    const timer = setInterval(() => {
      if (isSubmittedRef.current || examStatus === 'SUBMITTED' || examStatus === 'TERMINATED') {
        clearInterval(timer);
        return;
      }

      if (expiresAtMsRef.current !== null) {
        const remaining = Math.max(0, Math.floor((expiresAtMsRef.current - Date.now()) / 1000));
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(timer);
          submitExam('Exam timer completed! Your exam has been automatically submitted.', false, true);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading, timerStarted, examStatus]);

  async function captureSnapshotAndReport(type: string, severity: string, message: string, actionTaken: string = 'LOG') {
    if (
      isSubmittedRef.current || 
      isConfirmSubmittedRef.current || 
      examStatusRef.current === 'SUBMITTED' || 
      examStatusRef.current === 'TERMINATED' || 
      examStatus === 'SUBMITTED' || 
      examStatus === 'TERMINATED'
    ) {
      return;
    }
    let screenshot = '';

    try {
      const canvas = document.createElement('canvas');
      const width = videoRef.current?.videoWidth || 640;
      const height = videoRef.current?.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        let hasFrame = false;
        if (videoRef.current && (videoRef.current.readyState >= 1 || (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0))) {
          try {
            ctx.drawImage(videoRef.current, 0, 0, width, height);
            hasFrame = true;
          } catch (e) {
            console.warn('Failed to draw from videoRef', e);
          }
        }

        if (!hasFrame) {
          // Robust surveillance frame fallback when camera is obscured, inactive, or testing
          ctx.fillStyle = '#090d16';
          ctx.fillRect(0, 0, width, height);
          
          // Draw subtle surveillance grid
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
          }
          for (let y = 0; y < height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
          }

          // Incident box
          ctx.strokeStyle = severity === 'CRITICAL' ? '#ef4444' : '#f59e0b';
          ctx.lineWidth = 2;
          ctx.strokeRect(width * 0.15, height * 0.15, width * 0.7, height * 0.6);

          ctx.fillStyle = severity === 'CRITICAL' ? '#f87171' : '#fbbf24';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('[LIVE PROCTOR SURVEILLANCE SNAPSHOT]', width / 2, height / 2 - 15);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '12px monospace';
          ctx.fillText(`VIOLATION: ${type.replace(/_/g, ' ')}`, width / 2, height / 2 + 15);
          ctx.fillText(`SESSION: ${attemptId.substring(0, 16)}...`, width / 2, height / 2 + 35);
          ctx.textAlign = 'left';
        }

        // Overlay Surveillance Stamp Banner
        const bannerHeight = 44;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

        // Top accent line on banner
        ctx.fillStyle = severity === 'CRITICAL' ? '#ef4444' : '#f59e0b';
        ctx.fillRect(0, height - bannerHeight, width, 3);

        // Violation Label
        ctx.fillStyle = severity === 'CRITICAL' ? '#ef4444' : '#fbbf24';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`VIOLATION: ${type.replace(/_/g, ' ')}`, 14, height - 16);

        // Timestamp
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px monospace';
        const timeText = new Date().toLocaleString();
        const textWidth = ctx.measureText(timeText).width;
        ctx.fillText(timeText, width - textWidth - 14, height - 16);

        screenshot = canvas.toDataURL('image/jpeg', 0.65);

        // Client-side cache persistence for instant review (capped at 10 to protect storage quota)
        try {
          if (typeof window !== 'undefined') {
            const cacheKey = 'pg_violation_evidence';
            const existing = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            existing.unshift({
              attemptId,
              type,
              severity,
              description: message,
              screenshot,
              detectedAt: new Date().toISOString()
            });
            localStorage.setItem(cacheKey, JSON.stringify(existing.slice(0, 10)));
          }
        } catch (e) {}

        // Optional blob upload to recordings storage
        canvas.toBlob(async (blob) => {
          if (blob) {
            const formData = new FormData();
            formData.append('snapshot', blob, 'snapshot.jpg');
            formData.append('attemptId', attemptId);
            formData.append('severity', severity);
            formData.append('description', message);
            await api.post('/recordings/evidence/snapshot', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            }).catch(() => {});
          }
        }, 'image/jpeg', 0.8);
      }
    } catch (err) {
      console.error('Failed to capture evidence snapshot', err);
    }

    // 1. Emit socket violation with screenshot proof via active socket ref
    const activeSocket = socketRef.current || socket;
    if (activeSocket) {
      activeSocket.emit('violation:created', { 
        attemptId, 
        type, 
        severity, 
        source: 'BROWSER', 
        actionTaken,
        description: message,
        screenshot,
        image: screenshot,
        snapshotImage: screenshot
      });
      if (screenshot) {
        activeSocket.emit('evidence:snapshot', { 
          attemptId, 
          type, 
          severity, 
          description: message, 
          image: screenshot,
          screenshot 
        });
      }
    }

    // 2. Persist directly via REST API as a resilient guarantee
    api.post(`/candidate/attempts/${attemptId}/violations`, {
      type,
      severity,
      source: 'BROWSER',
      actionTaken,
      description: message,
      screenshot,
      image: screenshot,
      snapshotImage: screenshot
    }).catch(err => console.error('REST violation report error:', err));
  }

  function handleViolation(type: string, severity: string, message: string, actionTaken: string = 'LOG') {
    if (
      isSubmittedRef.current || 
      isConfirmSubmittedRef.current || 
      examStatusRef.current === 'SUBMITTED' || 
      examStatusRef.current === 'TERMINATED' || 
      examStatus === 'SUBMITTED' || 
      examStatus === 'TERMINATED'
    ) {
      return;
    }
    const now = Date.now();
    const last = lastViolationTimeRef.current[type] || 0;
    // Debounce duplicate events within 4 seconds per violation type
    if (now - last < 4000) {
      return;
    }
    lastViolationTimeRef.current[type] = now;
    captureSnapshotAndReport(type, severity, message, actionTaken);
  }

  function addWarning(message: string) {
    setWarnings(prev => [...prev, message]);
    setShowWarningModal(true);
  }

  const retryWebcam = async () => {
    setIsRetryingCamera(true);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
        audio: false
      });
      const camTrack = newStream.getVideoTracks()[0];
      if (!camTrack || camTrack.readyState !== 'live') {
        throw new Error('Webcam is not active or delivering video.');
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => {
          try { t.stop(); } catch (e) {}
        });
      }

      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      camTrack.onended = () => {
        if (isSubmittedRef.current || examStatus !== 'IN_PROGRESS') return;
        setCameraBlockedMessage('Webcam connection was lost or stopped functioning. You are not allowed to write the exam until the camera is re-connected.');
        handleViolation('CAMERA_UNAVAILABLE', 'CRITICAL', 'Webcam was disconnected or stopped functioning during the exam.');
      };

      if (socketRef.current) {
        socketRef.current.emit('camera:status', 'STARTED');
      }

      if (!cameraSessionId) {
        const camSession = await startRecording('CAMERA', newStream);
        if (camSession) setCameraSessionId(camSession);
      }

      if (!screenStreamRef.current) {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = screenStream;
          const screenTrack = screenStream.getVideoTracks()[0];
          if (screenTrack) {
            screenTrack.onended = () => {
              if (isSubmittedRef.current || isConfirmSubmittedRef.current || examStatusRef.current === 'SUBMITTED' || examStatusRef.current === 'TERMINATED' || examStatus !== 'IN_PROGRESS') return;
              handleViolation('SCREEN_SHARE_STOPPED', 'CRITICAL', 'Screen sharing was stopped.');
            };
          }
          const scrSession = await startRecording('SCREEN', screenStream);
          if (scrSession) setScreenSessionId(scrSession);
        } catch (scrErr) {
          console.warn('Screen share skipped during webcam reconnect:', scrErr);
        }
      }

      if (!streamsStarted) {
        setStreamsStarted(true);
        if (document.fullscreenElement) {
          isFullscreenReadyRef.current = true;
          setIsFullscreenReady(true);
          startExamTimer();
        }
      }

      setCameraBlockedMessage(null);
    } catch (err: any) {
      console.error('Failed to reconnect webcam:', err);
      const errMsg = err.name === 'NotAllowedError'
        ? 'Webcam permission was denied. Please allow camera permissions in your browser.'
        : (err.message || 'Webcam is not functioning properly.');
      setCameraBlockedMessage(`Webcam Not Functioning: ${errMsg}. Remote proctoring requires a functioning webcam. You are not allowed to write the exam.`);
    } finally {
      setIsRetryingCamera(false);
    }
  };

  const handleAnswerSelect = (option: string) => {
    const qId = questions[currentQuestionIdx].id;
    setAnswers(prev => ({ ...prev, [qId]: option }));
    
    // Emit to API for autosave
    api.post(`/candidate/attempts/${attemptId}/answers`, { questionId: qId, answerValue: option })
      .catch(err => console.error('Failed to save answer:', err));
  };

  const toggleReview = () => {
    const qId = questions[currentQuestionIdx].id;
    setMarkedForReview(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  async function submitExam(reason?: string, isTermination = false, isAutoSubmit = false) {
    if (isSubmittingRef.current || examStatus === 'SUBMITTED' || examStatus === 'TERMINATED') return;
    isSubmittingRef.current = true;
    isConfirmSubmittedRef.current = true;
    isSubmittedRef.current = true;
    examStatusRef.current = isTermination ? 'TERMINATED' : 'SUBMITTED';
    setExamStatus(isTermination ? 'TERMINATED' : 'SUBMITTED');
    setShowReviewCatalogModal(false);
    setShowWarningModal(false);

    // Notify backend proctor socket immediately that attempt is being finalized
    // This adds the attemptId to submittedAttempts in the socket system to ensure zero violations can be triggered
    const activeSocket = socketRef.current || socket;
    if (activeSocket) {
      try {
        activeSocket.emit('attempt:submitting', { attemptId });
        activeSocket.emit('attempt:submitted', { attemptId });
      } catch (e) {}
    }

    // Immediately neutralize window unload / navigation handlers so no browser exit violations can be dispatched
    if (typeof window !== 'undefined') {
      window.onbeforeunload = null;
      window.onpagehide = null;
    }

    // Display non-blocking submission status overlay immediately
    if (isTermination) {
      setSubmissionOverlay({
        isOpen: true,
        isAutoSubmitted: false,
        title: 'Examination Terminated',
        message: reason || 'Examination terminated by proctor policy. Redirecting to candidate dashboard...'
      });
    } else if (isAutoSubmit) {
      setSubmissionOverlay({
        isOpen: true,
        isAutoSubmitted: true,
        title: 'Exam Timer Completed!',
        message: 'The allocated time for this examination has reached 0:00. Your answers and assessment scores have been automatically submitted.'
      });
    } else {
      setSubmissionOverlay({
        isOpen: true,
        isAutoSubmitted: false,
        title: 'Exam Submitted Successfully!',
        message: 'Your examination responses have been finalized and recorded.'
      });
    }

    // 1. Immediately shut down camera tracks, screen share tracks, and clear video source
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          try {
            track.onended = null;
            track.stop();
          } catch(e) {}
        });
        streamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          try {
            track.onended = null;
            track.stop();
          } catch(e) {}
        });
        screenStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (peerConnectionRef.current) {
        try { peerConnectionRef.current.close(); } catch(e) {}
        peerConnectionRef.current = null;
      }
    } catch(e) {}

    // 2. Immediately stop recording sessions
    try {
      if (cameraSessionId) stopRecording(cameraSessionId);
      if (screenSessionId) stopRecording(screenSessionId);
      stopAllRecordings();
    } catch(e) {}

    // 3. Submit attempt to backend database FIRST so attempt status is SUBMITTED in DB before socket disconnects
    try {
      await api.post(`/candidate/attempts/${attemptId}/submit`, {
        isTermination,
        status: isTermination ? 'TERMINATED' : 'SUBMITTED',
        reason: reason || ''
      });
    } catch (err) {
      console.error('Submit API call failed:', err);
    }

    // 4. Disconnect socket to prevent any further events
    try {
      if (activeSocket) {
        if (isTermination) {
          activeSocket.emit('attempt:terminated', { attemptId, reason, action: 'TERMINATE' });
        }
        activeSocket.disconnect();
      }
    } catch(e) {}

    // 5. Safely exit fullscreen
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(()=>{});
    }

    // 6. Record local completion for dashboard state and redirect
    try {
      sessionStorage.removeItem('pg_cached_candidate_exams');
    } catch (e) {}

    const completedStr = localStorage.getItem('completed_exams') || '[]';
    try {
      const completedExams = JSON.parse(completedStr);
      if (!completedExams.includes(examId)) {
        completedExams.push(examId);
        localStorage.setItem('completed_exams', JSON.stringify(completedExams));
      }
    } catch(e) {}

    try {
      sessionStorage.setItem('just_submitted_exam', JSON.stringify({
        examId,
        attemptId,
        examTitle: exam?.title || 'Examination',
        submittedAt: new Date().toISOString()
      }));
    } catch (e) {}

    // Smooth delay so candidate sees final submission overlay and redirected cleanly
    setTimeout(() => {
      router.push(`/candidate/dashboard?submitted=true&examId=${examId}`);
    }, 1800);
  }

  const currentQ = questions[currentQuestionIdx];
  const answeredCount = questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== '').length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const reviewCount = questions.filter(q => markedForReview[q.id]).length;

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden bg-slate-50 flex flex-col select-none">
      {/* Fullscreen Entry Gate: Ensures exam timer and questions only activate after fullscreen is entered */}
      {(!isFullscreenReady || !streamsStarted) && !isLoading && examStatus !== 'SUBMITTED' && examStatus !== 'TERMINATED' && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[90] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700/80 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-5 text-blue-400">
              <Maximize2 className="w-8 h-8 animate-pulse" />
            </div>

            <h2 className="text-2xl font-bold mb-2 text-white">
              {!streamsStarted ? 'Initializing Proctoring...' : 'Enter Full Screen Mode'}
            </h2>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {!streamsStarted
                ? 'Please permit camera and screen sharing when prompted. All devices must be connected before entering the exam.'
                : 'Your camera and screen share have been connected. Click below to enter full screen mode to start your test.'}
            </p>

            {streamsStarted ? (
              <button
                onClick={async () => {
                  try {
                    await document.documentElement.requestFullscreen();
                    if (document.fullscreenElement) {
                      isFullscreenReadyRef.current = true;
                      setIsFullscreenReady(true);
                      startExamTimer();
                    }
                  } catch (err) {
                    console.error('Fullscreen request error:', err);
                    alert('Please allow full screen in your browser to proceed with the examination.');
                  }
                }}
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center text-base"
              >
                <Maximize2 className="w-5 h-5 mr-2" /> Enter Full Screen & Start Exam
              </button>
            ) : (
              <div className="flex items-center text-sm text-blue-400 font-semibold bg-blue-950/60 px-4 py-2.5 rounded-lg border border-blue-800/50">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting Camera & Screen Share...
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-700/60 w-full flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Duration: {exam?.duration || 60} mins</span>
              <span className="text-emerald-400 font-semibold">Timer starts in full screen</span>
            </div>
          </div>
        </div>
      )}

      {examStatus === 'PAUSED' && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="bg-slate-800 p-8 rounded-2xl max-w-md text-center border border-slate-700 shadow-2xl">
            <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold text-white mb-2">
              {resumeCountdown !== null ? 'Exam Resuming' : 'Exam Paused'}
            </h2>
            <p className="text-slate-300 mb-6">
              {resumeCountdown !== null 
                ? `Get ready. Exam resumes in ${resumeCountdown} seconds...`
                : violationReviewState.active 
                  ? `Violation detected: ${violationReviewState.reason}. Waiting for Proctor review... (Reminder ${violationReviewState.reminders}/3)`
                  : 'Your exam has been paused by the Proctor. Please wait...'}
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-slate-900 text-white flex items-center justify-between px-6 py-3 shadow-md z-10 relative shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-1.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-lg font-bold tracking-tight text-white">Flair</span>
            <span className="text-xs text-slate-400 hidden sm:inline font-medium">| Secure Examination Mode</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 sm:space-x-6">
          {/* Mobile Phone / Electronic Device Warning Indicator */}
          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
            mobilePhoneStrikes >= 3
              ? 'bg-rose-950/90 text-rose-300 border-rose-500 animate-pulse ring-2 ring-rose-500/50'
              : mobilePhoneStrikes > 0
                ? 'bg-amber-950/80 text-amber-300 border-amber-500'
                : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
            <Smartphone className={`w-3.5 h-3.5 ${mobilePhoneStrikes > 0 ? 'text-rose-400' : 'text-slate-400'}`} />
            <span>
              {mobilePhoneStrikes === 0 
                ? 'Device: 0/3 Warnings' 
                : mobilePhoneStrikes >= 3
                  ? 'FINAL WARNING: 3/3'
                  : `Device: ${mobilePhoneStrikes}/3 Warnings`}
            </span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-800 px-4 py-1.5 rounded-md">
            <Wifi className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium">Connected</span>
          </div>
          <div className={`flex items-center space-x-2 px-4 py-1.5 rounded-md font-mono text-lg font-bold transition-all ${
            timerStarted && timeRemaining <= 60 
              ? 'text-red-400 bg-red-950/80 border border-red-500 animate-pulse' 
              : timerStarted && timeRemaining <= 300
                ? 'text-amber-400 bg-amber-950/60 border border-amber-600'
                : 'text-rose-400 bg-slate-800'
          }`}>
            <Clock className={`w-5 h-5 ${timerStarted && timeRemaining <= 60 ? 'text-red-400 animate-spin' : ''}`} />
            <span>{formatTime(timeRemaining)}</span>
            {!timerStarted && (
              <span className="text-[10px] uppercase tracking-wider bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-sans ml-1">
                Paused
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        
        {/* Left Sidebar (Camera & Monitor) */}
        <aside className="w-64 bg-slate-800 flex flex-col border-r border-slate-700 shadow-inner h-full min-h-0 shrink-0 overflow-hidden">
          <div className="p-4 border-b border-slate-700 shrink-0">
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative shadow-lg">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover transform -scale-x-100" 
              />
              <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span>Recording</span>
              </div>
            </div>
            <p className="text-center text-xs text-emerald-400 font-bold mt-2 flex items-center justify-center">
              <ShieldAlert className="w-3 h-3 mr-1" /> {aiStatus}
            </p>

            {mobilePhoneStrikes > 0 && (
              <div className={`mt-2 py-1.5 px-2 rounded-lg text-xs font-bold text-center flex items-center justify-center space-x-1 border ${
                mobilePhoneStrikes >= 3
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                <Smartphone className="w-3.5 h-3.5 mr-1 text-rose-400" />
                <span>Device Warnings: {mobilePhoneStrikes}/3 ({mobilePhoneStrikes >= 3 ? 'Final Warning' : 'Active'})</span>
              </div>
            )}
            
            {/* AI Test Panel (Only visible for testing purposes) */}
            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider">AI Simulation Panel</p>
              <div className="flex flex-col space-y-2">
                <button 
                  onClick={() => triggerMobilePhoneViolation('Candidate detected using an electronic device (mobile phone) or photographing screen.')}
                  className="text-xs bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 py-1.5 px-2 rounded border border-rose-500/40 transition-colors font-bold text-left flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center">
                    <Smartphone className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                    Simulate: Phone
                  </span>
                  <span className="bg-rose-600/50 text-white px-1.5 py-0.5 rounded text-[10px]">
                    {mobilePhoneStrikes < 3 ? `Strike ${mobilePhoneStrikes + 1}/3` : 'Auto-Terminate'}
                  </span>
                </button>
                <button 
                  onClick={() => triggerAIViolation('MULTIPLE_FACES')}
                  className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 py-1.5 rounded border border-red-500/30 transition-colors"
                >
                  Simulate: Multiple Faces
                </button>
                <button 
                  onClick={() => triggerAIViolation('FACE_NOT_FOUND')}
                  className="text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 py-1.5 rounded border border-amber-500/30 transition-colors cursor-pointer"
                >
                  Simulate: Face Not Found
                </button>
                <button 
                  onClick={() => triggerAIViolation('LOOKING_AWAY')}
                  className="text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 py-1.5 rounded border border-yellow-500/30 transition-colors cursor-pointer"
                >
                  Simulate: Looking Away
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto min-h-0">
            <h3 className="text-slate-300 text-sm font-semibold mb-3 uppercase tracking-wider">Question Palette</h3>
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isMarked = markedForReview[q.id];
                const isCurrent = idx === currentQuestionIdx;
                
                let bgColor = 'bg-slate-700 text-slate-300';
                if (isCurrent) bgColor = 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-800';
                else if (isMarked) bgColor = 'bg-amber-500 text-white';
                else if (isAnswered) bgColor = 'bg-[#047857] text-white';

                return (
                  <button 
                    key={q.id}
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={`w-10 h-10 rounded-md flex items-center justify-center font-medium transition-all ${bgColor}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 space-y-2 text-xs text-slate-400">
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-[#047857] rounded-sm"></div><span>Answered ({answeredCount})</span></div>
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-amber-500 rounded-sm"></div><span>Marked for Review ({reviewCount})</span></div>
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-slate-700 rounded-sm"></div><span>Unanswered ({unansweredCount})</span></div>
            </div>

            <button
              onClick={() => setShowReviewCatalogModal(true)}
              className="w-full mt-5 py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-bold flex items-center justify-center transition-colors shadow-sm"
            >
              <ListChecks className="w-4 h-4 mr-2 text-blue-400" />
              View Question Catalog
            </button>
          </div>
        </aside>

        {/* Center Exam Area */}
        <main className="flex-1 bg-white flex flex-col relative h-full min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-500 font-bold">Loading questions...</p>
            </div>
          ) : !currentQ ? (
            <div className="flex-1 flex items-center justify-center flex-col text-center p-8">
              <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
              <h2 className="text-xl font-bold text-slate-800">No Questions Found</h2>
              <p className="text-slate-500 mt-2">This exam doesn't have any questions configured.</p>
              <button 
                onClick={() => {
                  isConfirmSubmittedRef.current = true;
                  submitExam('Exam completed.', false, false);
                }} 
                disabled={examStatus === 'SUBMITTED' || examStatus === 'TERMINATED' || isSubmittingRef.current}
                className="mt-6 bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {examStatus === 'SUBMITTED' || isSubmittingRef.current ? 'Ending...' : 'End Exam'}
              </button>
            </div>
          ) : (
            <>
          <div ref={questionScrollRef} className="flex-1 overflow-y-auto min-h-0 p-6 lg:p-10">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-3xl font-bold text-slate-800">Question {currentQuestionIdx + 1}</h2>
                <span className="text-sm font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">+1 Mark</span>
              </div>
              
              <div className="text-lg text-slate-700 mb-6 leading-relaxed whitespace-pre-wrap">
                {currentQ.text}
              </div>

              {currentQ.imageUrl && (
                <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center">
                  <img 
                    src={currentQ.imageUrl} 
                    alt={`Question ${currentQuestionIdx + 1} Diagram`} 
                    className="max-h-[380px] max-w-full object-contain rounded-xl shadow-xs bg-white p-2 border border-slate-100" 
                  />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-2.5">
                    Figure / Diagram Reference
                  </span>
                </div>
              )}

              <div className="space-y-4">
                {currentQ.options.map((opt: string, idx: number) => (
                  <label 
                    key={idx} 
                    className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                      answers[currentQ.id] === opt 
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name={`question-${currentQ.id}`} 
                      value={opt}
                      checked={answers[currentQ.id] === opt}
                      onChange={() => handleAnswerSelect(opt)}
                      className="w-5 h-5 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="ml-4 text-slate-700">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Controls - Always visible at bottom of initial page */}
          <footer className="bg-slate-50 border-t border-slate-200 p-3.5 px-6 lg:px-10 flex flex-wrap gap-3 justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0 z-20 sticky bottom-0">
            <div className="flex items-center space-x-3">
              <button 
                onClick={toggleReview}
                className="px-5 py-2.5 bg-amber-100 text-amber-800 hover:bg-amber-200 font-semibold rounded-lg transition-colors border border-amber-300 text-sm shadow-xs"
              >
                {markedForReview[currentQ.id] ? 'Unmark Review' : 'Mark for Review'}
              </button>

              <button 
                onClick={() => setShowReviewCatalogModal(true)}
                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold rounded-lg transition-colors text-sm flex items-center shadow-xs"
              >
                <ListChecks className="w-4 h-4 mr-2 text-blue-600" />
                Review Catalog ({answeredCount}/{questions.length})
              </button>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIdx === 0}
                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg disabled:opacity-50 transition-colors text-sm"
              >
                Previous
              </button>
              
              {currentQuestionIdx < questions.length - 1 && (
                <button 
                  onClick={() => setCurrentQuestionIdx(prev => Math.min(questions.length - 1, prev + 1))}
                  className="px-8 py-2.5 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-lg shadow-sm transition-colors text-sm"
                >
                  Next
                </button>
              )}

              <button 
                onClick={() => setShowReviewCatalogModal(true)}
                disabled={timeRemaining <= 0 || examStatus === 'SUBMITTED' || examStatus === 'TERMINATED'}
                className="px-8 py-2.5 bg-[#047857] text-white hover:bg-[#03543f] font-bold rounded-lg shadow-sm flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Send className="w-4 h-4 mr-2" /> 
                {examStatus === 'SUBMITTED' ? 'Submitting...' : 'Submit Exam'}
              </button>
            </div>
          </footer>
          </>
          )}
        </main>
      </div>

      {/* Examination Review & Question Catalog Modal */}
      {showReviewCatalogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                  <ListChecks className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Exam Review & Question Catalog</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review your answered and unanswered questions before final submission
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowReviewCatalogModal(false)}
                className="text-slate-400 hover:text-slate-700 p-2 hover:bg-slate-200/60 rounded-full transition"
                title="Close Catalog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Total Questions</span>
                  <span className="text-2xl font-black text-blue-900 mt-1 block">{questions.length}</span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-700" /> Answered
                  </span>
                  <span className="text-2xl font-black text-emerald-900 mt-1 block">{answeredCount}</span>
                </div>
                <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block flex items-center">
                    <HelpCircle className="w-3.5 h-3.5 mr-1 text-rose-600" /> Unanswered
                  </span>
                  <span className="text-2xl font-black text-rose-900 mt-1 block">{unansweredCount}</span>
                </div>
                <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" /> Marked Review
                  </span>
                  <span className="text-2xl font-black text-amber-900 mt-1 block">{reviewCount}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
                  <span>Completion Rate</span>
                  <span>{questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}% ({answeredCount}/{questions.length} answered)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-[#047857] h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Status Callout Banner */}
              {unansweredCount > 0 ? (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start space-x-3 text-amber-900 text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">You have {unansweredCount} unanswered questions remaining.</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      You can click any unanswered question below to review and answer it, or click the "Confirm & Submit Exam" button to finish now.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start space-x-3 text-emerald-900 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">All questions answered!</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      You have attempted every question in this examination. When you are confident in your answers, click "Confirm & Submit Exam" below.
                    </p>
                  </div>
                </div>
              )}

              {/* Question Catalog Matrix */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Question Catalog (Click tile to jump to question)
                  </h3>
                  <div className="flex items-center space-x-3 text-[11px] font-medium text-slate-500">
                    <span className="flex items-center"><span className="w-2.5 h-2.5 rounded bg-[#047857] mr-1"></span> Answered</span>
                    <span className="flex items-center"><span className="w-2.5 h-2.5 rounded bg-amber-400 mr-1"></span> Marked</span>
                    <span className="flex items-center"><span className="w-2.5 h-2.5 rounded bg-slate-200 mr-1"></span> Unanswered</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
                  {questions.map((q, idx) => {
                    const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                    const isMarked = markedForReview[q.id];
                    const isCurrent = idx === currentQuestionIdx;

                    let style = 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-100';
                    if (isMarked) {
                      style = 'bg-amber-50 border-amber-300 text-amber-900 font-bold hover:bg-amber-100';
                    } else if (isAnswered) {
                      style = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100';
                    }

                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setCurrentQuestionIdx(idx);
                          setShowReviewCatalogModal(false);
                        }}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all hover:scale-105 relative cursor-pointer ${style} ${
                          isCurrent ? 'ring-2 ring-blue-500' : ''
                        }`}
                        title={`Question ${idx + 1}: ${isAnswered ? 'Answered' : 'Unanswered'}${isMarked ? ' (Marked for review)' : ''}`}
                      >
                        <span className="text-xs font-black">Q{idx + 1}</span>
                        <span className="text-[10px] mt-0.5">
                          {isAnswered ? (
                            <span className="text-emerald-700 font-extrabold flex items-center">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" /> Done
                            </span>
                          ) : (
                            <span className="text-slate-400">Empty</span>
                          )}
                        </span>
                        {isMarked && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setShowReviewCatalogModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl transition text-sm flex items-center justify-center shadow-xs"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Exam
              </button>

              <button
                onClick={() => {
                  isConfirmSubmittedRef.current = true;
                  submitExam('Exam submitted successfully.', false, false);
                }}
                disabled={examStatus === 'SUBMITTED' || examStatus === 'TERMINATED' || isSubmittingRef.current}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#047857] hover:bg-[#03543f] text-white font-extrabold rounded-xl transition text-sm flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {examStatus === 'SUBMITTED' || isSubmittingRef.current ? 'Submitting...' : 'Confirm & Submit Exam'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center transform scale-100 transition-all">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Notice</h3>
            <p className="text-slate-600 mb-6">
              {warnings[warnings.length - 1]}
            </p>
            <button 
              onClick={() => setShowWarningModal(false)}
              className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Mobile Phone & Electronic Device Warning Modal (3 Warnings Limit) */}
      {mobilePhoneModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[220] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 text-center border-2 border-rose-500 flex flex-col items-center relative overflow-hidden">
            {/* Top red pulsing accent stripe */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 animate-pulse" />

            {/* Strike Progress Indicator */}
            <div className="w-full flex items-center justify-between mb-5 bg-slate-50 border border-slate-200 rounded-2xl p-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Infraction Strikes
              </span>
              <div className="flex items-center space-x-2">
                {[1, 2, 3].map((num) => {
                  const isPastOrCurrent = num <= mobilePhoneModal.strike;
                  const isCurrent = num === mobilePhoneModal.strike;
                  return (
                    <div
                      key={num}
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-black transition-all ${
                        isCurrent
                          ? 'bg-rose-600 text-white ring-4 ring-rose-300 scale-110 shadow-md animate-pulse'
                          : isPastOrCurrent
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Warning Icon */}
            <div className="relative mb-3">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl ${
                mobilePhoneModal.strike === 3
                  ? 'bg-rose-600 text-white shadow-rose-600/40 animate-pulse'
                  : mobilePhoneModal.strike === 2
                    ? 'bg-orange-500 text-white shadow-orange-500/30'
                    : 'bg-amber-500 text-white shadow-amber-500/30'
              }`}>
                <Smartphone className="w-10 h-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-red-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full ring-2 ring-white">
                STRIKE {mobilePhoneModal.strike}/3
              </div>
            </div>

            {/* Badge */}
            <div className={`inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2 ${
              mobilePhoneModal.strike === 3
                ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                : mobilePhoneModal.strike === 2
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}>
              <AlertTriangle className="w-4 h-4 mr-1 text-rose-600" />
              {mobilePhoneModal.strike === 3
                ? '🚨 FINAL WARNING (3 OF 3) — TERMINATION ON NEXT STRIKE'
                : `WARNING ${mobilePhoneModal.strike} OF 3`}
            </div>

            {/* Title */}
            <h3 className="text-2xl font-black text-slate-900 mb-2">
              {mobilePhoneModal.title}
            </h3>

            {/* Explanation Message */}
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              {mobilePhoneModal.message}
            </p>

            {/* Policy Box */}
            <div className="w-full bg-rose-50 border border-rose-200 rounded-2xl p-4 text-left text-xs text-rose-900 mb-4 space-y-1.5">
              <div className="font-bold flex items-center text-rose-700">
                <AlertOctagon className="w-4 h-4 mr-1.5 text-rose-600" />
                <span>Strict Academic Integrity Rule:</span>
              </div>
              <p className="text-rose-800 leading-normal">
                Using an electronic device (mobile phone, camera, tablet) or attempting to photograph the examination screen is strictly prohibited.
              </p>
              <div className="pt-1.5 font-bold text-rose-950 border-t border-rose-200">
                {mobilePhoneModal.strike === 3 ? (
                  <span className="text-rose-600 uppercase tracking-wide">
                    ⚠️ CRITICAL: You have used all 3 warnings. If you use a mobile phone or electronic device again, your exam will be AUTOMATICALLY AND PERMANENTLY TERMINATED!
                  </span>
                ) : (
                  <span>
                    Warning {mobilePhoneModal.strike} of 3 recorded. If repeated after 3 warnings (4th occurrence), the exam will be automatically terminated immediately.
                  </span>
                )}
              </div>
            </div>

            {/* Snapshot Evidence Preview if available */}
            {mobilePhoneModal.evidenceImg && (
              <div className="w-full mb-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left flex items-center">
                  <Camera className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  Captured Incident Proof:
                </div>
                <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-rose-300 bg-slate-900 relative shadow-inner">
                  <img
                    src={mobilePhoneModal.evidenceImg}
                    alt="Phone Detection Evidence"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 bg-red-600/95 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                    AI CAPTURE
                  </span>
                </div>
              </div>
            )}

            {/* Acknowledge Button */}
            <button
              onClick={dismissMobilePhoneModal}
              className={`w-full py-3.5 px-6 font-black rounded-xl text-white shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer text-sm flex items-center justify-center space-x-2 ${
                mobilePhoneModal.strike === 3
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  : mobilePhoneModal.strike === 2
                    ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/30'
                    : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/30'
              }`}
            >
              <span>
                {mobilePhoneModal.strike === 3
                  ? 'I Understand — Final Chance (Phone Put Away)'
                  : mobilePhoneModal.strike === 2
                    ? 'I Acknowledge Warning 2/3 & Removed Device'
                    : 'I Understand & Put Phone Away'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Auto-Submit & Submission Confirmation Overlay */}
      {submissionOverlay && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center border border-slate-100 flex flex-col items-center">
            {submissionOverlay.title === 'Examination Terminated' ? (
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center shadow-lg shadow-rose-500/20 animate-pulse">
                  <AlertOctagon className="w-10 h-10" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-rose-600 text-white rounded-full flex items-center justify-center ring-4 ring-white shadow-xs">
                  <Ban className="w-4 h-4" />
                </div>
              </div>
            ) : submissionOverlay.isAutoSubmitted ? (
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-500/20 animate-pulse">
                  <Clock className="w-10 h-10" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#047857] text-white rounded-full flex items-center justify-center ring-4 ring-white shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            ) : (
              <div className="w-20 h-20 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-3xl flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10" />
              </div>
            )}

            <h3 className="text-2xl font-black text-slate-900 mb-2">
              {submissionOverlay.title}
            </h3>

            <p className="text-slate-600 text-sm leading-relaxed mb-6 max-w-md">
              {submissionOverlay.message}
            </p>

            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-center space-x-3 text-slate-700 text-xs font-bold mb-2">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span>Finalizing examination answers & redirecting to dashboard...</span>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 font-medium">
              Please do not close this window while final results are synchronized.
            </p>
          </div>
        </div>
      )}

      {/* Webcam Failure / Disconnection Blocking Modal */}
      {cameraBlockedMessage && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center border border-rose-200 flex flex-col items-center">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center shadow-lg shadow-rose-500/20 mb-5 animate-pulse">
              <VideoOff className="w-10 h-10" />
            </div>

            <div className="inline-flex items-center space-x-1.5 px-3.5 py-1 bg-rose-50 border border-rose-200 rounded-full text-rose-700 text-xs font-bold uppercase tracking-wider mb-3">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Proctoring Requirement</span>
            </div>

            <h3 className="text-2xl font-black text-slate-900 mb-2">
              Webcam Not Functioning
            </h3>

            <p className="text-slate-600 text-sm leading-relaxed mb-5">
              You are <strong className="text-rose-600 font-bold">not allowed to write or continue this exam</strong> because your webcam is inactive or not functioning. Remote proctoring strictly mandates an active video feed.
            </p>

            <div className="w-full bg-rose-50/80 border border-rose-200 rounded-2xl p-4 text-left text-xs text-rose-800 font-medium mb-6 space-y-1.5">
              <div className="font-bold text-rose-900 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1.5 text-rose-600" /> Error Details:
              </div>
              <p className="break-words text-rose-700">{cameraBlockedMessage}</p>
              <p className="text-[11px] text-slate-500 pt-1">
                Ensure your webcam is plugged in, camera permissions are granted in your browser, and no other app is accessing the camera.
              </p>
            </div>

            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setCameraBlockedMessage(null)}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Continue Exam with Camera Closed</span>
              </button>

              <button
                onClick={retryWebcam}
                disabled={isRetryingCamera}
                className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {isRetryingCamera ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking Camera...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry Webcam</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttemptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AttemptContent />
    </Suspense>
  );
}
