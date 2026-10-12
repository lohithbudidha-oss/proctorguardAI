'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileText, Check, X, ShieldAlert, ExternalLink, HardDrive } from 'lucide-react';
import api from '@/lib/api';

export default function ResultsVerificationPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const res = await api.get('/admin/results');
      setResults(res.data.results || []);
    } catch (error) {
      console.error('Failed to fetch results', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyResult = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.patch(`/admin/results/${id}/verify`, { status });
      fetchResults();
    } catch (error) {
      console.error('Failed to verify result', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col py-10 px-8">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <Link href="/admin/monitoring" className="text-blue-600 font-semibold flex items-center hover:underline w-max">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Candidates
          </Link>

          <a 
            href="https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            <HardDrive className="w-4 h-4 mr-2" />
            Open Google Drive Folder
            <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-80" />
          </a>
        </div>
        
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 flex items-center">
              <FileText className="w-8 h-8 mr-3 text-blue-500" />
              Results & Verification
            </h1>
            <p className="text-slate-500 mt-2 text-lg">Verify candidate exam results, submitted answers, and violations linked to Google Drive</p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-800 flex items-center">
            <HardDrive className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" />
            <span>Drive Folder ID: <strong className="font-mono">1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1</strong></span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Loading results...</div>
          ) : results.length === 0 ? (
            <div className="p-16 flex flex-col items-center text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">No Results Found</h3>
              <p className="text-slate-500">No candidates have completed exams yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm uppercase tracking-wider">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Candidate</th>
                    <th className="p-4 font-semibold">Exam</th>
                    <th className="p-4 font-semibold">Score</th>
                    <th className="p-4 font-semibold">Violations</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-600 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{r.candidateId?.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{r.candidateId?.email || 'N/A'}</div>
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-700">
                        {r.examId?.title || 'Unknown Exam'}
                      </td>
                      <td className="p-4">
                        <span className={`font-bold ${r.pass ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {r.percentage.toFixed(1)}%
                        </span>
                        <div className="text-xs text-slate-500">{r.obtainedMarks}/{r.totalMarks} Marks</div>
                      </td>
                      <td className="p-4">
                        {r.violations > 0 ? (
                          <div className="flex items-center text-rose-600 font-bold">
                            <ShieldAlert className="w-4 h-4 mr-1" />
                            {r.violations}
                          </div>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                          r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          r.status === 'REJECTED' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                          'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <a
                          href={r.driveReportUrl || r.driveFolderUrl || 'https://drive.google.com/drive/folders/1P_3yKzFloiMrF8Pe1XFl9Lh-nqvPTit1?usp=sharing'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center transition-colors"
                          title="View candidate answers sheet and proctoring report on Google Drive"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1 text-blue-600" />
                          Answers (Drive)
                          <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                        </a>
                        {r.status === 'PENDING' && (
                          <>
                            <button 
                              onClick={() => verifyResult(r._id, 'APPROVED')}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium transition-colors inline-flex items-center ml-2"
                            >
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </button>
                            <button 
                              onClick={() => verifyResult(r._id, 'REJECTED')}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-sm font-medium transition-colors inline-flex items-center ml-2"
                            >
                              <X className="w-4 h-4 mr-1" /> Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
