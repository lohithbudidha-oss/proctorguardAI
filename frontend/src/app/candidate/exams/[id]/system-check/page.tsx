'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Monitor, Camera, Mic, Wifi, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

function SystemCheckContent() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [checks, setChecks] = useState({
    browser: { status: 'PENDING', message: 'Checking browser compatibility...' },
    camera: { status: 'PENDING', message: 'Requesting camera access...' },
    screen: { status: 'PENDING', message: 'Requesting screen share access...' },
    network: { status: 'PENDING', message: 'Checking network stability...' },
  });

  const [allReady, setAllReady] = useState(false);
  const [retryingCamera, setRetryingCamera] = useState(false);

  const updateCheck = (key: keyof typeof checks, status: 'PENDING' | 'PASS' | 'FAIL', message: string) => {
    setChecks(prev => ({ ...prev, [key]: { status, message } }));
  };

  const runAllChecks = useCallback(async () => {
    // 1. Browser check
    if (typeof navigator?.mediaDevices?.getUserMedia === 'function') {
      updateCheck('browser', 'PASS', 'Browser is fully supported.');
    } else {
      updateCheck('browser', 'FAIL', 'Browser does not support required media features.');
    }

    // 2. Network Check
    if (navigator.onLine) {
      updateCheck('network', 'PASS', 'Network connection is stable.');
    } else {
      updateCheck('network', 'FAIL', 'You are currently offline.');
    }

    // 3. Camera Check - Even if candidate closed webcam or it's unavailable, they are allowed to proceed
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      if (stream.active && track && track.readyState === 'live') {
        updateCheck('camera', 'PASS', 'Camera is verified and working correctly.');
        stream.getTracks().forEach(t => t.stop()); // Stop immediately after check
      } else {
        updateCheck('camera', 'FAIL', 'Webcam is closed or inactive. You are permitted to proceed to the examination.');
      }
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('not found') || err.name === 'DevicesNotFoundError') {
        updateCheck('camera', 'FAIL', 'Webcam not detected or closed. You are permitted to proceed to the examination.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('denied')) {
        updateCheck('camera', 'FAIL', 'Camera closed or permission denied. You are permitted to proceed to the examination.');
      } else {
        updateCheck('camera', 'FAIL', 'Webcam is closed or unavailable. You are permitted to proceed to the examination.');
      }
    }

    updateCheck('screen', 'PENDING', 'Please test screen sharing manually.');
  }, []);

  const retryCameraCheck = async () => {
    setRetryingCamera(true);
    updateCheck('camera', 'PENDING', 'Testing camera access...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      if (stream.active && track && track.readyState === 'live') {
        updateCheck('camera', 'PASS', 'Camera is verified and working correctly.');
        stream.getTracks().forEach(t => t.stop());
      } else {
        updateCheck('camera', 'FAIL', 'Webcam is closed or inactive. You are permitted to proceed to the examination.');
      }
    } catch (err: any) {
      updateCheck('camera', 'FAIL', 'Webcam is closed or unavailable. You are permitted to proceed to the examination.');
    } finally {
      setRetryingCamera(false);
    }
  };

  // Verify exam status before running system check to prevent duplicate attempts
  useEffect(() => {
    api.get(`/candidate/exams/${examId}`).then((res) => {
      const ex = res.data?.exam;
      if (ex?.isCompleted && !ex?.canRewrite) {
        if (ex.completedAttemptId) {
          router.replace(`/candidate/exams/${examId}/result/${ex.completedAttemptId}`);
        } else {
          router.replace('/candidate/dashboard');
        }
      } else if (ex?.hasActiveAttempt && ex?.activeAttemptId) {
        router.replace(`/candidate/exams/${examId}/attempt/${ex.activeAttemptId}`);
      }
    }).catch(() => {});
  }, [examId, router]);

  useEffect(() => {
    const t = setTimeout(() => runAllChecks(), 0);
    return () => clearTimeout(t);
  }, [runAllChecks]);

  const testScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } });
      if (displayStream.active && displayStream.getVideoTracks().length > 0) {
        updateCheck('screen', 'PASS', 'Screen sharing is working correctly.');
        displayStream.getTracks().forEach(t => t.stop());
        
        // Candidate is allowed to proceed regardless of camera status
        setChecks(curr => {
          const isBrowserPass = curr.browser.status === 'PASS';
          const isNetPass = curr.network.status === 'PASS';
          setAllReady(isBrowserPass && isNetPass);
          return curr;
        });
      } else {
        updateCheck('screen', 'FAIL', 'Screen share is not active.');
      }
    } catch (err) {
      updateCheck('screen', 'FAIL', 'Screen share permission denied.');
    }
  };

  // Proceed to Waiting Room - allows candidate even if webcam is closed
  const proceedToWaitingRoom = () => {
    router.push(`/candidate/exams/${examId}/waiting-room`);
  };

  // Can proceed if browser and network are fine, and screen share was tested (or user continues)
  const isEligibleToProceed = checks.browser.status === 'PASS' && checks.network.status === 'PASS';

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl p-8 border border-slate-100">
        <Link href="/candidate/dashboard" className="text-blue-600 font-bold flex items-center mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Link>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">System Readiness Check</h1>
          <p className="text-slate-500">We need to ensure your system meets the requirements for this proctored examination.</p>
        </div>

        <div className="space-y-4">
          <CheckItem icon={<Monitor />} title="Browser Support" check={checks.browser} />
          <CheckItem icon={<Wifi />} title="Network Connection" check={checks.network} />
          
          {/* Camera Check with Retry Button if Failed */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-white rounded-md shadow-sm text-blue-600">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Webcam Check</h3>
                <p className="text-sm text-slate-500">{checks.camera.message}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {checks.camera.status === 'FAIL' && (
                <button
                  type="button"
                  onClick={retryCameraCheck}
                  disabled={retryingCamera}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200"
                >
                  {retryingCamera ? 'Checking...' : 'Retry Webcam'}
                </button>
              )}
              {checks.camera.status === 'PENDING' && <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />}
              {checks.camera.status === 'PASS' && <CheckCircle2 className="w-6 h-6 text-emerald-700" />}
              {checks.camera.status === 'FAIL' && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-bold">
                  Camera Closed (Allowed)
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-white rounded-md shadow-sm text-blue-600">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Screen Share</h3>
                <p className="text-sm text-slate-500">{checks.screen.message}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {checks.screen.status !== 'PASS' && (
                <button
                  onClick={testScreenShare}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-semibold rounded-md hover:bg-blue-200 transition-colors cursor-pointer"
                >
                  Test Screen
                </button>
              )}
              {checks.screen.status === 'PENDING' && <div className="w-6 h-6" />}
              {checks.screen.status === 'PASS' && <CheckCircle2 className="w-6 h-6 text-emerald-700" />}
              {checks.screen.status === 'FAIL' && <XCircle className="w-6 h-6 text-red-500" />}
            </div>
          </div>
        </div>

        {/* Webcam Closed Notification Banner - Informs candidate they are permitted to proceed */}
        {checks.camera.status === 'FAIL' && (
          <div className="mt-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl flex items-start space-x-3.5 text-amber-900 shadow-xs animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-sm text-amber-950">Webcam Closed or Inactive — Candidate Permitted to Proceed</h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Your webcam is closed or not detected. You are still allowed to take this examination. You may reconnect your camera or proceed directly to the examination waiting room.
              </p>
              <div className="mt-3 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={retryCameraCheck}
                  disabled={retryingCamera}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-xs rounded-lg transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {retryingCamera ? 'Checking Webcam...' : 'Retry Webcam'}
                </button>
                <button
                  type="button"
                  onClick={proceedToWaitingRoom}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer flex items-center"
                >
                  <span>Proceed to Exam with Closed Camera</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
          <Link
            href="/candidate/dashboard"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Cancel & Return
          </Link>

          <button
            onClick={proceedToWaitingRoom}
            disabled={!isEligibleToProceed}
            className={`px-6 py-3 rounded-md font-semibold text-white transition-all ${
              isEligibleToProceed
                ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg cursor-pointer' 
                : 'bg-slate-300 cursor-not-allowed opacity-60'
            }`}
          >
            Continue to Waiting Room
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ icon, title, check }: { icon: React.ReactNode, title: string, check: { status: string, message: string } }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center space-x-4">
        <div className="p-2 bg-white rounded-md shadow-sm text-blue-600">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">{check.message}</p>
        </div>
      </div>
      <div>
        {check.status === 'PENDING' && <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />}
        {check.status === 'PASS' && <CheckCircle2 className="w-6 h-6 text-emerald-700" />}
        {check.status === 'FAIL' && <XCircle className="w-6 h-6 text-red-500" />}
      </div>
    </div>
  );
}

export default function SystemCheckPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SystemCheckContent />
    </Suspense>
  );
}
