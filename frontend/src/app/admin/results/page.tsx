'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  BarChart3, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Award, 
  Calendar, 
  User, 
  FileText, 
  ExternalLink, 
  ShieldAlert, 
  HardDrive, 
  Check, 
  X, 
  Eye, 
  RefreshCw, 
  Users,
  LogOut,
  ChevronRight,
  Sparkles,
  Download
} from 'lucide-react';
import api from '@/lib/api';

interface ExamResult {
  _id: string;
  attemptId?: {
    _id: string;
    startedAt?: string;
    submittedAt?: string;
    status?: string;
    attemptNumber?: number;
    durationSeconds?: number;
  };
  candidateId?: {
    _id: string;
    name: string;
    email: string;
    status?: string;
  };
  examId?: {
    _id: string;
    title: string;
    duration?: number;
    passingPercentage?: number;
    passMark?: number;
  };
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  pass: boolean;
  timeTaken: number;
  riskScore: number;
  violations: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  driveReportUrl?: string;
  driveFolderUrl?: string;
  createdAt: string;
}

export default function AdminResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'FAIL' | 'APPROVED' | 'PENDING' | 'FLAGGED'>('ALL');
  const [selectedResultModal, setSelectedResultModal] = useState<ExamResult | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<{ name?: string; email?: string } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    fetchResults();
    try {
      const u = localStorage.getItem('user');
      if (u) setAdminProfile(JSON.parse(u));
    } catch (e) {}
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/results');
      setResults(res.data.results || []);
    } catch (err) {
      console.error('Failed to fetch exam results', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyStatus = async (id: string, newStatus: 'APPROVED' | 'REJECTED') => {
    setUpdatingId(id);
    try {
      await api.patch(`/admin/results/${id}/verify`, { status: newStatus });
      setResults(prev => prev.map(r => r._id === id ? { ...r, status: newStatus } : r));
      if (selectedResultModal && selectedResultModal._id === id) {
        setSelectedResultModal(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update result verification status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login?role=admin');
  };

  // Distinct exams available in results
  const uniqueExams = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    results.forEach(r => {
      const exId = r.examId?._id || 'unassigned';
      const exTitle = r.examId?.title || 'General Assessment';
      if (!map.has(exId)) {
        map.set(exId, { id: exId, title: exTitle, count: 0 });
      }
      map.get(exId)!.count += 1;
    });
    return Array.from(map.values());
  }, [results]);

  // Filtered results calculation
  const filteredResults = useMemo(() => {
    const rawQuery = searchQuery.trim().toLowerCase();
    const tokens = rawQuery.split(/\s+/).filter(Boolean);

    return results.filter(r => {
      // 1. Exam filter
      if (selectedExamFilter !== 'ALL') {
        const exId = r.examId?._id || 'unassigned';
        if (exId !== selectedExamFilter) return false;
      }

      // 2. Status filter
      if (statusFilter === 'PASS' && !r.pass) return false;
      if (statusFilter === 'FAIL' && r.pass) return false;
      if (statusFilter === 'APPROVED' && r.status !== 'APPROVED') return false;
      if (statusFilter === 'PENDING' && r.status !== 'PENDING') return false;
      if (statusFilter === 'FLAGGED' && (r.violations === 0 && r.riskScore === 0)) return false;

      // 3. Search query
      if (tokens.length === 0) return true;

      const blob = [
        r.candidateId?.name || '',
        r.candidateId?.email || '',
        r.examId?.title || '',
        r.pass ? 'pass passed' : 'fail failed',
        r.status || '',
        `${Math.round(r.percentage)}%`,
        `${r.obtainedMarks} marks`,
        r.violations > 0 ? `${r.violations} violations flagged` : 'clean',
        r.attemptId?.status || ''
      ].join(' ').toLowerCase();

      return tokens.every(t => blob.includes(t));
    });
  }, [results, selectedExamFilter, statusFilter, searchQuery]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const approved = results.filter(r => r.status === 'APPROVED').length;
    const flagged = results.filter(r => r.violations > 0 || r.riskScore > 0).length;
    const avgPercentage = total > 0 ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / total) : 0;

    return { total, passed, approved, flagged, avgPercentage };
  }, [results]);

  const formatSeconds = (secs: number) => {
    if (!secs || secs <= 0) return '0m 0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'N/A';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-500/20">
      {/* Top Bar Header */}
      <header className="bg-white/80 border-b border-slate-200/80 backdrop-blur-md px-8 py-5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <Link 
            href="/admin/monitoring" 
            className="flex items-center text-sm font-bold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Candidates
          </Link>
          <Link 
            href="/admin/exams" 
            className="flex items-center text-sm font-bold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <FileText className="w-4 h-4 mr-1.5 text-slate-400" /> Exams
          </Link>
          <Link 
            href="/admin/violations" 
            className="flex items-center text-sm font-bold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ShieldAlert className="w-4 h-4 mr-1.5 text-rose-500" /> Violations
          </Link>
          <div className="h-5 w-[1px] bg-slate-200" />
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Candidate Results & Scores</h1>
              <p className="text-xs text-slate-500 font-medium">Exam-wise performance, grade verification & violation links</p>
            </div>
          </div>
        </div>

        {/* Admin Profile & Sign Out */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
              {adminProfile?.name ? adminProfile.name.substring(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">{adminProfile?.name || 'Administrator'}</p>
              <p className="text-[11px] text-slate-500 font-medium">{adminProfile?.email || 'admin@proctorguard.local'}</p>
            </div>
          </div>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-rose-200 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Submissions</p>
            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
            <span className="text-[11px] text-slate-400 font-medium">Evaluated attempts</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Passed Candidates</p>
            <p className="text-2xl font-black text-emerald-600">{stats.passed}</p>
            <span className="text-[11px] text-slate-400 font-medium">
              {stats.total > 0 ? `${Math.round((stats.passed / stats.total) * 100)}% pass rate` : '0%'}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Average Score</p>
            <p className="text-2xl font-black text-blue-600">{stats.avgPercentage}%</p>
            <span className="text-[11px] text-slate-400 font-medium">Across all exams</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Approved Results</p>
            <p className="text-2xl font-black text-indigo-600">{stats.approved}</p>
            <span className="text-[11px] text-slate-400 font-medium">Verified by admin</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Flagged Violations</p>
            <p className="text-2xl font-black text-rose-600">{stats.flagged}</p>
            <span className="text-[11px] text-slate-400 font-medium">Infractions captured</span>
          </div>
        </div>

        {/* Exam Tabs / Selector */}
        <div className="mb-6 flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-200">
          <button
            onClick={() => setSelectedExamFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedExamFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Exams ({results.length})
          </button>
          {uniqueExams.map(ex => (
            <button
              key={ex.id}
              onClick={() => setSelectedExamFilter(ex.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedExamFilter === ex.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {ex.title} ({ex.count})
            </button>
          ))}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidate name, email, exam title..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-9 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto">
            {(['ALL', 'PASS', 'FAIL', 'APPROVED', 'PENDING', 'FLAGGED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab === 'ALL' ? 'All Status' : tab}
              </button>
            ))}

            <button
              onClick={fetchResults}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ml-1"
              title="Refresh results"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-slate-400 text-xs font-bold tracking-wider uppercase">Loading Examination Results...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <BarChart3 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Examination Results Found</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'ALL' || selectedExamFilter !== 'ALL'
                  ? 'No results match your active search or filter criteria. Try resetting filters.'
                  : 'Candidate exam attempts will automatically be evaluated and listed here once submitted.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-6 align-middle text-left">Candidate</th>
                    <th className="py-3.5 px-4 align-middle text-left">Exam Assessment</th>
                    <th className="py-3.5 px-4 align-middle text-center">Score & Percentage</th>
                    <th className="py-3.5 px-4 align-middle text-center">Status</th>
                    <th className="py-3.5 px-4 align-middle text-center">Violations</th>
                    <th className="py-3.5 px-4 align-middle text-center">Attempt Info</th>
                    <th className="py-3.5 px-6 align-middle text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredResults.map(res => (
                    <tr key={res._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Candidate Column */}
                      <td className="py-4 px-6 align-middle text-left">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200 shrink-0">
                            {res.candidateId?.name ? res.candidateId.name.substring(0, 2).toUpperCase() : 'CA'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{res.candidateId?.name || 'Candidate'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{res.candidateId?.email || 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Exam Column */}
                      <td className="py-4 px-4 align-middle text-left">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg shrink-0">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-xs">{res.examId?.title || 'Examination Assessment'}</p>
                            {res.examId?.duration && (
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center">
                                <Clock className="w-3 h-3 mr-1 text-slate-400" /> {res.examId.duration} mins allocation
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Score & Percentage */}
                      <td className="py-4 px-4 align-middle text-center">
                        <div className="inline-flex flex-col items-center justify-center">
                          <span className={`text-base font-black ${res.pass ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {Math.round(res.percentage)}%
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">
                            {res.obtainedMarks} / {res.totalMarks} marks
                          </span>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${res.pass ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, res.percentage))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-4 px-4 align-middle text-center">
                        <div className="inline-flex flex-col items-center justify-center space-y-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            res.pass 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {res.pass ? 'PASS' : 'FAIL'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            res.status === 'APPROVED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : res.status === 'REJECTED'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {res.status}
                          </span>
                        </div>
                      </td>

                      {/* Violations Column */}
                      <td className="py-4 px-4 align-middle text-center">
                        <div className="inline-flex items-center justify-center">
                          {res.violations > 0 ? (
                            <Link
                              href={`/admin/violations?candidateId=${res.candidateId?._id || ''}&examId=${res.examId?._id || ''}`}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer group"
                              title="Click to view full violation queue for this exam attempt"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                              <span>{res.violations} Flagged</span>
                              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Clean (0)</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Attempt Info Column */}
                      <td className="py-4 px-4 align-middle text-center text-xs text-slate-500">
                        <div className="inline-flex flex-col items-center justify-center space-y-0.5">
                          <p className="font-semibold text-slate-700 flex items-center justify-center">
                            <Clock className="w-3 h-3 mr-1 text-slate-400" /> {formatSeconds(res.timeTaken)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {formatDate(res.attemptId?.submittedAt || res.createdAt)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {res.attempted}/{res.totalQuestions} answered ({res.correct} correct)
                          </p>
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-4 px-6 align-middle text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setSelectedResultModal(res)}
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 hover:border-blue-200 cursor-pointer"
                            title="View Full Performance Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <Link
                            href={`/admin/violations?candidateId=${res.candidateId?._id || ''}&examId=${res.examId?._id || ''}`}
                            className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 hover:border-rose-200 cursor-pointer"
                            title="Open Violations in Queue"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </Link>

                          {res.status !== 'APPROVED' && (
                            <button
                              onClick={() => handleVerifyStatus(res._id, 'APPROVED')}
                              disabled={updatingId === res._id}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center disabled:opacity-50"
                              title="Approve this exam result"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Approve
                            </button>
                          )}

                          {res.status !== 'REJECTED' && (
                            <button
                              onClick={() => handleVerifyStatus(res._id, 'REJECTED')}
                              disabled={updatingId === res._id}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-lg text-xs font-bold transition-colors border border-slate-200 hover:border-rose-200 cursor-pointer flex items-center disabled:opacity-50"
                              title="Reject / Disqualify this exam result"
                            >
                              <X className="w-3.5 h-3.5 mr-1" /> Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Candidate Performance Details Modal */}
      {selectedResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${selectedResultModal.pass ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Candidate Result Performance Record
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedResultModal.examId?.title || 'Examination'} &bull; {selectedResultModal.candidateId?.name || 'Candidate'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedResultModal(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              {/* Score Highlight Header */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Final Result</p>
                  <div className="flex items-baseline space-x-3">
                    <span className="text-4xl font-black">{Math.round(selectedResultModal.percentage)}%</span>
                    <span className="text-slate-300 font-bold">
                      {selectedResultModal.obtainedMarks} / {selectedResultModal.totalMarks} Marks
                    </span>
                  </div>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    selectedResultModal.pass ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                  }`}>
                    {selectedResultModal.pass ? 'Qualified / PASS' : 'Disqualified / FAIL'}
                  </span>
                </div>
                <div className="text-right space-y-1 text-xs text-slate-300">
                  <p><span className="text-slate-400">Total Questions:</span> {selectedResultModal.totalQuestions}</p>
                  <p><span className="text-slate-400">Time Taken:</span> {formatSeconds(selectedResultModal.timeTaken)}</p>
                  <p><span className="text-slate-400">Review Status:</span> <span className="font-bold text-white">{selectedResultModal.status}</span></p>
                </div>
              </div>

              {/* Question Metrics Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Question Metrics Breakdown</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
                    <p className="text-xs text-slate-500 font-medium">Attempted</p>
                    <p className="text-xl font-bold text-slate-800 mt-0.5">{selectedResultModal.attempted}</p>
                  </div>
                  <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 text-center">
                    <p className="text-xs text-emerald-700 font-medium">Correct</p>
                    <p className="text-xl font-bold text-emerald-700 mt-0.5">{selectedResultModal.correct}</p>
                  </div>
                  <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-100 text-center">
                    <p className="text-xs text-rose-700 font-medium">Wrong</p>
                    <p className="text-xl font-bold text-rose-700 mt-0.5">{selectedResultModal.wrong}</p>
                  </div>
                  <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-100 text-center">
                    <p className="text-xs text-amber-700 font-medium">Unanswered</p>
                    <p className="text-xl font-bold text-amber-700 mt-0.5">{selectedResultModal.unanswered}</p>
                  </div>
                </div>
              </div>

              {/* Proctoring & Integrity Telemetry */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-slate-600" />
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Proctor Integrity Status</span>
                  </div>
                  <Link
                    href={`/admin/violations?candidateId=${selectedResultModal.candidateId?._id || ''}&examId=${selectedResultModal.examId?._id || ''}`}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    View in Violation Queue <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Violations Captured:</span>
                    <span className={`ml-2 font-bold ${selectedResultModal.violations > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {selectedResultModal.violations} Infractions
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Risk Assessment:</span>
                    <span className={`ml-2 font-bold ${selectedResultModal.riskScore >= 40 ? 'text-rose-600' : selectedResultModal.riskScore > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {selectedResultModal.riskScore} Risk Index
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <Link
                  href={`/admin/violations?candidateId=${selectedResultModal.candidateId?._id || ''}&examId=${selectedResultModal.examId?._id || ''}`}
                  className="px-4 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition flex items-center"
                >
                  <ShieldAlert className="w-4 h-4 mr-1.5 text-rose-600" /> Inspect Evidence & Violations
                </Link>

                <button
                  onClick={() => handleVerifyStatus(selectedResultModal._id, 'APPROVED')}
                  disabled={updatingId === selectedResultModal._id}
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition flex items-center shadow-xs"
                >
                  <Check className="w-4 h-4 mr-1.5" /> Approve Grade
                </button>

                <button
                  onClick={() => handleVerifyStatus(selectedResultModal._id, 'REJECTED')}
                  disabled={updatingId === selectedResultModal._id}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold hover:bg-rose-50 hover:text-rose-700 transition flex items-center"
                >
                  <X className="w-4 h-4 mr-1.5" /> Reject Result
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center border border-slate-200 shadow-xl">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Sign Out of Admin Portal</h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">Are you sure you want to log out of your administrator session?</p>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition shadow-xs"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
