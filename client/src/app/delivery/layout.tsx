'use client';

import { useEffect } from 'react';
import DeliveryBottomNav from "../../components/delivery/DeliveryBottomNav";
import AuthGuard from "../../components/AuthGuard";

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Reset browser window scroll position to top immediately to prevent pre-scrolled lock states
    window.scrollTo(0, 0);
    if (document.body) document.body.scrollTop = 0;
    if (document.documentElement) document.documentElement.scrollTop = 0;

    // Add overflow-hidden and h-full to html and body to lock browser scroll
    document.documentElement.classList.add('overflow-hidden', 'h-full');
    document.body.classList.add('overflow-hidden', 'h-full');
    
    return () => {
      // Clean up when unmounting
      document.documentElement.classList.remove('overflow-hidden', 'h-full');
      document.body.classList.remove('overflow-hidden', 'h-full');
    };
  }, []);

  return (
    <AuthGuard allowedRoles={['delivery']}>
      <div className="flex flex-col items-center justify-center h-[100dvh] sm:h-screen w-full bg-slate-900 sm:p-6 overflow-hidden">

        {/* Mobile Simulator Frame for Desktop */}
        <div className="flex flex-col w-full max-w-[440px] bg-slate-50 h-[100dvh] sm:h-[850px] sm:max-h-[calc(100vh-3rem)] sm:rounded-[40px] sm:shadow-2xl overflow-hidden relative font-sans border-slate-800 sm:border-[8px]">

          {/* Top Header */}
          <div className="flex items-center justify-between p-4 bg-white shrink-0 shadow-sm z-30 sticky top-0">
            <button className="text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <div className="flex items-center justify-center text-emerald-600 font-black tracking-tighter text-[22px] uppercase absolute left-1/2 -translate-x-1/2">
              DELIVERYFLOW
            </div>
            <button className="relative text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto pb-20 relative bg-slate-50">
            {children}
          </div>

          {/* Bottom Navigation */}
          <DeliveryBottomNav />
        </div>
      </div>
    </AuthGuard>
  );
}
