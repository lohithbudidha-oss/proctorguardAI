'use client';

import React from 'react';

interface FlyhiiBrandingProps {
  variant?: 'light' | 'dark'; // 'light' for dark/blue backgrounds (wrapped in crisp white badge), 'dark' for light backgrounds
  size?: 'sm' | 'md' | 'lg';
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
    sm: 'h-4 sm:h-4.5',
    md: 'h-5 sm:h-5.5',
    lg: 'h-6 sm:h-7',
  }[size];

  const containerBg = variant === 'light'
    ? 'bg-white text-slate-900 border border-white/90 shadow-xs'
    : 'bg-white/90 hover:bg-white text-slate-900 border border-slate-200/80 shadow-2xs';

  return (
    <div 
      className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-xl transition-all ${containerBg} ${className}`}
      title="Flyhii Solutions Pvt. Ltd."
    >
      {showLabel && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-200 pr-2 hidden sm:inline">
          In Association With
        </span>
      )}
      <img
        src="/images/flyhii-logo.png"
        alt="Flyhii Solutions Pvt. Ltd."
        className={`${heightClass} w-auto object-contain shrink-0`}
      />
    </div>
  );
}
