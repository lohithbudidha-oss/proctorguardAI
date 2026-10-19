'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import io from 'socket.io-client';
import BrandLogo from '@/components/BrandLogo';
import FlyhiiBranding from '@/components/FlyhiiBranding';
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
  BarChart3,
  ExternalLink,
  UserCheck,
  ArrowRight,
  LifeBuoy,
  RefreshCw
} from 'lucide-react';
import api from '@/lib/api';
import { getViolationInfo } from '@/lib/violations';
import { sanitizeSearchInput } from '@/lib/sanitize';

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
  verificationStatus?: string;
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
  const [candidates, setCandidates] = useState<CandidateExamRecord[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pg_cached_admin_candidates');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateExamRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  type StatusFilterType = 'ALL' | 'IN_PROGRESS' | 'SUBMITTED' | 'FORCE_SUBMITTED' | 'TERMINATED' | 'ASSIGNED';
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('ALL');
  const [selectedProofModal, setSelectedProofModal] = useState<{
    image: string;
    type: string;
    time: string;
    desc?: string;
    candidateName?: string;
    candidateEmail?: string;
    examName?: string;
    severity?: string;
    driveUrl?: string;
  } | null>(null);
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pg_cached_admin_candidates');
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch (e) {}
    }
    return true;
  });
  const [adminProfile, setAdminProfile] = useState<{ name?: string; email?: string; role?: string } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = localStorage.getItem('user');
        if (u) return JSON.parse(u);
      } catch (e) {}
    }
    return null;
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const c = sessionStorage.getItem('pg_cached_pending_count');
        if (c) return parseInt(c, 10) || 0;
      } catch (e) {}
    }
    return 0;
  });
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const c = sessionStorage.getItem('pg_cached_tickets_count');
        if (c) return parseInt(c, 10) || 0;
      } catch (e) {}
    }
    return 0;
  });
  const [showCandidateViolationQueueModal, setShowCandidateViolationQueueModal] = useState(false);
  const [candidateQueueSeverityFilter, setCandidateQueueSeverityFilter] = useState<string>('ALL');
  const [candidateQueueSearchQuery, setCandidateQueueSearchQuery] = useState('');
  const [rewritingCandidateId, setRewritingCandidateId] = useState<string | null>(null);
  const [loadingProofId, setLoadingProofId] = useState<string | null>(null);
  const isFetchingRef = React.useRef(false);

  const filteredCandidateQueueViolations = useMemo(() => {
    if (!selectedCandidate) return [];
    let list = selectedCandidate.violations || [];

    if (candidateQueueSeverityFilter !== 'ALL') {
      list = list.filter(v => v.severity === candidateQueueSeverityFilter);
    }

    const q = candidateQueueSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(v => {
        const info = getViolationInfo(v.type, v.description);
        return (
          v.type.toLowerCase().includes(q) ||
          (v.description && v.description.toLowerCase().includes(q)) ||
          info.title.toLowerCase().includes(q) ||
          info.actionDone.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [selectedCandidate, candidateQueueSeverityFilter, candidateQueueSearchQuery]);

  const candidateCriticalCount = useMemo(() => {
    if (!selectedCandidate) return 0;
    return (selectedCandidate.violations || []).filter(v => v.severity === 'CRITICAL').length;
  }, [selectedCandidate]);

  const candidateHighCount = useMemo(() => {
    if (!selectedCandidate) return 0;
    return (selectedCandidate.violations || []).filter(v => v.severity === 'HIGH').length;
  }, [selectedCandidate]);

  const candidateMediumCount = useMemo(() => {
    if (!selectedCandidate) return 0;
    return (selectedCandidate.violations || []).filter(v => v.severity === 'MEDIUM').length;
  }, [selectedCandidate]);

  const candidateProofCount = useMemo(() => {
    if (!selectedCandidate) return 0;
    return (selectedCandidate.violations || []).filter(v => Boolean(v.screenshot || v.snapshotImage)).length;
  }, [selectedCandidate]);

  const fetchPendingApprovalsCount = () => {
    api.get('/admin/candidates?status=PENDING&countOnly=true').then(res => {
      if (res.data?.count !== undefined) {
        setPendingApprovalsCount(res.data.count);
        try { sessionStorage.setItem('pg_cached_pending_count', String(res.data.count)); } catch (e) {}
      } else {
        const list = res.data.candidates || [];
        const pending = list.filter((c: any) => {
          const s = (c.status || '').toUpperCase();
          return s === 'PENDING_VERIFICATION' || s === 'PENDING';
        }).length;
        setPendingApprovalsCount(pending);
        try { sessionStorage.setItem('pg_cached_pending_count', String(pending)); } catch (e) {}
      }
    }).catch(() => {});
  };

  const fetchOpenTicketsCount = () => {
    api.get('/admin/helpdesk?statsOnly=true').then(res => {
      if (res.data?.stats?.open !== undefined) {
        setOpenTicketsCount(res.data.stats.open);
        try { sessionStorage.setItem('pg_cached_tickets_count', String(res.data.stats.open)); } catch (e) {}
      }
    }).catch(() => {});
  };

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) setAdminProfile(JSON.parse(u));
    } catch (e) {}

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const eParam = params.get('examId') || params.get('exam');
      if (eParam) setSelectedExamFilter(eParam);
      const sParam = params.get('status')?.toUpperCase();
      if (sParam && ['IN_PROGRESS', 'SUBMITTED', 'FORCE_SUBMITTED', 'TERMINATED', 'ASSIGNED'].includes(sParam)) {
        setStatusFilter(sParam as StatusFilterType);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login?role=admin';
  };

  const handleOpenViolationProof = async (v: any) => {
    const existingImg = v.screenshot || v.snapshotImage;
    const existingDrive = v.driveUrl || v.driveFolderUrl;
    if (existingImg || existingDrive) {
      setSelectedProofModal({
        image: existingImg || '',
        type: v.type,
        time: new Date(v.detectedAt || v.timestamp || new Date().toISOString()).toLocaleString(),
        desc: v.description,
        candidateName: selectedCandidate?.name,
        candidateEmail: selectedCandidate?.email,
        examName: selectedCandidate?.examName,
        severity: v.severity,
        driveUrl: existingDrive
      });
      return;
    }

    const vId = v.id || v._id;
    if (!vId) {
      alert('Proof identifier missing for this event.');
      return;
    }

    setLoadingProofId(vId);
    try {
      const res = await api.get(`/admin/violations/${vId}/proof`);
      let img = res.data?.screenshot || res.data?.snapshotImage || res.data?.image || res.data?.proof?.screenshot || res.data?.proof?.snapshotImage || '';
      const driveUrl = res.data?.driveUrl || res.data?.proof?.driveUrl || v.driveUrl || v.driveFolderUrl || '';

      // Check client-side cached evidence as fallback
      if (!img && typeof window !== 'undefined') {
        try {
          const cachedEvidence: any[] = JSON.parse(localStorage.getItem('pg_violation_evidence') || '[]');
          const match = cachedEvidence.find((c: any) => 
            (c.id === vId || c._id === vId) || 
            (selectedCandidate?.attemptId && (c.attemptId === selectedCandidate.attemptId || c.attemptId?._id === selectedCandidate.attemptId) && c.type === v.type) ||
            (c.type === v.type)
          );
          if (match?.screenshot) img = match.screenshot;
        } catch (e) {}
      }

      if (!img && !driveUrl) {
        alert('No screenshot proof image recorded for this incident.');
        return;
      }

      v.screenshot = img;
      v.snapshotImage = img;
      v.driveUrl = driveUrl;
      v.hasScreenshot = Boolean(img || driveUrl);

      setSelectedCandidate(prev => {
        if (!prev) return null;
        return {
          ...prev,
          violations: (prev.violations || []).map(item => 
            (item.id === vId || item._id === vId) ? { ...item, screenshot: img, snapshotImage: img, driveUrl, hasScreenshot: true } : item
          )
        };
      });

      setSelectedProofModal({
        image: img,
        type: v.type,
        time: new Date(v.detectedAt || v.timestamp || new Date().toISOString()).toLocaleString(),
        desc: v.description,
        candidateName: selectedCandidate?.name,
        candidateEmail: selectedCandidate?.email,
        examName: selectedCandidate?.examName,
        severity: v.severity,
        driveUrl
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to load proof image');
    } finally {
      setLoadingProofId(null);
    }
  };

  const fetchCandidateRecords = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    let cachedEvidence: any[] = [];
    if (typeof window !== 'undefined') {
      try {
        cachedEvidence = JSON.parse(localStorage.getItem('pg_violation_evidence') || '[]');
      } catch (e) {
        cachedEvidence = [];
      }
    }

    try {
      const res = await api.get('/admin/live', {
        params: { _t: Date.now() },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const records: CandidateExamRecord[] = (res.data.candidates || []).map((cand: any) => ({
        id: cand.candidateId || cand.id,
        attemptId: cand.attemptId,
        name: cand.name || 'Candidate',
        email: cand.email || '',
        examName: cand.examName || cand.exam || 'Assessment',
        examId: cand.examId,
        status: cand.status || 'SUBMITTED',
        verificationStatus: cand.verificationStatus || 'PENDING',
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
          if (!img && cachedEvidence.length > 0) {
            const match = cachedEvidence.find((c: any) => c.attemptId === cand.attemptId && c.type === v.type) ||
                          cachedEvidence.find((c: any) => c.type === v.type);
            if (match?.screenshot) img = match.screenshot;
          }
          return {
            ...v,
            screenshot: img || '',
            snapshotImage: img || '',
            hasScreenshot: Boolean(img || v.hasScreenshot || v.driveUrl)
          };
        })
      }));
      setCandidates(records);
      try {
        sessionStorage.setItem('pg_cached_admin_candidates', JSON.stringify(records.slice(0, 40)));
      } catch (e) {}
    } catch (err: any) {
      console.error('Failed fetching candidate records', err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        router.replace('/login?role=admin');
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchCandidateRecords();
    fetchPendingApprovalsCount();
    fetchOpenTicketsCount();

    const interval = setInterval(() => {
      fetchCandidateRecords();
      fetchPendingApprovalsCount();
    }, 25000);

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : 'https://proctorguardai.onrender.com');
    const initSocket = io(wsUrl, {
      auth: { token: typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
    });

    initSocket.on('attempt:status_change', () => {
      fetchCandidateRecords();
      fetchPendingApprovalsCount();
    });

    initSocket.on('candidate:status_update', () => {
      fetchCandidateRecords();
      fetchPendingApprovalsCount();
    });

    initSocket.on('violation:alert', (data) => {
      if (data?.candidateId && data?.violation) {
        const raw = data.violation;
        const shot = raw.screenshot || raw.snapshotImage || raw.image || '';
        const formattedViolation = {
          ...raw,
          screenshot: shot,
          snapshotImage: shot
        };

        setCandidates(prev => prev.map(c => {
          const matchCand = String(c.id) === String(data.candidateId);
          const matchAttempt = data.violation.attemptId && (
            String(c.attemptId) === String(data.violation.attemptId._id || data.violation.attemptId)
          );

          if (matchCand || matchAttempt) {
            const exists = (c.violations || []).some((v: any) => (v.id || v._id) && (v.id === formattedViolation._id || v._id === formattedViolation._id));
            const newViolations = exists 
              ? (c.violations || []).map((v: any) => ((v.id === formattedViolation._id || v._id === formattedViolation._id) ? { ...v, ...formattedViolation } : v))
              : [formattedViolation, ...(c.violations || [])];

            return {
              ...c,
              violations: newViolations,
              riskScore: Math.min(100, c.riskScore + (formattedViolation.severity === 'CRITICAL' ? 40 : 20))
            };
          }
          return c;
        }));
      }
    });

    initSocket.on('evidence:snapshot_alert', (data) => {
      const shot = data?.image || data?.screenshot || '';
      if (shot) {
        setCandidates(prev => prev.map(c => {
          const matchCand = data.candidateId && String(c.id) === String(data.candidateId);
          const matchAttempt = data.attemptId && String(c.attemptId) === String(data.attemptId);

          if (matchCand || matchAttempt) {
            const updatedViolations = (c.violations || []).map((v: any) => {
              if (!v.screenshot || v.type === data.type) {
                return { ...v, screenshot: shot, snapshotImage: shot };
              }
              return v;
            });
            return { ...c, violations: updatedViolations };
          }
          return c;
        }));
      }
    });

    initSocket.on('violation:updated', (data) => {
      if (data?.violationId && data?.driveUrl) {
        setCandidates(prev => prev.map(c => {
          const updatedViolations = (c.violations || []).map((v: any) => {
            if ((v.id || v._id) && (String(v.id) === String(data.violationId) || String(v._id) === String(data.violationId))) {
              return { ...v, driveUrl: data.driveUrl };
            }
            return v;
          });
          return { ...c, violations: updatedViolations };
        }));
      }
    });

    return () => {
      clearInterval(interval);
      initSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedProofModal) {
          setSelectedProofModal(null);
        } else if (showCandidateViolationQueueModal) {
          setShowCandidateViolationQueueModal(false);
        } else if (selectedCandidate) {
          setSelectedCandidate(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProofModal, showCandidateViolationQueueModal, selectedCandidate]);

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

  const handleAllowRewrite = async (examId?: string, candidateId?: string, candidateName?: string) => {
    if (!examId || !candidateId) {
      alert('Missing examination or candidate identifier to authorize re-write.');
      return;
    }
    const name = candidateName || 'this candidate';
    if (!window.confirm(`Are you sure you want to authorize ${name} to re-write this examination? Their prior attempt and telemetry logs will be preserved.`)) {
      return;
    }
    setRewritingCandidateId(candidateId);
    try {
      const res = await api.post(`/admin/exams/${examId}/allow-rewrite/${candidateId}`);
      alert(res.data?.message || `Granted re-write successfully to ${name}`);
      fetchCandidateRecords();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to authorize re-write');
    } finally {
      setRewritingCandidateId(null);
    }
  };

  const isCandidateInProgress = (status: string) => {
    const s = (status || '').toUpperCase();
    return s === 'IN_PROGRESS' || s === 'PAUSED' || s === 'LOCKED';
  };

  const isCandidateSubmitted = (status: string) => {
    const s = (status || '').toUpperCase();
    return s === 'SUBMITTED' || s === 'AUTO_SUBMITTED' || s === 'COMPLETED';
  };

  const isCandidateForceSubmitted = (status: string) => {
    const s = (status || '').toUpperCase();
    return s === 'FORCE_SUBMITTED' || s === 'FORCEFULLY_SUBMITTED';
  };

  const isCandidateTerminated = (status: string) => {
    const s = (status || '').toUpperCase();
    return s === 'TERMINATED';
  };

  const isCandidateAssigned = (status: string) => {
    const s = (status || '').toUpperCase();
    return s === 'ASSIGNED' || s === 'READY' || s === 'WAITING';
  };

  const isCompletedStatus = (status: string) => {
    return isCandidateSubmitted(status) || isCandidateForceSubmitted(status) || isCandidateTerminated(status);
  };

  const getStatusBadge = (status: string) => {
    const norm = (status || '').toUpperCase().trim();
    if (norm === 'TERMINATED') {
      return {
        label: 'TERMINATED',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        dotColor: 'bg-rose-500'
      };
    }
    if (norm === 'FORCE_SUBMITTED' || norm === 'FORCEFULLY_SUBMITTED') {
      return {
        label: 'FORCEFULLY SUBMITTED',
        className: 'bg-amber-50 text-amber-800 border-amber-300',
        dotColor: 'bg-amber-500'
      };
    }
    if (norm === 'AUTO_SUBMITTED') {
      return {
        label: 'AUTO SUBMITTED',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        dotColor: 'bg-blue-500'
      };
    }
    if (norm === 'SUBMITTED' || norm === 'COMPLETED') {
      return {
        label: 'SUBMITTED',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500'
      };
    }
    if (norm === 'IN_PROGRESS') {
      return {
        label: 'IN PROGRESS',
        className: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse',
        dotColor: 'bg-blue-500'
      };
    }
    return {
      label: norm.replace(/_/g, ' ') || 'ASSIGNED',
      className: 'bg-slate-50 text-slate-700 border-slate-200',
      dotColor: 'bg-slate-400'
    };
  };

  // Live Exam-Based Candidate Status Breakdown
  const examStatsList = useMemo(() => {
    const map = new Map<string, {
      examId: string;
      examName: string;
      total: number;
      inProgress: number;
      submitted: number;
      forceSubmitted: number;
      terminated: number;
      assigned: number;
    }>();

    candidates.forEach(cand => {
      const eKey = cand.examId || cand.examName || 'unknown_exam';
      const eName = cand.examName || 'Assessment';

      if (!map.has(eKey)) {
        map.set(eKey, {
          examId: cand.examId || eKey,
          examName: eName,
          total: 0,
          inProgress: 0,
          submitted: 0,
          forceSubmitted: 0,
          terminated: 0,
          assigned: 0
        });
      }

      const item = map.get(eKey)!;
      item.total++;

      if (isCandidateTerminated(cand.status)) {
        item.terminated++;
      } else if (isCandidateForceSubmitted(cand.status)) {
        item.forceSubmitted++;
      } else if (isCandidateSubmitted(cand.status)) {
        item.submitted++;
      } else if (isCandidateInProgress(cand.status)) {
        item.inProgress++;
      } else {
        item.assigned++;
      }
    });

    return Array.from(map.values());
  }, [candidates]);

  const totalCandidatesCount = candidates.length;
  const totalInProgressCount = useMemo(() => candidates.filter(c => isCandidateInProgress(c.status)).length, [candidates]);
  const totalSubmittedCount = useMemo(() => candidates.filter(c => isCandidateSubmitted(c.status)).length, [candidates]);
  const totalForceSubmittedCount = useMemo(() => candidates.filter(c => isCandidateForceSubmitted(c.status)).length, [candidates]);
  const totalTerminatedCount = useMemo(() => candidates.filter(c => isCandidateTerminated(c.status)).length, [candidates]);
  const totalAssignedCount = useMemo(() => candidates.filter(c => isCandidateAssigned(c.status)).length, [candidates]);
  const completedCandidatesCount = totalSubmittedCount + totalForceSubmittedCount + totalTerminatedCount;
  const flaggedCandidatesCount = useMemo(() => candidates.filter(c => c.violations && c.violations.length > 0).length, [candidates]);

  // Candidate counts scoped to the currently selected exam
  const currentExamCandidates = useMemo(() => {
    if (selectedExamFilter === 'ALL') return candidates;
    return candidates.filter(c => 
      (c.examId && c.examId === selectedExamFilter) ||
      (c.examName && c.examName.toLowerCase() === selectedExamFilter.toLowerCase())
    );
  }, [candidates, selectedExamFilter]);

  const currentExamTotal = currentExamCandidates.length;
  const currentExamInProgress = useMemo(() => currentExamCandidates.filter(c => isCandidateInProgress(c.status)).length, [currentExamCandidates]);
  const currentExamSubmitted = useMemo(() => currentExamCandidates.filter(c => isCandidateSubmitted(c.status)).length, [currentExamCandidates]);
  const currentExamForceSubmitted = useMemo(() => currentExamCandidates.filter(c => isCandidateForceSubmitted(c.status)).length, [currentExamCandidates]);
  const currentExamTerminated = useMemo(() => currentExamCandidates.filter(c => isCandidateTerminated(c.status)).length, [currentExamCandidates]);
  const currentExamAssigned = useMemo(() => currentExamCandidates.filter(c => isCandidateAssigned(c.status)).length, [currentExamCandidates]);

  const filteredCandidates = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return candidates.filter(c => {
      // Exam Filter
      if (selectedExamFilter !== 'ALL') {
        const matchesExam = 
          (c.examId && c.examId === selectedExamFilter) ||
          (c.examName && c.examName.toLowerCase() === selectedExamFilter.toLowerCase());
        if (!matchesExam) return false;
      }

      // Status Filter
      if (statusFilter === 'IN_PROGRESS' && !isCandidateInProgress(c.status)) return false;
      if (statusFilter === 'SUBMITTED' && !isCandidateSubmitted(c.status)) return false;
      if (statusFilter === 'FORCE_SUBMITTED' && !isCandidateForceSubmitted(c.status)) return false;
      if (statusFilter === 'TERMINATED' && !isCandidateTerminated(c.status)) return false;
      if (statusFilter === 'ASSIGNED' && !isCandidateAssigned(c.status)) return false;

      if (tokens.length === 0) return true;

      // Build complete searchable text across candidate name, email, exam, status, scores, and violations
      const searchParts: string[] = [
        c.name || '',
        c.email || '',
        c.examName || '',
        c.id || '',
        c.attemptId || '',
        c.status || '',
        (c.status || '').replace(/_/g, ' '),
        isCandidateInProgress(c.status) ? 'in progress active taking ongoing' : '',
        isCandidateSubmitted(c.status) ? 'submitted auto submitted completed written' : '',
        isCandidateForceSubmitted(c.status) ? 'force submitted forcefully submitted force' : '',
        isCandidateTerminated(c.status) ? 'terminated stop disqualified cancelled' : '',
        isCandidateAssigned(c.status) ? 'assigned scheduled pending' : '',
        c.resultStatus || '',
        c.resultStatus === 'PASS' ? 'pass passed qualified' : '',
        c.resultStatus === 'FAIL' ? 'fail failed disqualified' : '',
        `${c.score} marks`,
        `${Math.round(c.percentage)}%`,
        `score ${c.score}`,
        `risk ${c.riskScore}`,
        c.riskScore >= 40 ? 'critical risk high risk danger flagged' : c.riskScore > 0 ? 'risk flagged low risk' : 'clean clean attempt zero risk'
      ];

      if (c.violations && c.violations.length > 0) {
        searchParts.push('violation violations flagged infractions');
        c.violations.forEach(v => {
          searchParts.push(v.type || '');
          searchParts.push((v.type || '').replace(/_/g, ' '));
          searchParts.push(v.severity || '');
          searchParts.push(v.description || '');
          const info = getViolationInfo(v.type, v.description);
          searchParts.push(info.title);
          searchParts.push(info.actionDone);
          searchParts.push(info.ruleBreached);
          searchParts.push(info.categoryLabel);
        });
      }

      const candidateBlob = searchParts.join(' ').toLowerCase();
      return tokens.every(token => candidateBlob.includes(token));
    });
  }, [candidates, searchQuery, statusFilter, selectedExamFilter]);

  const formatSeconds = (secs: number) => {
    if (!secs || secs <= 0) return 'N/A';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex font-sans selection:bg-blue-500/20">
      {/* Sidebar - Fixed at left edge, stretching 100% full height top to bottom */}
      <aside className="w-64 bg-blue-600 text-white border-r border-blue-700 flex flex-col hidden md:flex shadow-sm z-30 fixed inset-y-0 left-0 shrink-0">
        <div className="p-6 border-b border-blue-500/30 shrink-0 space-y-3">
          <Link href="/admin/monitoring" className="hover:opacity-95 transition-opacity block">
            <BrandLogo size="md" variant="light" />
          </Link>
          <FlyhiiBranding variant="light" size="sm" />
        </div>

        <div className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold text-blue-200 uppercase tracking-wider mb-3 px-3">Operations</p>
          
          {/* Active Navigation: Exam Candidates */}
          <div className="bg-white text-blue-600 px-4 py-3 rounded-xl font-bold border border-white flex items-center transition-all shadow-sm">
            <Users className="w-5 h-5 mr-3 text-blue-600" /> Exam Candidates
          </div>

          <Link 
            href="/admin/candidates?filter=pending" 
            className="text-blue-100 hover:text-white hover:bg-blue-700/60 px-4 py-3 rounded-xl font-medium cursor-pointer transition-all flex items-center justify-between"
          >
            <div className="flex items-center">
              <UserCheck className="w-5 h-5 mr-3 text-blue-200" /> Candidate Approvals
            </div>
            {pendingApprovalsCount > 0 && (
              <span className="bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                {pendingApprovalsCount}
              </span>
            )}
          </Link>

          <Link 
            href="/admin/exams" 
            className="text-blue-100 hover:text-white hover:bg-blue-700/60 px-4 py-3 rounded-xl font-medium cursor-pointer transition-all flex items-center"
          >
            <FileText className="w-5 h-5 mr-3 text-blue-200" /> Exam Management
          </Link>

          <Link 
            href="/admin/violations" 
            className="text-blue-100 hover:text-white hover:bg-blue-700/60 px-4 py-3 rounded-xl font-medium cursor-pointer transition-all flex items-center"
          >
            <AlertTriangle className="w-5 h-5 mr-3 text-blue-200" /> Violation Queue
          </Link>

          <Link 
            href="/admin/results" 
            className="text-blue-100 hover:text-white hover:bg-blue-700/60 px-4 py-3 rounded-xl font-medium cursor-pointer transition-all flex items-center"
          >
            <BarChart3 className="w-5 h-5 mr-3 text-blue-200" /> Results
          </Link>

          <Link 
            href="/admin/reports" 
            className="text-blue-100 hover:text-white hover:bg-blue-700/60 px-4 py-3 rounded-xl font-medium cursor-pointer transition-all flex items-center"
          >
            <CheckCircle2 className="w-5 h-5 mr-3 text-blue-200" /> Integrity Reports
          </Link>

          <Link 
            href="/admin/helpdesk" 
            className="text-blue-100 hover:text-white hover:bg-blue-700/60 px-4 py-3 rounded-xl font-medium cursor-pointer transition-all flex items-center justify-between"
          >
            <div className="flex items-center">
              <LifeBuoy className="w-5 h-5 mr-3 text-blue-200" /> Help Desk
            </div>
            {openTicketsCount > 0 && (
              <span className="bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                {openTicketsCount}
              </span>
            )}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0 relative overflow-hidden">
        {/* Top Header */}
        <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-8 py-5 z-10 sticky top-0 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Title & Subtitle */}
            <div className="min-w-0">
              <div className="md:hidden mb-2.5">
                <FlyhiiBranding variant="dark" size="sm" />
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Candidate Examination Records
                  </h1>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-1.5 font-medium">
                Performance overview and detailed information of candidates who wrote examinations
              </p>
            </div>

            {/* Top-Right: Admin Profile & Sign Out (Styled like Candidate Portal) */}
            <div className="flex items-center space-x-3 shrink-0 self-start md:self-center">
              <FlyhiiBranding variant="dark" size="sm" className="hidden sm:inline-flex" />
              <span className="hidden sm:inline-block h-6 w-px bg-slate-200" />
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200 shrink-0 shadow-2xs">
                  {adminProfile?.name ? (
                    adminProfile.name.trim().split(/\s+/).length > 1
                      ? (adminProfile.name.trim().split(/\s+/)[0][0] + adminProfile.name.trim().split(/\s+/)[1][0]).toUpperCase()
                      : adminProfile.name.substring(0, 2).toUpperCase()
                  ) : 'AD'}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold text-slate-900 leading-tight">
                    {adminProfile?.name || 'Admin User'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">
                    {adminProfile?.email || 'admin@proctorguard.local'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowLogoutConfirm(true)} 
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-rose-200 shadow-2xs cursor-pointer group active:scale-[0.98]" 
                title="Sign Out of Admin Portal"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-600 transition-colors" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Badges Bar */}
          <div className="mt-4 pt-3.5 border-t border-slate-100/80 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setSelectedExamFilter('ALL'); setStatusFilter('ALL'); }}
              className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                statusFilter === 'ALL' && selectedExamFilter === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-blue-50/90 hover:bg-blue-100 text-blue-700 border-blue-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full mr-2 shrink-0 ${statusFilter === 'ALL' && selectedExamFilter === 'ALL' ? 'bg-white' : 'bg-blue-500'}`}></span> 
              <span>Total Candidates: {totalCandidatesCount}</span>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
              className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                statusFilter === 'IN_PROGRESS'
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
              }`}
            >
              <span className="w-2 h-2 bg-sky-500 rounded-full mr-2 shrink-0 animate-ping"></span> 
              <span>In Progress: {totalInProgressCount}</span>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'SUBMITTED' ? 'ALL' : 'SUBMITTED')}
              className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                statusFilter === 'SUBMITTED'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 shrink-0"></span> 
              <span>Submitted: {totalSubmittedCount}</span>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'FORCE_SUBMITTED' ? 'ALL' : 'FORCE_SUBMITTED')}
              className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                statusFilter === 'FORCE_SUBMITTED'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
              }`}
            >
              <span className="w-2 h-2 bg-amber-500 rounded-full mr-2 shrink-0"></span> 
              <span>Force Submitted: {totalForceSubmittedCount}</span>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'TERMINATED' ? 'ALL' : 'TERMINATED')}
              className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                statusFilter === 'TERMINATED'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
              }`}
            >
              <span className="w-2 h-2 bg-rose-500 rounded-full mr-2 shrink-0"></span> 
              <span>Terminated: {totalTerminatedCount}</span>
            </button>

            <Link 
              href="/admin/violations" 
              className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-50/90 hover:bg-rose-100 px-3 py-1.5 rounded-full border border-rose-200 transition-colors shadow-2xs whitespace-nowrap"
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
              <span>Flagged Violations: {flaggedCandidatesCount}</span>
            </Link>

            {pendingApprovalsCount > 0 && (
              <Link 
                href="/admin/candidates?filter=pending" 
                className="inline-flex items-center text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-full border border-amber-300 transition-colors shadow-2xs whitespace-nowrap group"
                title="Review and approve pending candidates"
              >
                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2 shrink-0 animate-ping"></span> 
                <span>Pending Approvals: {pendingApprovalsCount}</span>
              </Link>
            )}
          </div>
        </header>

        {/* Pending Approvals Alert Banner */}
        {pendingApprovalsCount > 0 && (
          <div className="mx-8 mt-6 p-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-amber-950">
                  {pendingApprovalsCount} New Candidate Registration{pendingApprovalsCount > 1 ? 's' : ''} Awaiting Approval
                </p>
                <p className="text-xs text-amber-800 mt-0.5 font-medium">
                  Candidates have completed registration and need administrator approval before they can sign in or take assigned assessments.
                </p>
              </div>
            </div>
            <Link
              href="/admin/candidates?filter=pending"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center cursor-pointer group active:scale-95"
            >
              <span>Review & Approve</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        )}

        {/* Live Examination Status by Assessment (Exam-Based Breakdown) */}
        {examStatsList.length > 0 && (
          <div className="px-8 pt-6 pb-1 z-10">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center">
                      Live Candidate Examination Status (Exam-Based)
                      <span className="ml-2.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-pulse"></span>
                        Live Telemetry
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Real-time breakdown of candidates taking, submitted, force submitted, and terminated across examinations
                    </p>
                  </div>
                </div>

                {selectedExamFilter !== 'ALL' && (
                  <button
                    onClick={() => setSelectedExamFilter('ALL')}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Filter (Show All Exams)</span>
                  </button>
                )}
              </div>

              {/* Cards Grid: All Exams Summary Card + Individual Exam Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {/* "All Exams" Card */}
                <div
                  onClick={() => setSelectedExamFilter('ALL')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedExamFilter === 'ALL'
                      ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center">
                      <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      All Examinations Summary
                    </span>
                    <span className="text-[11px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs font-mono">
                      {totalCandidatesCount} Candidates
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-blue-50/90 p-2 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-center space-x-1">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
                        <span className="text-xs font-black text-blue-700">{totalInProgressCount}</span>
                      </div>
                      <span className="text-[9px] font-extrabold uppercase text-blue-600 tracking-wider block mt-0.5">In Progress</span>
                    </div>

                    <div className="bg-emerald-50/90 p-2 rounded-lg border border-emerald-200">
                      <span className="text-xs font-black text-emerald-700 block">{totalSubmittedCount}</span>
                      <span className="text-[9px] font-extrabold uppercase text-emerald-600 tracking-wider block mt-0.5">Submitted</span>
                    </div>

                    <div className="bg-amber-50/90 p-2 rounded-lg border border-amber-200">
                      <span className="text-xs font-black text-amber-700 block">{totalForceSubmittedCount}</span>
                      <span className="text-[9px] font-extrabold uppercase text-amber-600 tracking-wider block mt-0.5">Force Sub</span>
                    </div>

                    <div className="bg-rose-50/90 p-2 rounded-lg border border-rose-200">
                      <span className="text-xs font-black text-rose-700 block">{totalTerminatedCount}</span>
                      <span className="text-[9px] font-extrabold uppercase text-rose-600 tracking-wider block mt-0.5">Terminated</span>
                    </div>
                  </div>
                </div>

                {/* Per-Exam Cards */}
                {examStatsList.map((stat) => {
                  const isSelected = selectedExamFilter === stat.examId || selectedExamFilter === stat.examName;

                  return (
                    <div
                      key={stat.examId}
                      onClick={() => setSelectedExamFilter(isSelected ? 'ALL' : stat.examId)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-blue-300 bg-white hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-extrabold text-slate-900 truncate pr-2" title={stat.examName}>
                          {stat.examName}
                        </span>
                        <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 shrink-0 font-mono">
                          {stat.total}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        <div className="bg-blue-50/90 p-2 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-center space-x-1">
                            {stat.inProgress > 0 && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>}
                            <span className="text-xs font-black text-blue-700">{stat.inProgress}</span>
                          </div>
                          <span className="text-[9px] font-extrabold uppercase text-blue-600 tracking-wider block mt-0.5">In Progress</span>
                        </div>

                        <div className="bg-emerald-50/90 p-2 rounded-lg border border-emerald-200">
                          <span className="text-xs font-black text-emerald-700 block">{stat.submitted}</span>
                          <span className="text-[9px] font-extrabold uppercase text-emerald-600 tracking-wider block mt-0.5">Submitted</span>
                        </div>

                        <div className="bg-amber-50/90 p-2 rounded-lg border border-amber-200">
                          <span className="text-xs font-black text-amber-700 block">{stat.forceSubmitted}</span>
                          <span className="text-[9px] font-extrabold uppercase text-amber-600 tracking-wider block mt-0.5">Force Sub</span>
                        </div>

                        <div className="bg-rose-50/90 p-2 rounded-lg border border-rose-200">
                          <span className="text-xs font-black text-rose-700 block">{stat.terminated}</span>
                          <span className="text-[9px] font-extrabold uppercase text-rose-600 tracking-wider block mt-0.5">Terminated</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="px-8 pt-4 pb-2 z-10 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
          <div className="relative w-full xl:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidate name, email, exam, status, violation..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(sanitizeSearchInput(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold shadow-sm w-full xl:w-auto overflow-x-auto">
            <button 
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'ALL' 
                  ? 'bg-blue-600 text-white shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              All ({currentExamTotal})
            </button>
            <button 
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center whitespace-nowrap cursor-pointer ${
                statusFilter === 'IN_PROGRESS' 
                  ? 'bg-sky-600 text-white shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusFilter === 'IN_PROGRESS' ? 'bg-white' : 'bg-sky-500'} animate-ping`}></span>
              In Progress ({currentExamInProgress})
            </button>
            <button 
              onClick={() => setStatusFilter('SUBMITTED')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'SUBMITTED' 
                  ? 'bg-emerald-600 text-white shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Submitted ({currentExamSubmitted})
            </button>
            <button 
              onClick={() => setStatusFilter('FORCE_SUBMITTED')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'FORCE_SUBMITTED' 
                  ? 'bg-amber-600 text-white shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Force Submitted ({currentExamForceSubmitted})
            </button>
            <button 
              onClick={() => setStatusFilter('TERMINATED')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'TERMINATED' 
                  ? 'bg-rose-600 text-white shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Terminated ({currentExamTerminated})
            </button>
            {currentExamAssigned > 0 && (
              <button 
                onClick={() => setStatusFilter('ASSIGNED')}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'ASSIGNED' 
                    ? 'bg-slate-700 text-white shadow-sm font-bold' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Assigned ({currentExamAssigned})
              </button>
            )}
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
              {filteredCandidates.map((cand: CandidateExamRecord) => {
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
                            cand.status === 'TERMINATED'
                              ? 'bg-rose-50 text-rose-600 border-rose-200'
                              : cand.status === 'FORCE_SUBMITTED' || cand.status === 'FORCEFULLY_SUBMITTED'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : isCompleted 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                              : 'bg-blue-50 text-blue-600 border-blue-200'
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

                        {(() => {
                          const badge = getStatusBadge(cand.status);
                          return (
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border shrink-0 flex items-center ${badge.className}`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${badge.dotColor}`}></span>
                              {badge.label}
                            </span>
                          );
                        })()}
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

                          {cand.violations.some((v: ViolationSummary) => v.screenshot || v.snapshotImage) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const vWithProof = cand.violations.find((v: ViolationSummary) => v.screenshot || v.snapshotImage);
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
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-bold text-xs flex items-center shrink-0 transition shadow-2xs whitespace-nowrap cursor-pointer hover:border-blue-300"
                              title="Click to view violation proof screenshot and incident details"
                            >
                              <Camera className="w-3.5 h-3.5 mr-1 shrink-0 text-blue-600" />
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
                onClick={() => {
                  setSelectedCandidate(null);
                  setShowCandidateViolationQueueModal(false);
                }} 
                className="text-slate-400 hover:text-slate-700 transition-colors p-2.5 hover:bg-slate-200/60 rounded-xl shrink-0 cursor-pointer"
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
                  {(() => {
                    const badge = getStatusBadge(selectedCandidate.status);
                    return (
                      <span className={`text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border flex items-center ${badge.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${badge.dotColor}`}></span>
                        {badge.label}
                      </span>
                    );
                  })()}
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
                    type="button"
                    onClick={() => {
                      setCandidateQueueSeverityFilter('ALL');
                      setCandidateQueueSearchQuery('');
                      setShowCandidateViolationQueueModal(true);
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    title={`View all ${selectedCandidate.violations.length} violations in queue`}
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

                          {/* Screenshot Proof Preview / On-demand loader */}
                          {proofImg ? (
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
                          ) : (v.id || v._id) ? (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => handleOpenViolationProof(v)}
                                disabled={loadingProofId === (v.id || v._id)}
                                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Camera className="w-3.5 h-3.5 text-blue-600" />
                                <span>View Screenshot Proof Evidence</span>
                                {loadingProofId === (v.id || v._id) ? (
                                  <div className="w-3 h-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin ml-1" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 ml-1 text-blue-500" />
                                )}
                              </button>
                            </div>
                          ) : null}
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

              {/* Integrity & Verification Action for Completed & Submitted Sessions */}
              {isCompletedStatus(selectedCandidate.status) && selectedCandidate.verificationStatus !== 'APPROVED' && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-2xs">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 block mb-1.5 flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600 shrink-0" />
                    Assessment & Integrity Review
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3 font-medium">
                    Review candidate answers, telemetry, and integrity infractions to finalize or audit verification status.
                  </p>
                  <Link
                    href={`/admin/results?search=${encodeURIComponent(selectedCandidate.name || selectedCandidate.email || '')}`}
                    className="flex items-center justify-center p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <span>Open in Results & Verification Portal</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </div>
              )}

              {/* Authorize Re-write Action for Completed / Submitted Sessions */}
              {isCompletedStatus(selectedCandidate.status) && selectedCandidate.examId && (
                <div className="bg-blue-50/80 rounded-2xl p-4 border border-blue-200/80 shadow-2xs">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-blue-950 block mb-1.5 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-600 shrink-0" />
                    Authorize Examination Re-write
                  </span>
                  <p className="text-xs text-blue-900/80 leading-relaxed mb-3 font-medium">
                    Permit this candidate to re-take this examination. Prior answers, violations, and performance telemetry will remain safely recorded.
                  </p>
                  <button
                    onClick={() => handleAllowRewrite(selectedCandidate.examId, selectedCandidate.id, selectedCandidate.name)}
                    disabled={rewritingCandidateId === selectedCandidate.id}
                    className="w-full flex items-center justify-center p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${rewritingCandidateId === selectedCandidate.id ? 'animate-spin' : ''}`} />
                    <span>Authorize Examination Re-write</span>
                  </button>
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
                  {selectedProofModal.image ? (
                    <img 
                      src={selectedProofModal.image} 
                      alt="Violation Evidence" 
                      className="w-full max-h-[440px] object-contain mx-auto" 
                    />
                  ) : selectedProofModal.driveUrl ? (
                    <div className="py-16 px-6 text-center text-white flex flex-col items-center justify-center">
                      <Camera className="w-12 h-12 text-blue-400 mb-3" />
                      <p className="text-sm font-bold">Screenshot Evidence Archived in Google Drive</p>
                      <a 
                        href={selectedProofModal.driveUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center shadow-sm cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> View on Google Drive
                      </a>
                    </div>
                  ) : (
                    <div className="py-12 px-6 text-center text-slate-400">
                      <Camera className="w-10 h-10 mx-auto mb-2 text-slate-500" />
                      <p className="text-xs">No screenshot image recorded</p>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-rose-600/90 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-md shadow-lg uppercase tracking-wider flex items-center">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                    Surveillance Snapshot
                  </div>
                  {selectedProofModal.driveUrl && selectedProofModal.image && (
                    <a
                      href={selectedProofModal.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow uppercase tracking-wider flex items-center backdrop-blur-xs transition"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" /> Google Drive
                    </a>
                  )}
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
              <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end sticky bottom-0">
                <button 
                  onClick={() => setSelectedProofModal(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200 shadow-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Candidate-Specific Full Violation Queue Modal (Opens directly without redirecting away) */}
      {showCandidateViolationQueueModal && selectedCandidate && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-sm shrink-0">
                  {selectedCandidate.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-lg text-white truncate">{selectedCandidate.name}</h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider shrink-0">
                      Violation Queue
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
                    {selectedCandidate.email} • {selectedCandidate.examName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCandidateViolationQueueModal(false)}
                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Close Queue (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-header: Metrics & Quick Summary */}
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                <span className="bg-slate-200/80 text-slate-800 px-3 py-1 rounded-full">
                  Total Violations: {selectedCandidate.violations.length}
                </span>
                {candidateCriticalCount > 0 && (
                  <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full border border-rose-200 flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5 animate-pulse" />
                    Critical: {candidateCriticalCount}
                  </span>
                )}
                {candidateHighCount > 0 && (
                  <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full border border-orange-200">
                    High: {candidateHighCount}
                  </span>
                )}
                {candidateMediumCount > 0 && (
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                    Medium: {candidateMediumCount}
                  </span>
                )}
                {candidateProofCount > 0 && (
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200 flex items-center">
                    <Camera className="w-3 h-3 mr-1" />
                    Proof Evidence: {candidateProofCount}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-500 font-medium">Exam Score:</span>
                <span className="font-extrabold text-slate-900">{selectedCandidate.score} / {selectedCandidate.totalMarks || 100}</span>
                <span className="font-extrabold text-blue-600">({selectedCandidate.percentage.toFixed(1)}%)</span>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="p-4 px-6 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              {/* Severity Filter Tabs */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setCandidateQueueSeverityFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    candidateQueueSeverityFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({selectedCandidate.violations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateQueueSeverityFilter('CRITICAL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    candidateQueueSeverityFilter === 'CRITICAL'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  Critical ({candidateCriticalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateQueueSeverityFilter('HIGH')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    candidateQueueSeverityFilter === 'HIGH'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                  }`}
                >
                  High ({candidateHighCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateQueueSeverityFilter('MEDIUM')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    candidateQueueSeverityFilter === 'MEDIUM'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  Medium ({candidateMediumCount})
                </button>
              </div>

              {/* Search Within Candidate Violations */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={candidateQueueSearchQuery}
                  onChange={(e) => setCandidateQueueSearchQuery(e.target.value)}
                  placeholder="Search violations..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {candidateQueueSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCandidateQueueSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Violations Scroll Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3.5 bg-slate-50/50">
              {filteredCandidateQueueViolations.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2 opacity-80" />
                  <p className="font-extrabold text-slate-800 text-sm">No Matching Violations</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {candidateQueueSearchQuery || candidateQueueSeverityFilter !== 'ALL'
                      ? 'No incidents matched your current search and severity filters.'
                      : 'No integrity violations recorded for this candidate.'}
                  </p>
                </div>
              ) : (
                filteredCandidateQueueViolations.map((v, i) => {
                  const proofImg = v.screenshot || v.snapshotImage;
                  const vInfo = getViolationInfo(v.type, v.description);

                  return (
                    <div
                      key={v.id || v._id || i}
                      className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col sm:flex-row gap-4 justify-between"
                    >
                      <div className="flex-1 space-y-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md border flex items-center ${
                              v.severity === 'CRITICAL'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : v.severity === 'HIGH'
                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                            {v.severity} • {vInfo.title}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {new Date(v.detectedAt || v.timestamp || new Date().toISOString()).toLocaleTimeString()} ({new Date(v.detectedAt || v.timestamp || new Date().toISOString()).toLocaleDateString()})
                          </span>
                        </div>

                        {/* Action Description */}
                        <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200/80 text-xs">
                          <span className="text-[10px] font-extrabold uppercase text-rose-800 block mb-0.5 tracking-wider">
                            Candidate Action During Exam:
                          </span>
                          <p className="text-slate-800 font-medium text-xs leading-relaxed">
                            {vInfo.actionDone}
                          </p>
                          {v.description && v.description !== vInfo.actionDone && (
                            <p className="text-slate-500 font-mono text-[11px] mt-1.5 pt-1.5 border-t border-rose-200/50">
                              System Log: {v.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Proof Thumbnail / On-demand loader */}
                      {proofImg ? (
                        <div className="sm:w-48 shrink-0 flex flex-col">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center">
                            <Camera className="w-3 h-3 mr-1 text-blue-600" /> Evidence Proof:
                          </span>
                          <div
                            onClick={() =>
                              setSelectedProofModal({
                                image: proofImg,
                                type: v.type,
                                time: new Date(v.detectedAt || v.timestamp || new Date().toISOString()).toLocaleString(),
                                desc: v.description,
                                candidateName: selectedCandidate.name,
                                candidateEmail: selectedCandidate.email,
                                examName: selectedCandidate.examName,
                                severity: v.severity,
                              })
                            }
                            className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer group/img h-28 shadow-xs"
                          >
                            <img src={proofImg} alt="Proof" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-slate-900/20 group-hover/img:bg-slate-900/40 transition-colors flex items-center justify-center">
                              <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow flex items-center">
                                <Eye className="w-3 h-3 mr-1" /> Enlarge
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (v.id || v._id) ? (
                        <div className="sm:w-48 shrink-0 flex flex-col justify-center">
                          <button
                            type="button"
                            onClick={() => handleOpenViolationProof(v)}
                            disabled={loadingProofId === (v.id || v._id)}
                            className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Camera className="w-3.5 h-3.5 text-blue-600" />
                            <span>View Proof</span>
                            {loadingProofId === (v.id || v._id) ? (
                              <div className="w-3 h-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin ml-1" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 ml-1 text-blue-500" />
                            )}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500 font-medium text-center sm:text-left">
                Displaying {filteredCandidateQueueViolations.length} of {selectedCandidate.violations.length} incidents recorded for {selectedCandidate.name}
              </span>
              <div className="flex items-center space-x-3">
                <Link
                  href={`/admin/violations?${new URLSearchParams({
                    ...(selectedCandidate.id ? { candidateId: selectedCandidate.id } : {}),
                    ...(selectedCandidate.email ? { candidateEmail: selectedCandidate.email } : {}),
                    ...(selectedCandidate.name ? { candidateName: selectedCandidate.name } : {}),
                    ...(selectedCandidate.attemptId ? { attemptId: selectedCandidate.attemptId } : {}),
                    ...(selectedCandidate.examId ? { examId: selectedCandidate.examId } : {})
                  }).toString()}`}
                  className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer flex items-center"
                  title="Open in complete Violation Portal with Drive archive"
                >
                  Open in Violation Queue Portal &rarr;
                </Link>
                <button
                  type="button"
                  onClick={() => setShowCandidateViolationQueueModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
