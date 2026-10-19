'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import FlyhiiBranding from '@/components/FlyhiiBranding';
import { ShieldCheck, Mail, Lock, ArrowRight, ArrowLeft, Fingerprint, Activity, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

// Comprehensive Emoji Regex matching pictographic symbols, emojis, flags, symbols, and surrogate pairs
const EMOJI_REGEX = /[\uFE00-\uFE0F\u200D\u20E3]|\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/u;
const EMOJI_GLOBAL_REGEX = /[\uFE00-\uFE0F\u200D\u20E3]|\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/gu;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  const isAdminLogin = roleParam === 'admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (token && userStr) {
      try {
        const u = JSON.parse(userStr);
        if (isAdminLogin && (u.role === 'ADMIN' || u.role === 'PROCTOR')) {
          router.replace('/admin/monitoring');
        } else if (!isAdminLogin && u.role === 'CANDIDATE') {
          router.replace('/candidate/dashboard');
        }
      } catch (e) {}
    }
  }, [isAdminLogin, router]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (EMOJI_REGEX.test(rawVal)) {
      setEmailError('Emojis are not accepted in the email address.');
      setTimeout(() => setEmailError(''), 3500);
    } else {
      if (emailError) setEmailError('');
    }
    // Reject emojis immediately: strip all emojis and spaces
    const cleanVal = rawVal.replace(EMOJI_GLOBAL_REGEX, '').replace(/\s+/g, '');
    setEmail(cleanVal);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalized = email.trim().toLowerCase();

    if (EMOJI_REGEX.test(normalized)) {
      setError('Email address cannot contain emojis.');
      return;
    }

    if (isAdminLogin) {
      if (normalized !== 'admin@proctorguard.local') {
        setError('Admin Portal accepts authorized administrator credentials only. Candidate credentials cannot be used here.');
        return;
      }
    } else {
      if (normalized === 'admin@proctorguard.local') {
        setError('Administrator credentials cannot be used for candidate login. Please use the Administrator Sign In portal.');
        return;
      }
      if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(normalized)) {
        setError('Candidate login accepts candidate @gmail.com email addresses only (e.g. user@gmail.com).');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/login', { 
        email: normalized, 
        password: password.trim(),
        portalRole: isAdminLogin ? 'ADMIN' : 'CANDIDATE'
      });
      const { token, user } = res.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      if (user.role === 'CANDIDATE') {
        router.push('/candidate/dashboard');
      } else {
        router.push('/admin/monitoring');
      }
    } catch (err: unknown) {
      const axiosErr = err as { code?: string; message?: string; response?: { status?: number; data?: { message?: string } } };
      const serverMsg = axiosErr.response?.data?.message;
      if (serverMsg) {
        setError(serverMsg);
      } else if (axiosErr.code === 'ECONNABORTED' || axiosErr.message?.includes('timeout')) {
        setError('Connection timed out. The server is warming up, please click Sign In again.');
      } else if (!axiosErr.response) {
        setError('Authentication service is unreachable. Please verify your network connection and try again.');
      } else {
        setError('Invalid credentials. Please verify your email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12 bg-blue-600 text-white">
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="inline-block hover:opacity-95 transition-opacity">
            <BrandLogo size="lg" variant="light" />
          </Link>
          <FlyhiiBranding variant="light" size="md" />
        </div>

        <div className="relative z-10 max-w-lg mt-12">
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-6">
            Secure, Intelligent <br/>
            <span className="text-white">
              Remote Proctoring
            </span>
          </h1>
          <p className="text-lg text-blue-100 mb-12 leading-relaxed">
            State-of-the-art examination integrity platform trusted by enterprises worldwide. Verify identities, monitor behavior, and protect your assessments with advanced AI.
          </p>

          <div className="space-y-4">
            <div className="flex items-center space-x-4 text-white bg-blue-700/60 p-4 rounded-xl border border-blue-400/30">
              <div className="bg-blue-800 p-2 rounded-lg text-white"><Fingerprint className="w-6 h-6"/></div>
              <div>
                <h3 className="font-semibold text-white">Biometric Verification</h3>
                <p className="text-sm text-blue-100">Military-grade identity matching</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-white bg-blue-700/60 p-4 rounded-xl border border-blue-400/30">
              <div className="bg-blue-800 p-2 rounded-lg text-white"><Activity className="w-6 h-6"/></div>
              <div>
                <h3 className="font-semibold text-white">Live Monitoring Engine</h3>
                <p className="text-sm text-blue-100">Real-time behavior analysis and alerts</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-blue-100 font-medium">
          &copy; 2026 ProctorGuardAI Technologies. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 sm:p-12 lg:p-24 relative">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <Link 
              href="/" 
              className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" /> 
              Back to Home
            </Link>
          </div>

          <div className="lg:hidden mb-8 flex items-center justify-between flex-wrap gap-3">
            <Link href="/" className="inline-block hover:opacity-95 transition-opacity">
              <BrandLogo size="lg" variant="dark" />
            </Link>
            <FlyhiiBranding variant="dark" size="md" />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            {isAdminLogin ? (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold shadow-xs">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Administrator Portal</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Candidate Portal</span>
              </div>
            )}
            <FlyhiiBranding variant="dark" size="md" className="hidden lg:inline-flex" />
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            {isAdminLogin ? 'Administrator Sign In' : 'Candidate Sign In'}
          </h2>
          <p className="text-slate-500 mb-8 font-medium">
            {isAdminLogin ? 'Sign in with your administrative credentials' : 'Sign in to access your assigned examinations'}
          </p>

          {searchParams.get('registered') === 'true' && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3.5 rounded-xl text-sm font-medium mb-6 flex items-start space-x-2.5 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900">Registration Submitted Successfully!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Your candidate account has been created and is currently awaiting administrator approval. You will be able to sign in once approved by an administrator in the admin portal.
                </p>
              </div>
            </div>
          )}

          {searchParams.get('ticketSubmitted') === 'true' && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3.5 rounded-xl text-sm font-medium mb-6 flex items-start space-x-2.5 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900">Support Inquiry Received!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Our proctoring support desk has received your response. Sign in with your candidate email to access your examinations and dashboard.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6" autoComplete="off">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md text-sm font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className={`h-5 w-5 transition-colors ${
                    emailError ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-blue-500'
                  }`} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="off"
                  className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 transition-all font-medium placeholder:font-normal ${
                    emailError
                      ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-900 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                  placeholder={isAdminLogin ? "" : "candidate@gmail.com"}
                  suppressHydrationWarning
                />
              </div>
              {emailError && (
                <p className="text-xs text-rose-600 font-medium flex items-center pt-1 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                {!isAdminLogin && (
                  <Link href="/support" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-900 font-medium placeholder:font-normal"
                  placeholder=""
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
              suppressHydrationWarning
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  <span>Authenticating...</span>
                </div>
              ) : (
                <>
                  Sign In <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            
            {isAdminLogin ? (
              <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400 font-medium">
                  Administrative access accepts authorized admin credentials only.
                </p>
                <div className="mt-2.5">
                  <Link href="/login" className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                    Candidate Sign In &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-3">
                <p className="text-sm text-slate-500 font-medium">
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="font-bold text-blue-600 hover:text-blue-500 transition-colors">
                    Sign up
                  </Link>
                </p>
                <div>
                  <Link href="/login?role=admin" className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors">
                    Sign in as Administrator &rarr;
                  </Link>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
