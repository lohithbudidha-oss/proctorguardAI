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
  FileText,
  RefreshCw,
  BarChart3,
  CheckCircle
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
  source: string;
  actionTaken: string;
  description?: string;
  screenshot?: string;
  snapshotImage?: string;
  driveUrl?: string;
  driveFolderUrl?: string;
}

export interface CandidateExamSummary {
  examId: string;
  attemptId: string;
  examTitle: string;
  attemptStatus?: string;
  startedAt?: string;
  submittedAt?: string;
  duration?: number;
  score?: number;
  percentage?: number;
  violations: ViolationItem[];
  totalViolations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  proofCount: number;
  latestScreenshot?: string;
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
  examsWrittenCount: number;
  exams: CandidateExamSummary[];
}

export default function ViolationQueuePage() {
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [candidateAttempts, setCandidateAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const [selectedExamKey, setSelectedExamKey] = useState<string>('ALL');
  const [selectedProof, setSelectedProof] = useState<ViolationItem | null>(null);
  const [activeRealtimeAlert, setActiveRealtimeAlert] = useState<ViolationItem | null>(null);
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [syncingDrive, setSyncingDrive] = useState(false);

  useEffect(() => {
    fetchViolations();
    fetchDriveStatus();

    const handleWindowMsg = (e: MessageEvent) => {
      if (e.data?.type === 'GOOGLE_DRIVE_CONNECTED') {
        fetchDriveStatus();
        fetchViolations();
      }
    };
    window.addEventListener('message', handleWindowMsg);

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : 'https://proctorguardai.onrender.com');
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

    socket.on('violation:updated', (data) => {
      if (data?.violationId) {
        setViolations((prev) =>
          prev.map((v) =>
            v._id === data.violationId
              ? { ...v, ...(data.violation || {}), driveUrl: data.driveUrl || v.driveUrl }
              : v
          )
        );
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
      window.removeEventListener('message', handleWindowMsg);
      socket.disconnect();
    };
  }, []);

  const fetchDriveStatus = async () => {
    try {
      const res = await api.get('/admin/drive/status');
      setDriveStatus(res.data);
    } catch (e) {}
  };

  const handleSyncPendingProofs = async () => {
    setSyncingDrive(true);
    try {
      const res = await api.post('/admin/drive/sync-pending');
      alert(res.data?.message || 'Drive sync completed successfully!');
      fetchViolations();
      fetchDriveStatus();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to sync with Google Drive');
    } finally {
      setSyncingDrive(false);
    }
  };

  const fetchViolations = async () => {
    try {
      const res = await api.get('/admin/violations');
      let items: ViolationItem[] = (res.data.violations || []).map((v: any) => ({
        ...v,
        screenshot: v.screenshot || v.snapshotImage || v.image,
        snapshotImage: v.screenshot || v.snapshotImage || v.image
      }));
      setCandidateAttempts(res.data.candidateAttempts || []);

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

  // Group violations by candidate, then by exams written by each candidate
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
          driveUrl: v.driveUrl || v.driveFolderUrl,
          examsWrittenCount: 0,
          exams: []
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

        if (new Date(v.detectedAt).getTime() > new Date(group.latestViolation.detectedAt).getTime()) {
          group.latestViolation = v;
          if (v.screenshot) {
            group.latestScreenshot = v.screenshot;
          }
        }

        const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        if ((rank[v.severity] || 0) > (rank[group.highestSeverity] || 0)) {
          group.highestSeverity = v.severity;
        }

        if (v.type && !group.uniqueTypes.includes(v.type)) {
          group.uniqueTypes.push(v.type);
        }
      }
    });

    // Populate all exams written by each candidate
    map.forEach((group) => {
      const examMap = new Map<string, CandidateExamSummary>();
      const candIdStr = group.candidateId?._id?.toString();
      const candEmailStr = group.candidateEmail?.toLowerCase().trim();

      // 1. Process all attempts belonging to this candidate
      candidateAttempts.forEach((att: any) => {
        const attCandId = (att.candidateId?._id || att.candidateId)?.toString();
        const attCandEmail = att.candidateId?.email?.toLowerCase().trim();
        const matches = (candIdStr && attCandId === candIdStr) || (candEmailStr && attCandEmail === candEmailStr);

        if (matches) {
          const attemptId = att._id?.toString() || '';
          const examId = (att.examId?._id || att.examId)?.toString() || attemptId;
          const examKey = attemptId || examId;
          const exTitle = att.examId?.title || 'Examination Assessment';

          examMap.set(examKey, {
            examId,
            attemptId,
            examTitle: exTitle,
            attemptStatus: att.status,
            startedAt: att.startedAt || att.createdAt,
            submittedAt: att.submittedAt,
            duration: att.examId?.duration,
            score: att.score,
            percentage: att.percentage,
            violations: [],
            totalViolations: 0,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            proofCount: 0
          });
        }
      });

      // 2. Associate violations to exams, and insert any exams from violations that were missing
      group.violations.forEach((v) => {
        const vAttemptId = v.attemptId?._id?.toString() || (v.attemptId as any)?.toString() || '';
        const vExamId = v.attemptId?.examId?._id?.toString() || (v.attemptId?.examId as any)?.toString() || '';
        const vExamTitle = v.attemptId?.examId?.title || 'Examination Assessment';

        let existingEx: CandidateExamSummary | undefined = undefined;
        if (vAttemptId && examMap.has(vAttemptId)) {
          existingEx = examMap.get(vAttemptId);
        } else if (vExamId && examMap.has(vExamId)) {
          existingEx = examMap.get(vExamId);
        } else {
          existingEx = Array.from(examMap.values()).find(
            (ex) => (vAttemptId && ex.attemptId === vAttemptId) || (vExamId && ex.examId === vExamId)
          );
        }

        let targetKey = existingEx ? (existingEx.attemptId || existingEx.examId) : (vAttemptId || vExamId || ('general_exam_' + group.key));

        if (!existingEx) {
          existingEx = {
            examId: vExamId || targetKey,
            attemptId: vAttemptId || targetKey,
            examTitle: vExamTitle,
            startedAt: v.detectedAt,
            violations: [],
            totalViolations: 0,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            proofCount: 0
          };
          examMap.set(targetKey, existingEx);
        }

        existingEx.violations.push(v);
        existingEx.totalViolations += 1;
        if (v.severity === 'CRITICAL') existingEx.criticalCount += 1;
        if (v.severity === 'HIGH') existingEx.highCount += 1;
        if (v.severity === 'MEDIUM') existingEx.mediumCount += 1;
        if (v.severity === 'LOW') existingEx.lowCount += 1;
        if (v.screenshot) {
          existingEx.proofCount += 1;
          if (!existingEx.latestScreenshot) {
            existingEx.latestScreenshot = v.screenshot;
          }
        }
      });

      // Sort candidate's exams: exams with violations first, then by date desc
      const sortedExams = Array.from(examMap.values()).sort(
        (a, b) => b.totalViolations - a.totalViolations || new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
      );

      group.exams = sortedExams;
      group.examsWrittenCount = sortedExams.length;
    });

    // Sort candidate groups by latest detected violation descending
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latestViolation.detectedAt).getTime() - new Date(a.latestViolation.detectedAt).getTime()
    );
  }, [violations, candidateAttempts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetCandidate = params.get('candidateId') || params.get('candidate');
    const targetExam = params.get('examId');

    if (targetCandidate && candidateGroups.length > 0) {
      const match = candidateGroups.find(
        (g) =>
          g.key === targetCandidate ||
          g.candidateId?._id === targetCandidate ||
          (g.candidateEmail && g.candidateEmail.toLowerCase() === targetCandidate.toLowerCase())
      );
      if (match) {
        setSelectedCandidateKey(match.key);
        if (targetExam) {
          setSelectedExamKey(targetExam);
        }
      }
    }
  }, [candidateGroups]);

  // Filter groups according to search query and severity
  const filteredGroups = useMemo(() => {
    const rawQuery = searchQuery.trim().toLowerCase();
    const queryTokens = rawQuery.split(/\s+/).filter(Boolean);

    return candidateGroups.filter((g) => {
      // 1. Severity Filter
      const matchesSeverity =
        severityFilter === 'ALL' ||
        g.violations.some((v) => v.severity === severityFilter);

      if (!matchesSeverity) return false;
      if (queryTokens.length === 0) return true;

      // 2. Build rich searchable blob for this candidate including all exams written
      const searchParts: string[] = [
        g.candidateName || '',
        g.candidateEmail || '',
        g.highestSeverity || '',
        g.key || '',
        `${g.totalViolations} violations`,
        `${g.examsWrittenCount} exams written`,
        g.proofCount > 0 ? `${g.proofCount} proofs screenshots images snapshots` : 'no snapshots'
      ];

      // Index all exams written by this candidate
      g.exams.forEach((ex) => {
        searchParts.push(ex.examTitle || '');
        searchParts.push(ex.attemptStatus || '');
      });

      g.violations.forEach((v) => {
        searchParts.push(v.type || '');
        searchParts.push((v.type || '').replace(/_/g, ' '));
        searchParts.push(v.severity || '');
        searchParts.push(v.description || '');
        searchParts.push(v.actionTaken || '');
        const info = getViolationInfo(v.type, v.description);
        searchParts.push(info.title);
        searchParts.push(info.actionDone);
        searchParts.push(info.ruleBreached);
        searchParts.push(info.categoryLabel);
      });

      const groupBlob = searchParts.join(' ').toLowerCase();
      return queryTokens.every((token) => groupBlob.includes(token));
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

  // Selected exam within the candidate modal
  const selectedExam = useMemo(() => {
    if (!activeCandidateGroup || selectedExamKey === 'ALL') return null;
    return (
      activeCandidateGroup.exams.find(
        (ex) =>
          (ex.attemptId && ex.attemptId === selectedExamKey) ||
          (ex.examId && ex.examId === selectedExamKey)
      ) || null
    );
  }, [activeCandidateGroup, selectedExamKey]);

  // Violations filtered by chosen exam
  const displayedViolations = useMemo(() => {
    if (!activeCandidateGroup) return [];
    if (selectedExamKey === 'ALL') return activeCandidateGroup.violations;

    if (selectedExam) {
      return selectedExam.violations;
    }
    return activeCandidateGroup.violations.filter((v) => {
      const aId = v.attemptId?._id?.toString() || (v.attemptId as any)?.toString();
      const eId = v.attemptId?.examId?._id?.toString() || (v.attemptId?.examId as any)?.toString();
      return aId === selectedExamKey || eId === selectedExamKey;
    });
  }, [activeCandidateGroup, selectedExamKey, selectedExam]);

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
        <div className="flex items-center space-x-3">
          <Link 
            href="/admin/monitoring" 
            className="flex items-center text-sm font-bold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Candidates
          </Link>
          <Link 
            href="/admin/results" 
            className="flex items-center text-sm font-bold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <BarChart3 className="w-4 h-4 mr-1.5 text-slate-400" /> Results
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

        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          {driveStatus?.isConfigured ? (
            <span className="hidden sm:inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              Google Drive Auto-Upload Active
            </span>
          ) : (
            <a
              href={`${(process.env.NEXT_PUBLIC_API_URL || 'https://proctorguardai.onrender.com/api').replace(/\/api\/?$/, '')}/api/auth/google/drive-auth`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs inline-flex items-center transition cursor-pointer"
              title="Click to authorize automatic Google Drive proof uploads to folder 1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1"
            >
              <HardDrive className="w-3.5 h-3.5 mr-1.5" />
              Connect Google Drive
            </a>
          )}

          <button
            onClick={handleSyncPendingProofs}
            disabled={syncingDrive}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition flex items-center cursor-pointer disabled:opacity-60"
            title="Auto-sync all pending violation proof images from database to Google Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncingDrive ? 'animate-spin text-blue-600' : ''}`} />
            Sync Drive
          </button>

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
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-9 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium"
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
                    <th className="p-4">Exams Written</th>
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
                        onClick={() => {
                          setSelectedCandidateKey(group.key);
                          setSelectedExamKey('ALL');
                        }}
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

                        {/* Exams Written by Candidate */}
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5 max-w-xs">
                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                                <BookOpen className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                                {group.examsWrittenCount} {group.examsWrittenCount === 1 ? 'Exam Written' : 'Exams Written'}
                              </span>
                            </div>
                            {/* Exam pills */}
                            <div className="flex flex-wrap gap-1">
                              {group.exams.map((ex, idx) => (
                                <button
                                  key={ex.attemptId || ex.examId || idx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCandidateKey(group.key);
                                    setSelectedExamKey(ex.attemptId || ex.examId);
                                  }}
                                  title={`Click to check violations for "${ex.examTitle}"`}
                                  className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-lg border bg-slate-50 hover:bg-rose-50 hover:border-rose-300 text-slate-700 hover:text-rose-700 transition max-w-[210px]"
                                >
                                  <span className="truncate mr-1.5">{ex.examTitle}</span>
                                  {ex.totalViolations > 0 ? (
                                    <span className="shrink-0 text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                      {ex.totalViolations}
                                    </span>
                                  ) : (
                                    <span className="shrink-0 text-[10px] font-semibold px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                                      ✓ Clean
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
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
                              setSelectedExamKey('ALL');
                            }}
                            className="inline-flex items-center px-3.5 py-1.5 bg-rose-50 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 shadow-2xs group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600 hover:!bg-rose-700 hover:!text-white hover:!border-rose-700 transition-all cursor-pointer active:scale-95"
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
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                      {activeCandidateGroup.examsWrittenCount} {activeCandidateGroup.examsWrittenCount === 1 ? 'Exam Written' : 'Exams Written'}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                      {activeCandidateGroup.totalViolations} {activeCandidateGroup.totalViolations === 1 ? 'Violation' : 'Violations'} Recorded
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold border ${getSeverityBadge(activeCandidateGroup.highestSeverity)}`}>
                      Highest: {activeCandidateGroup.highestSeverity}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-500 font-mono mt-1">
                    <span>{activeCandidateGroup.candidateEmail}</span>
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
                <span className="flex items-center text-blue-700">
                  <BookOpen className="w-3.5 h-3.5 mr-1 text-blue-500" />
                  {activeCandidateGroup.examsWrittenCount} {activeCandidateGroup.examsWrittenCount === 1 ? 'Exam Written' : 'Exams Written'}
                </span>
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

            {/* Exams Written by Candidate Overview & Interactive Filter Selector */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center">
                    <BookOpen className="w-4 h-4 mr-1.5 text-blue-600" />
                    Exams Written by Candidate ({activeCandidateGroup.examsWrittenCount})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select an exam below or choose from the dropdown to check violations specifically for that assessment.
                  </p>
                </div>

                {/* Quick Dropdown Filter */}
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Filter Exam:</span>
                  <select
                    value={selectedExamKey}
                    onChange={(e) => setSelectedExamKey(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer max-w-[280px] truncate"
                  >
                    <option value="ALL">
                      All Exams Written ({activeCandidateGroup.examsWrittenCount} Exams • {activeCandidateGroup.totalViolations} Violations)
                    </option>
                    {activeCandidateGroup.exams.map((ex) => (
                      <option 
                        key={ex.attemptId || ex.examId} 
                        value={ex.attemptId || ex.examId}
                      >
                        {ex.examTitle} ({ex.totalViolations} {ex.totalViolations === 1 ? 'Violation' : 'Violations'}{ex.attemptStatus ? ` • ${ex.attemptStatus}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interactive Exam Cards / Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                {/* 'All Exams' Card Button */}
                <button
                  type="button"
                  onClick={() => setSelectedExamKey('ALL')}
                  className={`text-left p-3 rounded-2xl border transition flex flex-col justify-between ${
                    selectedExamKey === 'ALL'
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center">
                      <Layers className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      All Exams Combined
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      {activeCandidateGroup.examsWrittenCount} Written
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px]">
                    <span className="font-bold text-rose-700">
                      {activeCandidateGroup.totalViolations} Total Violations
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {activeCandidateGroup.proofCount} Proofs
                    </span>
                  </div>
                </button>

                {/* Individual Exam Cards */}
                {activeCandidateGroup.exams.map((ex) => {
                  const isSelected = (ex.attemptId && ex.attemptId === selectedExamKey) || (ex.examId && ex.examId === selectedExamKey);
                  return (
                    <button
                      key={ex.attemptId || ex.examId}
                      type="button"
                      onClick={() => setSelectedExamKey(ex.attemptId || ex.examId)}
                      className={`text-left p-3 rounded-2xl border transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="text-xs font-extrabold text-slate-900 line-clamp-1" title={ex.examTitle}>
                          {ex.examTitle}
                        </span>
                        {ex.attemptStatus && (
                          <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {ex.attemptStatus}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 text-[11px]">
                        {ex.totalViolations > 0 ? (
                          <span className="font-extrabold text-rose-700 flex items-center">
                            <AlertTriangle className="w-3 h-3 mr-1 text-rose-500" />
                            {ex.totalViolations} {ex.totalViolations === 1 ? 'Violation' : 'Violations'}
                          </span>
                        ) : (
                          <span className="font-extrabold text-emerald-700 flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Clean (0 Violations)
                          </span>
                        )}

                        {ex.proofCount > 0 ? (
                          <span className="text-indigo-600 text-[10px] font-bold flex items-center">
                            <Camera className="w-3 h-3 mr-0.5" />
                            {ex.proofCount} Proofs
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">
                            {ex.startedAt ? new Date(ex.startedAt).toLocaleDateString() : 'Attempted'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Violations List for chosen exam */}
            <div className="p-6 space-y-5 bg-slate-50/50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 text-slate-400" />
                  {selectedExam ? (
                    <span>
                      Violations for: <span className="text-slate-900 font-black">{selectedExam.examTitle}</span> ({displayedViolations.length})
                    </span>
                  ) : (
                    <span>
                      Violations Timeline Across All Written Exams ({displayedViolations.length})
                    </span>
                  )}
                </h3>

                {selectedExamKey !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedExamKey('ALL')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center hover:underline"
                  >
                    &larr; View Violations For All Exams
                  </button>
                )}
              </div>

              {/* When no violations exist for selected exam */}
              {displayedViolations.length === 0 ? (
                <div className="bg-white border border-emerald-200 rounded-3xl p-10 flex flex-col items-center text-center shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-200 shadow-2xs">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-black text-slate-900">
                    Clean Examination Attempt
                  </h4>
                  <p className="text-slate-600 text-xs max-w-md mt-1.5 leading-relaxed">
                    Zero violations logged for <span className="font-bold text-slate-800">{selectedExam?.examTitle || 'this exam'}</span>. 
                    The candidate completed this examination session without any recorded suspicious activity or integrity breaches.
                  </p>
                  <div className="mt-4 flex items-center space-x-3 text-xs font-mono">
                    <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      Status: {selectedExam?.attemptStatus || 'COMPLETED'}
                    </span>
                    {selectedExam?.duration && (
                      <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                        Duration: {selectedExam.duration} mins
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                displayedViolations.map((v, idx) => {
                  const info = getViolationInfo(v.type, v.description);
                  const examTitle = v.attemptId?.examId?.title || 'Examination Assessment';
                  return (
                    <div 
                      key={v._id || idx}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-rose-200 transition-colors"
                    >
                      {/* Violation Header */}
                      <div className="flex items-start justify-between flex-wrap gap-3 pb-4 border-b border-slate-100">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200">
                            #{displayedViolations.length - idx}
                          </span>
                          <div>
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className="font-extrabold text-sm text-slate-900">
                                {info.title}
                              </span>
                              <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${getSeverityBadge(v.severity)}`}>
                                {v.severity}
                              </span>
                              <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                                {info.categoryLabel}
                              </span>
                              {selectedExamKey === 'ALL' && (
                                <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md border border-blue-200 flex items-center">
                                  <BookOpen className="w-3 h-3 mr-1 text-blue-500" />
                                  {examTitle}
                                </span>
                              )}
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
                            {v.driveUrl && !v.driveUrl.includes('folders/') ? (
                              <a
                                href={v.driveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold inline-flex items-center transition border border-emerald-200"
                                title="Directly view this snapshot proof on Google Drive"
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                View on Drive
                                <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                              </a>
                            ) : (
                              <a
                                href={v.driveUrl || v.driveFolderUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing'}
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
                })
              )}
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
