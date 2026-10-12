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
  ShieldCheck
} from 'lucide-react';
import api from '@/lib/api';

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
        return 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-500/20';
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-500/20';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-500/20';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-500/20';
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-rose-500/30">
      {/* Realtime Alert Banner */}
      {activeRealtimeAlert && (
        <div className="fixed top-5 right-5 z-[90] max-w-md bg-rose-950/90 border border-rose-500/40 text-white p-4 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top duration-300 flex items-start space-x-3">
          <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1 text-sm">
            <p className="font-bold text-rose-300">New Violation Logged</p>
            <p className="text-slate-300 text-xs mt-0.5">
              <span className="font-semibold text-white">{activeRealtimeAlert.candidateId?.name || 'Candidate'}</span>: {activeRealtimeAlert.type?.replace(/_/g, ' ')}
            </p>
            {activeRealtimeAlert.screenshot && (
              <span className="inline-flex items-center text-[11px] text-rose-300 font-semibold mt-1">
                <Camera className="w-3 h-3 mr-1" /> Screenshot proof attached
              </span>
            )}
          </div>
          <button onClick={() => setActiveRealtimeAlert(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Bar */}
      <header className="bg-slate-950/60 border-b border-slate-800 backdrop-blur-xl px-8 py-5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Link 
            href="/admin/monitoring" 
            className="flex items-center text-sm font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Candidates
          </Link>
          <div className="h-5 w-[1px] bg-slate-800" />
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            <h1 className="text-xl font-extrabold text-white tracking-tight">Violation Queue</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchViolations}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition"
          >
            Refresh Queue
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Flagged</span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white mt-2">{totalViolations}</div>
            <p className="text-xs text-slate-500 mt-1">Recorded during candidate exams</p>
          </div>

          <div className="bg-slate-800/60 border border-rose-900/30 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Critical Incidents</span>
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
            <div className="text-3xl font-black text-rose-400 mt-2">{criticalCount}</div>
            <p className="text-xs text-slate-500 mt-1">Severe proctoring policy breaches</p>
          </div>

          <div className="bg-slate-800/60 border border-orange-900/30 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">High Severity</span>
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div className="text-3xl font-black text-orange-400 mt-2">{highCount}</div>
            <p className="text-xs text-slate-500 mt-1">Suspicious exam behaviors</p>
          </div>

          <div className="bg-slate-800/60 border border-indigo-900/30 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Screenshot Proofs</span>
              <Camera className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-indigo-300 mt-2">{proofCount}</div>
            <p className="text-xs text-slate-500 mt-1">Captured image evidence available</p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between backdrop-blur-sm">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidate, email, exam, or violation..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1.5" /> Severity:
            </span>
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs font-semibold">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    severityFilter === s 
                      ? 'bg-rose-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Violation Table */}
        <div className="bg-slate-800/40 rounded-xl border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-sm">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="font-medium text-sm">Loading violations queue...</p>
            </div>
          ) : filteredViolations.length === 0 ? (
            <div className="p-20 flex flex-col items-center text-center">
              <ShieldCheck className="w-16 h-16 text-emerald-400 mb-4 opacity-80" />
              <h3 className="text-xl font-bold text-white mb-2">No Violations Found</h3>
              <p className="text-slate-400 text-sm max-w-sm">
                {searchQuery || severityFilter !== 'ALL'
                  ? 'No violations match your current search and severity filters.'
                  : 'All candidate examination sessions are clean with no violations flagged.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="p-4">Violation Proof (Screenshot)</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Candidate</th>
                    <th className="p-4">Exam</th>
                    <th className="p-4">Violation Type</th>
                    <th className="p-4">Severity</th>
                    <th className="p-4">Action Taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredViolations.map((v) => (
                    <tr key={v._id} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Screenshot Proof Column */}
                      <td className="p-4 whitespace-nowrap">
                        {v.screenshot ? (
                          <div 
                            onClick={() => setSelectedProof(v)}
                            className="relative group/thumb cursor-pointer w-28 h-18 rounded-lg overflow-hidden border border-slate-700 hover:border-rose-500 shadow-md bg-black transition-all transform hover:scale-105"
                            title="Click to view full screenshot proof"
                          >
                            <img 
                              src={v.screenshot} 
                              alt="Violation proof thumbnail" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center">
                              <span className="bg-rose-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center">
                                <Eye className="w-3 h-3 mr-1" /> View Proof
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-28 h-18 rounded-lg border border-dashed border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center text-slate-500 text-xs">
                            <Camera className="w-4 h-4 mb-1 opacity-40" />
                            <span className="text-[10px] font-medium text-slate-500">No Snapshot</span>
                          </div>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="p-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                        <div className="text-slate-200 font-semibold">
                          {new Date(v.detectedAt).toLocaleDateString()}
                        </div>
                        <div className="text-slate-400">
                          {new Date(v.detectedAt).toLocaleTimeString()}
                        </div>
                      </td>

                      {/* Candidate */}
                      <td className="p-4">
                        <div className="font-bold text-white group-hover:text-rose-300 transition-colors">
                          {v.candidateId?.name || 'Unknown Candidate'}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {v.candidateId?.email || 'N/A'}
                        </div>
                      </td>

                      {/* Exam */}
                      <td className="p-4 font-medium text-slate-300">
                        {v.attemptId?.examId?.title || 'Examination'}
                      </td>

                      {/* Violation Type */}
                      <td className="p-4">
                        <div className="font-bold text-white flex items-center">
                          <AlertTriangle className={`w-3.5 h-3.5 mr-1.5 ${
                            v.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'
                          }`} />
                          {v.type?.replace(/_/g, ' ')}
                        </div>
                        {v.description && (
                          <div className="text-xs text-slate-400 mt-1 line-clamp-1 max-w-xs">
                            {v.description}
                          </div>
                        )}
                        {v.source && (
                          <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
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
                      <td className="p-4 text-xs text-slate-400 font-medium">
                        <span className="bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 text-slate-300">
                          {v.actionTaken || 'LOGGED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Proof Modal / Lightbox */}
      {selectedProof && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  selectedProof.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center">
                    Violation Proof Snapshot
                    <span className={`ml-3 text-xs px-2.5 py-0.5 rounded-full border font-bold ${getSeverityBadge(selectedProof.severity)}`}>
                      {selectedProof.severity}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {selectedProof.type.replace(/_/g, ' ')} &bull; {new Date(selectedProof.detectedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProof(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="p-6 flex flex-col items-center bg-slate-950/50">
              {selectedProof.screenshot ? (
                <div className="w-full relative rounded-xl overflow-hidden border border-slate-800 bg-black shadow-inner">
                  <img 
                    src={selectedProof.screenshot} 
                    alt="Violation Proof" 
                    className="w-full max-h-[460px] object-contain mx-auto"
                  />
                  <div className="absolute top-3 left-3 bg-rose-600/90 text-white text-[11px] font-extrabold px-2.5 py-1 rounded shadow-lg uppercase tracking-wider flex items-center">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                    Indisputable Evidence
                  </div>
                </div>
              ) : (
                <div className="w-full py-20 flex flex-col items-center justify-center text-slate-500">
                  <Camera className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">No screenshot captured for this record.</p>
                </div>
              )}

              {/* Violation Info Grid */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-xs bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block font-semibold">Candidate:</span>
                    <span className="text-white font-bold">{selectedProof.candidateId?.name || 'Unknown'}</span>
                    <span className="text-slate-400 ml-2 font-mono">({selectedProof.candidateId?.email || 'N/A'})</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block font-semibold">Exam:</span>
                    <span className="text-white font-bold">{selectedProof.attemptId?.examId?.title || 'Unknown Exam'}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2 md:col-span-2 pt-2 border-t border-slate-800">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-semibold">Reason / Description:</span>
                    <span className="text-slate-200">
                      {selectedProof.description || 'System detected policy violation event during examination session.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                Log ID: {selectedProof._id}
              </span>
              <div className="flex space-x-3">
                {selectedProof.screenshot && (
                  <a 
                    href={selectedProof.screenshot} 
                    download={`violation-proof-${selectedProof._id}.jpg`}
                    className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition"
                  >
                    <Download className="w-4 h-4 mr-2" /> Download Proof
                  </a>
                )}
                <button 
                  onClick={() => setSelectedProof(null)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
