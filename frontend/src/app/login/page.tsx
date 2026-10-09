'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, ArrowRight, Fingerprint, Activity, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      
      localStorage.setItem('token', token);
      
      if (user.role === 'CANDIDATE') {
        router.push('/candidate/dashboard');
      } else {
        router.push('/admin/monitoring');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0B0F19]">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] z-0" />
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl animate-pulse delay-1000" />
        
        <div className="relative z-10 flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">ProctorGuard AI</span>
        </div>

        <div className="relative z-10 max-w-lg mt-12">
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-6">
            Secure, Intelligent <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Remote Proctoring
            </span>
          </h1>
          <p className="text-lg text-slate-400 mb-12 leading-relaxed">
            State-of-the-art examination integrity platform trusted by enterprises worldwide. Verify identities, monitor behavior, and protect your assessments with advanced AI.
          </p>

          <div className="space-y-6">
            <div className="flex items-center space-x-4 text-slate-300 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="bg-slate-800 p-2 rounded-lg text-blue-400"><Fingerprint className="w-6 h-6"/></div>
              <div>
                <h3 className="font-semibold text-white">Biometric Verification</h3>
                <p className="text-sm text-slate-400">Military-grade identity matching</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-slate-300 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="bg-slate-800 p-2 rounded-lg text-indigo-400"><Activity className="w-6 h-6"/></div>
              <div>
                <h3 className="font-semibold text-white">Live Monitoring Engine</h3>
                <p className="text-sm text-slate-400">Real-time behavior analysis and alerts</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-500 font-medium">
          &copy; 2026 ProctorGuard AI Technologies. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 sm:p-12 lg:p-24 relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center space-x-3 mb-10">
            <div className="bg-blue-600 p-2 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">ProctorGuard AI</span>
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-slate-500 mb-8 font-medium">Sign in to your account to continue</p>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md text-sm font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-900 font-medium placeholder:font-normal"
                  placeholder="admin@example.com"
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-500">Forgot password?</a>
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
                  className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-900 font-medium placeholder:font-normal"
                  placeholder="••••••••"
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
            
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500 font-medium">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-bold text-blue-600 hover:text-blue-500 transition-colors">
                  Create an account
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
