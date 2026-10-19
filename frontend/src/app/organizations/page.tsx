'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  ArrowRight, 
  Building2, 
  GraduationCap, 
  Briefcase, 
  Award, 
  CheckCircle2, 
  Lock, 
  Users, 
  HardDrive, 
  BarChart3, 
  ArrowLeft 
} from 'lucide-react';

import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';

export default function OrganizationsPage() {
  const router = useRouter();

  const handleAdminPortalClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    let isAdmin = false;
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.role === 'ADMIN' || payload.role === 'PROCTOR') {
            isAdmin = !payload.exp || (payload.exp * 1000 > Date.now());
          }
        }
      } catch (err) {}
    }

    if (isAdmin) {
      router.push('/admin/monitoring');
    } else {
      router.push('/login?role=admin');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <PublicNavbar activePage="organizations" />

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 px-6 sm:px-12 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 border border-blue-200 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider mb-6">
            <Building2 className="w-4 h-4" />
            <span>Institutional & Enterprise Proctored Assessments</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
            Enterprise Assessment Integrity for <br />
            <span className="text-blue-600">Universities, Recruiters & Certifications</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-10">
            Scale high-stakes online examinations with confidence. ProctorGuardAI empowers organizations to conduct fair, cheat-resistant examinations with automated AI supervision, live proctor dashboards, and auditable proof archiving.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleAdminPortalClick}
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-base hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center cursor-pointer"
            >
              <Lock className="w-4 h-4 mr-2" />
              Access Organization Portal
            </button>
            <Link
              href="/support"
              className="w-full sm:w-auto px-8 py-3.5 bg-white text-slate-800 border border-slate-300 rounded-xl font-bold text-base hover:bg-slate-100 hover:border-slate-400 transition-all shadow-xs flex items-center justify-center"
            >
              Contact Solutions Team
            </Link>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-16 bg-white border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-6 sm:px-12">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Built for Mission-Critical Testing</h2>
              <p className="text-slate-500 mt-2 text-base">Explore how different institutions utilize ProctorGuardAI to maintain assessment credibility.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Higher Education */}
              <div className="bg-white rounded-2xl p-7 border border-slate-200 hover:border-blue-300 transition-all shadow-2xs">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Colleges & Universities</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Conduct semester midterms, final examinations, and remote entrance tests with automated candidate verification, multi-question randomized banks, and immediate cheating deterrence.
                </p>
                <ul className="text-xs text-slate-700 space-y-2 font-medium">
                  <li className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" /> Timed auto-submission upon expiry</li>
                  <li className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" /> Detailed exam violation logs</li>
                  <li className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" /> Candidate photo identity verification</li>
                </ul>
              </div>

              {/* Recruitment */}
              <div className="bg-white rounded-2xl p-7 border border-slate-200 hover:border-emerald-300 transition-all shadow-2xs">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center mb-5">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Corporate Hiring & Talent</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Screen software engineers and knowledge workers accurately. Eliminate unauthorized external AI tab browsing, second monitors, and candidate impersonation during pre-employment assessments.
                </p>
                <ul className="text-xs text-slate-700 space-y-2 font-medium">
                  <li className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 mr-2 shrink-0" /> Fullscreen browser enforcement</li>
                  <li className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 mr-2 shrink-0" /> Live screen broadcast capture</li>
                  <li className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 mr-2 shrink-0" /> Automated scoring & instant analytics</li>
                </ul>
              </div>

              {/* Certification Bodies */}
              <div className="bg-white rounded-2xl p-7 border border-slate-200 hover:border-blue-300 transition-all shadow-2xs">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Certification Authorities</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Protect credential values and accreditation standards with tamper-evident audit trails, permanent cloud snapshots, and verifiable candidate integrity records.
                </p>
                <ul className="text-xs text-slate-700 space-y-2 font-medium">
                  <li className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" /> Google Drive evidence archiving</li>
                  <li className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" /> Reviewable violation queue</li>
                  <li className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" /> Result approval & reject verification</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="py-16 px-6 sm:px-12 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Enterprise Infrastructure Features</h2>
            <p className="text-slate-500 mt-2">Comprehensive proctoring features engineered for administrators.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base mb-1">Batch Candidate Assignment</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Bulk assign registered candidate batches to assessments with custom time allocations, rewrite authorizations, and candidate email tracking.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base mb-1">Google Drive Cloud Vault</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Every violation snapshot is automatically synchronized to dedicated organizational Google Drive folders for transparent compliance and audit reviews.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base mb-1">Live Candidate Monitoring Feed</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  View realtime candidate examination statuses, active timers, flag tallies, and screen telemetry without interrupting ongoing candidate sessions.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-start space-x-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base mb-1">Automated AI Vision Proctor</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  On-device and cloud neural networks detect multiple individuals, face obstruction, gaze aversion, and tab switching in under 500 milliseconds.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
