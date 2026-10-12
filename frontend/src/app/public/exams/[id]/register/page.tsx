'use client';
import React, { useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Mail, User, Phone } from 'lucide-react';
import api from '@/lib/api';
import { validateCandidateEmail } from '@/app/register/page';

function RegistrationForm() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id;
  
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const emailValidation = validateCandidateEmail(formData.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Strict client-side email validation
    const validation = validateCandidateEmail(formData.email);
    if (!validation.isValid) {
      setEmailTouched(true);
      setError(validation.message);
      return;
    }

    setLoading(true);
    
    try {
      const res = await api.post(`/public/exams/${examId}/register`, {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase()
      });
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        // Automatically redirect to the exam system check and start page
        router.push(`/candidate/exams/${examId}/system-check`);
      }
    } catch (err: any) {
      if (err.response?.data?.errors?.length > 0) {
        const issues = err.response.data.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        setError(`Validation error: ${issues}`);
      } else {
        setError(err.response?.data?.message || 'Failed to register for exam.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Exam Registration</h1>
        <p className="text-slate-500 mb-6">Enter your details to create your candidate profile and start the exam.</p>
        
        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-600 rounded-lg mb-4 text-sm font-medium animate-in fade-in">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input 
              required 
              type="text" 
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-slate-700">Email Address</label>
              {formData.email && emailValidation.isValid && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Valid Format
                </span>
              )}
            </div>
            <div className="relative">
              <input 
                required 
                type="email" 
                className={`w-full px-4 pr-10 py-2.5 border rounded-lg focus:ring-2 outline-none text-slate-900 font-medium transition-all ${
                  emailTouched && !emailValidation.isValid
                    ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-500'
                    : formData.email && emailValidation.isValid
                      ? 'border-emerald-400 bg-emerald-50/20 focus:ring-emerald-500/20 focus:border-emerald-500'
                      : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
                value={formData.email} 
                onChange={e => {
                  setFormData({...formData, email: e.target.value});
                  if (!emailTouched && e.target.value.length > 2) {
                    setEmailTouched(true);
                  }
                }}
                onBlur={() => setEmailTouched(true)}
                placeholder="candidate@example.com"
              />
              {emailTouched && !emailValidation.isValid && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-rose-500">
                  <AlertCircle className="h-5 w-5" />
                </div>
              )}
              {formData.email && emailValidation.isValid && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              )}
            </div>
            {emailTouched && !emailValidation.isValid ? (
              <p className="text-xs text-rose-600 font-medium flex items-center pt-1 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                {emailValidation.message}
              </p>
            ) : formData.email && emailValidation.isValid ? (
              <p className="text-xs text-emerald-600 font-semibold flex items-center pt-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 shrink-0" />
                Valid candidate email address
              </p>
            ) : (
              <p className="text-xs text-slate-400 pt-0.5">
                We will send your examination credentials and results to this email.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (Optional)</label>
            <input 
              type="tel" 
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium" 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})} 
              placeholder="+1 (555) 000-0000"
            />
          </div>
          
          <button 
            disabled={loading} 
            type="submit" 
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors mt-6 shadow-sm disabled:opacity-70"
          >
            {loading ? 'Processing...' : 'Register & Start Exam'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PublicExamRegistration() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-4">Loading...</div>}>
      <RegistrationForm />
    </Suspense>
  );
}
