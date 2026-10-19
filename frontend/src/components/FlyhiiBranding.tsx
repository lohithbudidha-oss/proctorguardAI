'use client';

import React from 'react';

interface FlyhiiBrandingProps {
  variant?: 'light' | 'dark'; // 'light' for dark/blue backgrounds (wrapped in crisp white badge), 'dark' for light backgrounds
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showLabel?: boolean;
}

export default function FlyhiiBranding({
  variant = 'dark',
  size = 'md',
  className = '',
  showLabel = false,
}: FlyhiiBrandingProps) {
  const heightClass = {
    sm: 'h-6 sm:h-7',          // 24px - 28px
    md: 'h-7 sm:h-8.5',        // 28px - 34px (clearly readable text!)
    lg: 'h-9 sm:h-10.5',       // 36px - 42px
    xl: 'h-11 sm:h-13',        // 44px - 52px
  }[size];

  const paddingClass = {
    sm: 'px-3 py-1.5',
    md: 'px-3.5 py-1.5',
    lg: 'px-4 py-2',
    xl: 'px-5 py-2.5',
  }[size];

  const containerBg = variant === 'light'
    ? 'bg-white text-slate-900 border border-white/95 shadow-xs'
    : 'bg-white hover:bg-slate-50/90 text-slate-900 border border-slate-200/90 shadow-2xs';

  return (
    <div 
      className={`inline-flex items-center justify-center space-x-2.5 rounded-xl transition-all ${paddingClass} ${containerBg} ${className}`}
      title="Flyhii Solutions Pvt. Ltd."
    >
      {showLabel && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-200 pr-2.5 hidden sm:inline">
          In Association With
        </span>
      )}
      <img
        src="/images/flyhii-logo.png"
        alt="Flyhii Solutions Pvt. Ltd."
        className={`${heightClass} w-auto max-w-full object-contain shrink-0`}
      />
    </div>
  );
}
