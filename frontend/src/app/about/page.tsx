import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, UserCheck, MonitorPlay, Eye } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <PublicNavbar activePage="about" />
      
      <main className="flex-1 py-16 px-6 sm:px-12 max-w-4xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 border border-blue-200 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider mb-5">
            <ShieldCheck className="w-4 h-4" />
            <span>Integrity Architecture</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            How ProctorGuardAI Works
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            ProctorGuardAI is a next-generation remote proctoring platform designed to ensure fair, cheat-resistant examinations using real-time browser security, computer vision, and secure evidence storage.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-5">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 mt-1">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-2 text-xl">1. System Readiness Verification</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Before an exam begins, candidates undergo a structured technical check ensuring their camera, microphone, screen-sharing, and network meet proctoring standards.
              </p>
            </div>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-5">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center shrink-0 mt-1">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-2 text-xl">2. Continuous Environmental AI Monitoring</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                During the assessment, AI monitors the candidate&apos;s environment in real-time. Flags are captured with encrypted visual snapshots for suspicious activities like looking away, multiple faces, mobile devices, or window focus losses.
              </p>
            </div>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-5">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 mt-1">
              <MonitorPlay className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-2 text-xl">3. Real-Time Proctor Supervision & Google Drive Archive</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Administrators supervise candidates through a live telemetry dashboard, receive immediate violation alerts, review snapshot evidence stored in Google Drive Cloud Vault, and can pause or message test-takers on the fly.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-14 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link 
            href="/register" 
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-sm text-sm"
          >
            Create Candidate Account
          </Link>
          <Link 
            href="/" 
            className="w-full sm:w-auto px-6 py-3 bg-white text-slate-700 font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs text-sm inline-flex items-center justify-center"
          >
            Return to Homepage <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
