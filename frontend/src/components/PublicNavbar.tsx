'use client';

import React from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

interface PublicNavbarProps {
  activePage?: 'home' | 'about' | 'organizations' | 'support';
}

export default function PublicNavbar({ activePage = 'home' }: PublicNavbarProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <div className="flex-1 flex items-center justify-start">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <BrandLogo size="md" variant="dark" />
          </Link>
        </div>

        {/* Center: Main Navigation Links */}
        <nav className="hidden md:flex items-center justify-center space-x-8">
          <Link
            href="/about"
            className={
              activePage === 'about'
                ? 'text-blue-600 font-bold text-sm tracking-wide'
                : 'text-slate-600 font-medium hover:text-blue-600 transition-colors text-sm'
            }
          >
            How it works
          </Link>
          <Link
            href="/organizations"
            className={
              activePage === 'organizations'
                ? 'text-blue-600 font-bold text-sm tracking-wide'
                : 'text-slate-600 font-medium hover:text-blue-600 transition-colors text-sm'
            }
          >
            For Organizations
          </Link>
          <Link
            href="/support"
            className={
              activePage === 'support'
                ? 'text-blue-600 font-bold text-sm tracking-wide'
                : 'text-slate-600 font-medium hover:text-blue-600 transition-colors text-sm'
            }
          >
            Support
          </Link>
        </nav>

        {/* Right: User Actions */}
        <div className="flex-1 flex items-center justify-end space-x-3">
          <Link
            href="/login"
            className="text-slate-700 font-semibold hover:text-blue-600 transition-colors text-sm px-3.5 py-2 rounded-lg hover:bg-slate-50"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-xs text-sm"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}
