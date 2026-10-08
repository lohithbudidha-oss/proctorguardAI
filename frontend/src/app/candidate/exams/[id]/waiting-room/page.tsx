'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, ShieldAlert, MonitorPlay, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

function WaitingRoomContent() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam] = useState<any>(null);
  const [canStart, setCanStart] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [devicesEnabled, setDevicesEnabled] = useState(false);
  const [streamError, setStreamError] = useState('');
  const videoRef = React.useRef<HTMLVideoElement>(null);

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
      // defer to avoid setState-in-effect lint error
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
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setCountdown(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [exam]);

  const verifyDevices = async () => {
    setStreamError('');
    try {
      // Ask for Camera & Mic
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Screen share will be requested in the attempt page
      
      setDevicesEnabled(true);
    } catch (err) {
      console.error(err);
      setStreamError('You must grant access to Camera, Microphone, and Screen Share to continue.');
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video && video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleStart = async () => {
    try {
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
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
                <div className="text-sm text-blue-800">
                  <p className="font-bold mb-1">Important Rules:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Do not navigate away from this tab or exit fullscreen once the exam starts.</li>
                    <li>Your camera, microphone, and screen will be continuously recorded and monitored by AI and human proctors.</li>
                    <li>Any suspicious activity (e.g. mobile phone usage, looking away) will be flagged.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-5 flex flex-col justify-center items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 mb-3">System Verification</h3>
              {!devicesEnabled ? (
                <>
                  <p className="text-sm text-slate-500 text-center mb-4">You must enable and verify your Camera, Microphone, and Screen Share to proceed.</p>
                  <button onClick={verifyDevices} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition font-semibold text-sm">
                    Verify Devices
                  </button>
                  {streamError && <p className="text-red-500 text-xs mt-3 font-bold">{streamError}</p>}
                </>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500 mb-3 shadow-lg bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                  </div>
                  <p className="text-emerald-600 font-bold text-sm flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-1" /> Surveillance Active
                  </p>
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
