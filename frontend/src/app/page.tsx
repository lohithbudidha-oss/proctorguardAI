'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, UserCheck, MonitorPlay } from 'lucide-react';
import { getBaseURL } from '@/lib/api';

import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';

export default function LandingPage() {
  // Background wake-up ping to ensure backend is fully warm and awake before user logs in
  React.useEffect(() => {
    try {
      fetch(`${getBaseURL()}/health`, { method: 'GET' }).catch(() => {});
    } catch {}
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white">
      <PublicNavbar activePage="home" />

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 bg-white w-full overflow-hidden">
        <div className="w-full max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
            The Gold Standard in <span className="text-blue-600">Secure Assessment</span> & Examination.
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            AI-assisted exam integrity, continuous environmental monitoring, and comprehensive evidence capture to ensure fair and secure testing for organizations worldwide.
          </p>
          
          <div className="flex items-center justify-center">
            <Link 
              href="/login" 
              className="w-full sm:w-auto min-w-[220px] px-9 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-200 text-center inline-flex items-center justify-center"
            >
              Candidate Login
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto mt-24">
          <Link href="/about" className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col items-center text-center group cursor-pointer">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
              <UserCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">How It Works</h3>
            <p className="text-slate-500 leading-relaxed text-sm">Multi-factor authentication combining email OTPs, face verification, and government ID validation.</p>
          </Link>
          
          <Link href="/organizations" className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex flex-col items-center text-center group cursor-pointer">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
              <MonitorPlay className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-emerald-700 transition-colors">For Organizations</h3>
            <p className="text-slate-500 leading-relaxed text-sm">Real-time analysis of webcam, screen sharing, audio, tab visibility, and browser focus events.</p>
          </Link>
          
          <Link href="/support" className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col items-center text-center group cursor-pointer">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">Support & Help</h3>
            <p className="text-slate-500 leading-relaxed text-sm">Configurable AI flags linked with encrypted recording snapshots for confident human review.</p>
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
