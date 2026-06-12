'use client';

import { usePwa } from '@/context/PwaContext';

export default function PwaManager() {
  const {
    mounted,
    isOffline,
    showOnlineToast,
    showUpdateToast,
    triggerServiceWorkerUpdate,
    setShowUpdateToast,
  } = usePwa();

  // Guard against hydration mismatches
  if (!mounted) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 pointer-events-none z-[9999] p-4 flex flex-col gap-3 items-center md:items-end">
      
      {/* 1. Service Worker Update Toast */}
      {showUpdateToast && (
        <div className="pointer-events-auto w-full max-w-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-slate-800 dark:border-slate-105 rounded-3xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.2)] flex flex-col gap-4 mb-20 md:mb-0 transform transition-all duration-350 animate-in slide-in-from-bottom-5">
          <div className="flex gap-4 items-start">
            <div className="bg-[#FF5C00]/10 p-2.5 rounded-xl text-[#FF5C00] shrink-0">
              <span className="material-symbols-outlined text-2xl font-bold">autorenew</span>
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-extrabold">
                New Version Available
              </h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                A new version of ZipRocket is ready. Reload to access updated features.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end text-xs font-bold">
            <button
              onClick={() => setShowUpdateToast(false)}
              className="px-4 py-2 text-slate-400 dark:text-slate-505 hover:text-white dark:hover:text-slate-800 transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={triggerServiceWorkerUpdate}
              className="bg-[#FF5C00] hover:bg-[#e05200] text-white px-5 py-2 rounded-xl transition-all active:scale-95 shadow-md shadow-[#FF5C00]/15"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {/* 2. Offline Alert Banner */}
      {isOffline && (
        <div className="pointer-events-auto bg-red-650 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-[0_10px_30px_rgba(220,38,38,0.2)] border border-red-500/25 transition-all duration-300 mb-20 md:mb-0 max-w-xs md:max-w-sm animate-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-xl">cloud_off</span>
          <div className="flex flex-col text-left">
            <span className="text-xs font-black">You are currently offline</span>
            <span className="text-[10px] opacity-90 mt-0.5 leading-snug">
              Previously visited pages remain accessible.
            </span>
          </div>
        </div>
      )}

      {/* 3. Back Online Toast */}
      {showOnlineToast && (
        <div className="pointer-events-auto bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-[0_10px_30px_rgba(5,150,105,0.2)] border border-emerald-500/25 transition-all duration-300 mb-20 md:mb-0 animate-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-xl">cloud_queue</span>
          <span className="text-xs font-black">Back online! Connectivity restored.</span>
        </div>
      )}
      
    </div>
  );
}
