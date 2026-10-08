'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserCheck, Clock, UserX, User, ArrowLeft, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<{ _id?: string; name: string; email: string; status: string; role: string; profilePhoto?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCandidates = () => {
    api.get('/admin/candidates')
      .then(res => {
        setCandidates(res.data.candidates);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch candidates', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleApprove = async (candidateId: string) => {
    try {
      await api.patch(`/admin/candidates/${candidateId}/approve`);
      // Update local state
      setCandidates(prev => 
        prev.map(c => c._id === candidateId ? { ...c, status: 'APPROVED' } : c)
      );
    } catch (err) {
      console.error(err);
      alert('Failed to approve candidate');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Link href="/admin/exams" className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-100 transition">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Candidates</h1>
            </div>
            <p className="text-slate-500">Manage candidate registrations and approvals.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.length > 0 ? candidates.map((candidate) => (
                  <tr key={candidate._id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mr-3">
                          {candidate.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">{candidate.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{candidate.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                        ${candidate.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 
                          candidate.status === 'PENDING_VERIFICATION' ? 'bg-amber-100 text-amber-700' : 
                          'bg-slate-100 text-slate-600'}`}>
                        {candidate.status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                        {candidate.status === 'PENDING_VERIFICATION' && <Clock className="w-3.5 h-3.5 mr-1" />}
                        {candidate.status === 'PENDING_VERIFICATION' ? 'PENDING' : candidate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {candidate.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleApprove(candidate._id as string)}
                          className="inline-flex items-center px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
                        >
                          <UserCheck className="w-4 h-4 mr-1.5" />
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      No candidates found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
