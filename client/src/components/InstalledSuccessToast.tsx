'use client';

import React from 'react';
import Image from 'next/image';
import { usePwa } from '@/context/PwaContext';
import { MdCheckCircle, MdAddToHomeScreen, MdClose } from 'react-icons/md';

export default function InstalledSuccessToast() {
  const { mounted, showInstalledToast, setShowInstalledToast } = usePwa();

  // Guard against SSR and only render when active
  if (!mounted || !showInstalledToast) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/65 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Centered Modal Card */}
      <div className="relative bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-6 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        
        {/* Manual Close Button (✕ icon, top-right corner) */}
        <button
          onClick={() => setShowInstalledToast(false)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors active:scale-95"
          aria-label="Close"
        >
          <MdClose className="text-xl" />
        </button>

        {/* Brand Icon & Success Badge */}
        <div className="relative w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl p-1 shadow-inner border border-slate-100 dark:border-slate-750 flex items-center justify-center">
          <Image
            src="/icon-192x192.png"
            alt="ZipRocket Logo"
            width={72}
            height={72}
            className="rounded-2xl object-cover"
            priority
          />
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg ring-4 ring-white dark:ring-slate-900">
            <MdCheckCircle className="text-xl" />
          </div>
        </div>

        {/* Title & Short Description */}
        <div className="space-y-2 text-center">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
            ऐप डाउनलोड हो गया! 🎉
          </h2>
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            App Downloaded!
          </p>
        </div>

        {/* Tier-4 Friendly Instruction Card */}
        <div className="w-full bg-[#FF5C00]/5 dark:bg-[#FF5C00]/10 p-4 rounded-2xl border border-[#FF5C00]/15 flex items-start gap-3.5">
          <div className="bg-[#FF5C00]/15 text-[#FF5C00] p-2 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <MdAddToHomeScreen className="text-xl font-bold" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs sm:text-sm font-extrabold text-slate-850 dark:text-slate-200 leading-snug">
              अपनी होम स्क्रीन पर ZipRocket आइकॉन देखें और उस पर टैप करें
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-normal">
              Look for the ZipRocket icon on your home screen and tap it
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="w-full">
          <button
            onClick={() => setShowInstalledToast(false)}
            className="w-full py-3.5 bg-[#FF5C00] hover:bg-[#e05200] text-white text-sm font-extrabold rounded-2xl transition-all active:scale-[0.97] shadow-lg shadow-[#FF5C00]/20 flex items-center justify-center"
          >
            Okay / समझ गया
          </button>
        </div>

      </div>

    </div>
  );
}
