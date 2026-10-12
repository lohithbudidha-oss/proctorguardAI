'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, FileText, CheckCircle2, Clock, Calendar, ArrowRight, Bell, UserCircle, LogOut, X, Search } from 'lucide-react';
import api from '@/lib/api';

export default function CandidateDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notificationRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<{ name?: string; email?: string } | null>(null);
  const [exams, setExams] = useState<{ id: string; title: string; duration: number; status: string; scheduledFor: string; resultStatus?: string; attemptId?: string }[]>([]);

  const filteredExams = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return exams;
    return exams.filter(e => {
      const blob = `${e.title || ''} ${e.status || ''} ${e.duration} min mins minutes`.toLowerCase();
      return tokens.every(t => blob.includes(t));
    });
  }, [exams, searchQuery]);

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

    try {
      const u = localStorage.getItem('user');
      if (u) setCurrentUser(JSON.parse(u));
    } catch (e) {}

    return () => clearTimeout(t);
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showNotifications]);

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
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">ProctorGuardAI</span>
          </div>
          
          <div className="flex items-center space-x-6">
            <div ref={notificationRef} className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-slate-400 hover:text-blue-600 transition-colors relative p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute 0 top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
                )}
              </button>

              {/* Outside click backdrop */}
              {showNotifications && (
                <div 
                  className="fixed inset-0 z-40 bg-transparent cursor-default" 
                  onClick={() => setShowNotifications(false)} 
                />
              )}

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 overflow-hidden transform origin-top-right transition-all animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{notifications.length} New</span>
                    </div>
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">
                        You have no new notifications.
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => setShowNotifications(false)}
                          className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <p className="text-sm font-bold text-slate-800">{notif.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                  <UserCircle className="w-5 h-5 text-slate-600" />
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{currentUser?.name || 'Candidate'}</p>
                  <p className="text-[11px] text-slate-500 font-medium truncate max-w-[160px]">{currentUser?.email || currentTime}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-rose-200 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back!</h1>
            <p className="text-slate-500 mt-2 text-lg">You have <span className="font-bold text-blue-600">{exams.filter(e => e.status === 'AVAILABLE').length}</span> assessment ready to take.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search assessments..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-xs"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-2 shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-slate-700">Security active</span>
            </div>
          </div>
        </div>
        
        {/* Assessment Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => (
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

        {exams.length === 0 && (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700">No Assessments Assigned</h3>
            <p className="text-slate-400 text-sm mt-1">You do not have any active examinations assigned right now.</p>
          </div>
        )}

        {exams.length > 0 && filteredExams.length === 0 && (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700">No Assessments Found</h3>
            <p className="text-slate-400 text-sm mt-1">No assessments match your search &quot;{searchQuery}&quot;.</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
            >
              Clear Search
            </button>
          </div>
        )}
      </main>

      {/* Sign Out Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 transform transition-all animate-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <LogOut className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900">Sign Out of Candidate Portal?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Are you sure you want to sign out? You will need to log back in to access your assessments, waiting rooms, or examination results.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 transition-all flex items-center cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
