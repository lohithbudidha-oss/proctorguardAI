'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Plus, 
  Settings, 
  Users, 
  MonitorPlay, 
  FileText, 
  CheckCircle, 
  Trash2, 
  Eye, 
  Edit2, 
  X, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import api from '@/lib/api';

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

export default function AdminExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View Details Modal State
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [examDetails, setExamDetails] = useState<any>(null);

  // Create Exam Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDuration, setCreateDuration] = useState<number>(60);
  const [createDescription, setCreateDescription] = useState('');
  const [createInstructions, setCreateInstructions] = useState('');
  const [createErrors, setCreateErrors] = useState<{ title?: string; description?: string; instructions?: string }>({});
  const [isCreating, setIsCreating] = useState(false);

  // Edit Exam Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState<number>(60);
  const [editDescription, setEditDescription] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editErrors, setEditErrors] = useState<{ title?: string; description?: string; instructions?: string }>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchExams = () => {
    api.get('/admin/exams')
      .then(res => {
        setExams(res.data.exams);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch exams', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const formatDurationDisplay = (mins: number) => {
    if (!mins || isNaN(mins)) return '0 Min';
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hours > 0 && rem > 0) return `${hours}h ${rem}m (${mins} Mins)`;
    if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''} (${mins} Mins)`;
    return `${mins} Mins`;
  };

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
    }

    if (createDescription.trim().length > 250) {
      errors.description = `Description cannot exceed 250 characters (currently ${createDescription.trim().length}).`;
    }

    if (createInstructions.trim().length > 250) {
      errors.instructions = `Exam guidelines & instructions cannot exceed 250 characters (currently ${createInstructions.trim().length}).`;
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
    }

    if (editDescription.trim().length > 250) {
      errors.description = `Description cannot exceed 250 characters (currently ${editDescription.trim().length}).`;
    }

    if (editInstructions.trim().length > 250) {
      errors.instructions = `Exam guidelines & instructions cannot exceed 250 characters (currently ${editInstructions.trim().length}).`;
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <Link href="/admin/monitoring" className="text-blue-600 font-bold flex items-center mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Monitoring
        </Link>
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Exam Management</h1>
            <p className="text-slate-500 mt-2">Create assessments, configure test timers, and manage question sets.</p>
          </div>
          <div className="flex space-x-4">
            <Link href="/admin/candidates" className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm">
              Candidates
            </Link>
            <Link href="/admin/monitoring" className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 font-semibold rounded-lg hover:bg-slate-50 transition shadow-xs">
              Exam Candidates
            </Link>
            <button 
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm flex items-center shadow-blue-600/20"
            >
              <Plus className="w-5 h-5 mr-2" /> Create Exam
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {exams.map(exam => (
            <div key={exam._id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between group hover:border-blue-300 transition-colors">
              <div className="flex items-center space-x-6">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${exam.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{exam.title}</h3>
                  <div className="flex items-center mt-1 space-x-4 text-sm text-slate-500 font-medium">
                    <span className="flex items-center bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md font-semibold border border-blue-100">
                      <Clock className="w-4 h-4 mr-1 text-blue-500" /> {formatDurationDisplay(exam.duration)}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${exam.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {exam.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleView(exam)}
                  className="p-2 text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm transition"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {exam.status === 'DRAFT' && (
                  <button
                    onClick={() => handleOpenEditModal(exam)}
                    className="p-2 text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition"
                    title="Edit Exam Title & Time Duration"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(exam._id)}
                  className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition"
                  title="Delete Exam"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <Link 
                  href={`/admin/exams/${exam._id}/questions`}
                  className="px-4 py-2 text-slate-600 font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                >
                  Builder
                </Link>
                <Link 
                  href={`/admin/exams/${exam._id}/assign`}
                  className="px-4 py-2 text-blue-600 font-semibold border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition flex items-center"
                >
                  <Users className="w-4 h-4 mr-2" /> Assign
                </Link>
                {exam.status === 'DRAFT' && (
                  <button 
                    onClick={() => handlePublish(exam._id)}
                    className="px-4 py-2 text-emerald-700 font-semibold border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition flex items-center"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" /> Publish
                  </button>
                )}
              </div>
            </div>
          ))}
          {exams.length === 0 && (
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
          )}
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

            <form onSubmit={handleConfirmCreate} className="p-6 overflow-y-auto space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Exam Title <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-bold ${
                    createTitle.length > 250 
                      ? 'text-rose-600' 
                      : createTitle.length >= 220 
                      ? 'text-amber-600' 
                      : 'text-slate-500'
                  }`}>
                    {createTitle.length}/250 chars (250 chars suggested)
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={250}
                  placeholder="e.g., Software Engineering Aptitude & Logic Assessment"
                  value={createTitle}
                  onChange={e => {
                    setCreateTitle(e.target.value);
                    if (createErrors.title) setCreateErrors(prev => ({ ...prev, title: undefined }));
                  }}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-sm font-medium outline-none transition ${
                    createErrors.title ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {createErrors.title && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {createErrors.title}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Suggestion: Up to 250 characters suggested for a clear assessment title.
                </p>
              </div>

              {/* TIME ASSIGNMENT SECTION */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center">
                    <Clock className="w-4 h-4 mr-1.5 text-blue-600" />
                    Assign Exam Duration (Minutes) <span className="text-rose-500 ml-1">*</span>
                  </label>
                  <span className="text-xs font-black text-blue-700 bg-white px-2.5 py-1 rounded-full border border-blue-200 shadow-2xs">
                    {formatDurationDisplay(createDuration)}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="600"
                    required
                    value={createDuration || ''}
                    onChange={e => setCreateDuration(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-32 px-4 py-2 border border-blue-300 rounded-xl bg-white text-slate-900 font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none text-base"
                  />
                  <span className="text-sm font-semibold text-slate-600">Minutes</span>
                </div>

                {/* Quick preset pills */}
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Quick Presets:</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_DURATIONS.map(mins => (
                      <button
                        type="button"
                        key={mins}
                        onClick={() => setCreateDuration(mins)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
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

                <p className="text-[11px] text-blue-800 flex items-center font-medium mt-1">
                  <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0 text-blue-600" />
                  When candidate timer reaches 0, their exam will automatically submit immediately wherever they are.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Description (Optional)
                  </label>
                  <span className={`text-[11px] font-bold ${
                    createDescription.length > 250 
                      ? 'text-rose-600' 
                      : createDescription.length >= 220 
                      ? 'text-amber-600' 
                      : 'text-slate-500'
                  }`}>
                    {createDescription.length}/250 chars (250 chars suggested)
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={250}
                  placeholder="Provide a brief overview of syllabus or purpose (max 250 chars suggested)..."
                  value={createDescription}
                  onChange={e => {
                    setCreateDescription(e.target.value);
                    if (createErrors.description) setCreateErrors(prev => ({ ...prev, description: undefined }));
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-sm outline-none transition resize-none ${
                    createErrors.description ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {createErrors.description && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {createErrors.description}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Suggestion: Up to 250 characters suggested for syllabus summary & assessment objective.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Exam Guidelines & Instructions (Optional)
                  </label>
                  <span className={`text-[11px] font-bold ${
                    createInstructions.length > 250 
                      ? 'text-rose-600' 
                      : createInstructions.length >= 220 
                      ? 'text-amber-600' 
                      : 'text-slate-500'
                  }`}>
                    {createInstructions.length}/250 chars (250 chars suggested)
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={250}
                  placeholder="e.g. Scientific calculators allowed, each question carries equal weightage (max 250 chars suggested)..."
                  value={createInstructions}
                  onChange={e => {
                    setCreateInstructions(e.target.value);
                    if (createErrors.instructions) setCreateErrors(prev => ({ ...prev, instructions: undefined }));
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-sm outline-none transition resize-none ${
                    createErrors.instructions ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {createErrors.instructions && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {createErrors.instructions}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Suggestion: Up to 250 characters suggested for exam rules, calculator policies & instructions.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition text-sm flex items-center shadow-md shadow-blue-600/20 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Edit Examination Details</h3>
                  <p className="text-xs text-slate-500">Modify title and adjust allocated exam time</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmEdit} className="p-6 overflow-y-auto space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Exam Title <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-bold ${
                    editTitle.length > 250 
                      ? 'text-rose-600' 
                      : editTitle.length >= 220 
                      ? 'text-amber-600' 
                      : 'text-slate-500'
                  }`}>
                    {editTitle.length}/250 chars (250 chars suggested)
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={250}
                  value={editTitle}
                  onChange={e => {
                    setEditTitle(e.target.value);
                    if (editErrors.title) setEditErrors(prev => ({ ...prev, title: undefined }));
                  }}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-sm font-medium outline-none transition ${
                    editErrors.title ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {editErrors.title && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {editErrors.title}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Suggestion: Up to 250 characters suggested for a clear assessment title.
                </p>
              </div>

              {/* TIME ASSIGNMENT SECTION */}
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center">
                    <Clock className="w-4 h-4 mr-1.5 text-amber-600" />
                    Assigned Exam Duration (Minutes) <span className="text-rose-500 ml-1">*</span>
                  </label>
                  <span className="text-xs font-black text-amber-800 bg-white px-2.5 py-1 rounded-full border border-amber-200 shadow-2xs">
                    {formatDurationDisplay(editDuration)}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="600"
                    required
                    value={editDuration || ''}
                    onChange={e => setEditDuration(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-32 px-4 py-2 border border-amber-300 rounded-xl bg-white text-slate-900 font-bold text-center focus:ring-2 focus:ring-amber-500 outline-none text-base"
                  />
                  <span className="text-sm font-semibold text-slate-600">Minutes</span>
                </div>

                {/* Quick preset pills */}
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Quick Presets:</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_DURATIONS.map(mins => (
                      <button
                        type="button"
                        key={mins}
                        onClick={() => setEditDuration(mins)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
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
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Description
                  </label>
                  <span className={`text-[11px] font-bold ${
                    editDescription.length > 250 
                      ? 'text-rose-600' 
                      : editDescription.length >= 220 
                      ? 'text-amber-600' 
                      : 'text-slate-500'
                  }`}>
                    {editDescription.length}/250 chars (250 chars suggested)
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={250}
                  placeholder="Provide a brief overview of syllabus or purpose (max 250 chars suggested)..."
                  value={editDescription}
                  onChange={e => {
                    setEditDescription(e.target.value);
                    if (editErrors.description) setEditErrors(prev => ({ ...prev, description: undefined }));
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-sm outline-none transition resize-none ${
                    editErrors.description ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {editErrors.description && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {editErrors.description}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Suggestion: Up to 250 characters suggested for syllabus summary & assessment objective.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Exam Guidelines & Instructions
                  </label>
                  <span className={`text-[11px] font-bold ${
                    editInstructions.length > 250 
                      ? 'text-rose-600' 
                      : editInstructions.length >= 220 
                      ? 'text-amber-600' 
                      : 'text-slate-500'
                  }`}>
                    {editInstructions.length}/250 chars (250 chars suggested)
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={250}
                  placeholder="e.g. Scientific calculators allowed, each question carries equal weightage (max 250 chars suggested)..."
                  value={editInstructions}
                  onChange={e => {
                    setEditInstructions(e.target.value);
                    if (editErrors.instructions) setEditErrors(prev => ({ ...prev, instructions: undefined }));
                  }}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 text-sm outline-none transition resize-none ${
                    editErrors.instructions ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {editErrors.instructions && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" /> {editErrors.instructions}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Suggestion: Up to 250 characters suggested for exam rules, calculator policies & instructions.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-3">
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
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${examDetails.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
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
