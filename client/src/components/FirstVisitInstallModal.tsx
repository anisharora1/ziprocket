'use client';

import { usePwa } from '@/context/PwaContext';
import Image from 'next/image';
import { MdSpeed, MdAddToHomeScreen, MdSignalWifiBad, MdDownload } from 'react-icons/md';

export default function FirstVisitInstallModal() {
  const { mounted, showFirstVisitModal, isInstalled, installApp, dismissFirstVisitModal } = usePwa();

  // Guard against hydration mismatches and show only when required
  if (!mounted || !showFirstVisitModal || isInstalled) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/65 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal Card container */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-6 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        
        {/* Brand Logo Icon */}
        <div className="relative w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl p-1 shadow-inner border border-slate-100 dark:border-slate-750 flex items-center justify-center overflow-hidden">
          <Image 
            src="/icon-192x192.png" 
            alt="ZipRocket Logo" 
            width={72} 
            height={72} 
            className="rounded-2xl object-cover"
            priority
          />
        </div>

        {/* Title & Short Description */}
        <div className="space-y-2 text-center">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
            Install App for Faster Ordering
          </h2>
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            तेज़ डिलीवरी और आसान आर्डर
          </p>
        </div>

        {/* Benefits List (Tier-3 / Tier-4 Friendly Hindi/English) */}
        <div className="w-full space-y-3.5 bg-slate-55 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-50 dark:border-slate-800">
          
          <div className="flex gap-3.5 items-start">
            <MdSpeed className="text-[#FF5C00] text-xl font-bold shrink-0 mt-0.5" />
            <div className="flex-1 text-left">
              <p className="text-xs font-black text-slate-850 dark:text-slate-200 leading-none">तेज़ ऑर्डर (Faster Loading)</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                Slow internet checks won't stop you. App loads instantly.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 items-start">
            <MdAddToHomeScreen className="text-emerald-500 text-xl font-bold shrink-0 mt-0.5" />
            <div className="flex-1 text-left">
              <p className="text-xs font-black text-slate-850 dark:text-slate-200 leading-none">सीधा होम स्क्रीन से (One-Tap Access)</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                No need to type website address. Launch app with one tap.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 items-start">
            <MdSignalWifiBad className="text-indigo-500 text-xl font-bold shrink-0 mt-0.5" />
            <div className="flex-1 text-left">
              <p className="text-xs font-black text-slate-850 dark:text-slate-200 leading-none">कम नेटवर्क में भी चालू (Offline Support)</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                Check previously visited items even when network cuts.
              </p>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 w-full">
          <button
            onClick={installApp}
            className="w-full py-4 bg-[#FF5C00] hover:bg-[#e05200] text-white text-sm font-extrabold rounded-2xl transition-all active:scale-[0.97] shadow-lg shadow-[#FF5C00]/20 flex items-center justify-center gap-2"
          >
            <MdDownload className="font-bold text-[18px]" />
            Install App (ऐप इनस्टॉल करें)
          </button>
          
          <button
            onClick={dismissFirstVisitModal}
            className="w-full py-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 text-xs font-bold transition-colors active:scale-[0.98]"
          >
            Skip for Now / अभी नहीं
          </button>
        </div>

      </div>
      
    </div>
  );
}

