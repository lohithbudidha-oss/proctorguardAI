'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  UserCheck, 
  Clock, 
  User, 
  ArrowLeft, 
  CheckCircle2, 
  Search, 
  X, 
  LogOut, 
  Users, 
  FileText, 
  AlertTriangle, 
  BarChart3,
  Calendar,
  Sparkles
} from 'lucide-react';
import api from '@/lib/api';
import { sanitizeSearchInput } from '@/lib/sanitize';

interface CandidateUser {
  _id?: string;
  name: string;
  email: string;
  status: string;
  role: string;
  profilePhoto?: string;
  createdAt?: string;
}

export default function CandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalToast, setApprovalToast] = useState<string | null>(null);

  const fetchCandidates = () => {
    setLoading(true);
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

  const handleApprove = async (candidateId: string, candidateName: string) => {
    setApprovingId(candidateId);
    try {
      await api.patch(`/admin/candidates/${candidateId}/approve`);
      // Update local state
      setCandidates(prev => 
        prev.map(c => c._id === candidateId ? { ...c, status: 'APPROVED' } : c)
      );
      setApprovalToast(`Candidate "${candidateName}" has been successfully approved! They can now log in and take assigned exams.`);
      setTimeout(() => setApprovalToast(null), 5000);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to approve candidate');
    } finally {
      setApprovingId(null);
    }
  };

  const pendingCount = useMemo(() => {
    return candidates.filter(c => {
      const s = (c.status || '').toUpperCase();
      return s === 'PENDING_VERIFICATION' || s === 'PENDING';
    }).length;
  }, [candidates]);

  const approvedCount = useMemo(() => {
    return candidates.filter(c => {
      const s = (c.status || '').toUpperCase();
      return s === 'APPROVED' || s === 'VERIFIED';
    }).length;
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return candidates.filter(c => {
      const normStatus = (c.status || '').toUpperCase();
      const isApproved = normStatus === 'APPROVED' || normStatus === 'VERIFIED';
      const isPending = normStatus === 'PENDING_VERIFICATION' || normStatus === 'PENDING';

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
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Link 
                href="/admin/exams" 
                className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-100 transition shadow-2xs" 
                title="Back to Exam Management"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
                <Users className="w-7 h-7 mr-2.5 text-blue-600" /> Candidates Directory & Approvals
              </h1>
            </div>
            <p className="text-slate-500">
              Manage candidate account registrations, verify newly registered candidates, and approve access to assessments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/admin/exams" className="px-3.5 py-2 bg-white text-slate-700 border border-slate-200 font-semibold rounded-lg hover:bg-slate-50 transition shadow-xs text-xs flex items-center">
              <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Exam Management
            </Link>
            <Link href="/admin/monitoring" className="px-3.5 py-2 bg-white text-slate-700 border border-slate-200 font-semibold rounded-lg hover:bg-slate-50 transition shadow-xs text-xs flex items-center">
              <Users className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Live Monitoring
            </Link>
            <Link href="/admin/results" className="px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 font-semibold rounded-lg hover:bg-blue-100 transition shadow-xs text-xs flex items-center">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Results
            </Link>
            <Link href="/admin/violations" className="px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 font-semibold rounded-lg hover:bg-rose-100 transition shadow-xs text-xs flex items-center">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Violations
            </Link>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to sign out of the Admin Portal?')) {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  window.location.href = '/login?role=admin';
                }
              }}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg border border-rose-200 transition shadow-xs flex items-center text-xs cursor-pointer"
              title="Sign Out of Admin Portal"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
            </button>
          </div>
        </div>

        {/* Approval Success Banner */}
        {approvalToast && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between animate-fadeIn shadow-xs">
            <div className="flex items-center text-emerald-800 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600 shrink-0" />
              <span>{approvalToast}</span>
            </div>
            <button 
              onClick={() => setApprovalToast(null)} 
              className="text-emerald-500 hover:text-emerald-700 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search and Filters Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search candidate name, email, status..." 
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
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'ALL' 
                  ? 'bg-white text-slate-900 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Candidates ({candidates.length})
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'APPROVED' 
                  ? 'bg-white text-emerald-800 shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center ${
                statusFilter === 'PENDING' 
                  ? 'bg-amber-500 text-white shadow-xs font-bold' 
                  : pendingCount > 0 
                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' 
                    : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending Approval ({pendingCount})
              {pendingCount > 0 && statusFilter !== 'PENDING' && (
                <span className="ml-1.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider align-middle text-left">Candidate Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider align-middle text-left">Email Address</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider align-middle text-center">Registration Date</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider align-middle text-center">Approval Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider align-middle text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center text-slate-500 font-semibold">
                      <div className="w-7 h-7 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                      Loading candidate records...
                    </td>
                  </tr>
                ) : filteredCandidates.length > 0 ? filteredCandidates.map((candidate) => {
                  const normStatus = (candidate.status || '').toUpperCase();
                  const isApproved = normStatus === 'APPROVED' || normStatus === 'VERIFIED';
                  const isPending = normStatus === 'PENDING_VERIFICATION' || normStatus === 'PENDING';

                  return (
                    <tr key={candidate._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 align-middle text-left">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3 shrink-0 shadow-2xs ${
                            isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {candidate.name ? candidate.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{candidate.name || 'Candidate'}</span>
                            <span className="text-xs text-slate-400">Role: {candidate.role || 'CANDIDATE'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle text-left">
                        <span className="font-medium text-slate-700">{candidate.email}</span>
                      </td>
                      <td className="px-6 py-4 align-middle text-center text-xs text-slate-500 font-medium">
                        {candidate.createdAt ? (
                          <div className="inline-flex items-center space-x-1 bg-slate-100 px-2.5 py-1 rounded-md">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1" />
                            <span>{new Date(candidate.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle text-center">
                        <div className="inline-flex items-center justify-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                            ${isApproved ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                              isPending ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                              'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                            {isApproved && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                            {isPending && <Clock className="w-3.5 h-3.5 mr-1" />}
                            {isPending ? 'PENDING APPROVAL' : isApproved ? 'APPROVED' : candidate.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle text-center">
                        <div className="inline-flex items-center justify-center">
                          {!isApproved ? (
                            <button
                              onClick={() => handleApprove(candidate._id as string, candidate.name)}
                              disabled={approvingId === candidate._id}
                              className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 active:scale-95 transition shadow-2xs cursor-pointer disabled:opacity-50"
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                              {approvingId === candidate._id ? 'Approving...' : 'Approve Candidate'}
                            </button>
                          ) : (
                            <span className="inline-flex items-center text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verified
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center text-slate-500">
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
                          <p className="font-bold text-slate-700 text-base">No candidates found in this view.</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {statusFilter === 'PENDING' 
                              ? 'All candidates are currently approved. New candidate registrations will appear here for verification.' 
                              : 'Registered candidates will appear here with verification approvals.'}
                          </p>
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
