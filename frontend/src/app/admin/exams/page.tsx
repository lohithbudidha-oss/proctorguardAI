'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Plus, 
  Settings, 
  Users, 
  UserCheck,
  MonitorPlay, 
  FileText, 
  CheckCircle, 
  Trash2, 
  Eye, 
  Edit2, 
  X, 
  Clock, 
  AlertCircle,
  Search,
  LogOut,
  LifeBuoy,
  CheckCircle2
} from 'lucide-react';
import api from '@/lib/api';
import { sanitizeSearchInput } from '@/lib/sanitize';

interface Exam {
  _id: string;
  title: string;
  duration: number;
  status: string;
  description?: string;
  instructions?: string;
  createdAt?: string;
}

const PRESET_DURATIONS = [15, 30, 45, 60, 90, 120, 180];

// Comprehensive Emoji Regex matching pictographic, presentation emojis, flags, symbols, and surrogates
const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF]|[\u2600-\u26FF\u2700-\u27BF])/u;
const EMOJI_GLOBAL_REGEX = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF]|[\u2600-\u26FF\u2700-\u27BF])/gu;

// Intercepts key presses at the initial position to block numbers, spaces, and special characters immediately
const handleInitialKeyBlock = (
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  currentVal: string,
  fieldLabel: string,
  setError: (err: string | undefined) => void
) => {
  const isAtStart = (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) || currentVal.length === 0;

  // Printable single character typed by user at position 0
  if (isAtStart && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (!/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      setError(`${fieldLabel} must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.`);
    }
  }
};

// Sanitizes input on change, rejecting emojis and stripping initial numbers / special characters
const handleSanitizedChange = (
  rawVal: string,
  fieldLabel: string,
  setValue: (clean: string) => void,
  setError: (err: string | undefined) => void
) => {
  let hadEmoji = false;
  let hadInitialInvalid = false;

  if (EMOJI_REGEX.test(rawVal)) {
    hadEmoji = true;
  }

  // Remove any emojis
  let clean = rawVal.replace(EMOJI_GLOBAL_REGEX, '');

  // If text starts with non-letter characters (numbers, special chars, leading spaces)
  if (clean.length > 0 && !/^[a-zA-Z]/.test(clean)) {
    hadInitialInvalid = true;
    clean = clean.replace(/^[^a-zA-Z]+/, '');
  }

  setValue(clean);

  if (hadEmoji) {
    setError('Emojis are not accepted in the exam form.');
  } else if (hadInitialInvalid) {
    setError(`${fieldLabel} must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.`);
  } else {
    setError(undefined);
  }
};

