'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle2, 
  FileText, 
  Check, 
  X, 
  ShieldAlert, 
  ExternalLink, 
  HardDrive, 
  Search,
  BarChart3,
  Eye,
  Clock,
  Award,
  AlertTriangle,
  Printer,
  ChevronRight,
  HelpCircle,
  Camera,
  FolderOpen,
  Cloud,
  RefreshCw,
  Folder,
  Download,
  Shield,
  FileCheck,
  LogOut
} from 'lucide-react';
import api from '@/lib/api';
import { sanitizeSearchInput } from '@/lib/sanitize';

export default function ResultsVerificationPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Candidate Answers Modal State
  const [selectedAnswersData, setSelectedAnswersData] = useState<any | null>(null);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [answersQuestionFilter, setAnswersQuestionFilter] = useState<'ALL' | 'CORRECT' | 'WRONG' | 'UNANSWERED'>('ALL');

  // Google Drive Stored Information Modal State
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveData, setDriveData] = useState<any | null>(null);
  const [loadingDriveData, setLoadingDriveData] = useState(false);
  const [driveCategoryFilter, setDriveCategoryFilter] = useState<'ALL' | 'Submissions' | 'Violations'>('ALL');
  const [driveSearchQuery, setDriveSearchQuery] = useState('');
  const [previewProofImage, setPreviewProofImage] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const handleOpenDriveFolder = async () => {
    // 1. Open Google Drive in new browser tab
    if (typeof window !== 'undefined') {
      window.open('https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing', '_blank', 'noopener,noreferrer');
    }

    // 2. Open Stored Drive Information viewer modal
    setIsDriveModalOpen(true);
    setLoadingDriveData(true);
    try {
      const res = await api.get('/admin/drive/files');
      setDriveData(res.data);
    } catch (err) {
      console.error('Failed to load drive files:', err);
    } finally {
      setLoadingDriveData(false);
    }
  };

  const fetchResults = async () => {
    try {
      const res = await api.get('/admin/results');
      setResults(res.data.results || []);
    } catch (error) {
      console.error('Failed to fetch results', error);
    } finally {
      setLoading(false);
    }
  };

  const openCandidateAnswers = async (resultItem: any) => {
    setLoadingAnswers(true);
    setSelectedAnswersData({
      loading: true,
      resultId: resultItem._id,
      candidate: resultItem.candidateId,
      exam: resultItem.examId,
      result: resultItem,
      answers: []
    });
    setAnswersQuestionFilter('ALL');

    try {
      const res = await api.get(`/admin/results/${resultItem._id}/answers`);
      setSelectedAnswersData(res.data);
    } catch (err) {
      console.error('Failed to fetch candidate answers', err);
      setSelectedAnswersData({
        candidate: resultItem.candidateId,
        exam: resultItem.examId,
        result: resultItem,
        answers: [],
        error: 'Unable to load individual question answers from server.'
      });
    } finally {
      setLoadingAnswers(false);
    }
  };

  const verifyResult = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.patch(`/admin/results/${id}/verify`, { status });
      fetchResults();
      if (selectedAnswersData && (selectedAnswersData.result?._id === id || selectedAnswersData.result?.id === id)) {
        setSelectedAnswersData((prev: any) => ({
          ...prev,
          result: { ...prev?.result, status }
        }));
      }
    } catch (error) {
      console.error('Failed to verify result', error);
    }
  };

  const filteredResults = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return results.filter(r => {
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      if (!matchesStatus) return false;
      if (tokens.length === 0) return true;

      const candName = r.candidateId?.name || '';
      const candEmail = r.candidateId?.email || '';
      const examTitle = r.examId?.title || '';
      const statusText = r.status || '';
      const passText = r.pass ? 'pass passed' : 'fail failed';
      const scoreText = `${r.obtainedMarks}/${r.totalMarks} ${r.percentage ? r.percentage.toFixed(1) : ''}% score marks`;
      const violText = `${r.violations || 0} violations infractions flags`;

      const blob = `${candName} ${candEmail} ${examTitle} ${statusText} ${passText} ${scoreText} ${violText}`.toLowerCase();
      return tokens.every(t => blob.includes(t));
    });
  }, [results, searchQuery, statusFilter]);

  const filteredDriveFiles = useMemo(() => {
    if (!driveData?.files) return [];
    const tokens = driveSearchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return driveData.files.filter((file: any) => {
      const matchesCategory = driveCategoryFilter === 'ALL' || file.category === driveCategoryFilter;
      if (!matchesCategory) return false;
      if (tokens.length === 0) return true;

      const blob = `${file.name || ''} ${file.candidateName || ''} ${file.candidateEmail || ''} ${file.examTitle || ''} ${file.violationType || ''} ${file.category || ''}`.toLowerCase();
      return tokens.every((t: string) => blob.includes(t));
    });
  }, [driveData, driveSearchQuery, driveCategoryFilter]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col py-10 px-8">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/admin/monitoring" className="text-blue-600 font-semibold flex items-center hover:underline w-max text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Candidates
            </Link>
            <Link href="/admin/results" className="text-blue-600 font-semibold flex items-center hover:underline w-max text-sm">
              <BarChart3 className="w-4 h-4 mr-1.5" /> Results
            </Link>
            <Link href="/admin/violations" className="text-blue-600 font-semibold flex items-center hover:underline w-max text-sm">
              <ShieldAlert className="w-4 h-4 mr-1.5 text-rose-500" /> Violations
            </Link>
          </div>

          <div className="flex items-center space-x-3">
            <button 
              onClick={handleOpenDriveFolder}
              className="inline-flex items-center px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer h-9"
              title="Open Google Drive folder and view all stored submissions, answer sheets, and evidence"
            >
              <HardDrive className="w-3.5 h-3.5 mr-1.5" />
              Open Google Drive Folder
              <ExternalLink className="w-3 h-3 ml-1.5 opacity-80" />
            </button>
          </div>
        </div>
        
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 flex items-center">
              <FileText className="w-8 h-8 mr-3 text-blue-500" />
              Results & Verification
            </h1>
            <p className="text-slate-500 mt-2 text-lg">Verify candidate exam results, submitted answers, and violations linked to Google Drive</p>
          </div>
          
          <button 
            onClick={handleOpenDriveFolder}
            className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-800 flex items-center transition cursor-pointer"
            title="Click to view all stored Drive files"
          >
            <HardDrive className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" />
            <span>Drive Folder ID: <strong className="font-mono">1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1</strong></span>
            <ExternalLink className="w-3 h-3 ml-2 text-blue-600 opacity-60" />
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidate name, email, exam, status..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(sanitizeSearchInput(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-200"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold w-full sm:w-auto">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === tab 
                    ? 'bg-white text-slate-900 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'ALL' ? `All (${results.length})` : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Loading results...</div>
          ) : results.length === 0 ? (
            <div className="p-16 flex flex-col items-center text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">No Results Found</h3>
              <p className="text-slate-500">No candidates have completed exams yet.</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="p-16 flex flex-col items-center text-center">
              <Search className="w-14 h-14 text-slate-300 mb-3" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">No Matching Results</h3>
              <p className="text-slate-500 text-sm">No records match your search criteria &quot;{searchQuery}&quot;.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm uppercase tracking-wider">
                    <th className="p-4 font-semibold align-middle text-center">Date</th>
                    <th className="p-4 font-semibold align-middle text-left">Candidate</th>
                    <th className="p-4 font-semibold align-middle text-left">Exam</th>
                    <th className="p-4 font-semibold align-middle text-center">Score</th>
                    <th className="p-4 font-semibold align-middle text-center">Violations</th>
                    <th className="p-4 font-semibold align-middle text-center">Status</th>
                    <th className="p-4 font-semibold align-middle text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 align-middle text-center text-sm text-slate-600 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 align-middle text-left">
                        <div className="font-semibold text-slate-800">{r.candidateId?.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{r.candidateId?.email || 'N/A'}</div>
                      </td>
                      <td className="p-4 align-middle text-left text-sm font-medium text-slate-700">
                        {r.examId?.title || 'Unknown Exam'}
                      </td>
                      <td className="p-4 align-middle text-center">
                        <div className="inline-flex flex-col items-center justify-center">
                          <span className={`font-bold ${r.pass ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {r.percentage.toFixed(1)}%
                          </span>
                          <div className="text-xs text-slate-500">{r.obtainedMarks}/{r.totalMarks} Marks</div>
                        </div>
                      </td>
                      <td className="p-4 align-middle text-center">
                        <div className="inline-flex items-center justify-center">
                          {r.violations > 0 ? (
                            <span className="inline-flex items-center text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                              <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                              {r.violations}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold text-xs">0</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-middle text-center">
                        <div className="inline-flex items-center justify-center">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                            r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            r.status === 'REJECTED' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                            'bg-amber-100 text-amber-700 border-amber-200'
                          }`}>
                            {r.status}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 align-middle text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center space-x-2">
                          <button
                            onClick={() => openCandidateAnswers(r)}
                            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold inline-flex items-center transition-colors shadow-2xs hover:border-blue-300 cursor-pointer"
                            title="View candidate answers sheet, questions evaluation, and Google Drive links"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                            Answers (Drive)
                            <Eye className="w-3.5 h-3.5 ml-1.5 text-blue-500 opacity-80" />
                          </button>
                          {r.status === 'PENDING' && (
                            <>
                              <button 
                                onClick={() => verifyResult(r._id, 'APPROVED')}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> Approve
                              </button>
                              <button 
                                onClick={() => verifyResult(r._id, 'REJECTED')}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5 mr-1" /> Reject
                              </button>
                            </>
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
      </div>

      {/* Candidate Answers Review Modal */}
      {selectedAnswersData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50/90 flex justify-between items-start sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-black text-xl shrink-0">
                  {selectedAnswersData.candidate?.name?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {selectedAnswersData.candidate?.name || 'Candidate Answers'}
                    </h2>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      selectedAnswersData.result?.pass
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border-rose-200'
                    }`}>
                      {selectedAnswersData.result?.pass ? 'PASSED' : 'FAILED'} ({(selectedAnswersData.result?.percentage ?? 0).toFixed(1)}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Exam: <strong className="text-slate-700">{selectedAnswersData.exam?.title || 'Assessment'}</strong> • {selectedAnswersData.candidate?.email || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'https://proctorguardai.onrender.com/api'}/admin/results/${selectedAnswersData.result?._id || selectedAnswersData.result?.id || selectedAnswersData.resultId}/report-html?token=${typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center transition shadow-2xs"
                  title="Open full printable HTML answer sheet report in new tab"
                >
                  <Printer className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Printable Sheet
                  <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                </a>

                <a
                  href={selectedAnswersData.result?.driveReportUrl || selectedAnswersData.result?.driveFolderUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center transition shadow-2xs"
                  title="Open Google Drive folder or uploaded files"
                >
                  <HardDrive className="w-3.5 h-3.5 mr-1" />
                  Google Drive
                  <ExternalLink className="w-3 h-3 ml-1 opacity-80" />
                </a>

                <button
                  onClick={() => setSelectedAnswersData(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition ml-2 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Scorecard Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Score</span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {selectedAnswersData.result?.obtainedMarks ?? 0} <span className="text-xs text-slate-400 font-normal">/ {selectedAnswersData.result?.totalMarks ?? 100} Marks</span>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Correct</span>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    {selectedAnswersData.result?.correct ?? 0} Questions
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Wrong</span>
                  <div className="text-xl font-black text-rose-700 mt-1">
                    {selectedAnswersData.result?.wrong ?? 0} Questions
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Skipped</span>
                  <div className="text-xl font-black text-slate-700 mt-1">
                    {selectedAnswersData.result?.unanswered ?? 0} Questions
                  </div>
                </div>
              </div>

              {/* Filter Tabs for Answers */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center">
                  <FileText className="w-4 h-4 mr-1.5 text-blue-600" />
                  Candidate Response Details ({selectedAnswersData.answers?.length ?? 0} Questions)
                </h3>

                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  {(['ALL', 'CORRECT', 'WRONG', 'UNANSWERED'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setAnswersQuestionFilter(tab)}
                      className={`px-3 py-1 rounded-md transition cursor-pointer ${
                        answersQuestionFilter === tab
                          ? 'bg-white text-slate-900 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {loadingAnswers ? (
                <div className="py-16 text-center text-slate-400 font-semibold animate-pulse">
                  Loading candidate responses and questions...
                </div>
              ) : selectedAnswersData.answers?.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold">No individual answer responses recorded for this attempt.</p>
                  <p className="text-xs text-slate-400 mt-1">Exam evaluation summary marks are displayed above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedAnswersData.answers
                    .filter((q: any) => {
                      if (answersQuestionFilter === 'CORRECT') return q.isCorrect;
                      if (answersQuestionFilter === 'WRONG') return q.isAttempted && !q.isCorrect;
                      if (answersQuestionFilter === 'UNANSWERED') return !q.isAttempted;
                      return true;
                    })
                    .map((q: any) => {
                      const isUnanswered = !q.isAttempted;
                      const isCorrect = q.isCorrect;
                      const hasOptions = Array.isArray(q.options) && q.options.length > 0;

                      return (
                        <div
                          key={q.questionId || q.questionNumber}
                          className={`p-4 rounded-xl border transition-all ${
                            isUnanswered
                              ? 'border-slate-200 bg-slate-50/60'
                              : isCorrect
                              ? 'border-emerald-200 bg-emerald-50/20'
                              : 'border-rose-200 bg-rose-50/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <span className="font-bold text-sm text-slate-900">
                              Q{q.questionNumber}. {q.questionText}
                            </span>
                            <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 border ${
                              isUnanswered
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : isCorrect
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}>
                              {isUnanswered ? 'Not Answered' : isCorrect ? `Correct (+${q.marks})` : `Wrong (${q.negativeMarks ? `-${q.negativeMarks}` : '0'})`}
                            </span>
                          </div>

                          {/* Options if Multiple Choice */}
                          {hasOptions ? (
                            <div className="space-y-1.5 mt-3">
                              {q.options.map((opt: any, optIdx: number) => {
                                const optVal = typeof opt === 'object' ? opt.text || opt.value || optIdx : opt;
                                const isSelected = JSON.stringify(q.candidateSelectedAnswer) === JSON.stringify(optVal) ||
                                                   String(q.candidateSelectedAnswer) === String(optVal) ||
                                                   String(q.candidateSelectedAnswer) === String(optIdx);
                                const isCorrectChoice = JSON.stringify(q.correctAnswer) === JSON.stringify(optVal) ||
                                                        String(q.correctAnswer) === String(optVal) ||
                                                        String(q.correctAnswer) === String(optIdx);

                                return (
                                  <div
                                    key={optIdx}
                                    className={`p-2.5 rounded-lg text-xs font-medium flex items-center justify-between border ${
                                      isSelected && isCorrect
                                        ? 'bg-emerald-100/60 border-emerald-300 text-emerald-950 font-semibold'
                                        : isSelected && !isCorrect
                                        ? 'bg-rose-100/60 border-rose-300 text-rose-950 font-semibold'
                                        : isCorrectChoice
                                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                                        : 'bg-white border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold bg-white text-slate-600 shrink-0">
                                        {String.fromCharCode(65 + optIdx)}
                                      </span>
                                      <span>{typeof opt === 'object' ? opt.text || JSON.stringify(opt) : opt}</span>
                                    </div>

                                    {isSelected && (
                                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                        isCorrect ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                                      }`}>
                                        Candidate Choice {isCorrect ? '(Correct)' : '(Incorrect)'}
                                      </span>
                                    )}
                                    {!isSelected && isCorrectChoice && (
                                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                        Correct Answer
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* Non-MCQ or Direct Answer display */
                            <div className="mt-2.5 p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1.5">
                              <div>
                                <span className="font-bold text-slate-500">Candidate Answer: </span>
                                <span className={isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                  {q.candidateSelectedAnswer !== null && q.candidateSelectedAnswer !== undefined
                                    ? JSON.stringify(q.candidateSelectedAnswer)
                                    : 'None'}
                                </span>
                              </div>
                              <div>
                                <span className="font-bold text-slate-500">Correct Answer: </span>
                                <span className="text-emerald-700 font-bold">
                                  {JSON.stringify(q.correctAnswer)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Proctoring Violations Log if any */}
              {selectedAnswersData.violations && selectedAnswersData.violations.length > 0 && (
                <div className="mt-6 pt-5 border-t border-slate-200">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-1.5 text-rose-600" />
                    Proctoring Violations Logged During Exam ({selectedAnswersData.violations.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedAnswersData.violations.map((v: any, idx: number) => (
                      <div key={v.id || idx} className="p-3 bg-rose-50/40 rounded-xl border border-rose-200 text-xs flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px] uppercase">
                            {v.type}
                          </span>
                          <span className="text-slate-800 font-medium">{v.description || 'Proctoring violation detected'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-400 font-mono text-[10px]">
                            {new Date(v.detectedAt).toLocaleTimeString()}
                          </span>
                          {v.screenshot && (
                            <a 
                              href={v.screenshot} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:underline font-bold flex items-center text-[11px]"
                            >
                              <Camera className="w-3 h-3 mr-0.5" /> Proof
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-medium">Verification Status:</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  selectedAnswersData.result?.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                  selectedAnswersData.result?.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                  'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  {selectedAnswersData.result?.status || 'PENDING'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {selectedAnswersData.result?.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => verifyResult(selectedAnswersData.result?._id || selectedAnswersData.result?.id, 'APPROVED')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve
                    </button>
                    <button
                      onClick={() => verifyResult(selectedAnswersData.result?._id || selectedAnswersData.result?.id, 'REJECTED')}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center shadow-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedAnswersData(null)}
                  className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Cloud Vault & Stored Information Modal */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-slate-100 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-bold text-slate-800">
                      Google Drive Cloud Vault & Stored Information
                    </h2>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-semibold flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                      Cloud Synced
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-slate-500 mt-1 space-x-2">
                    <span>Folder ID:</span>
                    <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-medium">
                      {driveData?.folderId || '1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1'}
                    </code>
                    <span>•</span>
                    <span>Synchronized candidate answer sheets & violation evidence</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                {!driveData?.isConfigured ? (
                  <a
                    href={`${(process.env.NEXT_PUBLIC_API_URL || 'https://proctorguardai.onrender.com/api').replace(/\/api\/?$/, '')}/api/auth/google/drive-auth`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition flex items-center shadow-xs cursor-pointer"
                    title="Authorize Google Drive account to auto-upload files to folder 1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1"
                  >
                    <HardDrive className="w-3.5 h-3.5 mr-1.5" />
                    Connect Google Drive
                  </a>
                ) : (
                  <button
                    onClick={async () => {
                      setLoadingDriveData(true);
                      try {
                        const res = await api.post('/admin/drive/sync-pending');
                        alert(res.data?.message || 'Sync completed!');
                        const fRes = await api.get('/admin/drive/files');
                        setDriveData(fRes.data);
                      } catch (err: any) {
                        alert(err?.response?.data?.message || 'Sync error');
                      } finally {
                        setLoadingDriveData(false);
                      }
                    }}
                    disabled={loadingDriveData}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-300 flex items-center cursor-pointer disabled:opacity-50"
                    title="Auto-sync all pending violation proof images to Google Drive"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingDriveData ? 'animate-spin text-blue-600' : ''}`} />
                    Sync Proofs
                  </button>
                )}

                <a
                  href={driveData?.folderUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex items-center shadow-xs cursor-pointer"
                  title="Open folder in Google Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open in Google Drive
                </a>
                <button
                  onClick={async () => {
                    setLoadingDriveData(true);
                    try {
                      const res = await api.get('/admin/drive/files');
                      setDriveData(res.data);
                    } catch (err) {
                      console.error('Refresh failed:', err);
                    } finally {
                      setLoadingDriveData(false);
                    }
                  }}
                  disabled={loadingDriveData}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer disabled:opacity-50"
                  title="Refresh Stored Information"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingDriveData ? 'animate-spin text-blue-600' : ''}`} />
                </button>
                <button
                  onClick={() => setIsDriveModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-100 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-slate-500 font-medium">Total Stored Files</div>
                  <div className="text-lg font-bold text-slate-800 mt-0.5">
                    {driveData?.summary?.total ?? (driveData?.files?.length || 0)}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-slate-500 font-medium">Candidate Submissions</div>
                  <div className="text-lg font-bold text-slate-800 mt-0.5">
                    {driveData?.summary?.submissions ?? (driveData?.files?.filter((f: any) => f.category === 'Submissions').length || 0)}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-slate-500 font-medium">Violation Evidence</div>
                  <div className="text-lg font-bold text-slate-800 mt-0.5">
                    {driveData?.summary?.violations ?? (driveData?.files?.filter((f: any) => f.category === 'Violations').length || 0)}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-slate-500 font-medium">Cloud Vault Status</div>
                  <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center">
                    <Cloud className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                    Online & Linked
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FolderOpen className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 bg-white">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search candidate, exam or file..."
                  value={driveSearchQuery}
                  onChange={(e) => setDriveSearchQuery(sanitizeSearchInput(e.target.value))}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div className="flex items-center space-x-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                {(['ALL', 'Submissions', 'Violations'] as const).map((cat) => {
                  const count = cat === 'ALL'
                    ? (driveData?.files?.length || 0)
                    : (driveData?.files?.filter((f: any) => f.category === cat).length || 0);
                  const isSelected = driveCategoryFilter === cat;

                  return (
                    <button
                      key={cat}
                      onClick={() => setDriveCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat === 'ALL' ? 'All Files' : cat === 'Submissions' ? 'Exam Submissions & Answers' : 'Violation Screenshots'} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File Records Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50 min-h-[320px]">
              {loadingDriveData ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Connecting to Google Drive Folder...</p>
                  <p className="text-xs text-slate-400 mt-1">Retrieving synchronized submission reports and proctoring evidence.</p>
                </div>
              ) : filteredDriveFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-white rounded-xl border border-dashed border-slate-200">
                  <FolderOpen className="w-12 h-12 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No stored drive items match your filter</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {driveSearchQuery ? `No files matching "${driveSearchQuery}". Try clearing search.` : 'Candidate answer reports and violation screenshots will appear here automatically when recorded.'}
                  </p>
                  <a
                    href={driveData?.folderUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition flex items-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Open Google Drive Folder Directly
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDriveFiles.map((file: any) => {
                    const isSubmission = file.category === 'Submissions';

                    return (
                      <div
                        key={file.id + file.category}
                        className="bg-white rounded-xl border border-slate-200/80 p-3.5 hover:border-blue-300 hover:shadow-xs transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="flex items-start space-x-3 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSubmission
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : 'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                            {isSubmission ? (
                              <FileText className="w-4 h-4" />
                            ) : (
                              <Camera className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <span className="font-semibold text-slate-800 text-xs truncate max-w-md" title={file.name}>
                                {file.name}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                isSubmission ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {file.category}
                              </span>
                              {file.violationType && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                                  {file.violationType.replace(/_/g, ' ')}
                                </span>
                              )}
                              {file.score && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                  Score: {file.score}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                              <span><strong>Candidate:</strong> {file.candidateName} ({file.candidateEmail})</span>
                              <span>•</span>
                              <span><strong>Exam:</strong> {file.examTitle}</span>
                              {file.createdAt && (
                                <>
                                  <span>•</span>
                                  <span>{new Date(file.createdAt).toLocaleString()}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                          {isSubmission ? (
                            <>
                              <button
                                onClick={() => openCandidateAnswers({
                                  _id: file.id,
                                  candidateId: { name: file.candidateName, email: file.candidateEmail },
                                  examId: { title: file.examTitle }
                                })}
                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition flex items-center cursor-pointer"
                                title="View candidate submitted answers sheet"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                Answers Sheet
                              </button>

                              <button
                                onClick={() => {
                                  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'https://proctorguardai.onrender.com/api').replace(/\/api$/, '');
                                  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
                                  window.open(`${apiOrigin}${file.htmlReportUrl}?token=${token}`, '_blank');
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center cursor-pointer"
                                title="Open full styled HTML report"
                              >
                                <FileText className="w-3.5 h-3.5 mr-1" />
                                HTML Report
                              </button>
                            </>
                          ) : (
                            file.previewUrl && (
                              <button
                                onClick={() => setPreviewProofImage(file.previewUrl)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition flex items-center cursor-pointer"
                                title="View violation screenshot evidence"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                View Evidence
                              </button>
                            )
                          )}

                          <a
                            href={file.webViewLink || driveData?.folderUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center cursor-pointer"
                            title="Open file or folder in Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            Drive Link
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-white flex items-center justify-between">
              <div className="text-xs text-slate-500 flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                <span>All exam submissions and violation snapshots are backed up to Google Drive Folder: <strong>1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1</strong></span>
              </div>
              <button
                onClick={() => setIsDriveModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Close Vault
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Violation Proof Lightbox Modal */}
      {previewProofImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-60 flex items-center justify-center p-4"
          onClick={() => setPreviewProofImage(null)}
        >
          <div 
            className="bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-800 overflow-hidden shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Proctor Violation Evidence Screenshot</span>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={previewProofImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition flex items-center"
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> Open Original
                </a>
                <button
                  onClick={() => setPreviewProofImage(null)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-black flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={previewProofImage}
                alt="Violation Proof"
                className="max-h-[70vh] max-w-full object-contain rounded-lg border border-slate-800"
              />
            </div>
            <div className="p-3 bg-slate-900/90 text-center text-xs text-slate-400 border-t border-slate-800">
              Recorded by ProctorGuardAI Detection Engine • Saved in Google Drive Cloud Vault
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
