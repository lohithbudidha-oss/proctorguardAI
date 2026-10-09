'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Settings, Users, MonitorPlay, FileText, CheckCircle, Trash2, Eye, Edit2, X } from 'lucide-react';
import api from '@/lib/api';

interface Exam {
  _id: string;
  title: string;
  duration: number;
  status: string;
}

export default function AdminExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [examDetails, setExamDetails] = useState<any>(null);

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

  const handleCreate = async () => {
    try {
      const title = prompt('Enter new exam title:');
      if (!title) return;
      
      const res = await api.post('/admin/exams', {
        title,
        duration: 60,
        status: 'DRAFT',
      });
      router.push(`/admin/exams/${res.data.exam._id}/questions`);
    } catch (err) {
      console.error(err);
      alert('Failed to create exam');
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

  const handleEdit = async (exam: Exam) => {
    const newTitle = prompt('Enter new title:', exam.title);
    if (!newTitle) return;
    try {
      await api.patch(`/admin/exams/${exam._id}`, { title: newTitle });
      fetchExams();
    } catch(err) {
      alert('Failed to edit exam. Ensure it is still in DRAFT status.');
    }
  };

  const handleView = async (exam: Exam) => {
    setSelectedExam(exam);
    setIsViewModalOpen(true);
    setExamDetails(null); // Reset while loading
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
            <p className="text-slate-500 mt-2">Create and manage your organization&apos;s assessments.</p>
          </div>
          <div className="flex space-x-4">
            <Link href="/admin/candidates" className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm">
              Candidates
            </Link>
            <Link href="/admin/monitoring" className="px-5 py-2.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition shadow-sm">
              Live Monitoring
            </Link>
            <button 
              onClick={handleCreate}
              className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm flex items-center"
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
                    <span className="flex items-center"><MonitorPlay className="w-4 h-4 mr-1 text-slate-400" /> {exam.duration} Min</span>
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
                    onClick={() => handleEdit(exam)}
                    className="p-2 text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition"
                    title="Edit Title"
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
            </div>
          )}
        </div>
      </div>

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
                      <p className="text-slate-800 font-medium">{examDetails.duration} Minutes</p>
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
                className="px-6 py-2 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition"
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
