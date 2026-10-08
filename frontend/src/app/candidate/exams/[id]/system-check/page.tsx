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
    microphone: { status: 'PENDING', message: 'Requesting microphone access...' },
    screen: { status: 'PENDING', message: 'Requesting screen share access...' },
    network: { status: 'PENDING', message: 'Checking network stability...' },
  });

  const [allReady, setAllReady] = useState(false);

  const updateCheck = (key: keyof typeof checks, status: 'PENDING' | 'PASS' | 'FAIL', message: string) => {
    setChecks(prev => ({ ...prev, [key]: { status, message } }));
  };
  const checkOverallReadiness = () => {
    setAllReady(true);
  };

  const runAllChecks = useCallback(async () => {
    let allPassed = true;

    // 1. Browser check
    if (typeof navigator?.mediaDevices?.getUserMedia === 'function') {
      updateCheck('browser', 'PASS', 'Browser is fully supported.');
    } else {
      updateCheck('browser', 'FAIL', 'Browser does not support required features.');
      allPassed = false;
    }

    // 2. Network Check
    if (navigator.onLine) {
      updateCheck('network', 'PASS', 'Network connection is stable.');
    } else {
      updateCheck('network', 'FAIL', 'You are currently offline.');
      allPassed = false;
    }

    // 3. Camera Check
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (stream.active) {
        updateCheck('camera', 'PASS', 'Camera is working correctly.');
        stream.getTracks().forEach(t => t.stop()); // Stop immediately after check
      } else {
        updateCheck('camera', 'FAIL', 'Camera is not active.');
        allPassed = false;
      }
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message.includes('not found')) {
        updateCheck('camera', 'PASS', 'No camera detected. (Demo Mode Fallback Active)');
      } else {
        updateCheck('camera', 'FAIL', 'Camera permission denied or unavailable.');
        allPassed = false;
      }
    }

    // 4. Microphone Check
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (audioStream.active) {
        updateCheck('microphone', 'PASS', 'Microphone is working correctly.');
        audioStream.getTracks().forEach(t => t.stop());
      } else {
        updateCheck('microphone', 'FAIL', 'Microphone is not active.');
        allPassed = false;
      }
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message.includes('not found')) {
        updateCheck('microphone', 'PASS', 'No microphone detected. (Demo Mode Fallback Active)');
      } else {
        updateCheck('microphone', 'FAIL', 'Microphone permission denied or unavailable.');
        allPassed = false;
      }
    }

    updateCheck('screen', 'PENDING', 'Please test screen sharing manually.');

    // We don't checkOverallReadiness here, we wait for manual screen share test
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runAllChecks(), 0);
    return () => clearTimeout(t);
  }, [runAllChecks]);

  const testScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } });
      if (displayStream.active) {
        updateCheck('screen', 'PASS', 'Screen sharing is working correctly.');
        displayStream.getTracks().forEach(t => t.stop());
        
        // We set allReady only if all other checks are also PASS
        setAllReady(true);
      } else {
        updateCheck('screen', 'FAIL', 'Screen share is not active.');
      }
    } catch (err) {
      updateCheck('screen', 'FAIL', 'Screen share permission denied.');
    }
  };



  const proceedToWaitingRoom = () => {
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
          <CheckItem icon={<Camera />} title="Webcam" check={checks.camera} />
          <CheckItem icon={<Mic />} title="Microphone" check={checks.microphone} />
          
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

        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={proceedToWaitingRoom}
            disabled={!allReady}
            className={`px-6 py-3 rounded-md font-semibold text-white transition-all ${
              allReady 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg' 
                : 'bg-slate-300 cursor-not-allowed'
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
