'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // Synchronously check credentials in client storage
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token) {
      setIsAuthorized(false);
      router.replace('/login?role=admin');
      return;
    }

    try {
      // Decode JWT token payload
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        const isRoleValid = payload.role === 'ADMIN' || payload.role === 'PROCTOR';
        const isNotExpired = !payload.exp || (payload.exp * 1000 > Date.now());

        if (isRoleValid && isNotExpired) {
          setIsAuthorized(true);
          return;
        }
      }
    } catch (e) {
      // Token parsing failed, try checking user cache
    }

    try {
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.role === 'ADMIN' || u.role === 'PROCTOR') {
          setIsAuthorized(true);
          return;
        }
        if (u.role === 'CANDIDATE') {
          setIsAuthorized(false);
          router.replace('/candidate/dashboard');
          return;
        }
      }
    } catch (e) {}

    // Not authorized or invalid role
    setIsAuthorized(false);
    router.replace('/login?role=admin');
  }, [router]);

  // While checking authorization, render a clean light backdrop (NEVER flash the admin dashboard)
  if (isAuthorized !== true) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-9 h-9 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-slate-500 text-xs font-bold tracking-wider uppercase">Authenticating Admin Access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
