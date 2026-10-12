'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  HelpCircle, 
  Camera, 
  Monitor, 
  Wifi, 
  AlertTriangle, 
  Mail, 
  Phone, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Send,
  MessageSquare,
  ArrowLeft
} from 'lucide-react';

export default function SupportPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'TECHNICAL',
    message: ''
  });

  const faqs = [
    {
      q: 'How does the AI webcam & environment proctoring work?',
      a: 'SecureAssess uses computer vision algorithms directly in the browser and cloud. It continuously checks for candidate face presence, detects if multiple people enter the camera view, identifies if the candidate looks away repeatedly, and ensures no unauthorized auxiliary monitors are active.'
    },
    {
      q: 'What should I do if my webcam or microphone is not detected?',
      a: 'Make sure your browser has permission to access your camera and microphone. In Google Chrome or Edge, click the camera/lock icon in the URL address bar and choose "Allow" for Camera and Microphone. Close any other applications using your webcam (such as Zoom, Teams, or Skype) and refresh the page.'
    },
    {
      q: 'What happens if my internet connection drops during an exam?',
      a: 'The platform features automatic network resilience with a built-in grace period. Your local responses and exam state are preserved. Once your connection resumes within the grace window, your session reconnects seamlessly.'
    },
    {
      q: 'Why am I required to share my screen and stay in fullscreen mode?',
      a: 'To prevent unauthorized searching of exam questions or switching between tabs, examinations require fullscreen mode and active screen broadcasting. Navigating away, opening new browser windows, or exiting fullscreen will trigger proctoring alerts.'
    },
    {
      q: 'How do I know if my exam has been successfully submitted?',
      a: 'Upon clicking "Confirm & Submit Exam", or when the allocated timer completes, you are redirected to the Examination Results & Submission Catalog page which displays a confirmation summary of all answered and unanswered questions.'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(formData.email.trim())) {
      alert('Only @gmail.com email addresses are accepted (e.g. yourname@gmail.com).');
      return;
    }
    setFormSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-8 flex justify-between items-center shadow-xs sticky top-0 z-30">
        <Link href="/" className="flex items-center space-x-2 text-blue-700">
          <ShieldCheck className="w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">SecureAssess</span>
        </Link>
        <nav className="space-x-6 hidden md:block text-sm">
          <Link href="/about" className="text-slate-600 font-medium hover:text-blue-600 transition-colors">How it works</Link>
          <Link href="/organizations" className="text-slate-600 font-medium hover:text-blue-600 transition-colors">For Organizations</Link>
          <Link href="/support" className="text-blue-600 font-bold">Support</Link>
        </nav>
        <div className="space-x-3">
          <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-800 transition-colors text-sm px-3 py-2">
            Login
          </Link>
          <Link href="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-xs text-sm">
            Register
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-16 px-6 sm:px-12 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 border border-blue-200 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider mb-5">
            <HelpCircle className="w-4 h-4" />
            <span>Candidate & Administrator Help Center</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            How Can We Assist You?
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Find immediate answers for camera setup, browser permissions, and exam troubleshooting, or reach our technical support desk.
          </p>
        </section>

        {/* Quick Diagnostic Cards */}
        <section className="py-6 px-6 sm:px-12 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Camera className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base mb-1.5">Webcam & Audio Check</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ensure your camera is enabled in browser site permissions. Only 1 program can access webcam hardware at a time.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Monitor className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base mb-1.5">Screen Sharing & Display</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Choose &ldquo;Entire Screen&rdquo; when prompted to share your screen. Multiple monitor setups must be disconnected before testing.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                <Wifi className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base mb-1.5">Network & Disconnects</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tests are resilient to temporary drops. Reconnect promptly without closing the examination tab to resume your attempt.
              </p>
            </div>
          </div>
        </section>

        {/* FAQs & Contact Form Grid */}
        <section className="py-14 px-6 sm:px-12 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* FAQs Accordion */}
            <div className="lg:col-span-7">
              <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center">
                <HelpCircle className="w-6 h-6 mr-2 text-blue-600" />
                Frequently Asked Questions
              </h2>

              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div 
                    key={idx}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs"
                  >
                    <button
                      onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                      className="w-full px-5 py-4 text-left flex justify-between items-center text-slate-800 font-extrabold text-sm hover:bg-slate-50 transition"
                    >
                      <span>{faq.q}</span>
                      {activeFaq === idx ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                      )}
                    </button>
                    {activeFaq === idx && (
                      <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/40">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Support Contact Form */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-extrabold text-slate-900 mb-1 flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
                  Contact Support Desk
                </h3>
                <p className="text-xs text-slate-500 mb-5">
                  Have an urgent question during or after an assessment? Send us a ticket.
                </p>

                {formSubmitted ? (
                  <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                    <h4 className="font-bold text-emerald-900 text-sm">Message Sent Successfully</h4>
                    <p className="text-xs text-emerald-700 mt-1">
                      Our proctoring support desk has received your inquiry. We will contact you at {formData.email}.
                    </p>
                    <button
                      onClick={() => {
                        setFormSubmitted(false);
                        setFormData({ name: '', email: '', category: 'TECHNICAL', message: '' });
                      }}
                      className="mt-4 text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Email Address (@gmail.com only)</label>
                      <input
                        type="email"
                        required
                        placeholder="john@gmail.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Inquiry Type</label>
                      <select
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                      >
                        <option value="TECHNICAL">Webcam / Audio Technical Issue</option>
                        <option value="EXAM_ACCESS">Exam Access & Registration</option>
                        <option value="ORGANIZATION">Organization / Admin Inquiry</option>
                        <option value="OTHER">General Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Description of Issue</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Please describe what occurred..."
                        value={formData.message}
                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center transition shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Support Ticket
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 text-center border-t border-slate-800 text-xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between px-6 gap-4">
          <p>© 2026 SecureAssess Platforms. Enterprise-grade assessment proctoring.</p>
          <div className="space-x-4">
            <Link href="/" className="hover:text-white transition">Home</Link>
            <Link href="/about" className="hover:text-white transition">How it works</Link>
            <Link href="/organizations" className="hover:text-white transition">For Organizations</Link>
            <Link href="/support" className="text-white font-bold">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
