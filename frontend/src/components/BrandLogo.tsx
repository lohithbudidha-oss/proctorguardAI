'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface BrandLogoProps {
  className?: string;
  iconBoxClassName?: string;
  iconClassName?: string;
  textClassName?: string;
  variant?: 'light' | 'dark'; // 'light' means light text for dark background, 'dark' means dark text for light background
  size?: 'sm' | 'md' | 'lg';
}

export default function BrandLogo({
  className = '',
  iconBoxClassName,
  iconClassName,
  textClassName,
  variant = 'dark',
  size = 'md',
}: BrandLogoProps) {
  const sizeConfig = {
    sm: {
      box: 'p-1.5 rounded-lg',
      icon: 'w-4 h-4',
      text: 'text-lg font-bold tracking-tight',
    },
    md: {
      box: 'p-2 rounded-xl',
      icon: 'w-5 h-5',
      text: 'text-xl font-extrabold tracking-tight',
    },
    lg: {
      box: 'p-2 rounded-xl',
      icon: 'w-6 h-6',
      text: 'text-2xl font-bold tracking-tight',
    },
  }[size];

  const defaultTextClass = variant === 'light' ? 'text-white' : 'text-slate-900';

  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      <div
        className={`bg-blue-600 ${
          iconBoxClassName || sizeConfig.box
        } flex items-center justify-center shrink-0 shadow-xs`}
      >
        <ShieldCheck className={`${iconClassName || sizeConfig.icon} text-white`} />
      </div>
      <span className={`${textClassName || sizeConfig.text} ${defaultTextClass}`}>
        Flair
      </span>
    </div>
  );
}
