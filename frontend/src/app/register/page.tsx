'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import { ShieldCheck, Mail, Lock, User, ArrowRight, Activity, BookOpen, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

// Comprehensive emoji detection regex
const EMOJI_REGEX = /[\uFE00-\uFE0F\u200D\u20E3]|\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/u;
const EMOJI_GLOBAL_REGEX = /[\uFE00-\uFE0F\u200D\u20E3]|\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/gu;

// Comprehensive candidate email validation helper strictly accepting @gmail.com only
export function validateCandidateEmail(val: string): { isValid: boolean; message: string } {
  const trimmed = val.trim();
  if (!trimmed) {
    return { isValid: false, message: 'Email address is required.' };
  }
  if (EMOJI_REGEX.test(trimmed)) {
    return { isValid: false, message: 'Email address cannot contain emojis.' };
  }
  if (/\s/.test(trimmed)) {
    return { isValid: false, message: 'Email address cannot contain spaces.' };
  }
  if (!trimmed.includes('@')) {
    return { isValid: false, message: 'Email must contain "@gmail.com" (e.g. candidate@gmail.com).' };
  }
  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { isValid: false, message: 'Email can only contain one "@" symbol.' };
  }
  const [localPart, domainPart] = parts;
  if (!localPart || localPart.length === 0) {
    return { isValid: false, message: 'Please enter a username before "@gmail.com".' };
  }
  if (domainPart.toLowerCase() !== 'gmail.com') {
    return { isValid: false, message: 'Only @gmail.com email addresses are accepted (e.g. candidate@gmail.com).' };
  }
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
  if (!gmailRegex.test(trimmed)) {
    return { isValid: false, message: 'Please enter a valid Gmail address (e.g. candidate@gmail.com).' };
  }
  return { isValid: true, message: '' };
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const emailValidation = validateCandidateEmail(email);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Strict client-side email validation check
    const validation = validateCandidateEmail(email);
    if (!validation.isValid) {
      setEmailTouched(true);
      setError(validation.message);
      return;
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', { 
        name: name.trim(), 
        email: email.trim().toLowerCase(), 
        password 
      });
      router.push('/login?registered=true');
    } catch (err: any) {
      if (err.response?.data?.errors?.length > 0) {
        const issues = err.response.data.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        setError(`Validation error: ${issues}`);
      } else {
        setError(err.response?.data?.message || 'Registration failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12 bg-blue-600 text-white">
        <div className="relative z-10">
          <Link href="/" className="inline-block hover:opacity-95 transition-opacity">
            <BrandLogo size="lg" variant="light" />
          </Link>
        </div>

        <div className="relative z-10 max-w-lg mt-12">
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-6">
            Join the Next-Gen <br/>
            <span className="text-white">
              Candidate Platform
            </span>
          </h1>
          <p className="text-lg text-blue-100 mb-12 leading-relaxed">
            Create your profile to access secure assessments, manage your certifications, and prove your skills in a trusted environment.
          </p>

          <div className="space-y-6">
            <div className="flex items-center space-x-4 text-white bg-blue-700/60 p-4 rounded-xl border border-blue-400/30">
              <div className="bg-blue-800 p-2 rounded-lg text-white"><BookOpen className="w-6 h-6"/></div>
              <div>
                <h3 className="font-semibold text-white">Seamless Testing</h3>
                <p className="text-sm text-blue-100">Modern, distraction-free examination interface</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-white bg-blue-700/60 p-4 rounded-xl border border-blue-400/30">
              <div className="bg-blue-800 p-2 rounded-lg text-white"><ShieldCheck className="w-6 h-6"/></div>
              <div>
                <h3 className="font-semibold text-white">Data Privacy</h3>
                <p className="text-sm text-blue-100">Your biometric and testing data is fully encrypted</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-blue-100 font-medium">
          &copy; 2026 Flair Technologies. All rights reserved.
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 sm:p-12 lg:p-24 relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10">
            <Link href="/" className="inline-block hover:opacity-95 transition-opacity">
              <BrandLogo size="lg" variant="dark" />
            </Link>
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h2>
          <p className="text-slate-500 mb-8 font-medium">Sign up to start taking secure assessments</p>

          <form onSubmit={handleRegister} className="space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md text-sm font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value.replace(EMOJI_GLOBAL_REGEX, ''))}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-900 font-medium placeholder:font-normal"
                  placeholder="John Doe"
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-700">Email Address (@gmail.com only)</label>
                {email && emailValidation.isValid && (
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Valid @gmail.com
                  </span>
                )}
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className={`h-5 w-5 transition-colors ${
                    emailTouched && !emailValidation.isValid
                      ? 'text-rose-500'
                      : email && emailValidation.isValid
                        ? 'text-emerald-700'
                        : 'text-slate-400 group-focus-within:text-blue-500'
                  }`} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => {
                    const clean = e.target.value.replace(EMOJI_GLOBAL_REGEX, '').replace(/\s+/g, '');
                    setEmail(clean);
                    if (!emailTouched && clean.length > 2) {
                      setEmailTouched(true);
                    }
                  }}
                  onBlur={() => setEmailTouched(true)}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 transition-all text-slate-900 font-medium placeholder:font-normal ${
                    emailTouched && !emailValidation.isValid
                      ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-500/20'
                      : email && emailValidation.isValid
                        ? 'border-emerald-500 bg-emerald-50/20 focus:border-emerald-600 focus:ring-emerald-600/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 focus:bg-white focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                  placeholder="candidate@gmail.com"
                  suppressHydrationWarning
                />
                {emailTouched && !emailValidation.isValid && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-rose-500">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                )}
                {email && emailValidation.isValid && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}
              </div>
              {emailTouched && !emailValidation.isValid ? (
                <p className="text-xs text-rose-600 font-medium flex items-center pt-1 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                  {emailValidation.message}
                </p>
              ) : email && emailValidation.isValid ? (
                <p className="text-xs text-emerald-700 font-semibold flex items-center pt-1 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 shrink-0" />
                  Valid @gmail.com address
                </p>
              ) : (
                <p className="text-xs text-slate-400 pt-0.5">
                  Only @gmail.com email addresses are accepted for candidate accounts.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
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
              <p className="text-xs text-slate-500 pt-1">Password must contain at least 8 characters</p>
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
                  <span>Creating Account...</span>
                </div>
              ) : (
                <>
                  Register <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500 font-medium">
                Already have an account?{' '}
                <Link href="/login" className="font-bold text-blue-600 hover:text-blue-500 transition-colors">
                  Sign in here
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
