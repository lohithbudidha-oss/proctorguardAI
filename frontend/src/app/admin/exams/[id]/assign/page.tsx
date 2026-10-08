'use client';

import React, { useEffect, useState, Suspense, Key } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus, CheckCircle, Search } from 'lucide-react';
import api from '@/lib/api';

function CandidateAssignmentContent() {
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam] = useState<{ id: string; title: string; duration: number } | null>(null);
  const [candidates, setCandidates] = useState<{
    _id: Key | null | undefined;
    candidateId: any; userId: { _id?: string; id?: string }; status: string
  }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; _id: string; name: string; email: string; role: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const [examRes, assignRes, usersRes] = await Promise.all([
        api.get(`/admin/exams/${examId}`),
        api.get(`/admin/exams/${examId}/candidates`),
        api.get(`/admin/candidates`)
      ]);
      setExam(examRes.data.exam);
      setCandidates(assignRes.data.candidates);
      setAllUsers(usersRes.data.candidates);
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

  const handleAssign = async (userId: string) => {
    try {
      await api.post(`/admin/exams/${examId}/assign`, { candidateId: userId });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to assign candidate');
    }
  };

  const isAssigned = (userId: string) => {
    return candidates.some(c => {
      const cid = c.candidateId;
      if (cid && typeof cid === 'object') return String(cid._id) === userId;
      return String(cid) === userId;
    });
  };

  if (loading) return <div className="p-10 text-center font-bold">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin/exams" className="text-blue-600 font-bold flex items-center mb-6 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Exams
        </Link>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Assign Candidates</h1>
            <p className="text-slate-500 font-medium mt-1">{exam?.title}</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to allow all assigned candidates to re-write this exam?')) {
                  try {
                    const res = await api.post(`/admin/exams/${examId}/allow-rewrite-all`);
                    alert(res.data.message);
                    fetchData();
                  } catch (err) {
                    alert('Failed to grant rewrite');
                  }
                }
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition"
            >
              Allow Re-write for All
            </button>
            <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold border border-slate-200">
              {candidates.length} Assigned
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Available Users List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
              Available Candidates
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {allUsers.map(user => (
                <div key={user._id} className="flex items-center justify-between p-4 border-b border-slate-100 hover:bg-slate-50">
                  <div>
                    <p className="font-bold text-slate-800">{user.name}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </div>
                  {isAssigned(user._id) ? (
                    <span className="flex items-center text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                      <CheckCircle className="w-4 h-4 mr-1" /> Assigned
                    </span>
                  ) : (
                    <button onClick={() => handleAssign(user._id)} className="px-3 py-1.5 text-sm bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition flex items-center">
                      <UserPlus className="w-4 h-4 mr-1" /> Assign
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Candidates */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-emerald-50 font-bold text-emerald-800">
              Assigned to Exam
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {candidates.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-medium">No candidates assigned yet.</div>
              ) : (
                candidates.map(assignment => (
                  <div key={assignment._id} className="flex items-center justify-between p-4 border-b border-slate-100 hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-800">{assignment.candidateId?.name || 'Unknown'}</p>
                      <p className="text-sm text-slate-500">{assignment.candidateId?.email || 'Unknown'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {assignment.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function CandidateAssignmentPage() {
  return (
    <Suspense fallback={<div className="p-10 font-bold">Loading...</div>}>
      <CandidateAssignmentContent />
    </Suspense>
  );
}
