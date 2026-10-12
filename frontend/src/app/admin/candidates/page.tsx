'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { UserCheck, Clock, UserX, User, ArrowLeft, CheckCircle2, Search, X } from 'lucide-react';
import api from '@/lib/api';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<{ _id?: string; name: string; email: string; status: string; role: string; profilePhoto?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');

  const fetchCandidates = () => {
    api.get('/admin/candidates')
      .then(res => {
        setCandidates(res.data.candidates || []);
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

  const filteredCandidates = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return candidates.filter(c => {
      const isApproved = c.status === 'APPROVED';
      const isPending = c.status === 'PENDING_VERIFICATION' || c.status === 'PENDING';

      const matchesStatus = 
        statusFilter === 'ALL' ||
        (statusFilter === 'APPROVED' && isApproved) ||
        (statusFilter === 'PENDING' && isPending);

      if (!matchesStatus) return false;
      if (tokens.length === 0) return true;

      const blob = `${c.name || ''} ${c.email || ''} ${c.status || ''} ${isApproved ? 'approved' : 'pending unapproved'}`.toLowerCase();
      return tokens.every(t => blob.includes(t));
    });
  }, [candidates, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-6">
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

        {/* Search and Filters Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidate name, email, status..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
            {(['ALL', 'APPROVED', 'PENDING'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  statusFilter === tab 
                    ? 'bg-white text-slate-900 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'ALL' ? `All (${candidates.length})` : tab}
              </button>
            ))}
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
                {filteredCandidates.length > 0 ? filteredCandidates.map((candidate) => (
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
                    <td colSpan={4} className="px-6 py-14 text-center text-slate-500">
                      {searchQuery ? (
                        <div>
                          <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-700">No candidates match &quot;{searchQuery}&quot;</p>
                          <p className="text-xs text-slate-400 mt-1">Try searching by candidate name, email, or approval status.</p>
                          <button
                            onClick={() => setSearchQuery('')}
                            className="mt-3 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition"
                          >
                            Clear Search
                          </button>
                        </div>
                      ) : (
                        <div>
                          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          No candidates found.
                        </div>
                      )}
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
