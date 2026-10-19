'use client';

import React, { useEffect, useState, useMemo, Suspense, Key } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Users, RotateCcw, CheckCircle, Search, X, CheckSquare } from 'lucide-react';
import api from '@/lib/api';
import { sanitizeSearchInput } from '@/lib/sanitize';

function CandidateAssignmentContent() {
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam] = useState<{ id: string; title: string; duration: number } | null>(null);
  const [candidates, setCandidates] = useState<{
    _id: Key | null | undefined;
    candidateId: any; userId: { _id?: string; id?: string }; status: string
  }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; _id: string; name: string; email: string; role: string; status: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAssigningAll, setIsAssigningAll] = useState(false);
  const [isRewritingAll, setIsRewritingAll] = useState(false);

  // Select box state for multi-candidate assignment
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [isAssigningSelected, setIsAssigningSelected] = useState(false);

  const isAssigned = (userId: string) => {
    return candidates.some(c => {
      const cid = c.candidateId;
      if (cid && typeof cid === 'object') return String(cid._id) === userId;
      return String(cid) === userId;
    });
  };

  const unassignedCandidates = useMemo(() => {
    return allUsers.filter(u => !isAssigned(u._id));
  }, [allUsers, candidates]);

  const filteredUsers = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return allUsers;
    return allUsers.filter(u => {
      const blob = `${u.name || ''} ${u.email || ''}`.toLowerCase();
      return tokens.every(token => blob.includes(token));
    });
  }, [allUsers, searchQuery]);

  const filteredUnassigned = useMemo(() => {
    return filteredUsers.filter(u => !isAssigned(u._id));
  }, [filteredUsers, candidates]);

  async function fetchData() {
    try {
      const [examRes, assignRes, usersRes] = await Promise.all([
        api.get(`/admin/exams/${examId}`),
        api.get(`/admin/exams/${examId}/candidates`),
        api.get(`/admin/candidates`)
      ]);
      setExam(examRes.data.exam);
      setCandidates(assignRes.data.candidates || []);
      setAllUsers(usersRes.data.candidates || []);
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

  // Toggle individual candidate selection
  const toggleSelectCandidate = (userId: string) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Toggle select all visible unassigned candidates
  const handleToggleSelectAll = () => {
    if (filteredUnassigned.length === 0) return;
    const allSelected = filteredUnassigned.every(u => selectedCandidateIds.has(u._id));
    if (allSelected) {
      setSelectedCandidateIds(prev => {
        const next = new Set(prev);
        filteredUnassigned.forEach(u => next.delete(u._id));
        return next;
      });
    } else {
      setSelectedCandidateIds(prev => {
        const next = new Set(prev);
        filteredUnassigned.forEach(u => next.add(u._id));
        return next;
      });
    }
  };

  // Assign selected candidates
  const handleAssignSelected = async () => {
    const idsToAssign = Array.from(selectedCandidateIds).filter(id => !isAssigned(id));
    if (idsToAssign.length === 0) {
      alert('Please select at least one unassigned candidate.');
      return;
    }

    if (!confirm(`Are you sure you want to assign ${idsToAssign.length} selected candidate(s) to "${exam?.title || 'this exam'}"?`)) {
      return;
    }

    setIsAssigningSelected(true);
    try {
      const res = await api.post(`/admin/exams/${examId}/assign-all`, {
        candidateIds: idsToAssign
      });
      alert(res.data.message || `Successfully assigned ${idsToAssign.length} candidate(s).`);
      setSelectedCandidateIds(new Set());
      fetchData();
    } catch (err: unknown) {
      try {
        await Promise.all(
          idsToAssign.map(id => api.post(`/admin/exams/${examId}/assign`, { candidateId: id }))
        );
        alert(`Successfully assigned ${idsToAssign.length} candidate(s).`);
        setSelectedCandidateIds(new Set());
        fetchData();
      } catch (fallbackErr: unknown) {
        const msg = (fallbackErr as { response?: { data?: { message?: string } } })?.response?.data?.message;
        alert(msg || 'Failed to assign selected candidates');
      }
    } finally {
      setIsAssigningSelected(false);
    }
  };

  const handleAssign = async (userId: string) => {
    try {
      await api.post(`/admin/exams/${examId}/assign`, { candidateId: userId });
      setSelectedCandidateIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to assign candidate');
    }
  };

  // Assign All Candidates (or filtered candidates)
  const handleAssignAll = async (targetCandidates?: typeof allUsers) => {
    const toAssign = targetCandidates || unassignedCandidates;
    if (toAssign.length === 0) {
      alert('All available candidates are already assigned to this exam.');
      return;
    }

    const confirmMsg = targetCandidates && searchQuery
      ? `Are you sure you want to assign all ${toAssign.length} filtered candidate(s) to "${exam?.title || 'this exam'}"?`
      : `Are you sure you want to assign all ${toAssign.length} candidate(s) to "${exam?.title || 'this exam'}"?`;

    if (!confirm(confirmMsg)) return;

    setIsAssigningAll(true);
    try {
      const res = await api.post(`/admin/exams/${examId}/assign-all`, {
        candidateIds: toAssign.map(c => c._id)
      });
      alert(res.data.message || `Successfully assigned ${toAssign.length} candidates.`);
      setSelectedCandidateIds(new Set());
      fetchData();
    } catch (err: unknown) {
      try {
        await Promise.all(
          toAssign.map(u => api.post(`/admin/exams/${examId}/assign`, { candidateId: u._id }))
        );
        alert(`Successfully assigned ${toAssign.length} candidate(s).`);
        setSelectedCandidateIds(new Set());
        fetchData();
      } catch (fallbackErr: unknown) {
        const msg = (fallbackErr as { response?: { data?: { message?: string } } })?.response?.data?.message;
        alert(msg || 'Failed to assign candidates.');
      }
    } finally {
      setIsAssigningAll(false);
    }
  };

  const handleAllowRewriteAll = async () => {
    if (candidates.length === 0) {
      alert('No candidates are assigned to this exam yet.');
      return;
    }
    if (confirm('Are you sure you want to allow all assigned candidates to re-write this exam?')) {
      setIsRewritingAll(true);
      try {
        const res = await api.post(`/admin/exams/${examId}/allow-rewrite-all`);
        alert(res.data.message || 'Granted rewrite for all assigned candidates');
        fetchData();
      } catch (err: unknown) {
        alert('Failed to grant rewrite');
      } finally {
        setIsRewritingAll(false);
      }
    }
  };

  const handleAllowRewrite = async (candidateId: string) => {
    if (confirm('Are you sure you want to allow this candidate to re-write the exam?')) {
      try {
        const res = await api.post(`/admin/exams/${examId}/allow-rewrite/${candidateId}`);
        alert(res.data.message);
        fetchData();
      } catch (err) {
        alert('Failed to grant rewrite');
      }
    }
  };

  const handleUnassign = async (candidateId: string) => {
    if (confirm('Are you sure you want to unassign this candidate?')) {
      try {
        await api.delete(`/admin/exams/${examId}/assign/${candidateId}`);
        fetchData();
      } catch (err: unknown) {
        alert('Failed to unassign candidate');
      }
    }
  };

  if (loading) return <div className="p-10 text-center font-bold">Loading...</div>;

  return (
    <div className="min-h-screen bg-white py-10 px-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin/exams" className="text-blue-600 font-bold flex items-center mb-6 hover:underline text-sm group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Exams
        </Link>

        {/* Top Header Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Assign Candidates</h1>
            <p className="text-slate-500 font-semibold text-sm mt-1">{exam?.title}</p>
          </div>
          
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            {/* Assign to All Button */}
            <button
              type="button"
              onClick={() => handleAssignAll()}
              disabled={isAssigningAll || unassignedCandidates.length === 0}
              className={`px-4 py-2 font-bold rounded-lg transition flex items-center text-sm shadow-xs cursor-pointer active:scale-95 ${
                unassignedCandidates.length === 0
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={unassignedCandidates.length === 0 ? 'All candidates are already assigned' : `Assign all ${unassignedCandidates.length} candidate(s)`}
            >
              <Users className="w-4 h-4 mr-2" />
              {isAssigningAll ? 'Assigning All...' : `Assign Exam to All (${unassignedCandidates.length})`}
            </button>

            {/* Allow Re-write for All Button */}
            <button
              type="button"
              onClick={handleAllowRewriteAll}
              disabled={isRewritingAll || candidates.length === 0}
              className={`px-4 py-2 font-bold rounded-lg transition flex items-center text-sm shadow-xs cursor-pointer active:scale-95 ${
                candidates.length === 0
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
              title={candidates.length === 0 ? 'No candidates assigned to re-write' : 'Allow all assigned candidates to re-write'}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {isRewritingAll ? 'Granting...' : 'Allow Re-write for All'}
            </button>

            {/* Total Assigned Counter Badge */}
            <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-bold border border-slate-200 text-sm">
              {candidates.length} Assigned
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Available Users List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div className="flex items-center space-x-2.5">
                {/* Select All Checkbox */}
                {filteredUnassigned.length > 0 && (
                  <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-bold text-slate-600 mr-1 select-none" title="Select / Deselect all unassigned candidates">
                    <input 
                      type="checkbox"
                      checked={filteredUnassigned.length > 0 && filteredUnassigned.every(u => selectedCandidateIds.has(u._id))}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="hidden sm:inline">Select All</span>
                  </label>
                )}
                <span>Available Candidates</span>
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {filteredUsers.length}
                </span>
                {searchQuery && filteredUnassigned.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAssignAll(filteredUnassigned)}
                    disabled={isAssigningAll}
                    className="text-xs text-blue-600 hover:text-blue-800 underline font-semibold ml-1 cursor-pointer"
                  >
                    Assign Filtered ({filteredUnassigned.length})
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text" 
                  placeholder="Search name or email..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(sanitizeSearchInput(e.target.value))}
                  className="pl-9 pr-8 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-56 font-normal bg-white" 
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Selection Action Bar (Shown when 1 or more candidates are selected) */}
            {selectedCandidateIds.size > 0 && (
              <div className="px-4 py-2.5 bg-blue-50/90 border-b border-blue-200 flex items-center justify-between animate-fadeIn text-xs">
                <div className="flex items-center space-x-2 text-blue-900 font-bold">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  <span>{selectedCandidateIds.size} Candidate{selectedCandidateIds.size !== 1 ? 's' : ''} Selected</span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedCandidateIds(new Set())}
                    className="text-blue-600 hover:text-blue-800 underline font-semibold ml-2 cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAssignSelected}
                  disabled={isAssigningSelected}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-2xs flex items-center cursor-pointer active:scale-95 disabled:opacity-50 text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  {isAssigningSelected ? 'Assigning...' : `Assign Selected (${selectedCandidateIds.size})`}
                </button>
              </div>
            )}

            <div className="overflow-y-auto max-h-[500px]">
              {filteredUsers.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  {searchQuery ? `No candidates matching "${searchQuery}"` : 'No candidates available.'}
                </div>
              ) : (
                filteredUsers.map(user => {
                  const assigned = isAssigned(user._id);
                  const isSelected = selectedCandidateIds.has(user._id);

                  return (
                    <div 
                      key={user._id} 
                      className={`flex items-center justify-between p-3.5 border-b border-slate-100 transition ${
                        assigned 
                          ? 'bg-slate-50/50 opacity-80' 
                          : isSelected 
                          ? 'bg-blue-50/60 border-blue-100' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        {/* Select Box Checkbox */}
                        {!assigned ? (
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectCandidate(user._id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                            title={`Select ${user.name}`}
                          />
                        ) : (
                          <div className="w-4 h-4 rounded bg-slate-200 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-3 h-3 text-emerald-700" />
                          </div>
                        )}

                        <div 
                          className={`min-w-0 flex-1 select-none ${!assigned ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (!assigned) toggleSelectCandidate(user._id);
                          }}
                        >
                          <p className="font-bold text-slate-800 text-sm truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="shrink-0 ml-3">
                        {assigned ? (
                          <span className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-700" /> Assigned
                          </span>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => handleAssign(user._id)} 
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center shadow-2xs cursor-pointer active:scale-95"
                          >
                            <UserPlus className="w-3.5 h-3.5 mr-1" /> Assign
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Assigned Candidates */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-emerald-50 font-bold text-emerald-700 flex justify-between items-center">
              <span>Assigned to Exam</span>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                {candidates.length}
              </span>
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
                    <div className="flex items-center space-x-2">
                      {['COMPLETED', 'TERMINATED', 'EXPIRED'].includes(assignment.status) && (
                        <button 
                          type="button"
                          onClick={() => handleAllowRewrite(assignment.candidateId?._id || assignment.candidateId?.id)}
                          className="px-2.5 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs font-bold rounded-md transition cursor-pointer"
                        >
                          Allow Re-write
                        </button>
                      )}
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                        {assignment.status}
                      </span>
                      <button 
                        type="button"
                        onClick={() => handleUnassign(assignment.candidateId?._id || assignment.candidateId?.id)}
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold rounded-md transition ml-1 cursor-pointer"
                      >
                        Remove
                      </button>
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
    <Suspense fallback={<div className="p-10 font-bold text-center">Loading...</div>}>
      <CandidateAssignmentContent />
    </Suspense>
  );
}
