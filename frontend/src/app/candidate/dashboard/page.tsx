'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, FileText, CheckCircle2, Clock, Calendar, ArrowRight, Bell, UserCircle } from 'lucide-react';
import api from '@/lib/api';

export default function CandidateDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const [exams, setExams] = useState<{ id: string; title: string; duration: number; status: string; scheduledFor: string; resultStatus?: string; attemptId?: string }[]>([]);

  const notifications = exams.flatMap(exam => {
    const notifs = [];
    if (exam.status === 'AVAILABLE') {
      notifs.push({ id: `${exam.id}-avail`, title: 'Exam Available', message: `You can now take "${exam.title}".` });
    }
    if (exam.resultStatus === 'APPROVED') {
      notifs.push({ id: `${exam.id}-res`, title: 'Result Published', message: `Your result for "${exam.title}" is ready.` });
    }
    return notifs;
  });

  useEffect(() => {
    // Check auth token
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    // Defer state updates out of render cycle to avoid cascading renders
    const t = setTimeout(() => {
      setLoading(false);
      setCurrentTime(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    }, 0);

    api.get('/candidate/exams').then((res: { data: { exams?: { id: string; title: string; duration: number; status: string; scheduledFor: string; resultStatus?: string; attemptId?: string }[] } }) => {
      const fetchedExams = res.data?.exams || [];
      setExams(fetchedExams);
    }).catch(err => console.error('Error fetching exams:', err));

    return () => clearTimeout(t);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-blue-200">
      {/* Enterprise Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">ProctorGuard <span className="text-blue-600">Candidate</span></span>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-slate-400 hover:text-blue-600 transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 overflow-hidden transform origin-top-right transition-all">
                  <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Notifications</h3>
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{notifications.length} New</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">
                        You have no new notifications.
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div key={notif.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                          <p className="text-sm font-bold text-slate-800">{notif.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center space-x-3 group cursor-pointer" onClick={handleLogout}>
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Sign Out</p>
                <p className="text-xs text-slate-500 font-medium">{currentTime}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 group-hover:border-blue-300 transition-colors">
                <UserCircle className="w-6 h-6 text-slate-500 group-hover:text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back!</h1>
            <p className="text-slate-500 mt-2 text-lg">You have <span className="font-bold text-blue-600">{exams.filter(e => e.status === 'AVAILABLE').length}</span> assessment ready to take.</p>
          </div>
          <div className="bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-semibold text-slate-700">System security active</span>
          </div>
        </div>
        
        {/* Assessment Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <div 
              key={exam.id} 
              className={`bg-white rounded-2xl border transition-all duration-300 flex flex-col group ${
                exam.status === 'AVAILABLE' 
                  ? 'border-blue-200 shadow-[0_8px_30px_rgba(37,99,235,0.08)] hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(37,99,235,0.12)]' 
                  : 'border-slate-200 shadow-sm hover:shadow-md opacity-80 hover:opacity-100'
              }`}
            >
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-xl ${exam.status === 'AVAILABLE' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : exam.status === 'COMPLETED' ? 'bg-slate-800' : 'bg-slate-100 border border-slate-200'}`}>
                    <FileText className={`w-6 h-6 ${exam.status === 'AVAILABLE' || exam.status === 'COMPLETED' ? 'text-white' : 'text-slate-500'}`} />
                  </div>
                  {exam.status === 'AVAILABLE' ? (
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse"></span> Available Now
                    </span>
                  ) : exam.status === 'COMPLETED' ? (
                    <span className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center shadow-inner">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold uppercase tracking-wider rounded-lg">
                      Scheduled
                    </span>
                  )}
                </div>

                <h3 className={`text-xl font-extrabold mb-4 leading-tight ${exam.status === 'COMPLETED' ? 'text-slate-600 line-through decoration-slate-300' : 'text-slate-900'}`}>{exam.title}</h3>
                
                <div className="space-y-3 mt-4">
                  <div className="flex items-center text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <Clock className={`w-4 h-4 mr-3 ${exam.status === 'COMPLETED' ? 'text-slate-400' : 'text-blue-500'}`} /> {exam.duration} Minutes Duration
                  </div>
                  <div className="flex items-center text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <CheckCircle2 className={`w-4 h-4 mr-3 ${exam.status === 'COMPLETED' ? 'text-slate-400' : 'text-emerald-500'}`} /> AI-Proctored Session
                  </div>
                  <div className="flex items-center text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <Calendar className={`w-4 h-4 mr-3 ${exam.status === 'COMPLETED' ? 'text-slate-400' : 'text-indigo-500'}`} /> {new Date(exam.scheduledFor).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                {exam.status === 'COMPLETED' ? (
                  exam.resultStatus === 'APPROVED' ? (
                    <Link 
                      href={`/candidate/exams/${exam.id}/result/${exam.attemptId}`}
                      className="flex items-center justify-center w-full py-3.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition-all"
                    >
                      View Results
                    </Link>
                  ) : exam.resultStatus === 'REJECTED' ? (
                    <div className="flex items-center justify-center w-full py-3.5 rounded-xl font-bold bg-rose-100 text-rose-700 cursor-not-allowed shadow-inner border border-rose-200">
                      Results Rejected
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full py-3.5 rounded-xl font-bold bg-amber-100 text-amber-700 cursor-not-allowed shadow-inner border border-amber-200">
                      Pending Verification
                    </div>
                  )
                ) : (
                  <Link 
                    href={`/candidate/exams/${exam.id}/system-check`}
                    className={`flex items-center justify-center w-full py-3.5 rounded-xl font-bold transition-all ${
                      exam.status === 'AVAILABLE' 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg hover:shadow-blue-600/20' 
                        : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {exam.status === 'AVAILABLE' ? (
                      <>Start System Check <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></>
                    ) : (
                      'View Details'
                    )}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
