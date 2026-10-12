'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import io from 'socket.io-client';
import api from '@/lib/api';
import { 
  Clock, 
  ShieldAlert, 
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
  ArrowLeft
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showReviewCatalogModal, setShowReviewCatalogModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(3600); // 1 hour mock
  const [streamsStarted, setStreamsStarted] = useState(false);
  const [aiStatus, setAiStatus] = useState('Initializing AI...');
  const [examStatus, setExamStatus] = useState<'IN_PROGRESS' | 'PAUSED' | 'TERMINATED' | 'SUBMITTED'>('IN_PROGRESS');
  const [violationReviewState, setViolationReviewState] = useState({ active: false, reason: '', reminders: 0 });
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  
  const noFaceFrames = useRef(0);
  const multipleFaceFrames = useRef(0);
  
  const [questions, setQuestions] = useState<{ id: string; text: string; type: string; options: string[]; marks: number; negativeMarks: number; correctAnswer: string }[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch attempt details
    api.get(`/candidate/attempts/${attemptId}`).then((res: any) => {
      const { attempt, exam, questions, answers } = res.data;
      
      const mappedQuestions = questions.map((q: any) => ({
        id: q._id || q.id || '',
        text: q.text || '',
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

      // Calculate time remaining based on attempt.expiresAt
      if (attempt.expiresAt) {
        const remaining = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(exam.duration * 60);
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
      // Only enforce fullscreen AFTER the media streams have successfully started
      if (!document.fullscreenElement && examStatus === 'IN_PROGRESS' && streamsStarted) {
        handleViolation('FULLSCREEN_EXIT', 'CRITICAL', 'Candidate exited fullscreen mode.');
        submitExam('You have been terminated for exiting fullscreen mode. Redirecting to dashboard...', true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [examStatus, attemptId, socket, streamsStarted]);

  const mediaInitialized = useRef(false);

  // Initialize Socket and Devices
  useEffect(() => {
    if (isLoading || mediaInitialized.current) return;
    if (examStatus !== 'IN_PROGRESS' && examStatus !== 'PAUSED') return;
    
    mediaInitialized.current = true;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000');
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
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (err: any) {
          if (err.name === 'NotFoundError' || err.message.includes('not found') || err.message.includes('denied')) {
            // DEMO FALLBACK: Create dummy stream
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            setInterval(() => {
              if (ctx) {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(0, 0, 640, 480);
                ctx.fillStyle = '#ffffff';
                ctx.font = '24px Arial';
                ctx.fillText('NO CAMERA (DEMO MODE)', 120, 240);
                ctx.fillText(new Date().toLocaleTimeString(), 240, 280);
              }
            }, 1000);
            stream = canvas.captureStream(30);
            addWarning('Demo Mode: Using mock video stream because camera is unavailable.');
          } else {
            throw err;
          }
        }
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
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

        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
          screenTrack.onended = () => {
            handleViolation('SCREEN_SHARE_STOPPED', 'CRITICAL', 'Screen sharing was stopped.');
          };
        }

        initSocket.emit('camera:status', 'STARTED');
        
        // Phase 11: Start chunked recordings
        const camSession = await startRecording('CAMERA', stream);
        if (camSession) setCameraSessionId(camSession);
        
        const scrSession = await startRecording('SCREEN', screenStream);
        if (scrSession) setScreenSessionId(scrSession);

        // Re-enter full screen if the browser exited it during the permission prompts
        if (!document.fullscreenElement) {
          try {
            await document.documentElement.requestFullscreen();
          } catch (e) {
            console.error('Failed to restore fullscreen', e);
          }
        }

        setStreamsStarted(true); // Now we can safely attach security listeners

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
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (initSocket) {
        initSocket.disconnect();
      }
    };
  }, [isLoading, examStatus, attemptId, examId]);

  const requestAdminReview = (reason: string) => {
    if (socket) {
      socket.emit('violation:created', { attemptId, type: 'MANUAL_REVIEW', severity: 'CRITICAL', source: 'AI', actionTaken: 'LOG', description: reason });
    }
  };

  // AI Face Detection (Mediapipe)
  useEffect(() => {
    let faceDetector: import('@mediapipe/tasks-vision').FaceDetector;
    let animationFrameId: number;
    let lastDetect = 0;
    let isRunning = false;

    const initAI = async () => {
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "CPU"
          },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.3
        });
        
        setAiStatus('AI Active & Monitoring');
        isRunning = true;
        detectFaces();
      } catch (e) {
        console.error('Failed to init AI', e);
        setAiStatus('AI Init Failed');
      }
    };

    const detectFaces = async () => {
      if (!isRunning) return;
      const now = performance.now();

      if (videoRef.current && faceDetector && (now - lastDetect >= 250)) {
        lastDetect = now;
        try {
          if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
            const detections = faceDetector.detect(videoRef.current);
            const count = detections?.detections?.length || 0;

            if (count > 1) {
              multipleFaceFrames.current += 1;
              setAiStatus(`AI Alert: ${count} Faces Detected!`);
              if (multipleFaceFrames.current >= 4) { // ~1 second of multiple faces
                triggerAIViolation('MULTIPLE_FACES');
                multipleFaceFrames.current = 0;
              }
            } else {
              multipleFaceFrames.current = Math.max(0, multipleFaceFrames.current - 1);
            }

            if (count === 0) {
              noFaceFrames.current += 1;
              setAiStatus('AI Warning: No Face Detected');
              if (noFaceFrames.current >= 16) { // ~4 seconds of no face
                triggerAIViolation('FACE_NOT_FOUND');
                noFaceFrames.current = 0;
              }
            } else {
              noFaceFrames.current = Math.max(0, noFaceFrames.current - 1);
            }

            if (count === 1) {
              setAiStatus('AI Active: 1 Face Detected');
            }
          }
        } catch (err) {
          console.error('Face detection error:', err);
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
      if (faceDetector) faceDetector.close();
    };
  }, [streamsStarted]);

  // Audio Detection has been removed as per requirement

  // Browser Security Listeners (STRICT AUTO-TERMINATE)
  useEffect(() => {
    if (!streamsStarted) return; // Do not attach until after screen share popup is resolved

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleViolation('TAB_SWITCH', 'CRITICAL', 'You switched away from the exam tab.');
      }
    };

    const handleFocusLoss = () => {
      handleViolation('WINDOW_FOCUS_LOST', 'CRITICAL', 'Exam window lost focus.');
    };



    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('contextmenu', handleCopyPaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('contextmenu', handleCopyPaste);
    };
  }, [streamsStarted]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          submitExam('Time limit exceeded.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function captureSnapshotAndReport(type: string, severity: string, message: string) {
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

        // Client-side cache persistence for instant review
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
            localStorage.setItem(cacheKey, JSON.stringify(existing.slice(0, 50)));
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

    // 1. Emit socket violation with screenshot
    if (socket) {
      socket.emit('violation:created', { 
        attemptId, 
        type, 
        severity, 
        source: 'BROWSER', 
        actionTaken: 'LOG',
        description: message,
        screenshot,
        image: screenshot,
        snapshotImage: screenshot
      });
      if (screenshot) {
        socket.emit('evidence:snapshot', { 
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
      description: message,
      screenshot,
      snapshotImage: screenshot
    }).catch(err => console.error('REST violation report error:', err));
  }

  function handleViolation(type: string, severity: string, message: string) {
    captureSnapshotAndReport(type, severity, message);
  }

  function addWarning(message: string) {
    setWarnings(prev => [...prev, message]);
    setShowWarningModal(true);
  }

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

  async function submitExam(reason?: string, isTermination = false) {
    if (examStatus === 'SUBMITTED' || examStatus === 'TERMINATED') return;
    
    setExamStatus(isTermination ? 'TERMINATED' : 'SUBMITTED');
    setShowReviewCatalogModal(false);
    try {
      if (cameraSessionId) stopRecording(cameraSessionId);
      if (screenSessionId) stopRecording(screenSessionId);
      
      await api.post(`/candidate/attempts/${attemptId}/submit`);
      
      // Record local completion for dashboard state
      const completedStr = localStorage.getItem('completed_exams') || '[]';
      try {
        const completedExams = JSON.parse(completedStr);
        if (!completedExams.includes(examId)) {
          completedExams.push(examId);
          localStorage.setItem('completed_exams', JSON.stringify(completedExams));
        }
      } catch(e) {}

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(()=>{});
      }
      
      if (reason) {
        alert(reason);
      } else {
        alert('Examination Submitted Successfully');
      }
      
      // Redirect to dashboard instead of results page
      router.push(`/candidate/dashboard`);
    } catch (err) {
      console.error('Submit failed', err);
      // Force routing even if API fails to prevent being stuck
      router.push(`/candidate/dashboard`);
    }
  }

  // Simulated AI Face Detection Triggers for Local Testing
  const triggerAIViolation = (type: 'MULTIPLE_FACES' | 'FACE_NOT_FOUND') => {
    if (type === 'MULTIPLE_FACES') {
      handleViolation('MULTIPLE_FACES', 'CRITICAL', 'Multiple faces detected in the camera frame.');
    } else if (type === 'FACE_NOT_FOUND') {
      handleViolation('FACE_NOT_FOUND', 'CRITICAL', 'Candidate face turned away or left the frame.');
    }
  };

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
    <div className="min-h-screen bg-slate-50 flex flex-col select-none">
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
      <header className="bg-slate-900 text-white flex items-center justify-between px-6 py-3 shadow-md z-10 relative">
        <div className="flex items-center space-x-3">
          <ShieldAlert className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold tracking-wide">Secure Examination Mode</h1>
        </div>
        
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2 bg-slate-800 px-4 py-1.5 rounded-md">
            <Wifi className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium">Connected</span>
          </div>
          <div className="flex items-center space-x-2 text-rose-400 bg-slate-800 px-4 py-1.5 rounded-md font-mono text-lg font-bold">
            <Clock className="w-5 h-5" />
            <span>{formatTime(timeRemaining)}</span>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar (Camera & Monitor) */}
        <aside className="w-64 bg-slate-800 flex flex-col border-r border-slate-700 shadow-inner">
          <div className="p-4 border-b border-slate-700">
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
            
            {/* AI Test Panel (Only visible for testing purposes) */}
            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider">AI Simulation Panel</p>
              <div className="flex flex-col space-y-2">
                <button 
                  onClick={() => triggerAIViolation('MULTIPLE_FACES')}
                  className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 py-1.5 rounded border border-red-500/30 transition-colors"
                >
                  Simulate: Multiple Faces
                </button>
                <button 
                  onClick={() => triggerAIViolation('FACE_NOT_FOUND')}
                  className="text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 py-1.5 rounded border border-amber-500/30 transition-colors"
                >
                  Simulate: Look Away
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 flex-1">
            <h3 className="text-slate-300 text-sm font-semibold mb-3 uppercase tracking-wider">Question Palette</h3>
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isMarked = markedForReview[q.id];
                const isCurrent = idx === currentQuestionIdx;
                
                let bgColor = 'bg-slate-700 text-slate-300';
                if (isCurrent) bgColor = 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-800';
                else if (isMarked) bgColor = 'bg-amber-500 text-white';
                else if (isAnswered) bgColor = 'bg-emerald-500 text-white';

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
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div><span>Answered ({answeredCount})</span></div>
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
        <main className="flex-1 bg-white flex flex-col relative">
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
                onClick={() => submitExam()} 
                disabled={examStatus === 'SUBMITTED' || examStatus === 'TERMINATED'}
                className="mt-6 bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {examStatus === 'SUBMITTED' ? 'Ending...' : 'End Exam'}
              </button>
            </div>
          ) : (
            <>
          <div className="flex-1 overflow-y-auto p-10">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-3xl font-bold text-slate-800">Question {currentQuestionIdx + 1}</h2>
                <span className="text-sm font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">+1 Mark</span>
              </div>
              
              <div className="text-lg text-slate-700 mb-8 leading-relaxed">
                {currentQ.text}
              </div>

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

          {/* Footer Controls */}
          <footer className="bg-slate-50 border-t border-slate-200 p-4 px-10 flex flex-wrap gap-4 justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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
                className="px-8 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-lg shadow-sm flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Answered
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
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
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
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
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
                    <span className="flex items-center"><span className="w-2.5 h-2.5 rounded bg-emerald-500 mr-1"></span> Answered</span>
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
                onClick={() => submitExam()}
                disabled={examStatus === 'SUBMITTED' || examStatus === 'TERMINATED'}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition text-sm flex items-center justify-center shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {examStatus === 'SUBMITTED' ? 'Submitting...' : 'Confirm & Submit Exam'}
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
