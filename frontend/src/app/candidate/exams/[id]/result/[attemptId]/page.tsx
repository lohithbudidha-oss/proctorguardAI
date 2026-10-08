'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Award, Clock, ShieldAlert, Target } from 'lucide-react';
import api from '@/lib/api';

function CandidateResultContent() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;
  const examId = params.id as string;

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/candidate/results/${attemptId}`)
      .then(res => {
        setResult(res.data.result);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch result', err);
        setLoading(false);
      });
  }, [attemptId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-bold">Loading your results...</div>;
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Result Not Found</h2>
        <button onClick={() => router.push('/candidate/dashboard')} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-12 px-6 font-sans">
      <div className="max-w-4xl w-full">
        <button onClick={() => router.push('/candidate/dashboard')} className="text-blue-600 font-bold mb-6 hover:underline flex items-center">
          ← Back to Dashboard
        </button>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className={`p-8 text-white ${result.pass ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-rose-500 to-red-600'}`}>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-extrabold mb-2">Examination Result</h1>
                <p className="text-white/80 text-lg">{result.examId?.title}</p>
              </div>
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm border border-white/30 text-center">
                <p className="text-sm font-bold uppercase tracking-wider mb-1">Status</p>
                <div className="flex items-center text-2xl font-black">
                  {result.pass ? <><CheckCircle className="w-8 h-8 mr-2" /> PASSED</> : <><XCircle className="w-8 h-8 mr-2" /> FAILED</>}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Score Card */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
                <Award className={`w-12 h-12 mb-4 ${result.pass ? 'text-emerald-500' : 'text-rose-500'}`} />
                <p className="text-slate-500 font-semibold uppercase tracking-wider text-sm mb-1">Final Score</p>
                <h2 className="text-5xl font-black text-slate-800">{result.percentage.toFixed(1)}%</h2>
                <p className="text-slate-500 mt-2 font-medium">{result.obtainedMarks} / {result.totalMarks} Marks</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col items-center justify-center text-emerald-700">
                  <span className="text-3xl font-bold">{result.correct}</span>
                  <span className="text-xs font-bold uppercase mt-1">Correct</span>
                </div>
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex flex-col items-center justify-center text-rose-700">
                  <span className="text-3xl font-bold">{result.wrong}</span>
                  <span className="text-xs font-bold uppercase mt-1">Wrong</span>
                </div>
                <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-slate-600">
                  <span className="text-3xl font-bold">{result.unanswered}</span>
                  <span className="text-xs font-bold uppercase mt-1">Unanswered</span>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex flex-col items-center justify-center text-blue-700">
                  <span className="text-3xl font-bold">{Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</span>
                  <span className="text-xs font-bold uppercase mt-1">Time Taken</span>
                </div>
              </div>
            </div>

            {/* Proctoring Summary */}
            <div className="border-t border-slate-200 pt-8">
              <h3 className="text-xl font-bold text-slate-800 flex items-center mb-6">
                <ShieldAlert className="w-6 h-6 text-indigo-500 mr-2" /> Proctoring Summary
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex items-center justify-between">
                  <div className="flex items-center">
                    <Target className="w-5 h-5 text-slate-400 mr-3" />
                    <span className="font-semibold text-slate-700">Integrity Risk Score</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${result.riskScore > 50 ? 'bg-red-100 text-red-700' : result.riskScore > 20 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {result.riskScore} / 100
                  </span>
                </div>
                <div className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex items-center justify-between">
                  <div className="flex items-center">
                    <ShieldAlert className="w-5 h-5 text-slate-400 mr-3" />
                    <span className="font-semibold text-slate-700">Violations Detected</span>
                  </div>
                  <span className="font-bold text-slate-800 text-lg">{result.violations}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function CandidateResultPage() {
  return (
    <Suspense fallback={<div className="p-10 font-bold">Loading...</div>}>
      <CandidateResultContent />
    </Suspense>
  );
}
