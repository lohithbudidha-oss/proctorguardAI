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
  HelpCircle
} from 'lucide-react';
import api from '@/lib/api';

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
  const [selectedProofModal, setSelectedProofModal] = useState<{ image: string; type: string; time: string; desc?: string } | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="min-h-screen bg-[#0B0F19] text-slate-300 flex font-sans selection:bg-blue-500/30">
      {/* Sidebar */}
      <div className="w-64 bg-[#0f172a]/80 backdrop-blur-xl border-r border-slate-800 flex flex-col hidden md:flex shadow-2xl z-20 relative">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800/50">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">ProctorGuard AI</span>
        </div>

        <div className="p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Operations</p>
          
          {/* Active Navigation: Exam Candidates */}
          <div className="bg-blue-600/10 text-blue-400 px-4 py-3 rounded-xl font-semibold border border-blue-500/20 flex items-center transition-all shadow-[0_0_15px_rgba(37,99,235,0.1)]">
            <Users className="w-5 h-5 mr-3" /> Exam Candidates
          </div>

          <div 
            onClick={() => router.push('/admin/exams')} 
            className="text-slate-400 px-4 py-3 rounded-xl font-medium hover:bg-slate-800/50 hover:text-slate-200 cursor-pointer transition-all flex items-center"
          >
            <FileText className="w-5 h-5 mr-3" /> Exam Management
          </div>

          <div 
            onClick={() => router.push('/admin/violations')} 
            className="text-slate-400 px-4 py-3 rounded-xl font-medium hover:bg-slate-800/50 hover:text-slate-200 cursor-pointer transition-all flex items-center"
          >
            <AlertTriangle className="w-5 h-5 mr-3" /> Violation Queue
          </div>

          <div 
            onClick={() => router.push('/admin/reports')} 
            className="text-slate-400 px-4 py-3 rounded-xl font-medium hover:bg-slate-800/50 hover:text-slate-200 cursor-pointer transition-all flex items-center"
          >
            <CheckCircle2 className="w-5 h-5 mr-3" /> Integrity Reports
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <span className="text-sm font-bold text-slate-300">AD</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Admin User</p>
                <p className="text-xs text-slate-500">Security Officer</p>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" 
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background Ambient Lights */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Top Header */}
        <header className="bg-[#0f172a]/60 backdrop-blur-md border-b border-slate-800/60 p-5 px-8 z-10 sticky top-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center">
              <Users className="w-6 h-6 mr-3 text-blue-400" />
              Candidate Examination Records
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-medium">
              Performance overview and detailed information of candidates who wrote examinations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center text-xs font-bold text-blue-400 bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-500/20">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span> 
              Total Candidates: {totalCandidatesCount}
            </div>
            <div className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></span> 
              Exams Completed: {completedCandidatesCount}
            </div>
            <div className="flex items-center text-xs font-bold text-rose-400 bg-rose-500/10 px-3.5 py-1.5 rounded-full border border-rose-500/20">
              <span className="w-2 h-2 bg-rose-500 rounded-full mr-2"></span> 
              Flagged Violations: {flaggedCandidatesCount}
            </div>
          </div>
        </header>

        {/* Filter and Search Bar */}
        <div className="px-8 pt-6 pb-2 z-10 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search candidate name, email, exam..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131c31] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex items-center space-x-2 bg-[#131c31] p-1 rounded-xl border border-slate-800 text-xs font-semibold w-full sm:w-auto">
            <button 
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'ALL' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Candidates ({candidates.length})
            </button>
            <button 
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'COMPLETED' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Submitted / Written ({completedCandidatesCount})
            </button>
            <button 
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'IN_PROGRESS' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
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
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-semibold text-sm">Loading candidates exam info...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-28 flex flex-col items-center justify-center text-slate-500">
              <Users className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="text-xl font-bold text-slate-300">No Candidate Records Found</h3>
              <p className="text-sm mt-2 max-w-sm text-center">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No candidates match your current search and status filter.'
                  : 'Candidates who have taken or are taking exams will appear here with full exam info.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {filteredCandidates.map(cand => {
                const isCompleted = isCompletedStatus(cand.status);
                const isSelected = selectedCandidate?.id === cand.id;

                return (
                  <div 
                    key={cand.attemptId || cand.id} 
                    onClick={() => setSelectedCandidate(cand)}
                    className={`bg-[#131c31]/90 backdrop-blur-sm rounded-2xl border-2 cursor-pointer transition-all duration-300 p-6 flex flex-col justify-between group hover:-translate-y-1 ${
                      isSelected 
                        ? 'border-blue-500 shadow-[0_8px_30px_rgba(37,99,235,0.25)]' 
                        : cand.riskScore >= 60 
                          ? 'border-rose-900/50 hover:border-rose-500/50 hover:shadow-[0_8px_30px_rgba(239,68,68,0.15)]' 
                          : 'border-slate-800 hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgba(37,99,235,0.1)]'
                    }`}
                  >
                    {/* Top Row: Candidate Name & Status Badge */}
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${
                            isCompleted 
                              ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' 
                              : 'bg-amber-600/20 text-amber-400 border-amber-500/30'
                          }`}>
                            {cand.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-white text-lg group-hover:text-blue-400 transition-colors line-clamp-1">
                              {cand.name}
                            </h3>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              {cand.email || `ID: ${cand.id.substring(0, 10)}...`}
                            </p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                        }`}>
                          {cand.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Exam Title */}
                      <div className="bg-[#0f172a] rounded-xl p-3 border border-slate-800/80 mb-4 flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-200 line-clamp-1">{cand.examName}</span>
                      </div>

                      {/* Performance Metric Box */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Score / Result</span>
                          <div className="flex items-baseline mt-1 space-x-1">
                            <span className="text-lg font-black text-white">
                              {cand.percentage ? `${cand.percentage.toFixed(0)}%` : `${cand.score} Marks`}
                            </span>
                            {cand.resultStatus && (
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                cand.resultStatus === 'PASS' 
                                  ? 'bg-emerald-500/20 text-emerald-400' 
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}>
                                {cand.resultStatus}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Duration</span>
                          <span className="text-lg font-black text-white mt-1 block">
                            {formatSeconds(cand.timeTaken)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Violation Badges & Action */}
                    <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs">
                        <span className={`px-2.5 py-1 rounded-lg font-bold flex items-center border ${
                          cand.violations.length > 0 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                          {cand.violations.length} Flags
                        </span>

                        {cand.violations.some(v => v.screenshot || v.snapshotImage) && (
                          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-lg font-bold text-[10px] flex items-center">
                            <Camera className="w-3 h-3 mr-1" /> Proof
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 flex items-center">
                        View Exam Info <ChevronRight className="w-4 h-4 ml-1" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Side Slide-in: Detailed Candidate Exam Information Panel */}
      {selectedCandidate && (
        <>
          <div 
            className="fixed inset-0 bg-[#0f172a]/70 backdrop-blur-sm z-40 lg:hidden" 
            onClick={() => setSelectedCandidate(null)} 
          />
          <div className="fixed lg:relative right-0 top-0 bottom-0 w-full max-w-md bg-[#131c31]/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl flex flex-col z-50 transform transition-transform duration-300">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]/90">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-lg">
                  {selectedCandidate.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-extrabold text-lg text-white">{selectedCandidate.name}</h2>
                  <p className="text-xs text-slate-400 font-mono">{selectedCandidate.email || selectedCandidate.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCandidate(null)} 
                className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              
              {/* Exam Info Card */}
              <div className="bg-[#0f172a] rounded-2xl p-5 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Exam Details</span>
                  <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    isCompletedStatus(selectedCandidate.status)
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    {selectedCandidate.status.replace(/_/g, ' ')}
                  </span>
                </div>
                
                <h4 className="font-extrabold text-white text-base mb-3">{selectedCandidate.examName}</h4>
                
                <div className="space-y-2 text-xs text-slate-300">
                  {selectedCandidate.startedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" /> Started At:</span>
                      <span className="font-mono">{new Date(selectedCandidate.startedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedCandidate.submittedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex items-center"><CheckCircle className="w-3.5 h-3.5 mr-1" /> Submitted At:</span>
                      <span className="font-mono">{new Date(selectedCandidate.submittedAt).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> Time Taken:</span>
                    <span className="font-bold text-white">{formatSeconds(selectedCandidate.timeTaken)}</span>
                  </div>
                </div>
              </div>

              {/* Performance Scorecard */}
              <div className="bg-[#0f172a] rounded-2xl p-5 border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Performance Scorecard</span>
                  {selectedCandidate.resultStatus && (
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                      selectedCandidate.resultStatus === 'PASS' 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}>
                      {selectedCandidate.resultStatus}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Marks Obtained</span>
                    <div className="text-xl font-black text-white mt-0.5">
                      {selectedCandidate.score} <span className="text-xs text-slate-500 font-normal">/ {selectedCandidate.totalMarks || 100}</span>
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Percentage</span>
                    <div className="text-xl font-black text-blue-400 mt-0.5">
                      {selectedCandidate.percentage ? `${selectedCandidate.percentage.toFixed(1)}%` : 'N/A'}
                    </div>
                  </div>
                </div>

                {selectedCandidate.totalQuestions > 0 && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-3 border-t border-slate-800">
                    <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                      <span className="text-emerald-400 font-bold block text-sm">{selectedCandidate.correct}</span>
                      <span className="text-[10px] text-emerald-500/80 uppercase font-bold">Correct</span>
                    </div>
                    <div className="bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                      <span className="text-rose-400 font-bold block text-sm">{selectedCandidate.wrong}</span>
                      <span className="text-[10px] text-rose-500/80 uppercase font-bold">Wrong</span>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg border border-slate-700">
                      <span className="text-slate-300 font-bold block text-sm">{selectedCandidate.unanswered}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Skipped</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Integrity & Violations Proof */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-1.5 text-rose-500" />
                    Violation Proof & Telemetry ({selectedCandidate.violations.length})
                  </h3>
                  <button 
                    onClick={() => router.push('/admin/violations')}
                    className="text-xs font-bold text-rose-400 hover:text-rose-300 hover:underline"
                  >
                    View All in Queue &rarr;
                  </button>
                </div>

                {selectedCandidate.violations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 bg-[#0f172a] rounded-2xl border border-slate-800 border-dashed text-center p-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                    <p className="text-white text-xs font-bold">Nominal Integrity</p>
                    <p className="text-slate-500 text-[11px] mt-1">No violations or anomalies recorded during this examination.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCandidate.violations.map((v, i) => {
                      const proofImg = v.screenshot || v.snapshotImage;

                      return (
                        <div 
                          key={v.id || v._id || i} 
                          className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 flex flex-col space-y-2 hover:border-slate-700 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-extrabold flex items-center ${
                              v.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'
                            }`}>
                              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                              {v.type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {new Date(v.detectedAt || v.timestamp || new Date().toISOString()).toLocaleTimeString()}
                            </span>
                          </div>

                          {v.description && (
                            <p className="text-xs text-slate-400">{v.description}</p>
                          )}

                          {/* Screenshot Proof Preview */}
                          {proofImg && (
                            <div className="mt-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center">
                                <Camera className="w-3 h-3 mr-1 text-blue-400" /> Screenshot Proof:
                              </span>
                              <div 
                                onClick={() => setSelectedProofModal({
                                  image: proofImg,
                                  type: v.type,
                                  time: new Date(v.detectedAt || v.timestamp || new Date().toISOString()).toLocaleString(),
                                  desc: v.description
                                })}
                                className="relative rounded-lg overflow-hidden border border-slate-700 bg-black cursor-pointer group/img max-h-36 shadow-md"
                              >
                                <img src={proofImg} alt="Violation Proof" className="w-full h-auto object-cover" />
                                <div className="absolute inset-0 bg-black/40 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                  <span className="bg-rose-600/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow flex items-center">
                                    <Eye className="w-3 h-3 mr-1" /> Enlarge Proof
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
                <div className="bg-[#0f172a] rounded-2xl p-4 border border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">Admin Actions</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleApiCommand(selectedCandidate.attemptId, 'LOCK')}
                      className="flex items-center justify-center p-2.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition"
                    >
                      <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Console
                    </button>
                    <button 
                      onClick={() => handleApiCommand(selectedCandidate.attemptId, 'UNLOCK')}
                      className="flex items-center justify-center p-2.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition"
                    >
                      <Unlock className="w-3.5 h-3.5 mr-1.5" /> Unlock Console
                    </button>
                    <button 
                      onClick={() => handleApiCommand(selectedCandidate.attemptId, 'FORCE_SUBMIT')}
                      className="col-span-2 flex items-center justify-center p-2.5 bg-rose-600/20 text-rose-400 rounded-lg text-xs font-bold border border-rose-500/30 hover:bg-rose-600/30 transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Finalize & Submit Exam
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}

      {/* Proof Zoom Modal */}
      {selectedProofModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center">
                  <Camera className="w-4 h-4 mr-2 text-rose-500" />
                  Violation Screenshot Evidence
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedProofModal.type.replace(/_/g, ' ')} &bull; {selectedProofModal.time}
                </p>
              </div>
              <button 
                onClick={() => setSelectedProofModal(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-950/60 flex flex-col items-center">
              <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-black">
                <img src={selectedProofModal.image} alt="Enlarged Proof" className="w-full max-h-[460px] object-contain mx-auto" />
              </div>
              {selectedProofModal.desc && (
                <p className="text-xs text-slate-300 mt-4 text-center">
                  {selectedProofModal.desc}
                </p>
              )}
            </div>

            <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setSelectedProofModal(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
