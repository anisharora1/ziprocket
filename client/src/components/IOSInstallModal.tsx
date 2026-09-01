'use client';

import React from 'react';
import { usePwa } from '@/context/PwaContext';
import Image from 'next/image';
import { MdClose } from 'react-icons/md';

/**
 * iOS Share Icon SVG component matching the Apple Safari share sheet symbol
 */
function IOSShareIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

/**
 * iOS Add to Home Screen Icon SVG
 */
function IOSAddSquareIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export default function IOSInstallModal() {
  const { mounted, showIOSInstallInstructions, isInstalled, dismissIOSInstallModal } = usePwa();

  // Guard: only show when mounted, modal is requested, and app isn't installed
  if (!mounted || !showIOSInstallInstructions || isInstalled) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 z-[99999] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-5 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 relative">
        
        {/* Close Button */}
        <button
          onClick={dismissIOSInstallModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <MdClose className="text-xl" />
        </button>

        {/* Brand Logo Icon */}
        <div className="relative w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl p-1 shadow-inner border border-slate-100 dark:border-slate-750 flex items-center justify-center overflow-hidden">
          <Image
            src="/icon-192x192.png"
            alt="ZipRocket Logo"
            width={56}
            height={56}
            className="rounded-xl object-cover"
            priority
          />
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5 text-center">
          <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
            Install ZipRocket on iPhone
          </h2>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            होम स्क्रीन पर जोड़ें (Add to Home Screen)
          </p>
        </div>

        {/* Step-by-Step iOS Guide */}
        <div className="w-full space-y-3 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
          
          {/* Step 1: Share Button */}
          <div className="flex gap-3.5 items-start">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
              <IOSShareIcon className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                1. Tap the Share icon
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                At the bottom or top of your Safari browser toolbar.
              </p>
            </div>
          </div>

          {/* Step 2: Add to Home Screen */}
          <div className="flex gap-3.5 items-start">
            <div className="w-8 h-8 rounded-xl bg-[#FF5C00]/10 text-[#FF5C00] flex items-center justify-center shrink-0 mt-0.5">
              <IOSAddSquareIcon className="w-4 h-4 text-[#FF5C00]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                2. Tap &apos;Add to Home Screen&apos;
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                Scroll down in the share menu and select <strong>&quot;Add to Home Screen&quot;</strong>.
              </p>
            </div>
          </div>

          {/* Step 3: Tap Add */}
          <div className="flex gap-3.5 items-start">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">Add</span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                3. Tap &apos;Add&apos; in top right
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                ZipRocket will appear as an app on your home screen.
              </p>
            </div>
          </div>

        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={dismissIOSInstallModal}
            className="w-full py-3.5 bg-[#FF5C00] hover:bg-[#e05200] text-white text-sm font-extrabold rounded-2xl transition-all active:scale-[0.97] shadow-lg shadow-[#FF5C00]/20 flex items-center justify-center gap-2"
          >
            Got It (समझ गया)
          </button>
        </div>

      </div>
      
    </div>
  );
}
