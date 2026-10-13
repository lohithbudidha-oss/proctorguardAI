'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Monitor, Camera, Mic, Wifi, ArrowLeft } from 'lucide-react';
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

    // 3. Strict Camera Check
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      if (stream.active && track && track.readyState === 'live') {
        updateCheck('camera', 'PASS', 'Camera is verified and working correctly.');
        stream.getTracks().forEach(t => t.stop()); // Stop immediately after check
      } else {
        updateCheck('camera', 'FAIL', 'Webcam is inactive or not functioning. Working camera is strictly required.');
      }
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('not found') || err.name === 'DevicesNotFoundError') {
        updateCheck('camera', 'FAIL', 'Webcam not detected. You are not allowed to write the exam without a functional webcam.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('denied')) {
        updateCheck('camera', 'FAIL', 'Camera permission denied. Camera access is strictly required to take this assessment.');
      } else {
        updateCheck('camera', 'FAIL', 'Webcam is not functioning or unavailable. Working camera is strictly required.');
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
        setChecks(curr => {
          const isReady = curr.browser.status === 'PASS' && curr.network.status === 'PASS' && curr.screen.status === 'PASS';
          setAllReady(isReady);
          return curr;
        });
      } else {
        updateCheck('camera', 'FAIL', 'Webcam is inactive or not functioning. Working camera is strictly required.');
        setAllReady(false);
      }
    } catch (err: any) {
      setAllReady(false);
      if (err.name === 'NotFoundError' || err.message?.includes('not found') || err.name === 'DevicesNotFoundError') {
        updateCheck('camera', 'FAIL', 'Webcam not detected. You are not allowed to write the exam without a functional webcam.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('denied')) {
        updateCheck('camera', 'FAIL', 'Camera permission denied. Camera access is strictly required to take this assessment.');
      } else {
        updateCheck('camera', 'FAIL', 'Webcam is not functioning or unavailable. Working camera is strictly required.');
      }
    } finally {
      setRetryingCamera(false);
    }
  };

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
        
        // Only set allReady if camera is also strictly PASS!
        setChecks(curr => {
          const isCamPass = curr.camera.status === 'PASS';
          const isBrowserPass = curr.browser.status === 'PASS';
          const isNetPass = curr.network.status === 'PASS';
          setAllReady(isCamPass && isBrowserPass && isNetPass);
          return curr;
        });
      } else {
        updateCheck('screen', 'FAIL', 'Screen share is not active.');
        setAllReady(false);
      }
    } catch (err) {
      updateCheck('screen', 'FAIL', 'Screen share permission denied.');
      setAllReady(false);
    }
  };

  const proceedToWaitingRoom = () => {
    if (checks.camera.status !== 'PASS') {
      alert('You are not allowed to write the examination without a working, verified webcam.');
      return;
    }
    router.push(`/candidate/exams/${examId}/waiting-room`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
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
              {checks.camera.status === 'PASS' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
              {checks.camera.status === 'FAIL' && <XCircle className="w-6 h-6 text-red-500" />}
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
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-semibold rounded-md hover:bg-blue-200 transition-colors"
                >
                  Test Screen
                </button>
              )}
              {checks.screen.status === 'PENDING' && <div className="w-6 h-6" />}
              {checks.screen.status === 'PASS' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
              {checks.screen.status === 'FAIL' && <XCircle className="w-6 h-6 text-red-500" />}
            </div>
          </div>
        </div>

        {/* Webcam Failure Notification Banner */}
        {checks.camera.status === 'FAIL' && (
          <div className="mt-6 p-4 bg-rose-50 border-l-4 border-rose-600 rounded-r-xl flex items-start space-x-3.5 text-rose-900 shadow-xs animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-sm text-rose-950">Webcam Not Functioning — Candidate Not Allowed to Write Exam</h4>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                A functioning webcam is strictly required to verify identity and maintain continuous remote proctoring. Because your webcam is not detected or not active, you are not permitted to proceed to the examination.
              </p>
              <div className="mt-3 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={retryCameraCheck}
                  disabled={retryingCamera}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {retryingCamera ? 'Checking Webcam...' : 'Reconnect & Retry Webcam'}
                </button>
                <Link
                  href="/candidate/dashboard"
                  className="text-xs font-semibold text-rose-700 hover:text-rose-900 hover:underline"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={proceedToWaitingRoom}
            disabled={!allReady || checks.camera.status !== 'PASS'}
            className={`px-6 py-3 rounded-md font-semibold text-white transition-all ${
              allReady && checks.camera.status === 'PASS'
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
        {check.status === 'PASS' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
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
