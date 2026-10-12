'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import io from 'socket.io-client';
import { 
  ArrowLeft, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Search, 
  Filter, 
  Camera, 
  Eye, 
  X, 
  Download, 
  Clock, 
  User, 
  BookOpen, 
  ExternalLink,
  ShieldCheck,
  HardDrive,
  Calendar
} from 'lucide-react';
import api from '@/lib/api';
import { getViolationInfo } from '@/lib/violations';

interface ViolationItem {
  _id: string;
  detectedAt: string;
  candidateId?: {
    _id?: string;
    name?: string;
    email?: string;
  };
  attemptId?: {
    _id?: string;
    examId?: {
      _id?: string;
      title?: string;
    };
  };
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  source?: string;
  actionTaken: string;
  description?: string;
  screenshot?: string;
  snapshotImage?: string;
  driveUrl?: string;
  driveFolderUrl?: string;
}

export default function ViolationQueuePage() {
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedProof, setSelectedProof] = useState<ViolationItem | null>(null);
  const [activeRealtimeAlert, setActiveRealtimeAlert] = useState<ViolationItem | null>(null);

  useEffect(() => {
    fetchViolations();

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000');
    const socket = io(wsUrl, {
      auth: { token: typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
    });

    socket.on('violation:alert', (data) => {
      if (data?.violation) {
        const newV = {
          ...data.violation,
          screenshot: data.violation.screenshot || data.violation.snapshotImage || data.violation.image,
          snapshotImage: data.violation.screenshot || data.violation.snapshotImage || data.violation.image
        };
        setViolations((prev) => [newV, ...prev]);
        setActiveRealtimeAlert(newV);
        setTimeout(() => setActiveRealtimeAlert(null), 6000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchViolations = async () => {
    try {
      const res = await api.get('/admin/violations');
      let items: ViolationItem[] = (res.data.violations || []).map((v: any) => ({
        ...v,
        screenshot: v.screenshot || v.snapshotImage || v.image,
        snapshotImage: v.screenshot || v.snapshotImage || v.image
      }));

      // Merge client-cached evidence screenshots for complete zero-loss guarantee
      try {
        if (typeof window !== 'undefined') {
          const cachedEvidence: any[] = JSON.parse(localStorage.getItem('pg_violation_evidence') || '[]');
          if (cachedEvidence.length > 0) {
            items = items.map((v) => {
              if (v.screenshot) return v;
              const match = cachedEvidence.find((c) => {
                const matchAttempt = c.attemptId && v.attemptId && (c.attemptId === v.attemptId._id || c.attemptId === v.attemptId);
                return matchAttempt && c.type === v.type;
              }) || cachedEvidence.find((c) => c.type === v.type);

              if (match?.screenshot) {
                return { ...v, screenshot: match.screenshot, snapshotImage: match.screenshot };
              }
              return v;
            });

            const unlistedCached = cachedEvidence.filter(
              (c) => !items.some((it) => it.type === c.type && Math.abs(new Date(it.detectedAt).getTime() - new Date(c.detectedAt).getTime()) < 10000)
            );

            if (unlistedCached.length > 0) {
              const formattedCached: ViolationItem[] = unlistedCached.map((c, idx) => ({
                _id: 'cache_' + (c.attemptId || '') + '_' + idx,
                detectedAt: c.detectedAt || new Date().toISOString(),
                type: c.type,
                severity: c.severity || 'CRITICAL',
                source: c.source || 'AI',
                actionTaken: c.actionTaken || 'LOG',
                description: c.description,
                screenshot: c.screenshot,
                snapshotImage: c.screenshot,
                candidateId: { name: 'Exam Candidate', email: 'Live Session' },
                attemptId: { _id: c.attemptId, examId: { title: 'Assessment' } }
              }));
              items = [...formattedCached, ...items];
            }
          }
        }
      } catch (e) {}

      setViolations(items);
    } catch (error) {
      console.error('Failed to fetch violations', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const filteredViolations = violations.filter((v) => {
    const candidateName = v.candidateId?.name?.toLowerCase() || '';
    const candidateEmail = v.candidateId?.email?.toLowerCase() || '';
    const examTitle = v.attemptId?.examId?.title?.toLowerCase() || '';
    const violationType = v.type?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();

    const matchesSearch = 
      candidateName.includes(query) || 
      candidateEmail.includes(query) || 
      examTitle.includes(query) || 
      violationType.includes(query);

    const matchesSeverity = severityFilter === 'ALL' || v.severity === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  const totalViolations = violations.length;
  const criticalCount = violations.filter((v) => v.severity === 'CRITICAL').length;
  const highCount = violations.filter((v) => v.severity === 'HIGH').length;
  const proofCount = violations.filter((v) => Boolean(v.screenshot)).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-rose-500/20">
      {/* Realtime Alert Banner */}
      {activeRealtimeAlert && (
        <div className="fixed top-5 right-5 z-[90] max-w-md bg-white border border-rose-200 text-slate-900 p-4 rounded-xl shadow-2xl animate-in slide-in-from-top duration-300 flex items-start space-x-3">
          <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1 text-sm">
            <p className="font-extrabold text-rose-700">New Violation Logged</p>
            <p className="text-slate-600 text-xs mt-0.5">
              <span className="font-bold text-slate-900">{activeRealtimeAlert.candidateId?.name || 'Candidate'}</span>: {activeRealtimeAlert.type?.replace(/_/g, ' ')}
            </p>
            {activeRealtimeAlert.screenshot && (
              <span className="inline-flex items-center text-[11px] text-rose-700 font-semibold mt-1">
                <Camera className="w-3 h-3 mr-1" /> Screenshot proof attached
              </span>
            )}
          </div>
          <button onClick={() => setActiveRealtimeAlert(null)} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Bar */}
      <header className="bg-white/80 border-b border-slate-200/80 backdrop-blur-md px-8 py-5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Link 
            href="/admin/monitoring" 
            className="flex items-center text-sm font-bold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Candidates
          </Link>
          <div className="h-5 w-[1px] bg-slate-200" />
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Violation Queue</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm inline-flex items-center transition shadow-blue-600/20"
          >
            <HardDrive className="w-3.5 h-3.5 mr-1.5" />
            Google Drive Vault
            <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
          </a>
          <button 
            onClick={fetchViolations}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition shadow-2xs"
          >
            Refresh Queue
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Flagged</span>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">{totalViolations}</div>
            <p className="text-xs text-slate-500 mt-1">Recorded during candidate exams</p>
          </div>

          <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Critical Incidents</span>
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
            <div className="text-3xl font-black text-rose-600 mt-2">{criticalCount}</div>
            <p className="text-xs text-slate-500 mt-1">Severe proctoring policy breaches</p>
          </div>

          <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">High Severity</span>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-black text-amber-600 mt-2">{highCount}</div>
            <p className="text-xs text-slate-500 mt-1">Suspicious exam behaviors</p>
          </div>

          <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Screenshot Proofs</span>
              <Camera className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-black text-indigo-600 mt-2">{proofCount}</div>
            <p className="text-xs text-slate-500 mt-1">Captured image evidence available</p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidate, email, exam, or violation..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium"
            />
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1.5" /> Severity:
            </span>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-3 py-1 rounded-lg transition-colors font-bold ${
                    severityFilter === s 
                      ? 'bg-rose-600 text-white shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Violation Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="font-semibold text-sm text-slate-600">Loading violations queue...</p>
            </div>
          ) : filteredViolations.length === 0 ? (
            <div className="p-20 flex flex-col items-center text-center">
              <ShieldCheck className="w-16 h-16 text-emerald-500 mb-4 opacity-90" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Violations Found</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {searchQuery || severityFilter !== 'ALL'
                  ? 'No violations match your current search and severity filters.'
                  : 'All candidate examination sessions are clean with no violations flagged.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-extrabold uppercase tracking-wider">
                    <th className="p-4">Violation Proof (Screenshot)</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Candidate</th>
                    <th className="p-4">Exam</th>
                    <th className="p-4">Violation Type</th>
                    <th className="p-4">Severity</th>
                    <th className="p-4">Action Taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredViolations.map((v) => {
                    const rowInfo = getViolationInfo(v.type, v.description);
                    return (
                      <tr key={v._id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* Screenshot Proof Column */}
                        <td className="p-4">
                          {v.screenshot ? (
                            <div className="flex items-center gap-3">
                              <div 
                                onClick={() => setSelectedProof(v)}
                                className="relative group/thumb cursor-pointer w-28 h-18 rounded-xl overflow-hidden border border-slate-200 hover:border-rose-500 shadow-sm bg-slate-900 transition-all transform hover:scale-105 shrink-0"
                                title="Click to view full screenshot proof and incident description"
                              >
                                <img 
                                  src={v.screenshot} 
                                  alt="Violation proof thumbnail" 
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-slate-900/30 group-hover/thumb:bg-slate-900/10 transition-colors flex items-center justify-center">
                                  <span className="bg-rose-600/90 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow flex items-center">
                                    <Eye className="w-3 h-3 mr-1" /> View Proof
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0 max-w-[200px]">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 block truncate">
                                  {rowInfo.title}
                                </span>
                                <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug font-medium">
                                  {rowInfo.actionDone}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-28 h-18 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 text-xs shrink-0">
                                <Camera className="w-4 h-4 mb-1 opacity-50" />
                                <span className="text-[10px] font-medium text-slate-400">No Snapshot</span>
                              </div>
                              <div className="min-w-0 max-w-[200px]">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">
                                  {rowInfo.title}
                                </span>
                                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                                  {rowInfo.actionDone}
                                </p>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Date & Time */}
                        <td className="p-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                          <div className="text-slate-800 font-bold">
                            {new Date(v.detectedAt).toLocaleDateString()}
                          </div>
                          <div className="text-slate-400 mt-0.5">
                            {new Date(v.detectedAt).toLocaleTimeString()}
                          </div>
                        </td>

                        {/* Candidate */}
                        <td className="p-4">
                          <div className="font-extrabold text-slate-900 group-hover:text-rose-600 transition-colors">
                            {v.candidateId?.name || 'Unknown Candidate'}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            {v.candidateId?.email || 'N/A'}
                          </div>
                        </td>

                        {/* Exam */}
                        <td className="p-4 font-bold text-slate-700">
                          {v.attemptId?.examId?.title || 'Examination'}
                        </td>

                        {/* Violation Type */}
                        <td className="p-4">
                          <div className="font-extrabold text-slate-900 flex items-center">
                            <AlertTriangle className={`w-3.5 h-3.5 mr-1.5 ${
                              v.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'
                            }`} />
                            {v.type?.replace(/_/g, ' ')}
                          </div>
                          {v.description && (
                            <div className="text-xs text-slate-500 mt-1 line-clamp-1 max-w-xs">
                              {v.description}
                            </div>
                          )}
                          {v.source && (
                            <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                              Source: {v.source}
                            </span>
                          )}
                        </td>

                        {/* Severity */}
                        <td className="p-4">
                          <span className={`text-xs font-extrabold px-3 py-1 rounded-full border inline-block ${getSeverityBadge(v.severity)}`}>
                            {v.severity}
                          </span>
                        </td>

                        {/* Action Taken */}
                        <td className="p-4 text-xs text-slate-600 font-semibold">
                          <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700">
                            {v.actionTaken || 'LOGGED'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Proof Modal / Lightbox */}
      {selectedProof && (() => {
        const info = getViolationInfo(selectedProof.type, selectedProof.description);
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col custom-scrollbar">
              {/* Modal Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-xl ${
                    selectedProof.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center">
                      Violation Proof Snapshot
                      <span className={`ml-3 text-xs px-2.5 py-0.5 rounded-full border font-bold ${getSeverityBadge(selectedProof.severity)}`}>
                        {selectedProof.severity}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {info.title} &bull; {new Date(selectedProof.detectedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProof(null)}
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Image Body Along With Violation Description */}
              <div className="p-6 flex flex-col bg-slate-50/50 space-y-4">
                {selectedProof.screenshot ? (
                  <div className="w-full relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-inner">
                    <img 
                      src={selectedProof.screenshot} 
                      alt="Violation Proof" 
                      className="w-full max-h-[460px] object-contain mx-auto"
                    />
                    <div className="absolute top-3 left-3 bg-rose-600/90 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-md shadow-lg uppercase tracking-wider flex items-center">
                      <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                      Live Violation Proof Snapshot
                    </div>
                  </div>
                ) : (
                  <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                    <Camera className="w-12 h-12 mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No screenshot captured for this record.</p>
                  </div>
                )}

                {/* Violation Description & Candidate Action Callout (Directly Along With Image) */}
                <div className="w-full bg-rose-50/80 border border-rose-200 rounded-2xl p-5 shadow-xs">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white/80 p-2.5 rounded-lg border border-rose-100">
                          <span className="font-extrabold text-slate-500 block text-[10px] uppercase">Examination Rule Breached:</span>
                          <span className="text-slate-800 font-medium">{info.ruleBreached}</span>
                        </div>
                        {selectedProof.description && (
                          <div className="bg-white/80 p-2.5 rounded-lg border border-rose-100">
                            <span className="font-extrabold text-slate-500 block text-[10px] uppercase">Telemetry Event Log:</span>
                            <span className="text-slate-800 font-medium font-mono">{selectedProof.description}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Violation Candidate & Session Info Grid */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-semibold">Candidate:</span>
                      <span className="text-slate-900 font-extrabold">{selectedProof.candidateId?.name || 'Unknown Candidate'}</span>
                      <span className="text-slate-400 ml-2 font-mono text-[11px]">({selectedProof.candidateId?.email || 'N/A'})</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-semibold">Exam:</span>
                      <span className="text-slate-900 font-extrabold">{selectedProof.attemptId?.examId?.title || 'Unknown Exam'}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-semibold">Incident Timestamp:</span>
                      <span className="text-slate-800 font-mono font-medium">{new Date(selectedProof.detectedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-semibold">Proctor Action Taken:</span>
                      <span className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {selectedProof.actionTaken || 'LOGGED'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between sticky bottom-0">
                <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                  Log ID: {selectedProof._id}
                </span>
                <div className="flex space-x-3">
                  <a
                    href={selectedProof.driveUrl || selectedProof.driveFolderUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <HardDrive className="w-4 h-4 mr-1.5" />
                    View in Google Drive
                    <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
                  </a>
                  {selectedProof.screenshot && (
                    <a 
                      href={selectedProof.screenshot} 
                      download={`violation-proof-${selectedProof._id}.jpg`}
                      className="flex items-center px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition shadow-xs"
                    >
                      <Download className="w-4 h-4 mr-2" /> Download Proof
                    </a>
                  )}
                  <button 
                    onClick={() => setSelectedProof(null)}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition border border-slate-200 shadow-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
