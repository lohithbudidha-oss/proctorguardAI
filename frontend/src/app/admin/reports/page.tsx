'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function IntegrityReportsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-20">
      <div className="max-w-3xl w-full px-6">
        <Link href="/admin/monitoring" className="text-blue-600 font-bold flex items-center mb-10 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Monitoring
        </Link>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center text-center">
          <div className="bg-emerald-100 p-4 rounded-full mb-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 mb-4">Integrity Reports</h1>
          <p className="text-slate-500 text-lg mb-8 max-w-lg">
            This module is currently under development. Soon you will be able to generate and export comprehensive exam integrity reports and audit logs.
          </p>
          <div className="bg-slate-50 text-slate-400 font-mono text-sm px-4 py-2 rounded-lg border border-slate-200">
            Status: Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
