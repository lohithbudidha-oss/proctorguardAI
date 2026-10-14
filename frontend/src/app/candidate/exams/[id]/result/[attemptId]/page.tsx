'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  CheckCircle, 
  XCircle, 
  Award, 
  Clock, 
  ShieldAlert, 
  Target, 
  Check, 
  X, 
  CheckCircle2, 
  HelpCircle, 
  BookOpen, 
  Lightbulb, 
  ArrowLeft, 
  FileText, 
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '@/lib/api';

interface QuestionAnswerItem {
  questionNumber: number;
  questionId: string;
  questionText: string;
  type: string;
  options: any[];
  marks: number;
  negativeMarks: number;
  marksAwarded: number;
  candidateSelectedAnswer: any;
  correctAnswer: any;
  explanation?: string;
  isCorrect: boolean;
  isAttempted: boolean;
  isMarkedForReview?: boolean;
}

// Clean helper to test if an option was selected by candidate
function isOptionSelectedByCandidate(opt: any, optIdx: number, candidateSelectedAnswer: any): boolean {
  if (candidateSelectedAnswer === null || candidateSelectedAnswer === undefined || candidateSelectedAnswer === '') return false;
  const optId = typeof opt === 'object' && opt !== null ? (opt.id ?? opt.value ?? opt.text) : opt;
  const optText = typeof opt === 'object' && opt !== null ? (opt.text ?? opt.value ?? opt.id) : opt;
  const optLetter = String.fromCharCode(65 + optIdx).toLowerCase();

  const clean = (val: any) => String(val ?? '').trim().toLowerCase().replace(/^["']|["']$/g, '');

  const checkSingle = (candVal: any) => {
    const c = clean(candVal);
    if (!c) return false;
    return c === clean(optId) ||
           c === clean(optText) ||
           c === optLetter ||
           c.startsWith(`${optLetter})`) ||
           c.startsWith(`(${optLetter})`) ||
           c.startsWith(`${optLetter}.`);
  };

  if (Array.isArray(candidateSelectedAnswer)) {
    return candidateSelectedAnswer.some(checkSingle);
  }
  return checkSingle(candidateSelectedAnswer);
}

// Clean helper to test if an option is the correct answer
function isOptionCorrectAnswer(opt: any, optIdx: number, correctAnswer: any): boolean {
  if (correctAnswer === null || correctAnswer === undefined || correctAnswer === '') return false;
  const optId = typeof opt === 'object' && opt !== null ? (opt.id ?? opt.value ?? opt.text) : opt;
  const optText = typeof opt === 'object' && opt !== null ? (opt.text ?? opt.value ?? opt.id) : opt;
  const optLetter = String.fromCharCode(65 + optIdx).toLowerCase();

  const clean = (val: any) => String(val ?? '').trim().toLowerCase().replace(/^["']|["']$/g, '');

  const checkSingle = (corrVal: any) => {
    const cr = clean(corrVal);
    if (!cr) return false;
    return cr === clean(optId) ||
           cr === clean(optText) ||
           cr === optLetter ||
           cr.startsWith(`${optLetter})`) ||
           cr.startsWith(`(${optLetter})`) ||
           cr.startsWith(`${optLetter}.`);
  };

  if (Array.isArray(correctAnswer)) {
    return correctAnswer.some(checkSingle);
  }
  return checkSingle(correctAnswer);
}

function CandidateResultContent() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;
  const examId = params.id as string;

  const [result, setResult] = useState<any>(null);
  const [answers, setAnswers] = useState<QuestionAnswerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionFilter, setQuestionFilter] = useState<'ALL' | 'CORRECT' | 'WRONG' | 'UNANSWERED'>('ALL');

  useEffect(() => {
    api.get(`/candidate/results/${attemptId}`)
      .then(res => {
        setResult(res.data.result);
        const incomingAnswers = res.data.answers || [];
        if (incomingAnswers.length > 0) {
          setAnswers(incomingAnswers);
          setLoading(false);
        } else {
          // Fallback to fetch question paper directly from attempt
          api.get(`/candidate/attempts/${attemptId}`)
            .then(attRes => {
              const { questions = [], answers: savedAnswers = [] } = attRes.data;
              const mapped = questions.map((q: any, idx: number) => {
                const ans = savedAnswers.find((a: any) => String(a.questionId) === String(q._id || q.id));
                const candidateSelectedAnswer = ans ? ans.selectedAnswer : null;
                const isAttempted = Boolean(candidateSelectedAnswer !== null && candidateSelectedAnswer !== undefined && candidateSelectedAnswer !== '');
                const isCorrect = isAttempted && (ans?.isCorrect ?? (JSON.stringify(candidateSelectedAnswer) === JSON.stringify(q.correctAnswer)));
                return {
                  questionNumber: idx + 1,
                  questionId: q._id || q.id,
                  questionText: q.text || q.questionText || `Question ${idx + 1}`,
                  type: q.type || 'SINGLE_CHOICE',
                  options: q.options || [],
                  marks: q.marks || 1,
                  negativeMarks: q.negativeMarks || 0,
                  marksAwarded: ans?.marksAwarded ?? (isCorrect ? (q.marks || 1) : 0),
                  candidateSelectedAnswer,
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation || '',
                  isCorrect,
                  isAttempted,
                  isMarkedForReview: ans?.isMarkedForReview || false,
                };
              });
              setAnswers(mapped);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        }
      })
      .catch(() => {
        // Fallback to attempts endpoint if result endpoint 404s
        api.get(`/candidate/attempts/${attemptId}`)
          .then(attRes => {
            const { attempt, questions = [], answers: savedAnswers = [] } = attRes.data;
            if (attempt) {
              setResult({
                attemptId,
                totalQuestions: questions.length,
                attempted: savedAnswers.length,
                status: 'COMPLETED'
              });
            }
            const mapped = questions.map((q: any, idx: number) => {
              const ans = savedAnswers.find((a: any) => String(a.questionId) === String(q._id || q.id));
              const candidateSelectedAnswer = ans ? ans.selectedAnswer : null;
              const isAttempted = Boolean(candidateSelectedAnswer !== null && candidateSelectedAnswer !== undefined && candidateSelectedAnswer !== '');
              const isCorrect = isAttempted && (ans?.isCorrect ?? (JSON.stringify(candidateSelectedAnswer) === JSON.stringify(q.correctAnswer)));
              return {
                questionNumber: idx + 1,
                questionId: q._id || q.id,
                questionText: q.text || q.questionText || `Question ${idx + 1}`,
                type: q.type || 'SINGLE_CHOICE',
                options: q.options || [],
                marks: q.marks || 1,
                negativeMarks: q.negativeMarks || 0,
                marksAwarded: ans?.marksAwarded ?? (isCorrect ? (q.marks || 1) : 0),
                candidateSelectedAnswer,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || '',
                isCorrect,
                isAttempted,
                isMarkedForReview: ans?.isMarkedForReview || false,
              };
            });
            setAnswers(mapped);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
  }, [attemptId]);

  const stats = useMemo(() => {
    const total = answers.length;
    const correctCount = answers.filter(a => a.isCorrect).length;
    const wrongCount = answers.filter(a => a.isAttempted && !a.isCorrect).length;
    const unansweredCount = answers.filter(a => !a.isAttempted).length;
    return { total, correctCount, wrongCount, unansweredCount };
  }, [answers]);

  const filteredAnswers = useMemo(() => {
    if (questionFilter === 'CORRECT') return answers.filter(a => a.isCorrect);
    if (questionFilter === 'WRONG') return answers.filter(a => a.isAttempted && !a.isCorrect);
    if (questionFilter === 'UNANSWERED') return answers.filter(a => !a.isAttempted);
    return answers;
  }, [answers, questionFilter]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 font-sans">
        <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="font-bold text-lg text-slate-800">Loading your examination results...</p>
        <p className="text-xs text-slate-400 mt-1">Preparing question and response evaluation breakdown.</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans">
        <XCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Result Not Found</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-md">The requested examination result could not be retrieved or is still pending evaluation.</p>
        <button 
          onClick={() => router.push('/candidate/dashboard')} 
          className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-12 px-4 sm:px-6 font-sans">
      <div className="max-w-5xl w-full">
        {/* Back Link */}
        <button 
          onClick={() => router.push('/candidate/dashboard')} 
          className="text-blue-600 font-bold mb-6 hover:text-blue-700 transition flex items-center text-sm cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" /> Back to Candidate Dashboard
        </button>

        {/* Master Result Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 mb-10">
          <div className={`p-8 text-white ${result.pass ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-rose-600 to-red-700'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white mb-2 backdrop-blur-xs">
                  Proctored Assessment Outcome
                </span>
                <h1 className="text-3xl font-black tracking-tight">{result.examId?.title || 'Examination Assessment'}</h1>
                <p className="text-white/80 text-sm mt-1">Detailed evaluation and answer sheet</p>
              </div>
              <div className="bg-white/15 px-6 py-4 rounded-2xl backdrop-blur-md border border-white/25 text-center shrink-0">
                <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-1">Status</p>
                <div className="flex items-center text-2xl font-black">
                  {result.pass ? (
                    <><CheckCircle className="w-7 h-7 mr-2 text-emerald-200" /> PASSED</>
                  ) : (
                    <><XCircle className="w-7 h-7 mr-2 text-rose-200" /> FAILED</>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Score Card */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center shadow-2xs">
                <div className={`p-3 rounded-full mb-3 ${result.pass ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  <Award className="w-8 h-8" />
                </div>
                <p className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">Final Score Percentage</p>
                <h2 className="text-5xl font-black text-slate-900 tracking-tight">{Number(result.percentage || 0).toFixed(1)}%</h2>
                <div className="mt-2 inline-flex items-center space-x-1.5 text-sm font-bold text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-200">
                  <span>{result.obtainedMarks ?? 0}</span>
                  <span className="text-slate-400">/</span>
                  <span>{result.totalMarks ?? 0} Marks</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-xl flex flex-col items-center justify-center text-emerald-800 shadow-2xs">
                  <span className="text-3xl font-black text-emerald-700">{result.correct ?? 0}</span>
                  <span className="text-xs font-extrabold uppercase mt-1 flex items-center">
                    <Check className="w-3.5 h-3.5 mr-1" /> Correct
                  </span>
                </div>
                <div className="bg-rose-50 border border-rose-200/80 p-4 rounded-xl flex flex-col items-center justify-center text-rose-800 shadow-2xs">
                  <span className="text-3xl font-black text-rose-700">{result.wrong ?? 0}</span>
                  <span className="text-xs font-extrabold uppercase mt-1 flex items-center">
                    <X className="w-3.5 h-3.5 mr-1" /> Incorrect
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-slate-700 shadow-2xs">
                  <span className="text-3xl font-black text-slate-800">{result.unanswered ?? 0}</span>
                  <span className="text-xs font-extrabold uppercase mt-1">Unanswered</span>
                </div>
                <div className="bg-blue-50 border border-blue-200/80 p-4 rounded-xl flex flex-col items-center justify-center text-blue-800 shadow-2xs">
                  <span className="text-2xl font-black text-blue-700">
                    {Math.floor((result.timeTaken || 0) / 60)}m {(result.timeTaken || 0) % 60}s
                  </span>
                  <span className="text-xs font-extrabold uppercase mt-1 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1" /> Time Taken
                  </span>
                </div>
              </div>
            </div>

            {/* Proctoring Summary Pill */}
            <div className="border-t border-slate-200 pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Proctoring Verification</p>
                    <p className="text-xs text-slate-500 font-medium">Session audited for AI facial presence, tab activity, and screen sharing.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  <span className="text-xs font-bold text-slate-600">
                    Risk: <strong className={result.riskScore > 30 ? 'text-rose-600' : 'text-emerald-600'}>{result.riskScore || 0}/100</strong>
                  </span>
                  <span className="text-xs font-bold text-slate-600">
                    Violations: <strong className={result.violations > 0 ? 'text-rose-600' : 'text-emerald-600'}>{result.violations || 0}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OFFICIAL EXAMINATION QUESTION PAPER & RESULT EVALUATION */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-12">
          {/* Section Header */}
          <div className="p-6 sm:p-8 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
                <FileText className="w-4 h-4" />
                <span>Official Question Paper & Evaluation Key</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">Question & Answer Evaluation</h2>
              <p className="text-slate-300 text-xs mt-1">
                Review your submitted choices alongside the verified correct answers and detailed score breakdown.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80 text-xs font-bold">
              <button
                onClick={() => setQuestionFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  questionFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setQuestionFilter('CORRECT')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  questionFilter === 'CORRECT'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                Correct ({stats.correctCount})
              </button>
              <button
                onClick={() => setQuestionFilter('WRONG')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  questionFilter === 'WRONG'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                Incorrect ({stats.wrongCount})
              </button>
              <button
                onClick={() => setQuestionFilter('UNANSWERED')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  questionFilter === 'UNANSWERED'
                    ? 'bg-slate-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Unanswered ({stats.unansweredCount})
              </button>
            </div>
          </div>

          {/* Quick Jump Bar (Q1, Q2, Q3...) */}
          {answers.length > 0 && (
            <div className="p-4 bg-slate-50 border-b border-slate-200 overflow-x-auto">
              <div className="flex items-center space-x-2 min-w-max">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Quick Jump:</span>
                {answers.map((a) => {
                  const isCurCorrect = a.isCorrect;
                  const isCurUnanswered = !a.isAttempted;
                  return (
                    <a
                      key={a.questionNumber}
                      href={`#question-${a.questionNumber}`}
                      className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center transition-transform hover:scale-105 border ${
                        isCurCorrect
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isCurUnanswered
                          ? 'bg-slate-200 text-slate-700 border-slate-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                      title={`Question ${a.questionNumber}: ${isCurCorrect ? 'Correct' : isCurUnanswered ? 'Not Attempted' : 'Incorrect'}`}
                    >
                      {a.questionNumber}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Question List */}
          <div className="p-6 sm:p-8 space-y-8 divide-y divide-slate-100">
            {filteredAnswers.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <HelpCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-slate-700">No questions match the selected filter.</p>
                <button
                  onClick={() => setQuestionFilter('ALL')}
                  className="mt-3 px-4 py-1.5 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg hover:bg-blue-100 transition"
                >
                  View All Questions
                </button>
              </div>
            ) : (
              filteredAnswers.map((q) => {
                const isUnanswered = !q.isAttempted;
                const isCorrect = q.isCorrect;
                const hasOptions = Array.isArray(q.options) && q.options.length > 0;

                return (
                  <div 
                    key={q.questionId || q.questionNumber} 
                    id={`question-${q.questionNumber}`} 
                    className="pt-8 first:pt-0 scroll-mt-20"
                  >
                    {/* Question Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                          {q.questionNumber}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Question {q.questionNumber} of {answers.length}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Marks badge */}
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                          Score: <strong className={isCorrect ? 'text-emerald-700' : 'text-slate-800'}>{q.marksAwarded}</strong> / {q.marks} {q.marks === 1 ? 'Point' : 'Points'}
                        </span>

                        {/* Status Badge */}
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border shadow-2xs ${
                          isUnanswered
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : isCorrect
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}>
                          {isUnanswered ? (
                            <>Not Attempted</>
                          ) : isCorrect ? (
                            <><Check className="w-3.5 h-3.5 mr-1 text-emerald-600 stroke-[3]" /> Correct</>
                          ) : (
                            <><X className="w-3.5 h-3.5 mr-1 text-rose-600 stroke-[3]" /> Incorrect</>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed mb-6 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                      {q.questionText}
                    </div>

                    {/* Question Options Display */}
                    {hasOptions ? (
                      <div className="space-y-3 mb-6">
                        {q.options.map((opt: any, optIdx: number) => {
                          const optLetter = String.fromCharCode(65 + optIdx);
                          const optText = typeof opt === 'object' && opt !== null ? (opt.text ?? opt.value ?? opt.title ?? opt.id) : opt;
                          
                          const isSelectedByCandidate = isOptionSelectedByCandidate(opt, optIdx, q.candidateSelectedAnswer);
                          const isCorrectOption = isOptionCorrectAnswer(opt, optIdx, q.correctAnswer);

                          let cardClasses = 'bg-white border-slate-200 text-slate-700 hover:border-slate-300';
                          let circleClasses = 'bg-slate-100 text-slate-600 border-slate-300';
                          let radioColor = 'border-slate-300 text-slate-400';

                          if (isSelectedByCandidate && isCorrectOption) {
                            // Candidate chose correctly!
                            cardClasses = 'bg-emerald-50/80 border-emerald-500 text-emerald-950 font-semibold ring-2 ring-emerald-500/20 shadow-xs';
                            circleClasses = 'bg-emerald-600 text-white border-emerald-600 font-bold';
                            radioColor = 'border-emerald-600 bg-emerald-600 text-white';
                          } else if (isSelectedByCandidate && !isCorrectOption) {
                            // Candidate chose wrong!
                            cardClasses = 'bg-rose-50/80 border-rose-500 text-rose-950 font-semibold ring-2 ring-rose-500/20 shadow-xs';
                            circleClasses = 'bg-rose-600 text-white border-rose-600 font-bold';
                            radioColor = 'border-rose-600 bg-rose-600 text-white';
                          } else if (!isSelectedByCandidate && isCorrectOption) {
                            // Correct answer that candidate did not choose
                            cardClasses = 'bg-emerald-50/40 border-emerald-400 text-emerald-900 border-dashed ring-1 ring-emerald-400/30';
                            circleClasses = 'bg-emerald-100 text-emerald-800 border-emerald-400 font-bold';
                            radioColor = 'border-emerald-400';
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardClasses}`}
                            >
                              <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
                                {/* Option Letter Circle (A, B, C, D) */}
                                <span className={`w-6 h-6 rounded-full border text-xs flex items-center justify-center shrink-0 ${circleClasses}`}>
                                  {optLetter}
                                </span>

                                {/* Radio dot visual */}
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${radioColor}`}>
                                  {isSelectedByCandidate ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  ) : isCorrectOption ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  ) : null}
                                </div>

                                {/* Option Text */}
                                <span className="text-sm font-medium leading-relaxed">{optText}</span>
                              </div>

                              {/* Right Badge Badges */}
                              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                                {isSelectedByCandidate && (
                                  <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider shadow-2xs ${
                                    isCorrectOption
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-rose-600 text-white'
                                  }`}>
                                    {isCorrectOption ? (
                                      <><Check className="w-3.5 h-3.5 mr-1 stroke-[3]" /> Your Choice (Correct)</>
                                    ) : (
                                      <><X className="w-3.5 h-3.5 mr-1 stroke-[3]" /> Your Choice (Incorrect)</>
                                    )}
                                  </span>
                                )}

                                {!isSelectedByCandidate && isCorrectOption && (
                                  <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Correct Answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Non-MCQ Direct Answer View */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        <div className={`p-4 rounded-xl border ${
                          isCorrect ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
                        }`}>
                          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1">Your Submitted Answer</p>
                          <p className={`text-base font-bold ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                            {q.candidateSelectedAnswer !== null && q.candidateSelectedAnswer !== undefined
                              ? String(q.candidateSelectedAnswer)
                              : 'None (Unanswered)'}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-300">
                          <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 mb-1">Accepted Correct Answer</p>
                          <p className="text-base font-bold text-emerald-900">
                            {String(q.correctAnswer)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Official Verified Answers & Detailed Box */}
                    <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3 mb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                              Verified Correct Answer:
                            </span>
                            <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                              {(() => {
                                if (hasOptions) {
                                  const matchingOpts = q.options.filter((opt: any, idx: number) => isOptionCorrectAnswer(opt, idx, q.correctAnswer));
                                  if (matchingOpts.length > 0) {
                                    return matchingOpts.map((opt: any) => {
                                      const optIdx = q.options.indexOf(opt);
                                      const letter = String.fromCharCode(65 + optIdx);
                                      const text = typeof opt === 'object' ? (opt.text ?? opt.value ?? opt.id) : opt;
                                      return `${letter}) ${text}`;
                                    }).join(' , ');
                                  }
                                }
                                return String(q.correctAnswer);
                              })()}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                              Your Placed Option:
                            </span>
                            <span className={`text-sm font-black px-2.5 py-0.5 rounded-md border ${
                              isCorrect 
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                                : isUnanswered 
                                ? 'text-slate-500 bg-slate-100 border-slate-200' 
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}>
                              {q.candidateSelectedAnswer !== null && q.candidateSelectedAnswer !== undefined && q.candidateSelectedAnswer !== ''
                                ? String(q.candidateSelectedAnswer)
                                : 'Not Attempted'}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 font-semibold shrink-0">
                          Score Awarded: <strong className={isCorrect ? 'text-emerald-700' : 'text-slate-800'}>{q.marksAwarded}</strong> / {q.marks}
                        </div>
                      </div>

                      {/* Solution / Explanation if provided */}
                      {q.explanation ? (
                        <div className="mt-2 text-xs text-slate-700 leading-relaxed">
                          <div className="flex items-center space-x-1.5 font-bold text-slate-900 mb-1">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            <span>Detailed Solution & Explanation:</span>
                          </div>
                          <p className="text-slate-600 bg-white p-3 rounded-lg border border-slate-200/80">
                            {q.explanation}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
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
