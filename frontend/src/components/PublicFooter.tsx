import React from 'react';
import Link from 'next/link';

export default function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 text-center border-t border-slate-800">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between px-6 gap-4 text-xs mb-4">
        <p>© 2026 ProctorGuardAI Platforms. All rights reserved.</p>
        <div className="space-x-4">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <Link href="/about" className="hover:text-white transition">How it works</Link>
          <Link href="/organizations" className="hover:text-white transition">For Organizations</Link>
          <Link href="/support" className="hover:text-white transition">Support</Link>
        </div>
      </div>
      <p className="text-xs text-slate-500">Enterprise-grade cheating-risk detection and assessment integrity.</p>
    </footer>
  );
}
