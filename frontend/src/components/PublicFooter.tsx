import React from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

export default function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 text-center border-t border-slate-800">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between px-6 gap-4 text-xs mb-4">
        <div className="flex items-center space-x-3">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <BrandLogo size="sm" variant="light" />
          </Link>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <p>© 2026 ProctorGuardAI Platforms. All rights reserved.</p>
        </div>
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
