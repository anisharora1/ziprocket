'use client';

import Link from 'next/link';
import { MdBolt, MdSync, MdHome } from 'react-icons/md';

export default function OfflinePage() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#f9f9fc] dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col items-center gap-6">
        
        {/* Animated Brand Rocket Icon in Orange */}
        <div className="w-20 h-20 rounded-full bg-[#FF5C00]/10 flex items-center justify-center text-[#FF5C00] animate-bounce duration-1000">
          <MdBolt className="text-[42px] font-bold" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Connection Lost
          </h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            You are currently offline
          </p>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
          It looks like your internet connection is down. Don't worry! You can still browse restaurant listings, grocery stores, and categories that you have already visited.
        </p>

        <div className="flex flex-col gap-3 w-full mt-2">
          <button
            onClick={handleReload}
            className="w-full py-3.5 bg-[#FF5C00] hover:bg-[#e05200] text-white text-sm font-bold rounded-2xl transition-all active:scale-[0.98] shadow-md shadow-[#FF5C00]/25 flex items-center justify-center gap-2"
          >
            <MdSync className="text-[18px]" />
            Try Again
          </button>
          
          <Link
            href="/"
            className="w-full py-3.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-2xl border border-slate-100 dark:border-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <MdHome className="text-[18px]" />
            Go to Home
          </Link>
        </div>
        
      </div>
      
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 mt-6 tracking-wide uppercase">
        ZipRocket Express Delivery
      </p>
    </div>
  );
}
