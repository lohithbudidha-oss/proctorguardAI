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
  Calendar,
  ChevronRight,
  Users,
  Layers,
  FileText,
  RefreshCw,
  BarChart3,
  CheckCircle,
  Activity,
  LogOut,
  UserCheck,
  LifeBuoy
} from 'lucide-react';
import api from '@/lib/api';
import { getViolationInfo } from '@/lib/violations';
import { sanitizeSearchInput } from '@/lib/sanitize';

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
    candidateId?: {
      _id?: string;
      name?: string;
      email?: string;
    };
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
  const [violations, setViolations] = useState<ViolationItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pg_cached_violations');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [candidateAttempts, setCandidateAttempts] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pg_cached_candidate_attempts');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pg_cached_violations');
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch (e) {}
    }
    return true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const [selectedExamKey, setSelectedExamKey] = useState<string>('ALL');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>('ALL');
  const [selectedProof, setSelectedProof] = useState<ViolationItem | null>(null);
  const [activeRealtimeAlert, setActiveRealtimeAlert] = useState<ViolationItem | null>(null);
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

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

  const [loadingProofId, setLoadingProofId] = useState<string | null>(null);

  const handleOpenProof = async (v: ViolationItem) => {
    if (v.screenshot) {
      setSelectedProof(v);
      return;
    }
    // Fetch proof on-demand if screenshot wasn't pre-loaded to keep initial payload tiny
    setLoadingProofId(v._id);
    try {
      const res = await api.get(`/admin/violations/${v._id}/proof`);
      const fullScreenshot = res.data?.screenshot || '';
      const updatedV = { ...v, screenshot: fullScreenshot, snapshotImage: fullScreenshot, driveUrl: res.data?.driveUrl || v.driveUrl };
      setViolations(prev => prev.map(item => item._id === v._id ? updatedV : item));
      setSelectedProof(updatedV);
    } catch (err) {
      setSelectedProof(v);
    } finally {
      setLoadingProofId(null);
    }
  };

  const handleRefreshQueue = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshSuccess(null);
    setRefreshError(null);
    try {
      const count = await fetchViolations();
      await fetchDriveStatus();
      setRefreshSuccess(`Queue refreshed (${count} ${count === 1 ? 'incident' : 'incidents'})`);
      setTimeout(() => setRefreshSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error refreshing violation queue:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to refresh queue. Please try again.';
      setRefreshError(errMsg);
      setTimeout(() => setRefreshError(null), 4000);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchViolations = async () => {
    try {
      const res = await api.get('/admin/violations', {
        params: { _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      const rawList = Array.isArray(res.data)
        ? res.data
        : (res.data?.violations || res.data?.data || []);

      let items: ViolationItem[] = rawList.map((v: any) => ({
        ...v,
        screenshot: v.screenshot || v.snapshotImage || v.image,
        snapshotImage: v.screenshot || v.snapshotImage || v.image
      }));

      const rawAttempts = Array.isArray(res.data?.candidateAttempts)
        ? res.data.candidateAttempts
        : [];
      setCandidateAttempts(rawAttempts);

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

            const unlistedCached = cachedEvidence.filter((c) => {
              const cTime = c.detectedAt ? new Date(c.detectedAt).getTime() : 0;
              return !items.some((it) => {
                const itTime = it.detectedAt ? new Date(it.detectedAt).getTime() : 0;
                return it.type === c.type && Math.abs(itTime - cTime) < 10000;
              });
            });

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
      try {
        sessionStorage.setItem('pg_cached_violations', JSON.stringify(items.slice(0, 50)));
        sessionStorage.setItem('pg_cached_candidate_attempts', JSON.stringify(rawAttempts));
      } catch (e) {}
      return items.length;
    } catch (error) {
      console.error('Failed to fetch violations', error);
      throw error;
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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'TERMINATED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'FORCE_SUBMITTED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'LOCKED':
      case 'PAUSED':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Group violations by candidate, then by exams written by each candidate
  const candidateGroups = useMemo<CandidateViolationGroup[]>(() => {
    const map = new Map<string, CandidateViolationGroup>();

    // 0. Build attempt lookup for easy reference from candidateAttempts
    const attemptLookup = new Map<string, any>();
    candidateAttempts.forEach((att: any) => {
      const aId = att._id?.toString();
      if (aId) attemptLookup.set(aId, att);
    });

    violations.forEach((v) => {
      // 1. Resolve attempt ID
      const vAttId = (
        typeof v.attemptId === 'object' && v.attemptId !== null
          ? (v.attemptId._id || (v.attemptId as any).id)?.toString()
          : (v.attemptId ? String(v.attemptId) : '')
      ) || '';

      const matchedAttempt = vAttId ? attemptLookup.get(vAttId) : null;

      // 2. Resolve candidate details
      let candObj: any = null;
      if (v.candidateId && typeof v.candidateId === 'object' && (v.candidateId.name || v.candidateId.email || v.candidateId._id)) {
        candObj = v.candidateId;
      } else if (v.attemptId && typeof v.attemptId === 'object' && v.attemptId.candidateId && typeof v.attemptId.candidateId === 'object') {
        candObj = v.attemptId.candidateId;
      } else if (matchedAttempt?.candidateId && typeof matchedAttempt.candidateId === 'object') {
        candObj = matchedAttempt.candidateId;
      }

      const rawCandId = (
        candObj?._id?.toString() ||
        candObj?.id?.toString() ||
        (typeof v.candidateId === 'string' ? v.candidateId : '') ||
        (matchedAttempt?.candidateId?._id?.toString() || matchedAttempt?.candidateId?.toString() || '')
      );

      // If we don't have full candidate object but have an ID, search candidateAttempts
      if ((!candObj || !candObj.name) && rawCandId) {
        const foundAtt = candidateAttempts.find((ca: any) => {
          const cId = typeof ca.candidateId === 'object' ? ca.candidateId?._id?.toString() : ca.candidateId?.toString();
          return cId === rawCandId;
        });
        if (foundAtt?.candidateId && typeof foundAtt.candidateId === 'object') {
          candObj = foundAtt.candidateId;
        }
      }

      const cEmail = (candObj?.email || matchedAttempt?.candidateId?.email || '').trim();
      const cName = candObj?.name || matchedAttempt?.candidateId?.name || (cEmail && cEmail.includes('@') ? cEmail.split('@')[0] : 'Candidate');
      const examTitle = v.attemptId?.examId?.title || matchedAttempt?.examId?.title || 'Examination';

      // 3. Compute grouping candidateKey (NEVER fall back to v._id)
      let candidateKey = '';
      if (rawCandId) {
        candidateKey = rawCandId;
      } else if (cEmail && cEmail.includes('@') && cEmail.toLowerCase() !== 'n/a') {
        candidateKey = `email_${cEmail.toLowerCase()}`;
      } else if (vAttId) {
        candidateKey = `attempt_${vAttId}`;
      } else {
        candidateKey = 'unassigned_candidate';
      }

      if (!map.has(candidateKey)) {
        map.set(candidateKey, {
          key: candidateKey,
          candidateId: candObj || v.candidateId || matchedAttempt?.candidateId,
          candidateName: cName,
          candidateEmail: cEmail || 'N/A',
          examTitle,
          attemptId: vAttId,
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
        // If the group had placeholder candidate info and this violation or matchedAttempt has better info, upgrade it
        if ((!group.candidateName || group.candidateName === 'Unknown Candidate' || group.candidateName === 'Candidate') && cName && cName !== 'Unknown Candidate' && cName !== 'Candidate') {
          group.candidateName = cName;
        }
        if ((!group.candidateEmail || group.candidateEmail === 'N/A') && cEmail && cEmail !== 'N/A') {
          group.candidateEmail = cEmail;
        }
        if (!group.candidateId && (candObj || v.candidateId)) {
          group.candidateId = candObj || v.candidateId;
        }
        group.violations.push(v);
        group.totalViolations += 1;
        if (v.severity === 'CRITICAL') group.criticalCount += 1;
        if (v.severity === 'HIGH') group.highCount += 1;
        if (v.severity === 'MEDIUM') group.mediumCount += 1;
        if (v.severity === 'LOW') group.lowCount += 1;

        if (v.screenshot || (v as any).hasScreenshot) {
          group.proofCount += 1;
          if (!group.latestScreenshot && v.screenshot) {
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
      const candIdStr = (
        typeof group.candidateId === 'object' && group.candidateId !== null
          ? ((group.candidateId as any)._id || (group.candidateId as any).id)?.toString()
          : (group.candidateId ? String(group.candidateId) : '')
      ) || (typeof group.key === 'string' && !group.key.startsWith('attempt_') && !group.key.startsWith('email_') ? group.key : '');
      const candEmailStr = group.candidateEmail && group.candidateEmail !== 'N/A' ? group.candidateEmail.toLowerCase().trim() : '';

      // Collect all attempt IDs in this candidate's violations
      const groupAttemptIds = new Set<string>();
      group.violations.forEach((v) => {
        const attId = (
          typeof v.attemptId === 'object' && v.attemptId !== null
            ? (v.attemptId._id || (v.attemptId as any).id)?.toString()
            : (v.attemptId ? String(v.attemptId) : '')
        ) || '';
        if (attId) groupAttemptIds.add(attId);
      });

      // 1. Process all attempts belonging to this candidate
      candidateAttempts.forEach((att: any) => {
        const attCandId = (
          typeof att.candidateId === 'object' && att.candidateId !== null
            ? (att.candidateId._id || att.candidateId.id)?.toString()
            : (att.candidateId ? att.candidateId.toString() : '')
        );
        const attCandEmail = att.candidateId?.email?.toLowerCase().trim();
        const attIdStr = att._id?.toString() || '';

        const directAttemptMatch = attIdStr && groupAttemptIds.has(attIdStr);
        const idMatches = Boolean(candIdStr && attCandId && candIdStr === attCandId);
        const emailMatches = Boolean(candEmailStr && attCandEmail && candEmailStr === attCandEmail);

        if (idMatches || emailMatches || directAttemptMatch) {
          const attemptId = attIdStr;
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
        const vAttemptId = (
          typeof v.attemptId === 'object' && v.attemptId !== null
            ? (v.attemptId._id || (v.attemptId as any).id)?.toString()
            : (v.attemptId ? String(v.attemptId) : '')
        ) || '';
        const vExamId = (
          typeof v.attemptId?.examId === 'object' && v.attemptId.examId !== null
            ? (v.attemptId.examId._id || (v.attemptId.examId as any).id)?.toString()
            : (v.attemptId?.examId ? String(v.attemptId.examId) : '')
        ) || '';
        const vExamTitle = v.attemptId?.examId?.title || 'Examination Assessment';
        const vStatus = (v.attemptId as any)?.status || (v.actionTaken === 'TERMINATE' ? 'TERMINATED' : 'IN_PROGRESS');

        let existingEx: CandidateExamSummary | undefined = undefined;
        if (vAttemptId && examMap.has(vAttemptId)) {
          existingEx = examMap.get(vAttemptId);
          if (existingEx && vStatus && (!existingEx.attemptStatus || existingEx.attemptStatus === 'IN_PROGRESS' || vStatus === 'TERMINATED')) {
            existingEx.attemptStatus = vStatus;
          }
        } else if (vAttemptId) {
          // If the attemptId was not pre-fetched in attempts, create a dedicated entry
          existingEx = {
            examId: vExamId || vAttemptId,
            attemptId: vAttemptId,
            examTitle: vExamTitle,
            attemptStatus: vStatus,
            startedAt: v.detectedAt,
            violations: [],
            totalViolations: 0,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            proofCount: 0
          };
          examMap.set(vAttemptId, existingEx);
        } else if (vExamId && examMap.has(vExamId)) {
          existingEx = examMap.get(vExamId);
        } else {
          const targetKey = vExamId ? `exam_${vExamId}` : `session_${group.key}`;
          if (examMap.has(targetKey)) {
            existingEx = examMap.get(targetKey);
          } else {
            existingEx = {
              examId: vExamId || targetKey,
              attemptId: targetKey,
              examTitle: vExamTitle,
              attemptStatus: vStatus,
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
        }

        if (existingEx) {
          existingEx.violations.push(v);
          existingEx.totalViolations += 1;
          if (v.severity === 'CRITICAL') existingEx.criticalCount += 1;
          if (v.severity === 'HIGH') existingEx.highCount += 1;
          if (v.severity === 'MEDIUM') existingEx.mediumCount += 1;
          if (v.severity === 'LOW') existingEx.lowCount += 1;
          if (v.screenshot || (v as any).hasScreenshot) {
            existingEx.proofCount += 1;
            if (!existingEx.latestScreenshot && v.screenshot) {
              existingEx.latestScreenshot = v.screenshot;
            }
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
    const targetEmail = (params.get('candidateEmail') || params.get('candidate') || '').toLowerCase().trim();
    const targetName = (params.get('candidateName') || '').toLowerCase().trim();
    const targetAttempt = params.get('attemptId');
    const targetExam = params.get('examId');

    if (candidateGroups.length > 0 && (targetCandidate || targetEmail || targetName || targetAttempt)) {
      const match = candidateGroups.find(
        (g) =>
          (targetCandidate && (g.key === targetCandidate || g.candidateId?._id === targetCandidate)) ||
          (targetEmail && g.candidateEmail && g.candidateEmail.toLowerCase().trim() === targetEmail) ||
          (targetAttempt && (g.attemptId === targetAttempt || g.exams.some(e => e.attemptId === targetAttempt))) ||
          (targetName && g.candidateName && g.candidateName.toLowerCase().trim() === targetName)
      );
      if (match) {
        setSelectedCandidateKey(match.key);
        if (targetExam) {
          setSelectedExamKey(targetExam);
        } else if (targetAttempt) {
          setSelectedAttemptId(targetAttempt);
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
        `${g.examsWrittenCount} exam attempts`,
        `${g.examsWrittenCount} attempts`,
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

  // Distinct exams attempted by the active candidate in the modal
  const activeCandidateUniqueExams = useMemo(() => {
    if (!activeCandidateGroup) return [];

    const map = new Map<string, {
      key: string;
      title: string;
      examId: string;
      attemptsCount: number;
      violationsCount: number;
      proofCount: number;
      criticalCount: number;
      highCount: number;
      highestStatus: string;
      targetKey: string;
      attempts: CandidateExamSummary[];
    }>();

    const statusPriority: Record<string, number> = {
      TERMINATED: 6,
      FORCE_SUBMITTED: 5,
      AUTO_SUBMITTED: 4,
      IN_PROGRESS: 3,
      PAUSED: 2,
      SUBMITTED: 1,
      COMPLETED: 1
    };

    activeCandidateGroup.exams.forEach((ex) => {
      const title = (ex.examTitle || 'Examination Assessment').trim();
      const normKey = title.toLowerCase();

      if (!map.has(normKey)) {
        map.set(normKey, {
          key: normKey,
          title,
          examId: ex.examId,
          attemptsCount: 1,
          violationsCount: ex.totalViolations || 0,
          proofCount: ex.proofCount || 0,
          criticalCount: ex.criticalCount || 0,
          highCount: ex.highCount || 0,
          highestStatus: ex.attemptStatus || 'SUBMITTED',
          targetKey: title,
          attempts: [ex]
        });
      } else {
        const entry = map.get(normKey)!;
        entry.attemptsCount += 1;
        entry.violationsCount += (ex.totalViolations || 0);
        entry.proofCount += (ex.proofCount || 0);
        entry.criticalCount += (ex.criticalCount || 0);
        entry.highCount += (ex.highCount || 0);
        entry.attempts.push(ex);

        const currentRank = statusPriority[entry.highestStatus] || 0;
        const newRank = statusPriority[ex.attemptStatus || ''] || 0;
        if (newRank > currentRank) {
          entry.highestStatus = ex.attemptStatus || entry.highestStatus;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.violationsCount !== a.violationsCount) {
        return b.violationsCount - a.violationsCount;
      }
      return b.attemptsCount - a.attemptsCount;
    });
  }, [activeCandidateGroup]);

  // Selected exam within the candidate modal
  const selectedExam = useMemo(() => {
    if (!activeCandidateGroup || selectedExamKey === 'ALL') return null;
    const keyStr = selectedExamKey.trim();
    const keyLower = keyStr.toLowerCase();

    // 1. Match by distinct exam
    const distinctMatch = activeCandidateUniqueExams.find(
      (ue) => ue.key === keyLower || ue.title.toLowerCase() === keyLower || ue.examId === keyStr
    );
    if (distinctMatch) {
      if (selectedAttemptId && selectedAttemptId !== 'ALL') {
        const specific = distinctMatch.attempts.find((a) => a.attemptId === selectedAttemptId);
        if (specific) return specific;
      }
      return {
        examId: distinctMatch.examId,
        attemptId: 'ALL',
        examTitle: distinctMatch.title,
        attemptStatus: distinctMatch.highestStatus,
        startedAt: distinctMatch.attempts[0]?.startedAt,
        violations: distinctMatch.attempts.flatMap((a) => a.violations),
        totalViolations: distinctMatch.violationsCount,
        criticalCount: distinctMatch.criticalCount,
        highCount: distinctMatch.highCount,
        mediumCount: 0,
        lowCount: 0,
        proofCount: distinctMatch.proofCount,
        duration: distinctMatch.attempts[0]?.duration
      };
    }

    // 2. Direct match by attemptId
    const byAttempt = activeCandidateGroup.exams.find((ex) => ex.attemptId && ex.attemptId === keyStr);
    if (byAttempt) return byAttempt;

    // 3. Fallback match by examId or title
    return (
      activeCandidateGroup.exams.find(
        (ex) =>
          (ex.examId && ex.examId === keyStr) ||
          (ex.examTitle && ex.examTitle.toLowerCase().trim() === keyLower)
      ) || null
    );
  }, [activeCandidateGroup, selectedExamKey, selectedAttemptId, activeCandidateUniqueExams]);

  // Violations filtered by chosen exam or attempt session
  const displayedViolations = useMemo(() => {
    if (!activeCandidateGroup) return [];
    if (selectedExamKey === 'ALL') return activeCandidateGroup.violations;

    const keyStr = selectedExamKey.trim();
    const keyLower = keyStr.toLowerCase();

    // Check if matching a distinct exam group
    const distinctMatch = activeCandidateUniqueExams.find(
      (ue) => ue.key === keyLower || ue.title.toLowerCase() === keyLower || ue.examId === keyStr
    );

    // If a specific attempt session is selected
    if (selectedAttemptId && selectedAttemptId !== 'ALL') {
      return activeCandidateGroup.violations.filter((v) => {
        const vAttemptId = (v.attemptId?._id?.toString() || (typeof v.attemptId === 'string' ? v.attemptId : '') || '').trim();
        return vAttemptId && vAttemptId === selectedAttemptId;
      });
    }

    // If distinct exam matched, include all violations for that exam across all sessions
    if (distinctMatch) {
      return activeCandidateGroup.violations.filter((v) => {
        const vAttemptId = (v.attemptId?._id?.toString() || (typeof v.attemptId === 'string' ? v.attemptId : '') || '').trim();
        const vExamId = (v.attemptId?.examId?._id?.toString() || (typeof v.attemptId?.examId === 'string' ? v.attemptId.examId : '') || '').trim();
        const vExamTitle = (v.attemptId?.examId?.title || '').trim().toLowerCase();

        if (vExamId && (vExamId === distinctMatch.examId || distinctMatch.attempts.some((a) => a.examId === vExamId))) return true;
        if (vExamTitle && vExamTitle === distinctMatch.title.toLowerCase()) return true;
        if (vAttemptId && distinctMatch.attempts.some((a) => a.attemptId === vAttemptId)) return true;
        return false;
      });
    }

    // Direct match fallback
    return activeCandidateGroup.violations.filter((v) => {
      const vAttemptId = (v.attemptId?._id?.toString() || (typeof v.attemptId === 'string' ? v.attemptId : '') || '').trim();
      const vExamId = (v.attemptId?.examId?._id?.toString() || (typeof v.attemptId?.examId === 'string' ? v.attemptId.examId : '') || '').trim();
      const vExamTitle = (v.attemptId?.examId?.title || '').trim().toLowerCase();

      if (vAttemptId && vAttemptId === keyStr) return true;
      if (vExamId && vExamId === keyStr) return true;
      if (vExamTitle && vExamTitle === keyLower) return true;
      return false;
    });
  }, [activeCandidateGroup, selectedExamKey, selectedAttemptId, activeCandidateUniqueExams]);

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans selection:bg-rose-500/20">
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
      <header className="bg-white/85 border-b border-slate-200/80 backdrop-blur-md z-30 sticky top-0 shadow-2xs">
        <div className="max-w-7xl mx-auto w-full px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: Back Link & Page Title */}
          <div className="flex items-center space-x-3.5">
            <Link 
              href="/admin/monitoring" 
              className="p-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 shadow-2xs transition-colors shrink-0"
              title="Back to Candidate Monitoring Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shadow-2xs shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Violation Review Queue</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Candidate Infraction Logs & Evidence</p>
            </div>
          </div>

          {/* Right: Navigation Links & Action */}
          <div className="flex items-center gap-2 shrink-0 flex-nowrap overflow-x-auto max-w-full pb-1 xl:pb-0">
            <Link 
              href="/admin/monitoring" 
              className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 font-semibold rounded-lg hover:bg-slate-50 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Candidates
            </Link>
            <Link 
              href="/admin/candidates?filter=pending" 
              className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 font-semibold rounded-lg hover:bg-amber-100 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Approvals
            </Link>
            <Link 
              href="/admin/exams" 
              className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 font-semibold rounded-lg hover:bg-slate-50 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Exams
            </Link>
            <Link 
              href="/admin/results" 
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 font-semibold rounded-lg hover:bg-blue-100 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Results
            </Link>
            <Link 
              href="/admin/reports" 
              className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 font-semibold rounded-lg hover:bg-slate-100 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-700" /> Integrity
            </Link>
            <Link 
              href="/admin/helpdesk" 
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 font-semibold rounded-lg hover:bg-blue-100 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <LifeBuoy className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Help Desk
            </Link>
            <button 
              type="button"
              onClick={handleRefreshQueue}
              disabled={refreshing}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition shadow-2xs flex items-center cursor-pointer disabled:opacity-60 active:scale-95 h-8.5 shrink-0 whitespace-nowrap ${
                refreshSuccess 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                  : refreshError
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title="Refresh latest violation queue records from the server"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-blue-600' : refreshSuccess ? 'text-emerald-700' : 'text-slate-500'}`} />
              {refreshing ? 'Refreshing...' : refreshSuccess ? refreshSuccess : refreshError ? refreshError : 'Refresh Queue'}
            </button>
          </div>
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

          <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Screenshot Proofs</span>
              <Camera className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-black text-blue-600 mt-2">{proofCount}</div>
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
              onChange={(e) => setSearchQuery(sanitizeSearchInput(e.target.value))}
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
              <ShieldCheck className="w-16 h-16 text-emerald-700 mb-4 opacity-90" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Flagged Candidates Found</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {searchQuery || severityFilter !== 'ALL'
                  ? 'No candidates match your current search and severity filters.'
                  : 'All candidate examination sessions are clean with zero violations flagged.'}
              </p>
              <button
                type="button"
                onClick={handleRefreshQueue}
                disabled={refreshing}
                className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center cursor-pointer shadow-xs disabled:opacity-60 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing Queue...' : 'Refresh Queue'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-3.5 py-3 align-middle text-left">Candidate</th>
                    <th className="px-3 py-3 align-middle text-left">Exams Written</th>
                    <th className="px-2 py-3 align-middle text-center">Violations</th>
                    <th className="px-2 py-3 align-middle text-center">Severity</th>
                    <th className="px-2 py-3 align-middle text-center">Proofs</th>
                    <th className="px-2 py-3 align-middle text-center">Latest Infraction</th>
                    <th className="px-3.5 py-3 align-middle text-center">Action</th>
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

                    // Aggregate distinct exams attempted by candidate to avoid repetitive messy rows
                    const uniqueExams = (() => {
                      const map = new Map<string, {
                        key: string;
                        title: string;
                        attemptsCount: number;
                        violationsCount: number;
                        targetKey: string;
                      }>();

                      group.exams.forEach((ex) => {
                        const title = (ex.examTitle || 'Examination Assessment').trim();
                        const normKey = title.toLowerCase();

                        if (!map.has(normKey)) {
                          map.set(normKey, {
                            key: normKey,
                            title,
                            attemptsCount: 1,
                            violationsCount: ex.totalViolations || 0,
                            targetKey: title
                          });
                        } else {
                          const entry = map.get(normKey)!;
                          entry.attemptsCount += 1;
                          entry.violationsCount += (ex.totalViolations || 0);
                        }
                      });

                      return Array.from(map.values()).sort((a, b) => {
                        if (b.violationsCount !== a.violationsCount) {
                          return b.violationsCount - a.violationsCount;
                        }
                        return b.attemptsCount - a.attemptsCount;
                      });
                    })();

                    return (
                      <tr 
                        key={group.key} 
                        onClick={() => {
                          setSelectedCandidateKey(group.key);
                          setSelectedExamKey('ALL');
                          setSelectedAttemptId('ALL');
                        }}
                        className="hover:bg-rose-50/30 transition-colors group cursor-pointer"
                      >
                        {/* Candidate Column */}
                        <td className="px-3.5 py-3 align-middle text-left">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-900 text-xs group-hover:text-rose-600 transition-colors flex items-center">
                                <span className="truncate max-w-[120px]" title={group.candidateName}>{group.candidateName}</span>
                                <span className="ml-1.5 text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full border border-slate-200 shrink-0">
                                  {group.totalViolations}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono truncate max-w-[140px]" title={group.candidateEmail}>
                                {group.candidateEmail}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Exams Written by Candidate */}
                        <td className="px-3 py-3 align-middle text-left">
                          <div className="flex flex-col gap-1.5 max-w-[215px]">
                            {/* Summary Badge */}
                            <div className="flex items-center space-x-1.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                                <BookOpen className="w-3 h-3 mr-1 text-blue-500 shrink-0" />
                                <span>{group.examsWrittenCount} {group.examsWrittenCount === 1 ? 'Attempt' : 'Attempts'}</span>
                                {uniqueExams.length > 0 && (
                                  <span className="ml-1 text-[9px] font-bold text-blue-600/90 pl-1 border-l border-blue-200">
                                    {uniqueExams.length} {uniqueExams.length === 1 ? 'Sub' : 'Subs'}
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Structured Distinct Exam Cards */}
                            <div className="space-y-1 max-h-[110px] overflow-y-auto pr-0.5">
                              {uniqueExams.map((ue) => (
                                <button
                                  key={ue.key}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCandidateKey(group.key);
                                    setSelectedExamKey(ue.title);
                                    setSelectedAttemptId('ALL');
                                  }}
                                  title={`Click to check violations for "${ue.title}" (${ue.attemptsCount} attempt${ue.attemptsCount > 1 ? 's' : ''})`}
                                  className={`w-full flex items-center justify-between px-2 py-1 rounded-md border text-[11px] text-left transition-all group/item cursor-pointer ${
                                    ue.violationsCount > 0
                                      ? 'bg-rose-50/70 hover:bg-rose-100/80 border-rose-200 text-rose-950 shadow-2xs'
                                      : 'bg-slate-50 hover:bg-slate-100/90 border-slate-200 text-slate-800 shadow-2xs'
                                  }`}
                                >
                                  {/* Left: Exam title + attempt count multiplier */}
                                  <div className="flex items-center space-x-1 min-w-0 flex-1 mr-1.5">
                                    <span className="font-bold truncate text-slate-800 group-hover/item:text-slate-900 text-[11px]" title={ue.title}>
                                      {ue.title}
                                    </span>
                                    {ue.attemptsCount > 1 && (
                                      <span
                                        className="shrink-0 text-[9px] font-extrabold px-1 py-0.2 rounded bg-slate-200/80 text-slate-700 border border-slate-300/60"
                                        title={`${ue.attemptsCount} attempts`}
                                      >
                                        &times;{ue.attemptsCount}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right: Uniform status badge */}
                                  <div className="shrink-0 flex items-center">
                                    {ue.violationsCount > 0 ? (
                                      <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs">
                                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5 text-rose-600 shrink-0" />
                                        {ue.violationsCount} Flagged
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 text-emerald-600 shrink-0" />
                                        Clean
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Violations Summary */}
                        <td className="px-2 py-3 align-middle text-center">
                          <div className="inline-flex flex-col items-center justify-center gap-1">
                            <div className="inline-flex items-center space-x-1">
                              <span className="font-black text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                {group.totalViolations} Violations
                              </span>
                              {group.criticalCount > 0 && (
                                <span className="text-[10px] font-extrabold text-rose-600">
                                  ({group.criticalCount} crit)
                                </span>
                              )}
                            </div>
                            {/* Type tags */}
                            <div className="flex flex-wrap justify-center gap-1 max-w-[130px]">
                              {group.uniqueTypes.slice(0, 2).map((t) => (
                                <span 
                                  key={t}
                                  className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[100px]"
                                  title={t.replace(/_/g, ' ')}
                                >
                                  {t.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {group.uniqueTypes.length > 2 && (
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1 py-0.2 rounded border border-slate-200">
                                  +{group.uniqueTypes.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Highest Severity Badge */}
                        <td className="px-2 py-3 align-middle text-center">
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border inline-block ${getSeverityBadge(group.highestSeverity)}`}>
                            {group.highestSeverity}
                          </span>
                        </td>

                        {/* Evidence Proofs Column */}
                        <td className="px-2 py-3 align-middle text-center">
                          <div className="inline-flex items-center justify-center">
                            {group.latestScreenshot ? (
                              <div className="flex items-center space-x-2 text-left">
                                <div className="relative w-9 h-8 rounded-md overflow-hidden border border-slate-200 bg-slate-900 shrink-0 shadow-2xs">
                                  <img 
                                    src={group.latestScreenshot} 
                                    alt="Proof thumbnail" 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div>
                                  <span className="inline-flex items-center text-[11px] font-bold text-blue-700 whitespace-nowrap">
                                    <Camera className="w-3 h-3 mr-1" />
                                    {group.proofCount} {group.proofCount === 1 ? 'Proof' : 'Proofs'}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block">Available</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic inline-flex items-center justify-center">
                                <Camera className="w-3 h-3 mr-1 opacity-40" /> None
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Latest Infraction */}
                        <td className="px-2 py-3 align-middle text-center text-xs font-mono text-slate-500 whitespace-nowrap">
                          <div className="inline-flex flex-col items-center justify-center leading-tight">
                            <span className="text-slate-800 font-bold text-[11px]">
                              {new Date(group.latestViolation.detectedAt).toLocaleDateString()}
                            </span>
                            <span className="text-slate-400 text-[10px] mt-0.5">
                              {new Date(group.latestViolation.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* Action Column */}
                        <td className="px-3.5 py-3 align-middle text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidateKey(group.key);
                                setSelectedExamKey('ALL');
                                setSelectedAttemptId('ALL');
                              }}
                              className="inline-flex items-center justify-center px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white font-bold text-xs rounded-lg border border-rose-200 hover:border-rose-600 shadow-2xs transition-all cursor-pointer active:scale-95"
                              title={`View ${group.totalViolations} violations for ${group.candidateName}`}
                            >
                              <span>View ({group.totalViolations})</span>
                              <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </button>
                          </div>
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
                <button
                  type="button"
                  onClick={handleRefreshQueue}
                  disabled={refreshing}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 inline-flex items-center transition cursor-pointer disabled:opacity-60 active:scale-95"
                  title="Refresh latest candidate violations"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
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
                <span className="flex items-center text-blue-700">
                  <Camera className="w-3.5 h-3.5 mr-1 text-blue-600" />
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
                    Exams Written by Candidate ({activeCandidateUniqueExams.length} Distinct {activeCandidateUniqueExams.length === 1 ? 'Assessment' : 'Assessments'} • {activeCandidateGroup.examsWrittenCount} {activeCandidateGroup.examsWrittenCount === 1 ? 'Session' : 'Sessions'})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select an assessment below or choose from the dropdown to check violations specifically for that exam.
                  </p>
                </div>

                {/* Quick Dropdown Filter */}
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Filter Exam:</span>
                  <select
                    value={selectedExamKey}
                    onChange={(e) => {
                      setSelectedExamKey(e.target.value);
                      setSelectedAttemptId('ALL');
                    }}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer max-w-[280px] truncate"
                  >
                    <option value="ALL">
                      All Exams Combined ({activeCandidateGroup.examsWrittenCount} Sessions • {activeCandidateGroup.totalViolations} Violations)
                    </option>
                    {activeCandidateUniqueExams.map((ue) => (
                      <option 
                        key={ue.key} 
                        value={ue.title}
                      >
                        {ue.title} ({ue.violationsCount} {ue.violationsCount === 1 ? 'Violation' : 'Violations'} • {ue.attemptsCount} {ue.attemptsCount === 1 ? 'Session' : 'Sessions'}{ue.highestStatus ? ` • ${ue.highestStatus}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interactive Distinct Exam Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                {/* 'All Exams Combined' Card Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExamKey('ALL');
                    setSelectedAttemptId('ALL');
                  }}
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

                {/* Individual Distinct Assessment Cards */}
                {activeCandidateUniqueExams.map((ue) => {
                  const isSelected = selectedExamKey.toLowerCase() === ue.key || selectedExamKey.toLowerCase() === ue.title.toLowerCase();
                  return (
                    <button
                      key={ue.key}
                      type="button"
                      onClick={() => {
                        setSelectedExamKey(ue.title);
                        setSelectedAttemptId('ALL');
                      }}
                      className={`text-left p-3 rounded-2xl border transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="text-xs font-extrabold text-slate-900 line-clamp-1" title={ue.title}>
                          {ue.title}
                        </span>
                        <div className="flex items-center space-x-1 shrink-0">
                          {ue.attemptsCount > 1 && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              &times;{ue.attemptsCount}
                            </span>
                          )}
                          {ue.highestStatus && (
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${getStatusBadge(ue.highestStatus)}`}>
                              {ue.highestStatus}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 text-[11px]">
                        {ue.violationsCount > 0 ? (
                          <span className="font-extrabold text-rose-700 flex items-center">
                            <AlertTriangle className="w-3 h-3 mr-1 text-rose-500" />
                            {ue.violationsCount} {ue.violationsCount === 1 ? 'Violation' : 'Violations'}
                          </span>
                        ) : (
                          <span className="font-extrabold text-emerald-700 flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Clean (0 Violations)
                          </span>
                        )}

                        {ue.proofCount > 0 ? (
                          <span className="text-blue-600 text-[10px] font-bold flex items-center">
                            <Camera className="w-3 h-3 mr-0.5" />
                            {ue.proofCount} Proofs
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">
                            {ue.attemptsCount} {ue.attemptsCount === 1 ? 'Session' : 'Sessions'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Attempt Session Switcher Bar (when an exam with multiple sessions or non-submitted sessions is chosen) */}
              {selectedExamKey !== 'ALL' && (() => {
                const activeExam = activeCandidateUniqueExams.find(
                  (ue) => ue.key === selectedExamKey.toLowerCase() || ue.title.toLowerCase() === selectedExamKey.toLowerCase()
                );
                if (!activeExam || activeExam.attempts.length <= 1) return null;

                return (
                  <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Filter Session Attempt:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedAttemptId('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center ${
                        selectedAttemptId === 'ALL'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      All Sessions ({activeExam.violationsCount} Violations • {activeExam.attempts.length} Attempts)
                    </button>
                    {activeExam.attempts.map((att, idx) => {
                      const isAttSelected = selectedAttemptId === att.attemptId;
                      return (
                        <button
                          key={att.attemptId || idx}
                          type="button"
                          onClick={() => setSelectedAttemptId(att.attemptId)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                            isAttSelected
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <span>Session #{idx + 1}</span>
                          <span className={`text-[9px] uppercase px-1 py-0.2 rounded font-extrabold ${
                            isAttSelected 
                              ? 'bg-white/20 text-white' 
                              : getStatusBadge(att.attemptStatus)
                          }`}>
                            {att.attemptStatus || 'SUBMITTED'}
                          </span>
                          {att.totalViolations > 0 ? (
                            <span className={isAttSelected ? 'text-white font-extrabold' : 'text-rose-600 font-extrabold'}>
                              ({att.totalViolations} Vio)
                            </span>
                          ) : (
                            <span className={isAttSelected ? 'text-white/80' : 'text-slate-400'}>
                              (0)
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Violations List for chosen exam */}
            <div className="p-6 space-y-5 bg-slate-50/50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 text-slate-400" />
                  {selectedExam ? (
                    <span>
                      Violations for: <span className="text-slate-900 font-black">{selectedExam.examTitle}</span>
                      {selectedAttemptId !== 'ALL' && (
                        <span className="ml-2 font-mono text-[11px] font-bold text-slate-500">
                          (Session ID: {selectedAttemptId.slice(-6)})
                        </span>
                      )} ({displayedViolations.length})
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
                    onClick={() => {
                      setSelectedExamKey('ALL');
                      setSelectedAttemptId('ALL');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center hover:underline"
                  >
                    &larr; View Violations For All Exams
                  </button>
                )}
              </div>

              {/* When no violations exist for selected exam / session */}
              {displayedViolations.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-10 flex flex-col items-center text-center shadow-xs">
                  {selectedExam?.attemptStatus === 'TERMINATED' ? (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-200 shadow-2xs">
                        <AlertTriangle className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        Exam Attempt Terminated (Not Submitted)
                      </h4>
                      <p className="text-slate-600 text-xs max-w-md mt-1.5 leading-relaxed">
                        This session for <span className="font-bold text-slate-800">{selectedExam?.examTitle || 'this assessment'}</span> was terminated early by the proctor or automatic security policy. No individual violation records were logged directly in this specific attempt window.
                      </p>
                    </>
                  ) : selectedExam?.attemptStatus === 'FORCE_SUBMITTED' || selectedExam?.attemptStatus === 'AUTO_SUBMITTED' ? (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 border border-amber-200 shadow-2xs">
                        <Clock className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        Force-Submitted Examination Session
                      </h4>
                      <p className="text-slate-600 text-xs max-w-md mt-1.5 leading-relaxed">
                        This session was auto/force-submitted upon session expiration or administrative action. Zero violations were recorded during this attempt.
                      </p>
                    </>
                  ) : selectedExam?.attemptStatus === 'IN_PROGRESS' ? (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 border border-blue-200 shadow-2xs">
                        <Activity className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        Examination In Progress (Not Submitted)
                      </h4>
                      <p className="text-slate-600 text-xs max-w-md mt-1.5 leading-relaxed">
                        Candidate currently has an active ongoing session for <span className="font-bold text-slate-800">{selectedExam?.examTitle || 'this exam'}</span>. No proctoring violations recorded so far.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 border border-emerald-200 shadow-2xs">
                        <ShieldCheck className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-black text-slate-900">
                        Clean Examination Attempt
                      </h4>
                      <p className="text-slate-600 text-xs max-w-md mt-1.5 leading-relaxed">
                        Zero violations logged for <span className="font-bold text-slate-800">{selectedExam?.examTitle || 'this exam'}</span>. 
                        The candidate completed this examination session without any recorded suspicious activity or integrity breaches.
                      </p>
                    </>
                  )}

                  <div className="mt-4 flex items-center space-x-3 text-xs font-mono">
                    <span className={`px-3 py-1 rounded-lg font-bold border ${getStatusBadge(selectedExam?.attemptStatus)}`}>
                      Status: {selectedExam?.attemptStatus || 'COMPLETED'}
                    </span>
                    {selectedExam?.duration && (
                      <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                        Duration: {selectedExam.duration} mins
                      </span>
                    )}
                  </div>

                  {selectedAttemptId !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedAttemptId('ALL')}
                      className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                    >
                      &larr; View all sessions for {selectedExam?.examTitle}
                    </button>
                  )}
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
                              onClick={() => handleOpenProof(v)}
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
                          ) : (v as any).hasScreenshot ? (
                            <div 
                              onClick={() => handleOpenProof(v)}
                              className="relative group/thumb cursor-pointer w-full h-44 rounded-xl overflow-hidden border border-blue-200 hover:border-blue-500 shadow-sm bg-blue-50/50 hover:bg-blue-50 transition-all flex flex-col items-center justify-center p-4 text-center"
                              title="Click to load captured evidence proof snapshot"
                            >
                              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2 shadow-xs group-hover/thumb:scale-110 transition-transform">
                                <Camera className="w-5 h-5" />
                              </div>
                              <span className="font-extrabold text-blue-700 text-xs">
                                {loadingProofId === v._id ? 'Loading Snapshot Evidence...' : 'Snapshot Proof Recorded'}
                              </span>
                              <span className="text-[11px] text-slate-500 mt-1 flex items-center">
                                <Eye className="w-3 h-3 mr-1 text-blue-600" /> Click to view captured proof
                              </span>
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
                          {(v.screenshot || (v as any).hasScreenshot) && (
                            <div className="pt-1 flex items-center space-x-3">
                              <button
                                onClick={() => handleOpenProof(v)}
                                disabled={loadingProofId === v._id}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center hover:underline cursor-pointer disabled:opacity-50"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                {loadingProofId === v._id ? 'Loading Snapshot...' : 'Enlarge Snapshot Proof'}
                              </button>
                            </div>
                          )}
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
