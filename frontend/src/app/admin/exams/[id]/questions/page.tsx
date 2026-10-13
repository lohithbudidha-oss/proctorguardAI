'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Plus, 
  Save, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  FileText,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import api from '@/lib/api';

interface QuestionOption {
  id: string;
  text: string;
}

interface QuestionItem {
  _id?: string;
  id?: string;
  text: string;
  type: string;
  category: string;
  marks: number;
  negativeMarks?: number;
  options: QuestionOption[];
  correctAnswer: string;
  explanation?: string;
}

interface ExamDetails {
  id?: string;
  _id?: string;
  title: string;
  duration: number;
  description?: string;
  instructions?: string;
  status?: string;
}

function QuestionBuilderContent() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;
  
  const [exam, setExam] = useState<ExamDetails | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New question form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'SINGLE_CHOICE',
    category: 'General',
    marks: 1,
    negativeMarks: 0,
    options: [
      { id: 'A', text: '' }, 
      { id: 'B', text: '' }, 
      { id: 'C', text: '' }, 
      { id: 'D', text: '' }
    ],
    correctAnswer: 'A'
  });

  // Edit question state
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [isSavingEditQuestion, setIsSavingEditQuestion] = useState(false);

  // Edit Exam Details modal state
  const [showEditExamModal, setShowEditExamModal] = useState(false);
  const [editExamForm, setEditExamForm] = useState({
    title: '',
    duration: 60,
    description: '',
    instructions: ''
  });
  const [isSavingExam, setIsSavingExam] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  async function fetchData() {
    try {
      const [examRes, qRes] = await Promise.all([
        api.get(`/admin/exams/${examId}`),
        api.get(`/admin/exams/${examId}/questions`)
      ]);
      setExam(examRes.data.exam);
      setQuestions(qRes.data.questions || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [examId]);

  // Handle Add New Question
  const handleAddQuestion = async () => {
    if (!newQuestion.text.trim()) {
      return alert('Question text is required.');
    }
    const emptyOption = newQuestion.options.find(opt => !opt.text.trim());
    if (emptyOption) {
      return alert(`Please provide text for Option ${emptyOption.id}.`);
    }

    setIsSubmittingNew(true);
    try {
      await api.post(`/admin/exams/${examId}/questions`, newQuestion);
      setShowAddForm(false);
      setNewQuestion({ 
        text: '', 
        type: 'SINGLE_CHOICE',
        category: 'General',
        marks: 1,
        negativeMarks: 0,
        options: [
          { id: 'A', text: '' }, 
          { id: 'B', text: '' }, 
          { id: 'C', text: '' }, 
          { id: 'D', text: '' }
        ], 
        correctAnswer: 'A' 
      });
      showToast('Question created successfully!');
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to add question');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Open Edit Mode for an existing question
  const handleOpenEditQuestion = (q: QuestionItem) => {
    setEditingQuestion({
      _id: q._id || q.id,
      text: q.text || '',
      type: q.type || 'SINGLE_CHOICE',
      category: q.category || 'General',
      marks: q.marks !== undefined ? q.marks : 1,
      negativeMarks: q.negativeMarks || 0,
      options: q.options && q.options.length > 0 
        ? q.options.map(opt => ({ id: opt.id, text: opt.text }))
        : [
            { id: 'A', text: '' }, 
            { id: 'B', text: '' }, 
            { id: 'C', text: '' }, 
            { id: 'D', text: '' }
          ],
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || ''
    });
    setShowAddForm(false);
    // Smooth scroll to top of question builder
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Handle Save Edited Question
  const handleSaveEditQuestion = async () => {
    if (!editingQuestion) return;
    if (!editingQuestion.text.trim()) {
      return alert('Question text is required.');
    }
    const emptyOption = editingQuestion.options.find(opt => !opt.text.trim());
    if (emptyOption) {
      return alert(`Please provide text for Option ${emptyOption.id}.`);
    }

    setIsSavingEditQuestion(true);
    try {
      const qId = editingQuestion._id || editingQuestion.id;
      const res = await api.patch(`/admin/questions/${qId}`, editingQuestion);
      if (res.data?.question) {
        setQuestions(prev => prev.map(item => ((item._id || item.id) === qId ? res.data.question : item)));
      }
      showToast('Question updated successfully!');
      setEditingQuestion(null);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update question');
    } finally {
      setIsSavingEditQuestion(false);
    }
  };

  // Handle Delete Question
  const handleDelete = async (qId: string) => {
    if (confirm('Are you sure you want to delete this question? This cannot be undone.')) {
      try {
        await api.delete(`/admin/questions/${qId}`);
        showToast('Question deleted successfully.');
        if (editingQuestion && (editingQuestion._id === qId || editingQuestion.id === qId)) {
          setEditingQuestion(null);
        }
        fetchData();
      } catch (err: any) {
        alert(err?.response?.data?.message || 'Failed to delete question');
      }
    }
  };

  // Open Edit Exam Details Modal
  const handleOpenEditExam = () => {
    if (!exam) return;
    setEditExamForm({
      title: exam.title || '',
      duration: exam.duration || 60,
      description: exam.description || '',
      instructions: exam.instructions || ''
    });
    setShowEditExamModal(true);
  };

  // Save Exam Details
  const handleSaveExamDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExamForm.title.trim()) {
      return alert('Exam title is required.');
    }
    setIsSavingExam(true);
    try {
      const res = await api.patch(`/admin/exams/${examId}`, editExamForm);
      if (res.data?.exam) {
        setExam(res.data.exam);
      }
      showToast('Exam details updated successfully!');
      setShowEditExamModal(false);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update exam details');
    } finally {
      setIsSavingExam(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-10 font-sans text-slate-600">
        <div className="w-9 h-9 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="font-bold text-slate-800 text-sm">Loading Exam Builder...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Link */}
        <Link href="/admin/exams" className="text-blue-600 font-bold flex items-center mb-6 hover:underline text-sm group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Exam Management
        </Link>
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-2xs animate-fadeIn">
            <div className="flex items-center text-emerald-800 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Exam Builder Header Banner */}
        <div className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Exam Builder</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                exam?.status === 'PUBLISHED' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {exam?.status || 'DRAFT'}
              </span>
            </div>
            <p className="text-slate-600 font-bold text-base mt-1 flex items-center">
              <span>{exam?.title}</span>
              <span className="text-slate-400 mx-2">•</span>
              <span className="text-xs font-semibold text-slate-500 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {exam?.duration} Minutes
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-slate-100 text-slate-700 px-3.5 py-2 rounded-xl font-bold border border-slate-200 text-xs">
              {questions.length} Question{questions.length !== 1 ? 's' : ''}
            </div>

            {/* Edit Exam Details Button */}
            <button
              onClick={handleOpenEditExam}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs flex items-center transition shadow-2xs cursor-pointer active:scale-95"
              title="Edit exam title, duration time, or instructions"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              <span>Edit Exam Details</span>
            </button>

            {!showAddForm && !editingQuestion && (
              <button 
                onClick={() => {
                  setShowAddForm(true);
                  setEditingQuestion(null);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition flex items-center text-xs shadow-xs cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Question
              </button>
            )}
          </div>
        </div>

        {/* EDIT QUESTION FORM CARD */}
        {editingQuestion && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-amber-300 mb-8 animate-fadeIn">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Edit Question</h3>
                  <p className="text-xs text-slate-500">Modify question prompt, choices, or correct answer</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingQuestion(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Question Text <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  className="w-full border-slate-300 rounded-xl p-3 border focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 bg-white text-sm" 
                  rows={3}
                  placeholder="Enter the question text..."
                  value={editingQuestion.text}
                  onChange={e => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editingQuestion.options.map((opt, idx) => (
                  <div key={opt.id} className="relative">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Option {opt.id}</span>
                      {editingQuestion.correctAnswer === opt.id && (
                        <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Correct Option
                        </span>
                      )}
                    </label>
                    <input 
                      type="text"
                      className={`w-full rounded-xl p-2.5 border text-sm outline-none transition ${
                        editingQuestion.correctAnswer === opt.id 
                          ? 'border-emerald-400 bg-emerald-50/20 focus:ring-2 focus:ring-emerald-500' 
                          : 'border-slate-300 bg-white focus:ring-2 focus:ring-amber-500'
                      }`}
                      placeholder={`Enter text for option ${opt.id}...`}
                      value={opt.text}
                      onChange={e => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[idx].text = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: newOpts });
                      }}
                    />
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correct Answer Choice</label>
                  <select 
                    className="w-full border-slate-300 rounded-xl p-2.5 border outline-none text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                    value={editingQuestion.correctAnswer}
                    onChange={e => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                  >
                    {editingQuestion.options.map(opt => (
                      <option key={opt.id} value={opt.id}>Option {opt.id} {opt.text ? `(${opt.text.slice(0, 20)}...)` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marks (Score)</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full border-slate-300 rounded-xl p-2.5 border outline-none text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 text-sm font-semibold" 
                    value={editingQuestion.marks} 
                    onChange={e => setEditingQuestion({ ...editingQuestion, marks: Math.max(1, Number(e.target.value) || 1) })} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category / Tag</label>
                  <input 
                    type="text" 
                    className="w-full border-slate-300 rounded-xl p-2.5 border outline-none text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 text-sm font-medium" 
                    value={editingQuestion.category} 
                    placeholder="General, Aptitude, Coding..."
                    onChange={e => setEditingQuestion({ ...editingQuestion, category: e.target.value })} 
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setEditingQuestion(null)} 
                  className="px-4 py-2 text-slate-600 font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={isSavingEditQuestion}
                  onClick={handleSaveEditQuestion} 
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition flex items-center text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {isSavingEditQuestion ? 'Saving Changes...' : 'Save Question Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NEW QUESTION FORM CARD */}
        {showAddForm && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-200 mb-8 animate-fadeIn">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Add New Multiple Choice Question</h3>
                  <p className="text-xs text-slate-500">Provide question prompt, option choices, and designate the correct answer</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddForm(false)} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Question Text <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  className="w-full border-slate-300 rounded-xl p-3 border focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white text-sm" 
                  rows={3}
                  placeholder="Enter the question text here..."
                  value={newQuestion.text}
                  onChange={e => setNewQuestion({ ...newQuestion, text: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {newQuestion.options.map((opt, idx) => (
                  <div key={opt.id}>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Option {opt.id}</span>
                      {newQuestion.correctAnswer === opt.id && (
                        <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Correct Option
                        </span>
                      )}
                    </label>
                    <input 
                      type="text"
                      className={`w-full rounded-xl p-2.5 border text-sm outline-none transition ${
                        newQuestion.correctAnswer === opt.id 
                          ? 'border-emerald-400 bg-emerald-50/20 focus:ring-2 focus:ring-emerald-500' 
                          : 'border-slate-300 bg-white focus:ring-2 focus:ring-blue-500'
                      }`}
                      placeholder={`Enter text for option ${opt.id}...`}
                      value={opt.text}
                      onChange={e => {
                        const newOpts = [...newQuestion.options];
                        newOpts[idx].text = e.target.value;
                        setNewQuestion({ ...newQuestion, options: newOpts });
                      }}
                    />
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correct Answer Choice</label>
                  <select 
                    className="w-full border-slate-300 rounded-xl p-2.5 border outline-none text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                    value={newQuestion.correctAnswer}
                    onChange={e => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                  >
                    {newQuestion.options.map(opt => (
                      <option key={opt.id} value={opt.id}>Option {opt.id} {opt.text ? `(${opt.text.slice(0, 20)}...)` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marks (Score)</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full border-slate-300 rounded-xl p-2.5 border outline-none text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 text-sm font-semibold" 
                    value={newQuestion.marks} 
                    onChange={e => setNewQuestion({ ...newQuestion, marks: Math.max(1, Number(e.target.value) || 1) })} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category / Tag</label>
                  <input 
                    type="text" 
                    className="w-full border-slate-300 rounded-xl p-2.5 border outline-none text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 text-sm font-medium" 
                    value={newQuestion.category} 
                    placeholder="General, Aptitude..."
                    onChange={e => setNewQuestion({ ...newQuestion, category: e.target.value })} 
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowAddForm(false)} 
                  className="px-4 py-2 text-slate-600 font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={isSubmittingNew}
                  onClick={handleAddQuestion} 
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" /> 
                  {isSubmittingNew ? 'Saving Question...' : 'Save Question'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUESTIONS LIST */}
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div 
              key={q._id || q.id || idx} 
              className={`bg-white p-6 rounded-2xl border transition-all shadow-2xs ${
                editingQuestion && (editingQuestion._id === q._id || editingQuestion.id === q.id)
                  ? 'border-amber-400 ring-2 ring-amber-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center border border-slate-200">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold uppercase text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                    {q.category || 'General'}
                  </span>
                  <span className="text-xs font-bold uppercase text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                    {q.marks} Mark{q.marks !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Question Actions: EDIT & DELETE BUTTONS */}
                <div className="flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={() => handleOpenEditQuestion(q)} 
                    className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition shadow-2xs cursor-pointer active:scale-95"
                    title="Edit this question"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    <span>Edit</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleDelete((q._id || q.id) as string)} 
                    className="inline-flex items-center p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer active:scale-95"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <p className="text-base sm:text-lg text-slate-900 font-medium mb-4 leading-relaxed whitespace-pre-wrap">
                {q.text}
              </p>
              
              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(q.options || []).map((opt) => {
                  const isCorrect = q.correctAnswer === opt.id;
                  return (
                    <div 
                      key={opt.id} 
                      className={`p-3.5 rounded-xl border text-sm font-medium transition flex items-center justify-between ${
                        isCorrect 
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-900 shadow-2xs font-semibold' 
                          : 'border-slate-200 bg-slate-50/60 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs mr-2.5 shrink-0 ${
                          isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {opt.id}
                        </span> 
                        <span>{opt.text}</span>
                      </div>
                      {isCorrect && (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Empty State */}
          {questions.length === 0 && !showAddForm && !editingQuestion && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8 shadow-2xs">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">This Exam Has No Questions Yet</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 mb-5">
                Add multiple choice questions with options and mark values to complete this examination.
              </p>
              <button 
                onClick={() => setShowAddForm(true)} 
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-xs inline-flex items-center text-xs cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add First Question
              </button>
            </div>
          )}
        </div>

        {/* EDIT EXAM DETAILS MODAL */}
        {showEditExamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Edit Examination Details</h3>
                    <p className="text-xs text-slate-500">Update title, time duration, and guidelines</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEditExamModal(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveExamDetails} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Exam Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editExamForm.title}
                    onChange={e => setEditExamForm({ ...editExamForm, title: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Allocated Duration (Minutes) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    required
                    value={editExamForm.duration}
                    onChange={e => setEditExamForm({ ...editExamForm, duration: Math.max(1, parseInt(e.target.value) || 0) })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={editExamForm.description}
                    onChange={e => setEditExamForm({ ...editExamForm, description: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guidelines & Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={editExamForm.instructions}
                    onChange={e => setEditExamForm({ ...editExamForm, instructions: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditExamModal(false)}
                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingExam}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSavingExam ? 'Saving...' : 'Save Exam Details'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuestionBuilderPage() {
  return (
    <Suspense fallback={<div className="p-10 font-bold text-center">Loading...</div>}>
      <QuestionBuilderContent />
    </Suspense>
  );
}
