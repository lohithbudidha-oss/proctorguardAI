'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import { 
  ShieldAlert, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  LogOut, 
  FileText, 
  Search, 
  Clock, 
  Award, 
  X, 
  Eye, 
  Camera, 
  ChevronRight,
  Sparkles,
  BookOpen,
  Calendar,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  HelpCircle,
  User,
  HardDrive,
  ExternalLink
} from 'lucide-react';
import api from '@/lib/api';
import { getViolationInfo } from '@/lib/violations';

interface ViolationSummary {
  id?: string;
  _id?: string;
  type: string;
  severity: string;
  detectedAt?: string;
  timestamp?: string;
  description?: string;
  screenshot?: string;
  snapshotImage?: string;
  actionTaken?: string;
}

interface CandidateExamRecord {
  id: string;
  attemptId: string;
  name: string;
  email?: string;
  examName: string;
  examId?: string;
  status: string;
  startedAt?: string;
  submittedAt?: string;
  score: number;
  totalMarks: number;
  percentage: number;
  resultStatus?: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  timeTaken: number;
  riskScore: number;
  violations: ViolationSummary[];
}

export default function CandidateExamRecordsPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateExamRecord[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateExamRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS'>('ALL');
  const [selectedProofModal, setSelectedProofModal] = useState<{
    image: string;
    type: string;
    time: string;
    desc?: string;
    candidateName?: string;
    candidateEmail?: string;
    examName?: string;
    severity?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const fetchCandidateRecords = () => {
    api.get('/admin/live').then(res => {
      const records: CandidateExamRecord[] = (res.data.candidates || []).map((cand: any) => ({
        id: cand.candidateId || cand.id,
        attemptId: cand.attemptId,
        name: cand.name || 'Candidate',
        email: cand.email || '',
        examName: cand.examName || cand.exam || 'Assessment',
        examId: cand.examId,
        status: cand.status || 'SUBMITTED',
        startedAt: cand.startedAt,
        submittedAt: cand.submittedAt,
        score: cand.score ?? 0,
        totalMarks: cand.totalMarks ?? 0,
        percentage: cand.percentage ?? 0,
        resultStatus: cand.resultStatus || (cand.percentage >= 50 ? 'PASS' : 'FAIL'),
        totalQuestions: cand.totalQuestions ?? 0,
        attempted: cand.attempted ?? 0,
        correct: cand.correct ?? 0,
        wrong: cand.wrong ?? 0,
        unanswered: cand.unanswered ?? 0,
        timeTaken: cand.timeTaken ?? 0,
        riskScore: cand.riskScore ?? 0,
        violations: (cand.violations || []).map((v: any) => {
          let img = v.screenshot || v.snapshotImage || v.image;
          if (!img && typeof window !== 'undefined') {
            try {
              const cached = JSON.parse(localStorage.getItem('pg_violation_evidence') || '[]');
              const match = cached.find((c: any) => c.attemptId === cand.attemptId && c.type === v.type) ||
                            cached.find((c: any) => c.type === v.type);
              if (match?.screenshot) img = match.screenshot;
            } catch(e) {}
          }
          return {
            ...v,
            screenshot: img,
            snapshotImage: img
          };
        })
      }));
      setCandidates(records);
      setLoading(false);
    }).catch(err => {
      console.error('Failed fetching candidate records', err);
      setLoading(false);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        router.replace('/login?role=admin');
      }
    });
  };

  useEffect(() => {
    fetchCandidateRecords();

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000');
    const initSocket = io(wsUrl, {
      auth: { token: typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
    });

    initSocket.on('violation:alert', (data) => {
      if (data?.candidateId && data?.violation) {
        setCandidates(prev => prev.map(c => {
          if (c.id === data.candidateId) {
            const newViolations = [data.violation, ...(c.violations || [])];
            return {
              ...c,
              violations: newViolations,
              riskScore: Math.min(100, c.riskScore + (data.violation.severity === 'CRITICAL' ? 40 : 20))
            };
          }
          return c;
        }));
      }
    });

    return () => {
      initSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedProofModal) {
          setSelectedProofModal(null);
        } else if (selectedCandidate) {
          setSelectedCandidate(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProofModal, selectedCandidate]);

  const handleApiCommand = async (attemptId: string, action: string) => {
    if (!attemptId) return;
    try {
      if (action === 'LOCK') await api.post(`/admin/live/${attemptId}/lock`);
      if (action === 'UNLOCK') await api.post(`/admin/live/${attemptId}/unlock`);
      if (action === 'FORCE_SUBMIT') await api.post(`/admin/live/${attemptId}/force-submit`);
      alert(`Action ${action} executed successfully`);
      fetchCandidateRecords();
    } catch (err) {
      console.error(err);
      alert('Failed to execute command');
    }
  };

  const isCompletedStatus = (status: string) => {
    return ['SUBMITTED', 'COMPLETED', 'AUTO_SUBMITTED', 'FORCE_SUBMITTED'].includes(status);
  };

  const filteredCandidates = candidates.filter(c => {
    const query = searchQuery.toLowerCase();
    const matchesQuery = 
      c.name.toLowerCase().includes(query) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      c.examName.toLowerCase().includes(query);

    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'COMPLETED' && isCompletedStatus(c.status)) ||
      (statusFilter === 'IN_PROGRESS' && !isCompletedStatus(c.status));

    return matchesQuery && matchesStatus;
  });

  const totalCandidatesCount = candidates.length;
  const completedCandidatesCount = candidates.filter(c => isCompletedStatus(c.status)).length;
  const flaggedCandidatesCount = candidates.filter(c => c.violations && c.violations.length > 0).length;

  const formatSeconds = (secs: number) => {
    if (!secs || secs <= 0) return 'N/A';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans selection:bg-blue-500/20">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex shadow-sm z-20 relative">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-100">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-md shadow-blue-500/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold text-slate-900 tracking-tight">ProctorGuard AI</span>
        </div>

        <div className="p-4 space-y-1.5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">Operations</p>
          
          {/* Active Navigation: Exam Candidates */}
          <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-xl font-semibold border border-blue-200 flex items-center transition-all shadow-sm">
            <Users className="w-5 h-5 mr-3 text-blue-600" /> Exam Candidates
          </div>

          <div 
            onClick={() => router.push('/admin/exams')} 
            className="text-slate-600 px-4 py-3 rounded-xl font-medium hover:bg-slate-100 hover:text-slate-900 cursor-pointer transition-all flex items-center"
          >
            <FileText className="w-5 h-5 mr-3 text-slate-400" /> Exam Management
          </div>

          <div 
            onClick={() => router.push('/admin/violations')} 
            className="text-slate-600 px-4 py-3 rounded-xl font-medium hover:bg-slate-100 hover:text-slate-900 cursor-pointer transition-all flex items-center"
          >
            <AlertTriangle className="w-5 h-5 mr-3 text-slate-400" /> Violation Queue
          </div>

          <div 
            onClick={() => router.push('/admin/reports')} 
            className="text-slate-600 px-4 py-3 rounded-xl font-medium hover:bg-slate-100 hover:text-slate-900 cursor-pointer transition-all flex items-center"
          >
            <CheckCircle2 className="w-5 h-5 mr-3 text-slate-400" /> Integrity Reports
          </div>
        </div>

        <div className="mt-auto p-5 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                <span className="text-xs font-bold text-slate-700">AD</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Admin User</p>
                <p className="text-xs text-slate-500">Security Officer</p>
              </div>
            </div>
            <button 
              onClick={() => setShowLogoutConfirm(true)} 
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" 
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Soft Background Accents */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-100/40 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/30 blur-[120px] rounded-full pointer-events-none" />

        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 p-5 px-8 z-10 sticky top-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center">
              <Users className="w-6 h-6 mr-3 text-blue-600" />
              Candidate Examination Records
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Performance overview and detailed information of candidates who wrote examinations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center text-xs font-bold text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span> 
              Total Candidates: {totalCandidatesCount}
            </div>
            <div className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span> 
              Exams Completed: {completedCandidatesCount}
            </div>
            <div className="flex items-center text-xs font-bold text-rose-700 bg-rose-50 px-3.5 py-1.5 rounded-full border border-rose-200">
              <span className="w-2 h-2 bg-rose-500 rounded-full mr-2"></span> 
              Flagged Violations: {flaggedCandidatesCount}
            </div>
          </div>
        </header>

        {/* Filter and Search Bar */}
        <div className="px-8 pt-6 pb-2 z-10 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidate name, email, exam..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
            />
          </div>

          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold shadow-sm w-full sm:w-auto">
            <button 
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'ALL' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              All Candidates ({candidates.length})
            </button>
            <button 
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'COMPLETED' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Submitted / Written ({completedCandidatesCount})
            </button>
            <button 
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'IN_PROGRESS' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              In Progress ({candidates.length - completedCandidatesCount})
            </button>
          </div>
        </div>

        {/* Candidate Exam Info Cards Grid */}
        <main className="flex-1 p-8 overflow-y-auto z-10 custom-scrollbar">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-semibold text-sm text-slate-600">Loading candidates exam info...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-28 flex flex-col items-center justify-center text-slate-400">
              <Users className="w-16 h-16 mb-4 opacity-30 text-slate-400" />
              <h3 className="text-xl font-bold text-slate-700">No Candidate Records Found</h3>
              <p className="text-sm mt-2 max-w-sm text-center text-slate-500">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No candidates match your current search and status filter.'
                  : 'Candidates who have taken or are taking exams will appear here with full exam info.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredCandidates.map(cand => {
                const isCompleted = isCompletedStatus(cand.status);
                const isSelected = selectedCandidate?.id === cand.id;

                return (
                  <div 
                    key={cand.attemptId || cand.id} 
                    onClick={() => setSelectedCandidate(isSelected ? null : cand)}
                    className={`bg-white rounded-2xl border-2 cursor-pointer transition-all duration-300 p-5 flex flex-col justify-between group hover:-translate-y-1 ${
                      isSelected 
                        ? 'border-blue-600 shadow-xl ring-4 ring-blue-500/15 bg-blue-50/20' 
                        : cand.riskScore >= 60 
                          ? 'border-rose-200 hover:border-rose-400 shadow-sm hover:shadow-md' 
                          : 'border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* Top Row: Candidate Name & Status Badge */}
                    <div>
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border shrink-0 ${
                            isCompleted 
                              ? 'bg-blue-50 text-blue-600 border-blue-200' 
                              : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>
                            {cand.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-blue-600 transition-colors truncate">
                              {cand.name}
                            </h3>
                            <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                              {cand.email || `ID: ${cand.id.substring(0, 10)}...`}
                            </p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                        }`}>
                          {cand.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Exam Title */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 mb-4 flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 line-clamp-1">{cand.examName}</span>
                      </div>

                      {/* Performance Metric Box */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Score / Result</span>
                          <div className="flex items-baseline mt-1 space-x-1.5">
                            <span className="text-lg font-black text-slate-900">
                              {cand.percentage !== undefined && cand.percentage > 0 ? `${cand.percentage.toFixed(0)}%` : `${cand.score} Marks`}
                            </span>
                            {cand.resultStatus && (
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                cand.resultStatus === 'PASS' 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}>
                                {cand.resultStatus}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Duration</span>
                          <span className="text-lg font-black text-slate-900 mt-1 block">
                            {formatSeconds(cand.timeTaken)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Violation Badges & View Exam Info Action */}
                    <div className="pt-3.5 border-t border-slate-100 flex flex-col gap-2.5">
                      {/* Flags & Proof Badges Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className={`px-2.5 py-1 rounded-lg font-extrabold text-xs flex items-center shrink-0 border ${
                            cand.violations.length > 0 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
                            <span className="whitespace-nowrap">{cand.violations.length} Flags</span>
                          </span>

                          {cand.violations.some(v => v.screenshot || v.snapshotImage) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const vWithProof = cand.violations.find(v => v.screenshot || v.snapshotImage);
                                if (vWithProof) {
                                  setSelectedProofModal({
                                    image: vWithProof.screenshot || vWithProof.snapshotImage || '',
                                    type: vWithProof.type,
                                    time: vWithProof.timestamp || vWithProof.detectedAt || new Date().toISOString(),
                                    desc: vWithProof.description,
                                    candidateName: cand.name,
                                    candidateEmail: cand.email,
                                    examName: cand.examName,
                                    severity: vWithProof.severity
                                  });
                                }
                              }}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg font-bold text-xs flex items-center shrink-0 transition shadow-2xs whitespace-nowrap cursor-pointer hover:border-indigo-300"
                              title="Click to view violation proof screenshot and incident details"
                            >
                              <Camera className="w-3.5 h-3.5 mr-1 shrink-0 text-indigo-600" />
                              <span>Proof</span>
                            </button>
                          )}
                        </div>

                        {/* Integrity Status Pill */}
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border shrink-0 whitespace-nowrap ${
                          cand.riskScore >= 60
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : cand.riskScore > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {cand.riskScore > 0 ? `${cand.riskScore}% Risk` : 'Clean'}
                        </span>
                      </div>

                      {/* View Exam Info Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCandidate(isSelected ? null : cand);
                        }}
                        className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center transition-all border shadow-2xs whitespace-nowrap group/btn ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/20'
                            : 'bg-blue-50/80 hover:bg-blue-600 text-blue-700 hover:text-white border-blue-200 hover:border-blue-600'
                        }`}
                      >
                        <span className="whitespace-nowrap">{isSelected ? 'Viewing Exam Info' : 'View Exam Info'}</span>
                        <ChevronRight className={`w-3.5 h-3.5 ml-1.5 shrink-0 transition-transform ${isSelected ? 'translate-x-1' : 'group-hover/btn:translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Detailed Candidate Exam Information Slide-Over Drawer */}
      {selectedCandidate && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-200" 
            onClick={() => setSelectedCandidate(null)} 
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md sm:max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/90 sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center font-black text-blue-600 text-lg shadow-2xs shrink-0">
                  {selectedCandidate.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-lg text-slate-900 truncate">{selectedCandidate.name}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider shrink-0">
                      Exam Profile
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{selectedCandidate.email || selectedCandidate.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCandidate(null)} 
                className="text-slate-400 hover:text-slate-700 transition-colors p-2.5 hover:bg-slate-200/60 rounded-xl shrink-0"
                title="Close Panel (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              
              {/* Exam Info Card */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Exam Details</span>
                  <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    isCompletedStatus(selectedCandidate.status)
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedCandidate.status.replace(/_/g, ' ')}
                  </span>
                </div>
                
                <h4 className="font-extrabold text-slate-900 text-base mb-3">{selectedCandidate.examName}</h4>
                
                <div className="space-y-2 text-xs text-slate-600">
                  {selectedCandidate.startedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex items-center"><Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> Started At:</span>
                      <span className="font-mono text-slate-800">{new Date(selectedCandidate.startedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedCandidate.submittedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex items-center"><CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Submitted At:</span>
                      <span className="font-mono text-slate-800">{new Date(selectedCandidate.submittedAt).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 flex items-center"><Clock className="w-3.5 h-3.5 mr-1 text-blue-500" /> Time Taken:</span>
                    <span className="font-bold text-slate-900">{formatSeconds(selectedCandidate.timeTaken)}</span>
                  </div>
                </div>
              </div>

              {/* Performance Scorecard */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Performance Scorecard</span>
                  {selectedCandidate.resultStatus && (
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                      selectedCandidate.resultStatus === 'PASS' 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                        : 'bg-rose-100 text-rose-800 border-rose-200'
                    }`}>
                      {selectedCandidate.resultStatus}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Marks Obtained</span>
                    <div className="text-xl font-black text-slate-900 mt-0.5">
                      {selectedCandidate.score} <span className="text-xs text-slate-400 font-normal">/ {selectedCandidate.totalMarks || 100}</span>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Percentage</span>
                    <div className="text-xl font-black text-blue-600 mt-0.5">
                      {selectedCandidate.percentage !== undefined ? `${selectedCandidate.percentage.toFixed(1)}%` : 'N/A'}
                    </div>
                  </div>
                </div>

                {selectedCandidate.totalQuestions > 0 && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-3 border-t border-slate-200">
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      <span className="text-emerald-700 font-bold block text-sm">{selectedCandidate.correct}</span>
                      <span className="text-[10px] text-emerald-600 uppercase font-bold">Correct</span>
                    </div>
                    <div className="bg-rose-50 p-2 rounded-lg border border-rose-200">
                      <span className="text-rose-700 font-bold block text-sm">{selectedCandidate.wrong}</span>
                      <span className="text-[10px] text-rose-600 uppercase font-bold">Wrong</span>
                    </div>
                    <div className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-700 font-bold block text-sm">{selectedCandidate.unanswered}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Skipped</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Integrity & Violations Proof */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-1.5 text-rose-600" />
                    Violation Proof & Telemetry ({selectedCandidate.violations.length})
                  </h3>
                  <button 
                    onClick={() => router.push('/admin/violations')}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    View All in Queue &rarr;
                  </button>
                </div>

                {selectedCandidate.violations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-2xl border border-slate-200 border-dashed text-center p-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                    <p className="text-slate-900 text-xs font-bold">Nominal Integrity</p>
                    <p className="text-slate-500 text-[11px] mt-1">No violations or anomalies recorded during this examination.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCandidate.violations.map((v, i) => {
                      const proofImg = v.screenshot || v.snapshotImage;
                      const vInfo = getViolationInfo(v.type, v.description);

                      return (
                        <div 
                          key={v.id || v._id || i} 
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col space-y-2.5 hover:border-slate-300 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-extrabold flex items-center ${
                              v.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'
                            }`}>
                              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                              {vInfo.title}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {new Date(v.detectedAt || v.timestamp || new Date().toISOString()).toLocaleTimeString()}
                            </span>
                          </div>

                          {/* Incident Description: What candidate did during the exam */}
                          <div className="bg-rose-50/70 p-2.5 rounded-lg border border-rose-200/80 text-xs">
                            <span className="text-[10px] font-extrabold uppercase text-rose-700 block mb-0.5">
                              Candidate Action During Exam:
                            </span>
                            <p className="text-slate-800 font-medium text-xs leading-relaxed">
                              {vInfo.actionDone}
                            </p>
                            {v.description && v.description !== vInfo.actionDone && (
                              <p className="text-slate-500 font-mono text-[11px] mt-1.5 pt-1 border-t border-rose-200/50">
                                Log: {v.description}
                              </p>
                            )}
                          </div>

                          {/* Screenshot Proof Preview */}
                          {proofImg && (
                            <div className="mt-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center">
                                <Camera className="w-3 h-3 mr-1 text-blue-600" /> Screenshot Proof Evidence:
                              </span>
                              <div 
                                onClick={() => setSelectedProofModal({
                                  image: proofImg,
                                  type: v.type,
                                  time: new Date(v.detectedAt || v.timestamp || new Date().toISOString()).toLocaleString(),
                                  desc: v.description,
                                  candidateName: selectedCandidate.name,
                                  candidateEmail: selectedCandidate.email,
                                  examName: selectedCandidate.examName,
                                  severity: v.severity
                                })}
                                className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer group/img max-h-36 shadow-xs"
                              >
                                <img src={proofImg} alt="Violation Proof" className="w-full h-auto object-cover" />
                                <div className="absolute inset-0 bg-slate-900/20 group-hover/img:bg-slate-900/40 transition-colors flex items-center justify-center">
                                  <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow flex items-center">
                                    <Eye className="w-3 h-3 mr-1" /> Enlarge Proof & Details
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Exam Actions for In-Progress sessions */}
              {!isCompletedStatus(selectedCandidate.status) && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-3">Admin Actions</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleApiCommand(selectedCandidate.attemptId, 'LOCK')}
                      className="flex items-center justify-center p-2.5 bg-white text-slate-700 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-100 transition shadow-xs"
                    >
                      <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Lock Console
                    </button>
                    <button 
                      onClick={() => handleApiCommand(selectedCandidate.attemptId, 'UNLOCK')}
                      className="flex items-center justify-center p-2.5 bg-white text-slate-700 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-100 transition shadow-xs"
                    >
                      <Unlock className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Unlock Console
                    </button>
                    <button 
                      onClick={() => handleApiCommand(selectedCandidate.attemptId, 'FORCE_SUBMIT')}
                      className="col-span-2 flex items-center justify-center p-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 hover:bg-rose-100 transition shadow-xs"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-600" /> Finalize & Submit Exam
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}

      {/* Proof Zoom Modal */}
      {selectedProofModal && (() => {
        const info = getViolationInfo(selectedProofModal.type, selectedProofModal.desc);
        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col custom-scrollbar">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-xl ${
                    selectedProofModal.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center">
                      Violation Screenshot Evidence
                      {selectedProofModal.severity && (
                        <span className={`ml-2.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          selectedProofModal.severity === 'CRITICAL' 
                            ? 'bg-rose-100 text-rose-700 border-rose-200' 
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {selectedProofModal.severity}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {info.title} &bull; {selectedProofModal.time}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProofModal(null)}
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Along With Incident Description */}
              <div className="p-6 bg-slate-50/50 flex flex-col space-y-4">
                <div className="w-full relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-inner">
                  <img 
                    src={selectedProofModal.image} 
                    alt="Violation Evidence" 
                    className="w-full max-h-[440px] object-contain mx-auto" 
                  />
                  <div className="absolute top-3 left-3 bg-rose-600/90 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-md shadow-lg uppercase tracking-wider flex items-center">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                    Surveillance Snapshot
                  </div>
                </div>

                {/* Violation Description & Candidate Action Callout (Directly along with image) */}
                <div className="w-full bg-rose-50/80 border border-rose-200 rounded-2xl p-4.5 shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center">
                          Candidate Violation: {info.title}
                        </span>
                        <span className="text-[11px] font-bold text-slate-600 font-mono bg-white px-2.5 py-0.5 rounded-full border border-rose-200">
                          {info.categoryLabel}
                        </span>
                      </div>

                      {/* Explicit description of what violation was done by candidate during exam */}
                      <div className="bg-white rounded-xl p-3.5 border border-rose-200/90 shadow-2xs mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 block mb-1">
                          What Candidate Did During Exam:
                        </span>
                        <p className="text-xs font-bold text-slate-900 leading-relaxed">
                          {info.actionDone}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="bg-white/80 p-2.5 rounded-lg border border-rose-100">
                          <span className="font-extrabold text-slate-500 block text-[10px] uppercase">Examination Rule Breached:</span>
                          <span className="text-slate-800 font-medium">{info.ruleBreached}</span>
                        </div>
                        {selectedProofModal.desc && (
                          <div className="bg-white/80 p-2.5 rounded-lg border border-rose-100">
                            <span className="font-extrabold text-slate-500 block text-[10px] uppercase">Telemetry Event Log:</span>
                            <span className="text-slate-800 font-medium font-mono">{selectedProofModal.desc}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Candidate & Exam Metadata Grid */}
                {(selectedProofModal.candidateName || selectedProofModal.examName) && (
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    {selectedProofModal.candidateName && (
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-500 block font-semibold text-[11px]">Candidate:</span>
                          <span className="text-slate-900 font-extrabold">{selectedProofModal.candidateName}</span>
                          {selectedProofModal.candidateEmail && (
                            <span className="text-slate-400 ml-1.5 font-mono text-[11px]">({selectedProofModal.candidateEmail})</span>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedProofModal.examName && (
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-500 block font-semibold text-[11px]">Exam:</span>
                          <span className="text-slate-900 font-extrabold">{selectedProofModal.examName}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between sticky bottom-0">
                <a
                  href="https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  <HardDrive className="w-3.5 h-3.5 mr-1.5" />
                  View Drive Archive
                  <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                </a>
                <button 
                  onClick={() => setSelectedProofModal(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200 shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Admin Sign Out Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 transform transition-all animate-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <LogOut className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900">Sign Out of Admin Portal?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Are you sure you want to sign out? Your proctor session and real-time candidate monitoring feed will be closed until you log in again.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 transition-all flex items-center cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
