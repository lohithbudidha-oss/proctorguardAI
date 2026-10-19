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

        {/* Right spacer to keep center navigation links balanced */}
        <div className="flex-1 hidden md:block" />
      </div>
    </header>
  );
}
