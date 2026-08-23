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
    <div className="fixed top-4 sm:top-6 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-md mx-auto z-[99999] pointer-events-auto">
      <div className="bg-white dark:bg-slate-900 rounded-[28px] p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.25)] border border-emerald-100 dark:border-emerald-950/60 ring-1 ring-emerald-500/20 flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-4 duration-300">
        
        {/* Header: Status & Close */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Success Icon Badge */}
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center shrink-0">
              <MdCheckCircle className="text-emerald-500 text-2xl" />
            </div>

            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black text-slate-900 dark:text-white leading-tight">
                  ऐप डाउनलोड हो गया! 🎉
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                App Downloaded!
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowInstalledToast(false)}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors active:scale-95 shrink-0"
            aria-label="Dismiss notification"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Action / Next Step Instruction Card (Tier-4 Friendly) */}
        <div className="w-full bg-[#FF5C00]/5 dark:bg-[#FF5C00]/10 p-3.5 rounded-2xl border border-[#FF5C00]/15 flex items-center gap-3">
          
          {/* ZipRocket App Icon preview */}
          <div className="relative w-11 h-11 bg-white dark:bg-slate-800 rounded-xl p-0.5 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
            <Image
              src="/icon-192x192.png"
              alt="ZipRocket Icon"
              width={40}
              height={40}
              className="rounded-lg object-cover"
            />
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
              <MdAddToHomeScreen className="text-[10px]" />
            </div>
          </div>

          <div className="flex-1 text-left">
            <p className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
              अपनी होम स्क्रीन पर ZipRocket आइकॉन देखें और उस पर टैप करें
            </p>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
              Look for the ZipRocket icon on your home screen and tap it
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
