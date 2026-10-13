'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Loader2,
  AlertCircle
} from 'lucide-react';

import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';
import api from '@/lib/api';

export default function SupportPage() {
  const router = useRouter();
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'TECHNICAL',
    message: ''
  });

  // Pre-fill candidate information if logged in or stored
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('user');
        if (stored) {
          const u = JSON.parse(stored);
          setFormData(prev => ({
            ...prev,
            name: prev.name || u.name || '',
            email: prev.email || u.email || ''
          }));
        }
      }
    } catch (e) {}
  }, []);

  const DESCRIPTION_MAX_LENGTH = 500;

  const faqs = [
    {
      q: 'How does the AI webcam & environment proctoring work?',
      a: 'ProctorGuardAI uses computer vision algorithms directly in the browser and cloud. It continuously checks for candidate face presence, detects if multiple people enter the camera view, identifies if the candidate looks away repeatedly, and ensures no unauthorized auxiliary monitors are active.'
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

  // Helper to test if a string contains emojis
  const containsEmoji = (text: string) => {
    try {
      const emojiRegex = /\p{Extended_Pictographic}/u;
      return emojiRegex.test(text);
    } catch {
      return /[\uD83C-\uDBFF\uDC00-\uDFFF]/.test(text);
    }
  };

  // Helper to remove emojis from string
  const removeEmojis = (text: string) => {
    try {
      return text.replace(/\p{Extended_Pictographic}/gu, '');
    } catch {
      return text.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, '');
    }
  };

  // Handle Full Name Input (Letters and spaces only, no emojis or special chars)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Strip emojis, digits, and special characters; permit only English letters and spaces
    const cleaned = raw.replace(/[^a-zA-Z\s]/g, '');

    if (raw !== cleaned) {
      setNameError('Only alphabetical letters (A-Z, a-z) and spaces are allowed. Emojis and special characters are not accepted.');
    } else {
      setNameError(null);
    }

    setFormData(prev => ({ ...prev, name: cleaned }));
  };

  // Handle Description Input (Plain text, no emojis, max 500 chars)
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    const cleaned = removeEmojis(raw);

    if (raw !== cleaned) {
      setMessageError('Emojis are not accepted in the issue description. Please use plain text.');
    } else if (cleaned.length > DESCRIPTION_MAX_LENGTH) {
      setMessageError(`Character limit reached (${DESCRIPTION_MAX_LENGTH} characters max).`);
    } else {
      setMessageError(null);
    }

    // Enforce max 500 characters
    const trimmedToMax = cleaned.slice(0, DESCRIPTION_MAX_LENGTH);
    setFormData(prev => ({ ...prev, message: trimmedToMax }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedMessage = formData.message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setSubmitError('Please complete all required fields.');
      return;
    }

    // Validate Full Name: strictly letters and spaces, 2 to 60 characters
    if (!/^[a-zA-Z\s]{2,60}$/.test(trimmedName)) {
      setSubmitError('Full Name must contain only alphabetical letters and spaces (2-60 characters, no emojis or special characters).');
      return;
    }

    // Validate Email: @gmail.com only
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(trimmedEmail)) {
      setSubmitError('Only @gmail.com email addresses are accepted (e.g. yourname@gmail.com).');
      return;
    }

    // Validate Description: no emojis
    if (containsEmoji(trimmedMessage)) {
      setSubmitError('Description cannot contain emojis. Please remove emojis and describe in plain text.');
      return;
    }

    // Validate Description: length limit
    if (trimmedMessage.length < 10) {
      setSubmitError('Please provide a more descriptive issue summary (at least 10 characters).');
      return;
    }

    if (trimmedMessage.length > DESCRIPTION_MAX_LENGTH) {
      setSubmitError(`Description exceeds the maximum limit of ${DESCRIPTION_MAX_LENGTH} characters.`);
      return;
    }
    
    setSubmitting(true);

    try {
      await api.post('/support', {
        name: trimmedName,
        email: trimmedEmail,
        category: formData.category,
        message: trimmedMessage
      });
      setFormSubmitted(true);
      // Automatically navigate candidate to their dashboard
      setTimeout(() => {
        router.push('/candidate/dashboard?ticketSubmitted=true');
      }, 1800);
    } catch (err: any) {
      console.error('Failed to submit support ticket', err);
      setSubmitError(err?.response?.data?.message || 'Failed to submit support inquiry. Please check your network and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <PublicNavbar activePage="support" />

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
                  <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center animate-in fade-in zoom-in-95 duration-200">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                    <h4 className="font-extrabold text-emerald-900 text-base">Inquiry Submitted Successfully!</h4>
                    <p className="text-xs text-emerald-700 mt-1 max-w-sm mx-auto leading-relaxed">
                      Our proctoring support desk has received your response. We will contact you at <span className="font-bold underline">{formData.email}</span>.
                    </p>
                    <div className="mt-5 pt-3.5 border-t border-emerald-200/80 flex flex-col items-center justify-center gap-2">
                      <p className="text-[11px] text-emerald-800 font-semibold flex items-center">
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-emerald-600" />
                        Navigating to Candidate Dashboard...
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push('/candidate/dashboard?ticketSubmitted=true')}
                        className="mt-1 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
                      >
                        Go to Candidate Dashboard Now &rarr;
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-slate-700">Your Full Name</label>
                        <span className="text-[10px] text-slate-400">Letters and spaces only</span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={handleNameChange}
                        maxLength={60}
                        className={`w-full px-3.5 py-2 border rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition ${
                          nameError ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                        }`}
                      />
                      {nameError ? (
                        <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center">
                          <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                          <span>{nameError}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-1">
                          No emojis, numbers, or special characters permitted.
                        </p>
                      )}
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
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-slate-700">Description of Issue</label>
                        <span className={`text-[10px] font-bold ${
                          formData.message.length >= DESCRIPTION_MAX_LENGTH 
                            ? 'text-rose-600' 
                            : formData.message.length > 400 
                            ? 'text-amber-600' 
                            : 'text-slate-400'
                        }`}>
                          {formData.message.length} / {DESCRIPTION_MAX_LENGTH}
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        required
                        placeholder="Please describe what occurred (plain text only, no emojis)..."
                        value={formData.message}
                        onChange={handleMessageChange}
                        maxLength={DESCRIPTION_MAX_LENGTH}
                        className={`w-full px-3.5 py-2 border rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition ${
                          messageError ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                        }`}
                      />
                      {messageError ? (
                        <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center">
                          <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                          <span>{messageError}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Plain text only. Max 500 characters, emojis are not accepted.
                        </p>
                      )}
                    </div>

                    {submitError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start text-xs text-rose-700">
                        <AlertCircle className="w-4 h-4 mr-2 text-rose-500 shrink-0 mt-0.5" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-extrabold flex items-center justify-center transition shadow-xs cursor-pointer disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          <span>Submitting Ticket...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          <span>Submit Support Ticket</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
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
