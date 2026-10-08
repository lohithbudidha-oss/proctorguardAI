'use client';
import React, { useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';

function RegistrationForm() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id;
  
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post(`/public/exams/${examId}/register`, formData);
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        // Automatically redirect to the exam system check and start page
        router.push(`/candidate/exams/${examId}/system-check`);
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to register for exam.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Exam Registration</h1>
        <p className="text-slate-500 mb-6">Enter your details to access the exam.</p>
        
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-4 text-sm font-medium">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input required type="email" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (Optional)</label>
            <input type="tel" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          
          <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors mt-6">
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
