'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function AuthGuard({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!token || !user) {
        router.push('/auth/login');
      } else if (allowedRoles && !allowedRoles.includes(user.role)) {
        // If logged in but wrong role, send them to their native dashboard or home
        if (user.role === 'seller') router.push('/seller/dashboard');
        else if (user.role === 'admin') router.push('/admin/dashboard');
        else if (user.role === 'delivery') router.push('/delivery/dashboard');
        else if (user.role === 'grocery_moderator') router.push('/moderator/dashboard');
        else router.push('/');
      }
    }
  }, [isLoading, token, user, router, allowedRoles]);

  if (isLoading || !token || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
