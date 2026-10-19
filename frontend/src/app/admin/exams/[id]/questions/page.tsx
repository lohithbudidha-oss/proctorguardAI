'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
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
  Sparkles,
  Image as ImageIcon,
  Upload,
  FileUp,
  Eye,
  RefreshCw,
  ZoomIn,
  Layers,
  FileCheck2
} from 'lucide-react';
import api from '@/lib/api';

interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
}

interface QuestionItem {
  _id?: string;
  id?: string;
  text: string;
  imageUrl?: string;
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
    imageUrl: '',
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

  // Image Zoom / Diagram Preview Modal state
  const [previewImageModal, setPreviewImageModal] = useState<{ src: string; title: string } | null>(null);

  // Document / PDF Import Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'file' | 'text'>('file');
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [pastedImportText, setPastedImportText] = useState('');
  const [importCategory, setImportCategory] = useState('General');
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [parsedPreviewQuestions, setParsedPreviewQuestions] = useState<QuestionItem[]>([]);
  const [isImportingBulk, setIsImportingBulk] = useState(false);

  // File input refs
  const newImageFileRef = useRef<HTMLInputElement>(null);
  const editImageFileRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle Image Upload for New Question (converts to base64 data URI)
  const handleNewImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return alert('Please select a valid image file (PNG, JPG, SVG, WebP, GIF).');
    }

    if (file.size > 5 * 1024 * 1024) {
      return alert('Image size must be under 5MB.');
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewQuestion(prev => ({
          ...prev,
          imageUrl: reader.result as string,
          // If prompt text was empty, provide a helpful default diagram prompt
          text: prev.text.trim() ? prev.text : 'Study the diagram/figure above and select the correct answer.'
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Image Upload for Editing Question
  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return alert('Please select a valid image file (PNG, JPG, SVG, WebP, GIF).');
    }

    if (file.size > 5 * 1024 * 1024) {
      return alert('Image size must be under 5MB.');
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && editingQuestion) {
        setEditingQuestion({
          ...editingQuestion,
          imageUrl: reader.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Add New Question
  const handleAddQuestion = async () => {
    // If an image is provided, question text can be brief; otherwise it's required
    if (!newQuestion.text.trim() && !newQuestion.imageUrl) {
      return alert('Question text or diagram image is required.');
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
        imageUrl: '',
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
      imageUrl: q.imageUrl || '',
      type: q.type || 'SINGLE_CHOICE',
      category: q.category || 'General',
      marks: q.marks !== undefined ? q.marks : 1,
      negativeMarks: q.negativeMarks || 0,
      options: q.options && q.options.length > 0 
        ? q.options.map(opt => ({ id: opt.id, text: opt.text, imageUrl: opt.imageUrl }))
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
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Handle Save Edited Question
  const handleSaveEditQuestion = async () => {
    if (!editingQuestion) return;
    if (!editingQuestion.text.trim() && !editingQuestion.imageUrl) {
      return alert('Question text or diagram image is required.');
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

  // -------------------------------------------------------------
  // PDF / DOCUMENT IMPORT FUNCTIONALITY
  // -------------------------------------------------------------
  const handleParseDocument = async () => {
    if (importTab === 'file' && !selectedImportFile) {
      return alert('Please select a file (.pdf, .docx, .txt, .csv, .json) to upload.');
    }
    if (importTab === 'text' && !pastedImportText.trim()) {
      return alert('Please paste question content into the text area.');
    }

    setIsParsingDocument(true);
    try {
      if (importTab === 'file' && selectedImportFile) {
        const formData = new FormData();
        formData.append('file', selectedImportFile);
        formData.append('category', importCategory);

        const res = await api.post(`/admin/exams/${examId}/questions/parse-document`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.questions && res.data.questions.length > 0) {
          setParsedPreviewQuestions(res.data.questions);
          showToast(`Extracted ${res.data.questions.length} questions from document!`);
        } else {
          alert('Could not find any standard questions in the uploaded document. Please check the document format or try pasting the text.');
        }
      } else {
        // Send raw text to parse endpoint
        const res = await api.post(`/admin/exams/${examId}/questions/parse-document`, {
          text: pastedImportText,
          category: importCategory
        });

        if (res.data?.questions && res.data.questions.length > 0) {
          setParsedPreviewQuestions(res.data.questions);
          showToast(`Extracted ${res.data.questions.length} questions from text!`);
        } else {
          alert('Could not find any structured questions in the pasted text. Ensure questions have options A, B, C, D.');
        }
      }
    } catch (err: any) {
      console.error('Error parsing questions document:', err);
      alert(err?.response?.data?.message || 'Failed to parse questions from document. Please verify the file format.');
    } finally {
      setIsParsingDocument(false);
    }
  };

  // Confirm and Bulk Save all extracted questions to exam
  const handleConfirmImport = async () => {
    if (parsedPreviewQuestions.length === 0) return;

    setIsImportingBulk(true);
    try {
      const res = await api.post(`/admin/exams/${examId}/questions/bulk`, {
        questions: parsedPreviewQuestions
      });

      showToast(`Successfully imported ${res.data?.count || parsedPreviewQuestions.length} questions into exam!`);
      setShowImportModal(false);
      setSelectedImportFile(null);
      setPastedImportText('');
      setParsedPreviewQuestions([]);
      fetchData();
    } catch (err: any) {
      console.error('Failed to import questions:', err);
      alert(err?.response?.data?.message || 'Failed to save imported questions.');
    } finally {
      setIsImportingBulk(false);
    }
  };

  // Update a single parsed question in preview before final import
  const handleUpdateParsedItem = (idx: number, field: string, value: any) => {
    setParsedPreviewQuestions(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // Remove a parsed question from preview
  const handleRemoveParsedItem = (idx: number) => {
    setParsedPreviewQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 font-sans text-slate-600">
        <div className="w-9 h-9 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="font-bold text-slate-800 text-sm">Loading Exam Builder...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-6 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Link */}
        <Link href="/admin/exams" className="text-blue-600 font-bold flex items-center mb-6 hover:underline text-sm group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Exam Management
        </Link>
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-2xs animate-fadeIn">
            <div className="flex items-center text-emerald-800 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-700 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900">
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

            {/* Import Questions from PDF / Document Button */}
            <button
              onClick={() => {
                setShowImportModal(true);
                setParsedPreviewQuestions([]);
              }}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs flex items-center transition shadow-2xs cursor-pointer active:scale-95"
              title="Automatically extract and upload questions from PDF or Documents"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              <span>Import from PDF / Document</span>
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

        {/* ========================================================= */}
        {/* EDIT QUESTION FORM CARD */}
        {/* ========================================================= */}
        {editingQuestion && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-amber-300 mb-8 animate-fadeIn">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Edit Question</h3>
                  <p className="text-xs text-slate-500">Modify question prompt, diagram, choices, or correct answer</p>
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
                  Question Text / Prompt <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  className="w-full border-slate-300 rounded-xl p-3 border focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 bg-white text-sm" 
                  rows={3}
                  placeholder="Enter question text or prompt instructions..."
                  value={editingQuestion.text}
                  onChange={e => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                />
              </div>

              {/* DIAGRAM / GRAPHICAL QUESTION ATTACHMENT SECTION */}
              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Diagram / Graphical Figure (Mental Ability, Geometry, Patterns, Tables, Circuits)
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">Optional or Image-Only Question</span>
                </div>

                {editingQuestion.imageUrl ? (
                  <div className="relative p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={editingQuestion.imageUrl} 
                        alt="Question Diagram" 
                        className="w-20 h-20 object-contain rounded-lg border border-slate-200 bg-slate-50 cursor-pointer"
                        onClick={() => setPreviewImageModal({ src: editingQuestion.imageUrl!, title: 'Question Diagram' })}
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800 flex items-center">
                          <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> Diagram Attached
                        </p>
                        <p className="text-[11px] text-slate-500">Click image to inspect full-size preview</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setPreviewImageModal({ src: editingQuestion.imageUrl!, title: 'Question Diagram' })}
                        className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingQuestion({ ...editingQuestion, imageUrl: '' })}
                        className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input 
                      type="file" 
                      ref={editImageFileRef}
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleEditImageUpload}
                    />
                    <button
                      type="button"
                      onClick={() => editImageFileRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs flex items-center justify-center transition shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      <span>Upload Diagram Image</span>
                    </button>
                    <span className="text-xs text-slate-400 font-medium">or paste image URL:</span>
                    <input
                      type="text"
                      placeholder="https://example.com/diagram.png or data:image..."
                      className="flex-1 w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                      value={editingQuestion.imageUrl || ''}
                      onChange={e => setEditingQuestion({ ...editingQuestion, imageUrl: e.target.value })}
                    />
                  </div>
                )}
              </div>
              
              {/* OPTIONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editingQuestion.options.map((opt, idx) => (
                  <div key={opt.id} className="relative">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Option {opt.id}</span>
                      {editingQuestion.correctAnswer === opt.id && (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Correct Option
                        </span>
                      )}
                    </label>
                    <input 
                      type="text"
                      className={`w-full rounded-xl p-2.5 border text-sm outline-none transition ${
                        editingQuestion.correctAnswer === opt.id 
                          ? 'border-emerald-600 bg-emerald-50/20 focus:ring-2 focus:ring-emerald-700' 
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
                    placeholder="General, Aptitude, Mental Ability..."
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

        {/* ========================================================= */}
        {/* NEW QUESTION FORM CARD */}
        {/* ========================================================= */}
        {showAddForm && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-200 mb-8 animate-fadeIn">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Add New Multiple Choice / Diagram Question</h3>
                  <p className="text-xs text-slate-500">Provide question prompt or diagram, option choices, and designate the correct answer</p>
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
                  Question Text / Prompt <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  className="w-full border-slate-300 rounded-xl p-3 border focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white text-sm" 
                  rows={3}
                  placeholder="Enter the question text or prompt instructions here..."
                  value={newQuestion.text}
                  onChange={e => setNewQuestion({ ...newQuestion, text: e.target.value })}
                />
              </div>

              {/* DIAGRAM / GRAPHICAL QUESTION ATTACHMENT SECTION */}
              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Diagram / Graphical Figure (Mental Ability, Geometry, Patterns, Tables, Circuits)
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">Optional or Image-Only Question</span>
                </div>

                {newQuestion.imageUrl ? (
                  <div className="relative p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={newQuestion.imageUrl} 
                        alt="Question Diagram" 
                        className="w-20 h-20 object-contain rounded-lg border border-slate-200 bg-slate-50 cursor-pointer"
                        onClick={() => setPreviewImageModal({ src: newQuestion.imageUrl, title: 'Question Diagram' })}
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800 flex items-center">
                          <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> Diagram Attached
                        </p>
                        <p className="text-[11px] text-slate-500">Candidates will see this diagram above their options.</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setPreviewImageModal({ src: newQuestion.imageUrl, title: 'Question Diagram' })}
                        className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewQuestion({ ...newQuestion, imageUrl: '' })}
                        className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input 
                      type="file" 
                      ref={newImageFileRef}
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleNewImageUpload}
                    />
                    <button
                      type="button"
                      onClick={() => newImageFileRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs flex items-center justify-center transition shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      <span>Upload Diagram Image</span>
                    </button>
                    <span className="text-xs text-slate-400 font-medium">or paste image URL:</span>
                    <input
                      type="text"
                      placeholder="https://example.com/diagram.png or data:image..."
                      className="flex-1 w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newQuestion.imageUrl}
                      onChange={e => setNewQuestion({ ...newQuestion, imageUrl: e.target.value })}
                    />
                  </div>
                )}
              </div>
              
              {/* OPTIONS */}
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
                    placeholder="General, Aptitude, Mental Ability..."
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
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition flex items-center text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" /> 
                  {isSubmittingNew ? 'Saving Question...' : 'Save Question'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* QUESTIONS LIST */}
        {/* ========================================================= */}
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
                  {q.imageUrl && (
                    <span className="text-xs font-bold uppercase text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 flex items-center">
                      <ImageIcon className="w-3 h-3 mr-1" /> Diagram Question
                    </span>
                  )}
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
              <p className="text-base sm:text-lg text-slate-900 font-medium mb-3 leading-relaxed whitespace-pre-wrap">
                {q.text}
              </p>

              {/* Question Diagram / Image rendering if present */}
              {q.imageUrl && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center group relative max-w-lg">
                  <img 
                    src={q.imageUrl} 
                    alt={`Question ${idx + 1} Diagram`} 
                    className="max-h-60 max-w-full object-contain rounded-lg cursor-pointer bg-white p-2 border border-slate-100 transition hover:opacity-95"
                    onClick={() => setPreviewImageModal({ src: q.imageUrl!, title: `Question ${idx + 1} Diagram` })}
                  />
                  <button
                    type="button"
                    onClick={() => setPreviewImageModal({ src: q.imageUrl!, title: `Question ${idx + 1} Diagram` })}
                    className="mt-2 text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <ZoomIn className="w-3 h-3 mr-1" /> Click to view full-size diagram
                  </button>
                </div>
              )}
              
              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(q.options || []).map((opt) => {
                  const isCorrect = q.correctAnswer === opt.id;
                  return (
                    <div 
                      key={opt.id} 
                      className={`p-3.5 rounded-xl border text-sm font-medium transition flex items-center justify-between ${
                        isCorrect 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs font-semibold' 
                          : 'border-slate-200 bg-slate-50/60 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs mr-2.5 shrink-0 ${
                          isCorrect ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {opt.id}
                        </span> 
                        <span>{opt.text}</span>
                      </div>
                      {isCorrect && (
                        <Check className="w-4 h-4 text-emerald-700 shrink-0 ml-2" />
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
                Add multiple choice or graphical diagram questions, or import questions directly from PDF / Documents.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button 
                  onClick={() => setShowAddForm(true)} 
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-xs inline-flex items-center text-xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add First Question
                </button>
                <button 
                  onClick={() => setShowImportModal(true)} 
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-5 py-2.5 rounded-xl font-bold transition shadow-2xs inline-flex items-center text-xs cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4 mr-1.5" /> Import from PDF / Document
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* DOCUMENT / PDF QUESTION IMPORT MODAL */}
        {/* ========================================================= */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Import Questions from PDF / Document
                    </h3>
                    <p className="text-xs text-slate-500">
                      Automatically extract multiple choice questions from PDFs, Word DOCX, text files, or spreadsheets
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowImportModal(false);
                    setParsedPreviewQuestions([]);
                  }} 
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* PREVIEW & CONFIRM STEP (if questions already extracted) */}
                {parsedPreviewQuestions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-900">
                            Found {parsedPreviewQuestions.length} Questions Ready to Import
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            Review the extracted questions below. You can adjust the correct answer, marks, or delete any question before adding them.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setParsedPreviewQuestions([])}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                      >
                        Upload Another File
                      </button>
                    </div>

                    {/* Parsed Questions List */}
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                      {parsedPreviewQuestions.map((pq, qIdx) => (
                        <div key={qIdx} className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                              {qIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={pq.text}
                              onChange={e => handleUpdateParsedItem(qIdx, 'text', e.target.value)}
                              className="flex-1 font-semibold text-sm text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveParsedItem(qIdx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Discard this question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Options */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                            {pq.options.map(opt => (
                              <div key={opt.id} className="flex items-center space-x-1.5">
                                <span className="font-bold text-xs text-slate-500 w-4">{opt.id}:</span>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={e => {
                                    const updatedOpts = pq.options.map(o => o.id === opt.id ? { ...o, text: e.target.value } : o);
                                    handleUpdateParsedItem(qIdx, 'options', updatedOpts);
                                  }}
                                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                            ))}
                          </div>

                          {/* Controls (Correct Answer, Marks, Category) */}
                          <div className="flex items-center gap-4 pl-9 pt-1 flex-wrap text-xs">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-600">Correct Option:</span>
                              <select
                                value={pq.correctAnswer}
                                onChange={e => handleUpdateParsedItem(qIdx, 'correctAnswer', e.target.value)}
                                className="border border-slate-300 rounded-lg px-2 py-0.5 font-bold text-indigo-700 bg-white"
                              >
                                {pq.options.map(o => (
                                  <option key={o.id} value={o.id}>Option {o.id}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-600">Marks:</span>
                              <input
                                type="number"
                                min="1"
                                value={pq.marks}
                                onChange={e => handleUpdateParsedItem(qIdx, 'marks', Math.max(1, Number(e.target.value) || 1))}
                                className="w-14 border border-slate-300 rounded-lg px-2 py-0.5 font-bold text-slate-800 text-center"
                              />
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-600">Category:</span>
                              <input
                                type="text"
                                value={pq.category}
                                onChange={e => handleUpdateParsedItem(qIdx, 'category', e.target.value)}
                                className="w-28 border border-slate-300 rounded-lg px-2 py-0.5 text-slate-800"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* TABS: File Upload vs Direct Paste */}
                    <div className="flex border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => setImportTab('file')}
                        className={`pb-3 px-4 font-bold text-xs flex items-center transition border-b-2 ${
                          importTab === 'file'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <FileUp className="w-4 h-4 mr-1.5" /> Upload File (PDF, DOCX, TXT, CSV, JSON)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportTab('text')}
                        className={`pb-3 px-4 font-bold text-xs flex items-center transition border-b-2 ${
                          importTab === 'text'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <FileText className="w-4 h-4 mr-1.5" /> Paste Question Text Directly
                      </button>
                    </div>

                    {/* Common Category Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Default Category for Extracted Questions
                      </label>
                      <input
                        type="text"
                        value={importCategory}
                        onChange={e => setImportCategory(e.target.value)}
                        placeholder="e.g. Mental Ability, Aptitude, Technical, General"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    {/* TAB 1: FILE UPLOAD */}
                    {importTab === 'file' && (
                      <div className="space-y-3">
                        <div 
                          onClick={() => docFileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center ${
                            selectedImportFile 
                              ? 'border-indigo-500 bg-indigo-50/30' 
                              : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="file"
                            ref={docFileInputRef}
                            accept=".pdf,.docx,.txt,.csv,.json"
                            className="hidden"
                            onChange={e => setSelectedImportFile(e.target.files?.[0] || null)}
                          />
                          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-3">
                            <Upload className="w-6 h-6" />
                          </div>
                          {selectedImportFile ? (
                            <div>
                              <p className="text-sm font-bold text-slate-900 flex items-center justify-center">
                                <FileCheck2 className="w-4 h-4 mr-1 text-emerald-600" />
                                {selectedImportFile.name}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {(selectedImportFile.size / 1024).toFixed(1)} KB • Click to change file
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                Click or drag and drop your exam file here
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Supports PDF (.pdf), Word (.docx), Plain Text (.txt), CSV (.csv), or JSON (.json)
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Supported format helper note */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                          <p className="font-bold text-slate-800">💡 Standard Document Format Supported:</p>
                          <p>Questions numbered like <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">1.</code> or <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">Q1)</code> with options <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">A)</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">B)</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">C)</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">D)</code> and <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">Answer: B</code> will be automatically extracted.</p>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: TEXT PASTE */}
                    {importTab === 'text' && (
                      <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-700">
                          Paste Questions Text
                        </label>
                        <textarea
                          rows={8}
                          value={pastedImportText}
                          onChange={e => setPastedImportText(e.target.value)}
                          placeholder={`1. Which protocol is responsible for IP address assignment?
A) DNS
B) DHCP
C) ARP
D) ICMP
Answer: B

2. Study the sequence: 2, 4, 8, 16, ? What is the next number?
A) 24
B) 30
C) 32
D) 64
Answer: C`}
                          className="w-full border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setParsedPreviewQuestions([]);
                  }}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200/60 rounded-xl transition text-xs cursor-pointer"
                >
                  Cancel
                </button>

                {parsedPreviewQuestions.length > 0 ? (
                  <button
                    type="button"
                    disabled={isImportingBulk}
                    onClick={handleConfirmImport}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer flex items-center disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    {isImportingBulk 
                      ? 'Adding Questions to Exam...' 
                      : `Confirm & Import All ${parsedPreviewQuestions.length} Questions`}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isParsingDocument || (importTab === 'file' && !selectedImportFile) || (importTab === 'text' && !pastedImportText.trim())}
                    onClick={handleParseDocument}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer flex items-center disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    {isParsingDocument ? 'Analyzing & Extracting...' : 'Parse & Extract Questions'}
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* IMAGE ZOOM / FULL PREVIEW MODAL */}
        {/* ========================================================= */}
        {previewImageModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-fadeIn"
            onClick={() => setPreviewImageModal(null)}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-3xl max-h-[90vh] overflow-hidden p-4 flex flex-col border border-slate-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                <span className="font-bold text-xs text-slate-700">{previewImageModal.title}</span>
                <button 
                  onClick={() => setPreviewImageModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-50 rounded-xl">
                <img 
                  src={previewImageModal.src} 
                  alt={previewImageModal.title} 
                  className="max-h-[75vh] max-w-full object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* EDIT EXAM DETAILS MODAL */}
        {/* ========================================================= */}
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
