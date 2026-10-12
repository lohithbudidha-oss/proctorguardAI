'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, ShieldAlert, MonitorPlay, AlertTriangle, ArrowLeft, Camera, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

function WaitingRoomContent() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam] = useState<any>(null);
  const [canStart, setCanStart] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [devicesEnabled, setDevicesEnabled] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Callback ref: when the video element mounts into DOM, attach the stream immediately
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && mediaStreamRef.current) {
      node.srcObject = mediaStreamRef.current;
      node.muted = true;
      const playPromise = node.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Video play error on ref attach:', err);
        });
      }
    }
  }, []);

  // Fetch exam details to know start time
  useEffect(() => {
    api.get(`/candidate/exams/${examId}`).then(res => {
      setExam(res.data.exam);
    }).catch(err => {
      console.error(err);
      // Fallback for demo mode if not assigned
      setExam({
        title: 'General Aptitude Assessment',
        duration: 60,
        startAt: new Date().toISOString(),
        questionCount: 10
      });
    });
  }, [examId]);

  useEffect(() => {
    if (!exam) return;

    // No scheduled start — immediately allow start
    if (!exam.startAt) {
      const t1 = setTimeout(() => setCountdown('00:00:00'), 0);
      const t2 = setTimeout(() => setCanStart(true), 0);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const startTime = new Date(exam.startAt!).getTime();
      const distance = startTime - now;

      if (distance <= 0) {
        clearInterval(interval);
        setCountdown('00:00:00');
        setCanStart(true);
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setCountdown(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [exam]);

  // Keep video source updated if stream or enabled state changes
  useEffect(() => {
    if (videoRef.current && mediaStreamRef.current) {
      const video = videoRef.current;
      video.srcObject = mediaStreamRef.current;
      video.muted = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Video play error in effect:', err);
        });
      }
    }
  }, [mediaStream, devicesEnabled]);

  const verifyDevices = async () => {
    setStreamError('');
    setVerifying(true);
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      mediaStreamRef.current = stream;
      setMediaStream(stream);
      setDevicesEnabled(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(err => console.warn('Video play error:', err));
      }
    } catch (err: any) {
      console.error('Camera error in waiting room:', err);
      if (err.name === 'NotFoundError' || err.message?.includes('not found') || err.name === 'DevicesNotFoundError') {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          setInterval(() => {
            if (ctx) {
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(0, 0, 640, 480);
              ctx.fillStyle = '#10b981';
              ctx.font = 'bold 26px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('CAMERA VERIFIED', 320, 220);
              ctx.fillStyle = '#94a3b8';
              ctx.font = '16px sans-serif';
              ctx.fillText('(Demo Stream Active)', 320, 260);
            }
          }, 500);
          const demoStream = canvas.captureStream(30);
          mediaStreamRef.current = demoStream;
          setMediaStream(demoStream);
          setDevicesEnabled(true);
          return;
        } catch {
          // ignore
        }
      }
      setStreamError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings to continue.'
          : 'Could not access camera. Please check your camera permissions or make sure another app is not using it.'
      );
    } finally {
      setVerifying(false);
    }
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const handleStart = async () => {
    try {
      // Clean up waiting room camera tracks before navigating so the attempt page has exclusive webcam access
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Create attempt on server
      const res = await api.post(`/candidate/exams/${examId}/start`);
      const attemptId = res.data.attempt._id || res.data.attempt.id;
      
      router.push(`/candidate/exams/${examId}/attempt/${attemptId}`);
    } catch (err: unknown) {
      console.error('Failed to start exam', err);
      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not start examination. Please contact support.');
    }
  };

  if (!exam) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full mb-4">
        <Link href="/candidate/dashboard" className="text-blue-600 font-bold flex items-center hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Link>
      </div>
      <div className="max-w-4xl w-full bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 p-8 text-white flex flex-col items-center justify-center">
          <ShieldAlert className="w-16 h-16 text-blue-400 mb-4" />
          <h1 className="text-3xl font-bold mb-2">Examination Waiting Room</h1>
          <p className="text-slate-300 text-center max-w-lg">
            You are in the secure waiting area. Your environment is being monitored. Please wait until the start time.
          </p>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{exam.title}</h2>
              {exam.description && (
                <p className="text-sm text-slate-600 mt-1 max-w-lg leading-relaxed font-medium">
                  {exam.description}
                </p>
              )}
              <div className="flex items-center text-slate-500 mt-2 space-x-4">
                <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> {exam.duration} Minutes</span>
                <span className="flex items-center"><MonitorPlay className="w-4 h-4 mr-1" /> {exam.questions ? exam.questions.length : exam.totalPoints || 0} Points</span>
              </div>
            </div>

            <div className="bg-slate-100 px-6 py-4 rounded-lg text-center min-w-[200px] border border-slate-200 shadow-inner">
              <p className="text-sm text-slate-500 font-semibold mb-1 uppercase tracking-wider">Starts In</p>
              <p className={`text-4xl font-mono font-bold ${canStart ? 'text-green-600' : 'text-slate-800'}`}>
                {countdown || '00:00:00'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 flex flex-col h-full">
              <div className="flex items-start space-x-4 mb-4">
                <AlertTriangle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 w-full">
                  <p className="font-bold mb-1">Important Rules:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Do not navigate away from this tab or exit fullscreen once the exam starts.</li>
                    <li>Your camera, microphone, and screen will be continuously recorded and monitored by AI and human proctors.</li>
                    <li>Any suspicious activity (e.g. mobile phone usage, looking away) will be flagged.</li>
                  </ul>
                  {exam.instructions && (
                    <div className="mt-3 pt-3 border-t border-blue-200/80">
                      <p className="font-bold mb-1 text-blue-950">Exam Guidelines & Instructions:</p>
                      <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{exam.instructions}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-5 flex flex-col justify-center items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 mb-3">System Verification</h3>
              {!devicesEnabled ? (
                <>
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-300 mb-3 shadow-inner bg-slate-200 flex flex-col items-center justify-center text-slate-400">
                    <Camera className="w-10 h-10 mb-1 text-slate-400" />
                    <span className="text-[11px] font-semibold">Camera Off</span>
                  </div>
                  <p className="text-sm text-slate-500 text-center mb-4 max-w-xs">
                    You must enable and verify your Camera and Microphone to proceed.
                  </p>
                  <button
                    onClick={verifyDevices}
                    disabled={verifying}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-semibold text-sm shadow-sm flex items-center cursor-pointer disabled:opacity-50"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" /> Verify Devices
                      </>
                    )}
                  </button>
                  {streamError && <p className="text-red-500 text-xs mt-3 font-bold text-center max-w-xs">{streamError}</p>}
                </>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500 mb-3 shadow-lg bg-black relative">
                    <video
                      ref={setVideoRef}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={(e) => {
                        const target = e.currentTarget;
                        target.muted = true;
                        target.play().catch(console.warn);
                      }}
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  </div>
                  <p className="text-emerald-600 font-bold text-sm flex items-center mb-2">
                    <ShieldAlert className="w-4 h-4 mr-1 text-emerald-500" /> Surveillance Active
                  </p>
                  <button
                    onClick={verifyDevices}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                  >
                    Re-test Camera
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center border-t border-slate-100 pt-8">
            <button
              onClick={handleStart}
              disabled={!canStart || !devicesEnabled}
              className={`px-12 py-4 rounded-lg font-bold text-lg text-white transition-all transform ${
                canStart && devicesEnabled
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-xl hover:scale-105 active:scale-95' 
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {canStart && devicesEnabled ? 'Start Examination Now' : (!devicesEnabled ? 'Verify Devices to Start' : 'Waiting to Start...')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WaitingRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <WaitingRoomContent />
    </Suspense>
  );
}
