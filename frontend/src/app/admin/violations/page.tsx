'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Calendar,
  ChevronRight,
  Users,
  Layers,
  FileText
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

interface CandidateViolationGroup {
  key: string;
  candidateId?: {
    _id?: string;
    name?: string;
    email?: string;
  };
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  attemptId?: string;
  violations: ViolationItem[];
  totalViolations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  proofCount: number;
  latestViolation: ViolationItem;
  highestSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  uniqueTypes: string[];
  latestScreenshot?: string;
  driveUrl?: string;
}

export default function ViolationQueuePage() {
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
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
        const raw = data.violation;
        const newV = {
          ...raw,
          screenshot: raw.screenshot || raw.snapshotImage || raw.image || '',
          snapshotImage: raw.snapshotImage || raw.screenshot || raw.image || ''
        };
        setViolations((prev) => {
          const exists = prev.some((v) => v._id && newV._id && v._id === newV._id);
          if (exists) {
            return prev.map((v) => (v._id === newV._id ? { ...v, ...newV } : v));
          }
          return [newV, ...prev];
        });
        setActiveRealtimeAlert(newV);
        setTimeout(() => setActiveRealtimeAlert(null), 6000);
      }
    });

    socket.on('evidence:snapshot_alert', (data) => {
      const shot = data?.image || data?.screenshot || '';
      if (shot) {
        setViolations((prev) => {
          const targetIdx = prev.findIndex((v) => {
            const matchAttempt = data.attemptId && (v.attemptId?._id === data.attemptId || v.attemptId === data.attemptId);
            return matchAttempt && (!v.screenshot || v.type === data.type);
          });
          if (targetIdx !== -1) {
            const updated = [...prev];
            updated[targetIdx] = { ...updated[targetIdx], screenshot: shot, snapshotImage: shot };
            return updated;
          }
          return prev;
        });
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

  // Group violations by candidate
  const candidateGroups = useMemo<CandidateViolationGroup[]>(() => {
    const map = new Map<string, CandidateViolationGroup>();

    violations.forEach((v) => {
      const candidateKey =
        v.candidateId?._id ||
        (v.candidateId?.email ? v.candidateId.email.toLowerCase().trim() : '') ||
        v.attemptId?._id ||
        v._id;

      const cName = v.candidateId?.name || 'Unknown Candidate';
      const cEmail = v.candidateId?.email || 'N/A';
      const examTitle = v.attemptId?.examId?.title || 'Examination';

      if (!map.has(candidateKey)) {
        map.set(candidateKey, {
          key: candidateKey,
          candidateId: v.candidateId,
          candidateName: cName,
          candidateEmail: cEmail,
          examTitle,
          attemptId: v.attemptId?._id,
          violations: [v],
          totalViolations: 1,
          criticalCount: v.severity === 'CRITICAL' ? 1 : 0,
          highCount: v.severity === 'HIGH' ? 1 : 0,
          mediumCount: v.severity === 'MEDIUM' ? 1 : 0,
          lowCount: v.severity === 'LOW' ? 1 : 0,
          proofCount: v.screenshot ? 1 : 0,
          latestViolation: v,
          highestSeverity: v.severity,
          uniqueTypes: [v.type],
          latestScreenshot: v.screenshot,
          driveUrl: v.driveUrl || v.driveFolderUrl
        });
      } else {
        const group = map.get(candidateKey)!;
        group.violations.push(v);
        group.totalViolations += 1;
        if (v.severity === 'CRITICAL') group.criticalCount += 1;
        if (v.severity === 'HIGH') group.highCount += 1;
        if (v.severity === 'MEDIUM') group.mediumCount += 1;
        if (v.severity === 'LOW') group.lowCount += 1;

        if (v.screenshot) {
          group.proofCount += 1;
          if (!group.latestScreenshot) {
            group.latestScreenshot = v.screenshot;
          }
        }

        if (v.driveUrl || v.driveFolderUrl) {
          group.driveUrl = v.driveUrl || v.driveFolderUrl;
        }

        // Check if this violation is newer than the recorded latest
        if (new Date(v.detectedAt).getTime() > new Date(group.latestViolation.detectedAt).getTime()) {
          group.latestViolation = v;
          if (v.screenshot) {
            group.latestScreenshot = v.screenshot;
          }
        }

        // Rank highest severity
        const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        if ((rank[v.severity] || 0) > (rank[group.highestSeverity] || 0)) {
          group.highestSeverity = v.severity;
        }

        if (v.type && !group.uniqueTypes.includes(v.type)) {
          group.uniqueTypes.push(v.type);
        }
      }
    });

    // Sort candidate groups by latest detected violation descending
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latestViolation.detectedAt).getTime() - new Date(a.latestViolation.detectedAt).getTime()
    );
  }, [violations]);

  // Filter groups according to search query and severity
  const filteredGroups = useMemo(() => {
    return candidateGroups.filter((g) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        g.candidateName.toLowerCase().includes(q) ||
        g.candidateEmail.toLowerCase().includes(q) ||
        g.examTitle.toLowerCase().includes(q) ||
        g.uniqueTypes.some((t) => t.toLowerCase().includes(q) || t.replace(/_/g, ' ').toLowerCase().includes(q));

      const matchesSeverity =
        severityFilter === 'ALL' ||
        g.violations.some((v) => v.severity === severityFilter);

      return matchesSearch && matchesSeverity;
    });
  }, [candidateGroups, searchQuery, severityFilter]);

  // Metrics
  const totalViolations = violations.length;
  const flaggedCandidatesCount = candidateGroups.length;
  const criticalCount = violations.filter((v) => v.severity === 'CRITICAL').length;
  const proofCount = violations.filter((v) => Boolean(v.screenshot)).length;

  // Active selected candidate group for modal/drawer view
  const activeCandidateGroup = useMemo(() => {
    if (!selectedCandidateKey) return null;
    return candidateGroups.find((g) => g.key === selectedCandidateKey) || null;
  }, [selectedCandidateKey, candidateGroups]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-rose-500/20">
      {/* Realtime Alert Toast */}
      {activeRealtimeAlert && (
        <div className="fixed top-5 right-5 z-[90] max-w-md bg-white border border-rose-200 text-slate-900 p-4 rounded-xl shadow-2xl animate-in slide-in-from-top duration-300 flex items-start space-x-3">
          <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1 text-sm">
            <p className="font-extrabold text-rose-700">New Violation Flagged</p>
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

      {/* Top Bar Header */}
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
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Violation Review Queue</h1>
              <p className="text-xs text-slate-500 font-medium">Candidate Infraction Logs & Evidence</p>
            </div>
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
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Flagged Candidates</span>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">{flaggedCandidatesCount}</div>
            <p className="text-xs text-slate-500 mt-1">Candidates with logged exam infractions</p>
          </div>

          <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Total Violations</span>
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div className="text-3xl font-black text-rose-600 mt-2">{totalViolations}</div>
            <p className="text-xs text-slate-500 mt-1">Recorded infractions across all sessions</p>
          </div>

          <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Critical Incidents</span>
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-black text-amber-600 mt-2">{criticalCount}</div>
            <p className="text-xs text-slate-500 mt-1">Severe proctoring policy breaches</p>
          </div>

          <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Screenshot Proofs</span>
              <Camera className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-black text-indigo-600 mt-2">{proofCount}</div>
            <p className="text-xs text-slate-500 mt-1">Captured image evidence snapshots</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidate name, email, exam, or violation..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium"
            />
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1.5" /> Severity Filter:
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

        {/* Candidates With Violations Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="font-semibold text-sm text-slate-600">Loading flagged candidates...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-20 flex flex-col items-center text-center">
              <ShieldCheck className="w-16 h-16 text-emerald-500 mb-4 opacity-90" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Flagged Candidates Found</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {searchQuery || severityFilter !== 'ALL'
                  ? 'No candidates match your current search and severity filters.'
                  : 'All candidate examination sessions are clean with zero violations flagged.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-extrabold uppercase tracking-wider">
                    <th className="p-4">Candidate</th>
                    <th className="p-4">Exam Assessment</th>
                    <th className="p-4">Violations Committed</th>
                    <th className="p-4">Highest Severity</th>
                    <th className="p-4">Evidence Proofs</th>
                    <th className="p-4">Latest Infraction</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredGroups.map((group) => {
                    const initials = group.candidateName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'CD';

                    return (
                      <tr 
                        key={group.key} 
                        onClick={() => setSelectedCandidateKey(group.key)}
                        className="hover:bg-rose-50/30 transition-colors group cursor-pointer"
                      >
                        {/* Candidate Column */}
                        <td className="p-4">
                          <div className="flex items-center space-x-3.5">
                            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                              {initials}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 group-hover:text-rose-600 transition-colors flex items-center">
                                {group.candidateName}
                                <span className="ml-2 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                  {group.totalViolations} {group.totalViolations === 1 ? 'Event' : 'Events'}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">
                                {group.candidateEmail}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Exam Assessment */}
                        <td className="p-4">
                          <div className="flex items-center text-slate-800 font-bold">
                            <BookOpen className="w-4 h-4 text-blue-500 mr-2 shrink-0" />
                            <span className="truncate max-w-[200px]" title={group.examTitle}>
                              {group.examTitle}
                            </span>
                          </div>
                        </td>

                        {/* Violations Summary */}
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-black text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                {group.totalViolations} Violations
                              </span>
                              {group.criticalCount > 0 && (
                                <span className="text-[10px] font-bold text-rose-600">
                                  ({group.criticalCount} Critical)
                                </span>
                              )}
                            </div>
                            {/* Type tags */}
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {group.uniqueTypes.slice(0, 2).map((t) => (
                                <span 
                                  key={t}
                                  className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[140px]"
                                >
                                  {t.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {group.uniqueTypes.length > 2 && (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                  +{group.uniqueTypes.length - 2} more
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Highest Severity Badge */}
                        <td className="p-4">
                          <span className={`text-xs font-extrabold px-3 py-1 rounded-full border inline-block ${getSeverityBadge(group.highestSeverity)}`}>
                            {group.highestSeverity}
                          </span>
                        </td>

                        {/* Evidence Proofs Column */}
                        <td className="p-4">
                          {group.latestScreenshot ? (
                            <div className="flex items-center space-x-2.5">
                              <div className="relative w-12 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shrink-0 shadow-2xs">
                                <img 
                                  src={group.latestScreenshot} 
                                  alt="Proof thumbnail" 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <span className="inline-flex items-center text-xs font-bold text-indigo-700">
                                  <Camera className="w-3.5 h-3.5 mr-1" />
                                  {group.proofCount} Proof {group.proofCount === 1 ? 'Image' : 'Images'}
                                </span>
                                <span className="text-[10px] text-slate-400 block">Available</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic flex items-center">
                              <Camera className="w-3.5 h-3.5 mr-1 opacity-40" /> No snapshots
                            </span>
                          )}
                        </td>

                        {/* Latest Infraction */}
                        <td className="p-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                          <div className="text-slate-800 font-bold">
                            {new Date(group.latestViolation.detectedAt).toLocaleDateString()}
                          </div>
                          <div className="text-slate-400 mt-0.5">
                            {new Date(group.latestViolation.detectedAt).toLocaleTimeString()}
                          </div>
                        </td>

                        {/* Action Column */}
                        <td className="p-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCandidateKey(group.key);
                            }}
                            className="inline-flex items-center px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors shadow-2xs group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600"
                          >
                            View Violations ({group.totalViolations})
                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </button>
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

      {/* Candidate Violations Detail Drawer / Modal */}
      {activeCandidateGroup && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col custom-scrollbar">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center font-extrabold text-base shrink-0 shadow-xs">
                  {activeCandidateGroup.candidateName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'CD'}
                </div>
                <div>
                  <div className="flex items-center space-x-2.5 flex-wrap">
                    <h2 className="text-lg font-black text-slate-900">
                      {activeCandidateGroup.candidateName}
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                      {activeCandidateGroup.totalViolations} {activeCandidateGroup.totalViolations === 1 ? 'Violation' : 'Violations'} Recorded
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold border ${getSeverityBadge(activeCandidateGroup.highestSeverity)}`}>
                      Highest: {activeCandidateGroup.highestSeverity}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-500 font-mono mt-1">
                    <span>{activeCandidateGroup.candidateEmail}</span>
                    <span>&bull;</span>
                    <span className="font-bold text-slate-700 flex items-center">
                      <BookOpen className="w-3.5 h-3.5 mr-1 text-blue-500" />
                      {activeCandidateGroup.examTitle}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={activeCandidateGroup.driveUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center transition shadow-2xs"
                >
                  <HardDrive className="w-3.5 h-3.5 mr-1.5" />
                  Google Drive Folder
                  <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                </a>
                <button 
                  onClick={() => setSelectedCandidateKey(null)}
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar for this Candidate */}
            <div className="bg-slate-100/70 border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-wrap gap-2 text-xs font-bold text-slate-600">
              <div className="flex items-center space-x-4">
                <span className="flex items-center text-rose-700">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1 text-rose-500" />
                  {activeCandidateGroup.criticalCount} Critical
                </span>
                <span className="flex items-center text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  {activeCandidateGroup.highCount} High
                </span>
                <span className="flex items-center text-indigo-700">
                  <Camera className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                  {activeCandidateGroup.proofCount} Proof Snapshots
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-normal">
                Click any screenshot thumbnail to view full resolution proof and telemetry details
              </span>
            </div>

            {/* Violations List for this Candidate */}
            <div className="p-6 space-y-5 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 text-slate-400" />
                  Violations Timeline for {activeCandidateGroup.candidateName} ({activeCandidateGroup.violations.length})
                </h3>
              </div>

              {activeCandidateGroup.violations.map((v, idx) => {
                const info = getViolationInfo(v.type, v.description);
                return (
                  <div 
                    key={v._id || idx}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-rose-200 transition-colors"
                  >
                    {/* Violation Header */}
                    <div className="flex items-start justify-between flex-wrap gap-3 pb-4 border-b border-slate-100">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200">
                          #{activeCandidateGroup.violations.length - idx}
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-sm text-slate-900">
                              {info.title}
                            </span>
                            <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${getSeverityBadge(v.severity)}`}>
                              {v.severity}
                            </span>
                            <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                              {info.categoryLabel}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-slate-500 font-mono mt-1">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                              {new Date(v.detectedAt).toLocaleString()}
                            </span>
                            {v.source && (
                              <span>&bull; Source: <span className="font-semibold text-slate-700">{v.source}</span></span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          Action: {v.actionTaken || 'LOGGED'}
                        </span>
                      </div>
                    </div>

                    {/* Violation Content: Proof Image & Explanation */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                      {/* Screenshot proof */}
                      <div className="md:col-span-5">
                        {v.screenshot ? (
                          <div 
                            onClick={() => setSelectedProof(v)}
                            className="relative group/thumb cursor-pointer w-full h-44 rounded-xl overflow-hidden border border-slate-200 hover:border-rose-500 shadow-sm bg-slate-900 transition-all transform hover:scale-[1.02]"
                            title="Click to enlarge proof snapshot"
                          >
                            <img 
                              src={v.screenshot} 
                              alt="Violation proof snapshot" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-slate-900/30 group-hover/thumb:bg-slate-900/10 transition-colors flex items-center justify-center">
                              <span className="bg-rose-600/90 text-white text-xs font-extrabold px-3 py-1 rounded-lg shadow-md flex items-center">
                                <Eye className="w-3.5 h-3.5 mr-1.5" /> View Proof Snapshot
                              </span>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded">
                              {new Date(v.detectedAt).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-44 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 text-xs">
                            <Camera className="w-6 h-6 mb-1 opacity-40" />
                            <span className="font-medium text-slate-400">No snapshot image captured</span>
                          </div>
                        )}
                      </div>

                      {/* Detailed Violation Explanation */}
                      <div className="md:col-span-7 flex flex-col space-y-3">
                        {/* What the candidate did */}
                        <div className="bg-rose-50/80 rounded-xl p-3.5 border border-rose-200">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 block mb-1">
                            What Candidate Did During Exam:
                          </span>
                          <p className="text-xs font-bold text-slate-900 leading-relaxed">
                            {info.actionDone}
                          </p>
                        </div>

                        {/* Examination Rule Breached */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-0.5">
                            Examination Rule Breached:
                          </span>
                          <p className="text-slate-800 font-medium">
                            {info.ruleBreached}
                          </p>
                        </div>

                        {/* Telemetry log description */}
                        {v.description && (
                          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-xs font-mono text-slate-600">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5 font-sans">
                              System Telemetry Event:
                            </span>
                            {v.description}
                          </div>
                        )}

                        {/* Interactive actions for this violation */}
                        <div className="pt-1 flex items-center space-x-3">
                          {v.screenshot && (
                            <button
                              onClick={() => setSelectedProof(v)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Enlarge Snapshot Proof
                            </button>
                          )}
                          {(v.driveUrl || v.driveFolderUrl) && (
                            <a
                              href={v.driveUrl || v.driveFolderUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center hover:underline"
                            >
                              <HardDrive className="w-3.5 h-3.5 mr-1" /> Open Drive File
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between sticky bottom-0 z-10">
              <span className="text-xs text-slate-500 font-mono">
                Candidate ID: {activeCandidateGroup.candidateId?._id || activeCandidateGroup.attemptId || 'Recorded'}
              </span>
              <button 
                onClick={() => setSelectedCandidateKey(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Done / Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Screenshot Proof Modal / Lightbox */}
      {selectedProof && (() => {
        const info = getViolationInfo(selectedProof.type, selectedProof.description);
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
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

                {/* Violation Description & Candidate Action Callout */}
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
