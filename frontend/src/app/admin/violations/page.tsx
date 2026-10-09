'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, ShieldAlert, CheckCircle2, Search, Filter } from 'lucide-react';
import api from '@/lib/api';

export default function ViolationQueuePage() {
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchViolations();
  }, []);

  const fetchViolations = async () => {
    try {
      const res = await api.get('/admin/violations');
      setViolations(res.data.violations || []);
    } catch (error) {
      console.error('Failed to fetch violations', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'MEDIUM': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col py-10 px-8">
      <div className="max-w-7xl mx-auto w-full">
        <Link href="/admin/monitoring" className="text-blue-600 font-semibold flex items-center mb-6 hover:underline w-max">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Monitoring
        </Link>
        
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 flex items-center">
              <ShieldAlert className="w-8 h-8 mr-3 text-rose-500" />
              Violation Queue
            </h1>
            <p className="text-slate-500 mt-2 text-lg">Review and manage flagged candidate behavior</p>
          </div>
          
          <div className="flex space-x-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
              <input type="text" placeholder="Search candidate..." className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64" />
            </div>
            <button className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm font-medium">
              <Filter className="w-4 h-4 mr-2" /> Filter
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Loading violations...</div>
          ) : violations.length === 0 ? (
            <div className="p-16 flex flex-col items-center text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">No Violations Found</h3>
              <p className="text-slate-500">All examinations are running smoothly.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm uppercase tracking-wider">
                    <th className="p-4 font-semibold">Date & Time</th>
                    <th className="p-4 font-semibold">Candidate</th>
                    <th className="p-4 font-semibold">Exam</th>
                    <th className="p-4 font-semibold">Violation Type</th>
                    <th className="p-4 font-semibold">Severity</th>
                    <th className="p-4 font-semibold">Action Taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {violations.map((v) => (
                    <tr key={v._id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-600 whitespace-nowrap">
                        {new Date(v.detectedAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{v.candidateId?.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{v.candidateId?.email || 'N/A'}</div>
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-700">
                        {v.attemptId?.examId?.title || 'Unknown Exam'}
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-slate-700">{v.type.replace(/_/g, ' ')}</span>
                        {v.source && <span className="ml-2 text-[10px] uppercase font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{v.source}</span>}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getSeverityColor(v.severity)}`}>
                          {v.severity}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-600 font-medium">
                        {v.actionTaken}
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
