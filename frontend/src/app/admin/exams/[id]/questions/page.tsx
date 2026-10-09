'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import api from '@/lib/api';

function QuestionBuilderContent() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;
  
  const [exam, setExam] = useState<{ id: string; title: string; duration: number; status?: string } | null>(null);
  const [questions, setQuestions] = useState<{ _id?: string; id?: string; text: string; type: string; category: string; marks: number; options: { id: string; text: string }[]; correctAnswer: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // New question form state
  const [showForm, setShowForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'SINGLE_CHOICE',
    category: 'General',
    marks: 1,
    negativeMarks: 0,
    options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }, { id: 'D', text: '' }],
    correctAnswer: 'A'
  });

  async function fetchData() {
    try {
      const [examRes, qRes] = await Promise.all([
        api.get(`/admin/exams/${examId}`),
        api.get(`/admin/exams/${examId}/questions`)
      ]);
      setExam(examRes.data.exam);
      setQuestions(qRes.data.questions);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => fetchData(), 0);
    return () => clearTimeout(t);
  }, [examId]);

  const handleAddQuestion = async () => {
    if (!newQuestion.text) return alert('Question text is required');
    try {
      await api.post(`/admin/exams/${examId}/questions`, newQuestion);
      setShowForm(false);
      setNewQuestion({ ...newQuestion, text: '', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }, { id: 'D', text: '' }] });
      fetchData();
    } catch (err) {
      alert('Failed to add question');
    }
  };

  const handleDelete = async (qId: string) => {
    if (confirm('Delete this question?')) {
      try {
        await api.delete(`/admin/questions/${qId}`);
        fetchData();
      } catch (err) {
        alert('Failed to delete question');
      }
    }
  };

  if (loading) return <div className="p-10 text-center font-bold">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/admin/exams" className="text-blue-600 font-bold flex items-center mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Exams
        </Link>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Exam Builder</h1>
            <p className="text-slate-500 font-medium mt-1">{exam?.title}</p>
          </div>
          <div className="flex space-x-3">
            <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold border border-slate-200">
              {questions.length} Questions
            </div>
            {exam?.status === 'DRAFT' && !showForm && (
              <button 
                onClick={() => setShowForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Question
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-200 mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4">New Multiple Choice Question</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Question Text</label>
                <textarea 
                  className="w-full border-slate-300 rounded-lg p-3 border focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white" 
                  rows={3}
                  value={newQuestion.text}
                  onChange={e => setNewQuestion({...newQuestion, text: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {newQuestion.options.map((opt, idx) => (
                  <div key={opt.id}>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Option {opt.id}</label>
                    <input 
                      type="text"
                      className="w-full border-slate-300 rounded-lg p-2 border focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white"
                      value={opt.text}
                      onChange={e => {
                        const newOpts = [...newQuestion.options];
                        newOpts[idx].text = e.target.value;
                        setNewQuestion({...newQuestion, options: newOpts});
                      }}
                    />
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Correct Answer</label>
                  <select 
                    className="w-full border-slate-300 rounded-lg p-2 border outline-none text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                    value={newQuestion.correctAnswer}
                    onChange={e => setNewQuestion({...newQuestion, correctAnswer: e.target.value})}
                  >
                    {newQuestion.options.map(opt => <option key={opt.id} value={opt.id}>Option {opt.id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Marks</label>
                  <input type="number" className="w-full border-slate-300 rounded-lg p-2 border outline-none text-slate-900 bg-white focus:ring-2 focus:ring-blue-500" value={newQuestion.marks} onChange={e => setNewQuestion({...newQuestion, marks: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                  <input type="text" className="w-full border-slate-300 rounded-lg p-2 border outline-none text-slate-900 bg-white focus:ring-2 focus:ring-blue-500" value={newQuestion.category} onChange={e => setNewQuestion({...newQuestion, category: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button onClick={handleAddQuestion} className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition flex items-center">
                  <Save className="w-4 h-4 mr-2" /> Save Question
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q._id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-200">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded">{q.category}</span>
                  <span className="text-xs font-bold uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">{q.marks} Mark(s)</span>
                </div>
                {exam?.status === 'DRAFT' && (
                  <button onClick={() => handleDelete(q._id as string)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-lg text-slate-800 font-medium mb-4">{q.text}</p>
              
              <div className="grid grid-cols-2 gap-3">
                {q.options.map((opt: { id: string; text: string }) => (
                  <div key={opt.id} className={`p-3 rounded-lg border text-sm font-medium ${q.correctAnswer === opt.id ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    <span className="font-bold mr-2">{opt.id}.</span> {opt.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {questions.length === 0 && !showForm && (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
              <p className="text-slate-500 font-medium mb-4">This exam has no questions yet.</p>
              <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm inline-flex items-center">
                <Plus className="w-4 h-4 mr-2" /> Add First Question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuestionBuilderPage() {
  return (
    <Suspense fallback={<div className="p-10 font-bold">Loading...</div>}>
      <QuestionBuilderContent />
    </Suspense>
  );
}