export default function AdminExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pg_cached_admin_exams');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pg_cached_admin_exams');
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch (e) {}
    }
    return true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  
  // View Details Modal State
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [examDetails, setExamDetails] = useState<any>(null);

  // Create Exam Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDuration, setCreateDuration] = useState<number | ''>(60);
  const [createDescription, setCreateDescription] = useState('');
  const [createInstructions, setCreateInstructions] = useState('');
  const [createErrors, setCreateErrors] = useState<{ title?: string; description?: string; instructions?: string }>({});
  const [isCreating, setIsCreating] = useState(false);

  // Edit Exam Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState<number | ''>(60);
  const [editDescription, setEditDescription] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editErrors, setEditErrors] = useState<{ title?: string; description?: string; instructions?: string }>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const c = sessionStorage.getItem('pg_cached_pending_count');
        if (c) return parseInt(c, 10) || 0;
      } catch (e) {}
    }
    return 0;
  });
  const [adminProfile, setAdminProfile] = useState<{ name?: string; email?: string } | null>(null);
  const [examStatsMap, setExamStatsMap] = useState<Record<string, {
    total: number;
    inProgress: number;
    submitted: number;
    forceSubmitted: number;
    terminated: number;
    assigned: number;
  }>>({});

  const fetchExams = () => {
    api.get('/admin/exams')
      .then(res => {
        const list = res.data.exams || [];
        setExams(list);
        try {
          sessionStorage.setItem('pg_cached_admin_exams', JSON.stringify(list));
        } catch (e) {}
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch exams', err);
        setLoading(false);
      });

    api.get('/admin/exams/stats')
      .then(res => {
        const statsList = res.data?.stats || [];
        const map: Record<string, any> = {};
        statsList.forEach((s: any) => {
          map[s.examId] = s;
        });
        setExamStatsMap(map);
      })
      .catch(() => {});

    api.get('/admin/candidates?status=PENDING&countOnly=true')
      .then(res => {
        if (res.data?.count !== undefined) {
          setPendingApprovalsCount(res.data.count);
        } else {
          const cands = res.data.candidates || [];
          const pending = cands.filter((c: any) => {
            const s = (c.status || '').toUpperCase();
            return s === 'PENDING_VERIFICATION' || s === 'PENDING';
          }).length;
          setPendingApprovalsCount(pending);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchExams();
    try {
      const u = localStorage.getItem('user');
      if (u) setAdminProfile(JSON.parse(u));
    } catch (e) {}
  }, []);

  const formatDurationDisplay = (mins: number | string) => {
    const num = typeof mins === 'string' ? parseInt(mins, 10) : mins;
    if (!num || isNaN(num) || num <= 0) return 'Not set';
    const hours = Math.floor(num / 60);
    const rem = num % 60;
    if (hours > 0 && rem > 0) return `${hours}h ${rem}m (${num} Mins)`;
    if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''} (${num} Mins)`;
    return `${num} Mins`;
  };

  const filteredExams = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return exams.filter(e => {
      const matchesStatus = 
        statusFilter === 'ALL' ||
        e.status === statusFilter;

      if (!matchesStatus) return false;
      if (tokens.length === 0) return true;

      const durationStr = `${e.duration} min mins minutes ${Math.floor(e.duration / 60)} hour hours`;
      const blob = `${e.title || ''} ${e.status || ''} ${e.description || ''} ${e.instructions || ''} ${durationStr}`.toLowerCase();
      return tokens.every(t => blob.includes(t));
    });
  }, [exams, searchQuery, statusFilter]);

  const handleOpenCreateModal = () => {
    setCreateTitle('');
    setCreateDuration(60);
    setCreateDescription('');
    setCreateInstructions('');
    setCreateErrors({});
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { title?: string; description?: string; instructions?: string } = {};

    if (!createTitle.trim()) {
      errors.title = 'Please enter an exam title.';
    } else if (createTitle.trim().length > 250) {
      errors.title = `Exam title cannot exceed 250 characters (currently ${createTitle.trim().length}).`;
    } else if (EMOJI_REGEX.test(createTitle)) {
      errors.title = 'Emojis are not accepted in the exam creation form.';
    } else if (!/^[a-zA-Z]/.test(createTitle.trim())) {
      errors.title = 'Exam title must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.';
    }

    if (createDescription.trim()) {
      if (createDescription.trim().length > 250) {
        errors.description = `Description cannot exceed 250 characters (currently ${createDescription.trim().length}).`;
      } else if (EMOJI_REGEX.test(createDescription)) {
        errors.description = 'Emojis are not accepted in the description.';
      } else if (!/^[a-zA-Z]/.test(createDescription.trim())) {
        errors.description = 'Description must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.';
      }
    }

    if (createInstructions.trim()) {
      if (createInstructions.trim().length > 250) {
        errors.instructions = `Exam guidelines & instructions cannot exceed 250 characters (currently ${createInstructions.trim().length}).`;
      } else if (EMOJI_REGEX.test(createInstructions)) {
        errors.instructions = 'Emojis are not accepted in guidelines & instructions.';
      } else if (!/^[a-zA-Z]/.test(createInstructions.trim())) {
        errors.instructions = 'Exam guidelines & instructions must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.';
      }
    }

    const durationNum = Number(createDuration);
    if (!durationNum || durationNum <= 0) {
      alert('Please assign a valid exam duration (minimum 1 minute).');
      return;
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    try {
      setIsCreating(true);
      const res = await api.post('/admin/exams', {
        title: createTitle.trim(),
        duration: durationNum,
        description: createDescription.trim(),
        instructions: createInstructions.trim(),
        status: 'DRAFT',
      });
      setIsCreateModalOpen(false);
      router.push(`/admin/exams/${res.data.exam._id}/questions`);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to create exam. Please check backend connection.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditModal = (exam: Exam) => {
    setEditingExam(exam);
    setEditTitle(exam.title);
    setEditDuration(exam.duration || 60);
    setEditDescription(exam.description || '');
    setEditInstructions(exam.instructions || '');
    setEditErrors({});
    setIsEditModalOpen(true);
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;

    const errors: { title?: string; description?: string; instructions?: string } = {};

    if (!editTitle.trim()) {
      errors.title = 'Please enter an exam title.';
    } else if (editTitle.trim().length > 250) {
      errors.title = `Exam title cannot exceed 250 characters (currently ${editTitle.trim().length}).`;
    } else if (EMOJI_REGEX.test(editTitle)) {
      errors.title = 'Emojis are not accepted in the exam title.';
    } else if (!/^[a-zA-Z]/.test(editTitle.trim())) {
      errors.title = 'Exam title must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.';
    }

    if (editDescription.trim()) {
      if (editDescription.trim().length > 250) {
        errors.description = `Description cannot exceed 250 characters (currently ${editDescription.trim().length}).`;
      } else if (EMOJI_REGEX.test(editDescription)) {
        errors.description = 'Emojis are not accepted in the description.';
      } else if (!/^[a-zA-Z]/.test(editDescription.trim())) {
        errors.description = 'Description must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.';
      }
    }

    if (editInstructions.trim()) {
      if (editInstructions.trim().length > 250) {
        errors.instructions = `Exam guidelines & instructions cannot exceed 250 characters (currently ${editInstructions.trim().length}).`;
      } else if (EMOJI_REGEX.test(editInstructions)) {
        errors.instructions = 'Emojis are not accepted in guidelines & instructions.';
      } else if (!/^[a-zA-Z]/.test(editInstructions.trim())) {
        errors.instructions = 'Exam guidelines & instructions must start with an alphabet letter (A-Z). Numbers and special characters are not accepted initially.';
      }
    }

    const durationNum = Number(editDuration);
    if (!durationNum || durationNum <= 0) {
      alert('Please assign a valid exam duration (minimum 1 minute).');
      return;
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      setIsSavingEdit(true);
      await api.patch(`/admin/exams/${editingExam._id}`, {
        title: editTitle.trim(),
        duration: durationNum,
        description: editDescription.trim(),
        instructions: editInstructions.trim(),
      });
      setIsEditModalOpen(false);
      fetchExams();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to update exam. Ensure it is still in DRAFT status.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handlePublish = async (examId: string) => {
    if (confirm('Are you sure you want to publish this exam? Candidates will be able to take it if assigned.')) {
      try {
        await api.post(`/admin/exams/${examId}/publish`);
        fetchExams();
      } catch (err) {
        alert('Cannot publish. Make sure it has questions and is not already published.');
      }
    }
  };

  const handleView = async (exam: Exam) => {
    setSelectedExam(exam);
    setIsViewModalOpen(true);
    setExamDetails(null);
    try {
      const res = await api.get(`/admin/exams/${exam._id}`);
      setExamDetails(res.data.exam);
    } catch (err) {
      console.error('Failed to fetch exam details', err);
    }
  };

  const handleDelete = async (examId: string) => {
    if (confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
      try {
        await api.delete(`/admin/exams/${examId}`);
        fetchExams();
      } catch (err: any) {
        if (err.response?.status === 404) {
          alert('Exam already deleted or not found. Refreshing list...');
          fetchExams();
        } else {
          alert('Failed to delete exam. Make sure you have the latest backend deployed.');
        }
      }
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Loading Exams...</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <Link href="/admin/monitoring" className="text-blue-600 font-bold flex items-center mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Monitoring
        </Link>
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
          <div className="min-w-0 flex-1 pr-0 xl:pr-4">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Exam Management</h1>
            <p className="text-slate-500 mt-2">Create assessments, configure test timers, and manage question sets.</p>
          </div>
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
              title="Candidate Approvals"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Approvals
              {pendingApprovalsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-bold leading-none">
                  {pendingApprovalsCount}
                </span>
              )}
            </Link>
            <Link 
              href="/admin/results" 
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 font-semibold rounded-lg hover:bg-blue-100 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              Results
            </Link>
            <Link 
              href="/admin/violations" 
              className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 font-semibold rounded-lg hover:bg-rose-100 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              Violations
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
              onClick={handleOpenCreateModal}
              className="px-3.5 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm flex items-center shadow-blue-600/20 text-xs cursor-pointer h-8.5 shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Exam
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search exam title, duration, status, description..." 
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
            {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  statusFilter === tab 
                    ? 'bg-white text-slate-900 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'ALL' ? `All Exams (${exams.length})` : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredExams.map(exam => (
            <div key={exam._id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between group hover:border-blue-300 transition-colors">
              <div className="flex items-center space-x-6">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${exam.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{exam.title}</h3>
                  <div className="flex items-center mt-1 space-x-3 text-sm text-slate-500 font-medium flex-wrap gap-y-1">
                    <span className="flex items-center bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md font-semibold border border-blue-100">
                      <Clock className="w-4 h-4 mr-1 text-blue-500" /> {formatDurationDisplay(exam.duration)}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${exam.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {exam.status}
                    </span>
                  </div>

                  {/* Live Candidate Status Pills per Exam */}
                  {(() => {
                    const s = examStatsMap[exam._id];
                    if (!s) return null;
                    return (
                      <div className="flex items-center gap-1.5 mt-3 flex-wrap text-xs">
                        <Link
                          href={`/admin/monitoring?examId=${exam._id}`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-md font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors shadow-2xs text-[11px]"
                          title="View all candidates in monitoring"
                        >
                          <Users className="w-3 h-3 mr-1 text-slate-500" />
                          <span>Total: {s.total}</span>
                        </Link>

                        <Link
                          href={`/admin/monitoring?examId=${exam._id}&status=IN_PROGRESS`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-md font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors shadow-2xs text-[11px]"
                          title="Filter In Progress candidates"
                        >
                          <span className="w-1.5 h-1.5 rounded-full mr-1 bg-blue-500 animate-ping"></span>
                          <span>In Progress: {s.inProgress}</span>
                        </Link>

                        <Link
                          href={`/admin/monitoring?examId=${exam._id}&status=SUBMITTED`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-md font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors shadow-2xs text-[11px]"
                          title="Filter Submitted candidates"
                        >
                          <span className="w-1.5 h-1.5 rounded-full mr-1 bg-emerald-500"></span>
                          <span>Submitted: {s.submitted}</span>
                        </Link>

                        <Link
                          href={`/admin/monitoring?examId=${exam._id}&status=FORCE_SUBMITTED`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-md font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors shadow-2xs text-[11px]"
                          title="Filter Force Submitted candidates"
                        >
                          <span className="w-1.5 h-1.5 rounded-full mr-1 bg-amber-500"></span>
                          <span>Force Sub: {s.forceSubmitted}</span>
                        </Link>

                        <Link
                          href={`/admin/monitoring?examId=${exam._id}&status=TERMINATED`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-md font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors shadow-2xs text-[11px]"
                          title="Filter Terminated candidates"
                        >
                          <span className="w-1.5 h-1.5 rounded-full mr-1 bg-rose-500"></span>
                          <span>Terminated: {s.terminated}</span>
                        </Link>
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
                <Link 
                  href={`/admin/monitoring?examId=${exam._id}`}
                  className="px-3.5 py-2 text-blue-700 font-semibold border border-blue-200 bg-blue-50/70 rounded-lg hover:bg-blue-100 transition flex items-center text-xs shadow-2xs cursor-pointer"
                  title="View live candidates examination status"
                >
                  <MonitorPlay className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Live Status
                </Link>

                <button
                  onClick={() => handleView(exam)}
                  className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition cursor-pointer"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {exam.status === 'DRAFT' && (
                  <button
                    onClick={() => handleOpenEditModal(exam)}
                    className="p-2 text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition cursor-pointer"
                    title="Edit Exam Title & Time Duration"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(exam._id)}
                  className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition cursor-pointer"
                  title="Delete Exam"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <Link 
                  href={`/admin/exams/${exam._id}/questions`}
                  className="px-3.5 py-2 text-slate-600 font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 transition text-xs"
                >
                  Builder
                </Link>
                <Link 
                  href={`/admin/exams/${exam._id}/assign`}
                  className="px-3.5 py-2 text-blue-600 font-semibold border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition flex items-center text-xs"
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" /> Assign
                </Link>
                {exam.status === 'DRAFT' && (
                  <button 
                    onClick={() => handlePublish(exam._id)}
                    className="px-3.5 py-2 text-emerald-700 font-semibold border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition flex items-center text-xs cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Publish
                  </button>
                )}
              </div>
            </div>
          ))}
          {exams.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No exams created yet.</p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                Create Your First Exam
              </button>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-700 font-bold text-lg">No examinations match &quot;{searchQuery}&quot;</p>
              <p className="text-slate-400 text-sm mt-1">Try searching by title, duration, status, or description.</p>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
              >
                Clear Search & Filters
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* CREATE EXAM MODAL WITH TIME ASSIGNMENT */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Create New Examination</h3>
                  <p className="text-xs text-slate-500">Configure title and assign examination duration</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreate} className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {/* EXAM TITLE */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    Exam Title <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-mono font-medium ${
                    createTitle.length > 250 
                      ? 'text-rose-600 font-bold' 
                      : createTitle.length >= 220 
                      ? 'text-amber-600 font-bold' 
                      : 'text-slate-400'
                  }`}>
                    {createTitle.length} / 250
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={250}
                  placeholder="e.g. Software Engineering Aptitude & Logic Assessment"
                  value={createTitle}
                  onKeyDown={e => handleInitialKeyBlock(e, createTitle, 'Exam title', err => setCreateErrors(prev => ({ ...prev, title: err })))}
                  onChange={e => handleSanitizedChange(e.target.value, 'Exam title', setCreateTitle, err => setCreateErrors(prev => ({ ...prev, title: err })))}
                  className={`w-full px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs sm:text-sm font-medium outline-none transition ${
                    createErrors.title ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {createErrors.title ? (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {createErrors.title}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Must begin with a letter (A–Z). No emojis allowed.
                  </p>
                )}
              </div>

              {/* TIME ASSIGNMENT SECTION */}
              <div className="bg-blue-50/50 border border-blue-200/70 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-950 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                    Assign Exam Duration <span className="text-rose-500 ml-0.5">*</span>
                  </label>
                  <span className="text-[11px] font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                    {formatDurationDisplay(createDuration)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="600"
                    placeholder="e.g. 60"
                    value={createDuration}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setCreateDuration('');
                      } else {
                        const parsed = parseInt(val, 10);
                        setCreateDuration(isNaN(parsed) ? '' : Math.max(0, parsed));
                      }
                    }}
                    className="w-24 px-3 py-1.5 border border-blue-300 rounded-lg bg-white text-slate-900 font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm"
                  />
                  <span className="text-xs font-semibold text-slate-600">Minutes</span>
                  {createDuration !== '' && (
                    <button
                      type="button"
                      onClick={() => setCreateDuration('')}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
                      title="Clear duration"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick preset pills */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quick Presets</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_DURATIONS.map(mins => (
                      <button
                        type="button"
                        key={mins}
                        onClick={() => setCreateDuration(mins)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                          createDuration === mins
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        {mins} Min {mins >= 60 ? `(${mins / 60}h)` : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-blue-700/90 flex items-center font-medium">
                  <AlertCircle className="w-3 h-3 mr-1 shrink-0 text-blue-500" />
                  Exam auto-submits automatically when the countdown timer reaches 0.
                </p>
              </div>

              {/* DESCRIPTION */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <span className={`text-[11px] font-mono font-medium ${
                    createDescription.length > 250 
                      ? 'text-rose-600 font-bold' 
                      : createDescription.length >= 220 
                      ? 'text-amber-600 font-bold' 
                      : 'text-slate-400'
                  }`}>
                    {createDescription.length} / 250
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={250}
                  placeholder="Provide a brief overview of exam syllabus or purpose..."
                  value={createDescription}
                  onKeyDown={e => handleInitialKeyBlock(e, createDescription, 'Description', err => setCreateErrors(prev => ({ ...prev, description: err })))}
                  onChange={e => handleSanitizedChange(e.target.value, 'Description', setCreateDescription, err => setCreateErrors(prev => ({ ...prev, description: err })))}
                  className={`w-full px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs sm:text-sm outline-none transition resize-none ${
                    createErrors.description ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {createErrors.description ? (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {createErrors.description}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Plain text summary of syllabus or scope. No emojis.
                  </p>
                )}
              </div>

              {/* EXAM GUIDELINES & INSTRUCTIONS */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    Exam Guidelines & Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <span className={`text-[11px] font-mono font-medium ${
                    createInstructions.length > 250 
                      ? 'text-rose-600 font-bold' 
                      : createInstructions.length >= 220 
                      ? 'text-amber-600 font-bold' 
                      : 'text-slate-400'
                  }`}>
                    {createInstructions.length} / 250
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={250}
                  placeholder="e.g. Scientific calculators allowed, each question carries equal marks..."
                  value={createInstructions}
                  onKeyDown={e => handleInitialKeyBlock(e, createInstructions, 'Exam guidelines & instructions', err => setCreateErrors(prev => ({ ...prev, instructions: err })))}
                  onChange={e => handleSanitizedChange(e.target.value, 'Exam guidelines & instructions', setCreateInstructions, err => setCreateErrors(prev => ({ ...prev, instructions: err })))}
                  className={`w-full px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-xs sm:text-sm outline-none transition resize-none ${
                    createErrors.instructions ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {createErrors.instructions ? (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {createErrors.instructions}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Rules, marking scheme, or permitted candidate equipment.
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition text-xs sm:text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition text-xs sm:text-sm flex items-center shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {isCreating ? 'Creating Exam...' : 'Create Exam & Add Questions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EXAM MODAL (ALLOWS UPDATING DURATION & TITLE) */}
      {isEditModalOpen && editingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Edit Examination Details</h3>
                  <p className="text-xs text-slate-500">Modify title, duration time, or instructions</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmEdit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    Exam Title <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-mono font-medium ${
                    editTitle.length > 250 
                      ? 'text-rose-600 font-bold' 
                      : editTitle.length >= 220 
                      ? 'text-amber-600 font-bold' 
                      : 'text-slate-400'
                  }`}>
                    {editTitle.length} / 250
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={250}
                  value={editTitle}
                  onKeyDown={e => handleInitialKeyBlock(e, editTitle, 'Exam title', err => setEditErrors(prev => ({ ...prev, title: err })))}
                  onChange={e => handleSanitizedChange(e.target.value, 'Exam title', setEditTitle, err => setEditErrors(prev => ({ ...prev, title: err })))}
                  className={`w-full px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500 text-slate-900 text-xs sm:text-sm font-medium outline-none transition ${
                    editErrors.title ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-amber-500'
                  }`}
                />
                {editErrors.title ? (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {editErrors.title}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Must begin with a letter (A–Z). No emojis allowed.
                  </p>
                )}
              </div>

              {/* TIME ASSIGNMENT SECTION */}
              <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-950 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                    Assigned Exam Duration <span className="text-rose-500 ml-0.5">*</span>
                  </label>
                  <span className="text-[11px] font-bold text-amber-800 bg-white px-2.5 py-0.5 rounded-full border border-amber-200 shadow-2xs">
                    {formatDurationDisplay(editDuration)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="600"
                    placeholder="e.g. 60"
                    value={editDuration}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setEditDuration('');
                      } else {
                        const parsed = parseInt(val, 10);
                        setEditDuration(isNaN(parsed) ? '' : Math.max(0, parsed));
                      }
                    }}
                    className="w-24 px-3 py-1.5 border border-amber-300 rounded-lg bg-white text-slate-900 font-bold text-center focus:ring-2 focus:ring-amber-500 outline-none text-xs sm:text-sm"
                  />
                  <span className="text-xs font-semibold text-slate-600">Minutes</span>
                  {editDuration !== '' && (
                    <button
                      type="button"
                      onClick={() => setEditDuration('')}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
                      title="Clear duration"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick preset pills */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quick Presets</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_DURATIONS.map(mins => (
                      <button
                        type="button"
                        key={mins}
                        onClick={() => setEditDuration(mins)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                          editDuration === mins
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50'
                        }`}
                      >
                        {mins} Min {mins >= 60 ? `(${mins / 60}h)` : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-amber-800/90 flex items-center font-medium">
                  <AlertCircle className="w-3 h-3 mr-1 shrink-0 text-amber-600" />
                  Exam auto-submits automatically when the countdown timer reaches 0.
                </p>
              </div>

              {/* DESCRIPTION */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <span className={`text-[11px] font-mono font-medium ${
                    editDescription.length > 250 
                      ? 'text-rose-600 font-bold' 
                      : editDescription.length >= 220 
                      ? 'text-amber-600 font-bold' 
                      : 'text-slate-400'
                  }`}>
                    {editDescription.length} / 250
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={250}
                  placeholder="Provide a brief overview of exam syllabus or purpose..."
                  value={editDescription}
                  onKeyDown={e => handleInitialKeyBlock(e, editDescription, 'Description', err => setEditErrors(prev => ({ ...prev, description: err })))}
                  onChange={e => handleSanitizedChange(e.target.value, 'Description', setEditDescription, err => setEditErrors(prev => ({ ...prev, description: err })))}
                  className={`w-full px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500 text-slate-900 text-xs sm:text-sm outline-none transition resize-none ${
                    editErrors.description ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-amber-500'
                  }`}
                />
                {editErrors.description ? (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {editErrors.description}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Plain text summary of syllabus or scope. No emojis.
                  </p>
                )}
              </div>

              {/* EXAM GUIDELINES & INSTRUCTIONS */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    Exam Guidelines & Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <span className={`text-[11px] font-mono font-medium ${
                    editInstructions.length > 250 
                      ? 'text-rose-600 font-bold' 
                      : editInstructions.length >= 220 
                      ? 'text-amber-600 font-bold' 
                      : 'text-slate-400'
                  }`}>
                    {editInstructions.length} / 250
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={250}
                  placeholder="e.g. Scientific calculators allowed, each question carries equal marks..."
                  value={editInstructions}
                  onKeyDown={e => handleInitialKeyBlock(e, editInstructions, 'Exam guidelines & instructions', err => setEditErrors(prev => ({ ...prev, instructions: err })))}
                  onChange={e => handleSanitizedChange(e.target.value, 'Exam guidelines & instructions', setEditInstructions, err => setEditErrors(prev => ({ ...prev, instructions: err })))}
                  className={`w-full px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500 text-slate-900 text-xs sm:text-sm outline-none transition resize-none ${
                    editErrors.instructions ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-amber-500'
                  }`}
                />
                {editErrors.instructions ? (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {editErrors.instructions}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Rules, marking scheme, or permitted candidate equipment.
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl transition text-sm flex items-center shadow-md shadow-amber-600/20 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {isViewModalOpen && selectedExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">Exam Details</h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {!examDetails ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Title</h4>
                    <p className="text-lg font-bold text-slate-900">{examDetails.title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</h4>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${examDetails.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                        {examDetails.status}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</h4>
                      <p className="text-slate-800 font-bold flex items-center">
                        <Clock className="w-4 h-4 mr-1.5 text-blue-600" />
                        {formatDurationDisplay(examDetails.duration)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</h4>
                    <p className="text-slate-700 whitespace-pre-wrap">{examDetails.description || 'No description provided.'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Instructions</h4>
                    <p className="text-slate-700 whitespace-pre-wrap">{examDetails.instructions || 'No special instructions.'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Created At</h4>
                    <p className="text-slate-700">{new Date(examDetails.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition border border-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
