import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 py-4 px-8 flex justify-between items-center shadow-sm">
        <Link href="/" className="flex items-center space-x-2 text-blue-700">
          <ShieldCheck className="w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">SecureAssess</span>
        </Link>
        <nav className="space-x-6">
          <Link href="/login" className="text-slate-600 font-medium hover:text-blue-600 transition-colors">Login</Link>
        </nav>
      </header>
      
      <main className="flex-1 py-16 px-6 sm:px-12 max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-6">About SecureAssess</h1>
        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          SecureAssess is a next-generation platform designed to maintain the highest levels of integrity for remote examinations. 
          By combining AI-driven environmental monitoring, continuous face detection, and a locked-down browser environment, 
          we ensure that aptitude tests and academic assessments remain fair for everyone.
        </p>

        <h2 className="text-2xl font-bold text-slate-800 mt-12 mb-4">How It Works</h2>
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-blue-700 mb-2 text-lg">1. System Readiness Verification</h3>
            <p className="text-slate-600">Before an exam begins, candidates go through a rigorous technical check ensuring their camera, microphone, screen-sharing, and network meet proctoring standards.</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-emerald-700 mb-2 text-lg">2. Continuous Monitoring</h3>
            <p className="text-slate-600">During the exam, AI monitors the candidate&apos;s environment. Flags are generated for suspicious activities like looking away, mobile phone usage, or background noise.</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-indigo-700 mb-2 text-lg">3. Human-in-the-Loop Review</h3>
            <p className="text-slate-600">Administrators and Proctors receive real-time notifications via a Live Monitoring Dashboard, allowing them to review evidence, message the candidate, or pause the session.</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/" className="inline-flex items-center font-bold text-blue-600 hover:text-blue-700">
            Return to Homepage <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
