import React from 'react';
import Link from 'next/link';
import { ShieldCheck, UserCheck, MonitorPlay, Lock } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <header className="bg-white border-b border-slate-200 py-4 px-8 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-2 text-blue-700">
          <ShieldCheck className="w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">SecureAssess</span>
        </div>
        <nav className="space-x-6 hidden md:block">
          <Link href="/about" className="text-slate-600 font-medium hover:text-blue-600 transition-colors">How it works</Link>
          <Link href="/organizations" className="text-slate-600 font-medium hover:text-blue-600 transition-colors">For Organizations</Link>
          <Link href="/support" className="text-slate-600 font-medium hover:text-blue-600 transition-colors">Support</Link>
        </nav>
        <div className="space-x-4">
          <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-800 transition-colors">Login</Link>
          <Link href="/register" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-sm">Register</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
            The Gold Standard in <span className="text-blue-600">Secure Assessment</span> & Examination.
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            AI-assisted exam integrity, continuous environmental monitoring, and comprehensive evidence capture to ensure fair and secure testing for organizations worldwide.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <Link href="/login" className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5">
              Candidate Login
            </Link>
            <Link href="/admin/monitoring" className="w-full sm:w-auto px-8 py-4 bg-white text-slate-800 border-2 border-slate-200 rounded-xl font-bold text-lg hover:border-blue-300 hover:bg-slate-50 shadow-sm transition-all flex items-center justify-center">
              <Lock className="w-5 h-5 mr-2 text-slate-500" /> Admin Portal
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mt-24">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
              <UserCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">Identity Verification</h3>
            <p className="text-slate-500 leading-relaxed">Multi-factor authentication combining email OTPs, face verification, and government ID validation.</p>
          </div>
          
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6">
              <MonitorPlay className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">Continuous Monitoring</h3>
            <p className="text-slate-500 leading-relaxed">Real-time analysis of webcam, screen sharing, audio, tab visibility, and browser focus events.</p>
          </div>
          
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">Auditable Evidence</h3>
            <p className="text-slate-500 leading-relaxed">Configurable AI flags linked with encrypted recording snapshots for confident human review.</p>
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 text-center border-t border-slate-800">
        <p>© 2026 SecureAssess Platforms. All rights reserved.</p>
        <p className="text-sm mt-2">Enterprise-grade cheating-risk detection and assessment integrity.</p>
      </footer>
    </div>
  );
}
