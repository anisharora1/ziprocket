'use client';

import React, { useState, useEffect } from 'react';
import { isInAppBrowser } from '@/utils/inAppBrowser';
import { MdOpenInBrowser, MdContentCopy, MdCheck, MdClose } from 'react-icons/md';

export default function InAppBrowserBanner() {
  const [mounted, setMounted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    const inApp = isInAppBrowser();
    const isDismissed = sessionStorage.getItem('in-app-banner-dismissed') === 'true';
    if (inApp && !isDismissed) {
      setShowBanner(true);
    }
  }, []);

  const handleCopyLink = async () => {
    try {
      if (typeof window !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('in-app-banner-dismissed', 'true');
    }
  };

  if (!mounted || !showBanner) return null;

  return (
    <div className="relative z-[99990] bg-gradient-to-r from-amber-500 via-orange-500 to-[#FF5C00] text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="p-1 bg-white/20 rounded-lg shrink-0">
          <MdOpenInBrowser className="text-lg" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 leading-tight min-w-0">
          <span className="font-extrabold truncate">
            For best experience, open this in Safari/Chrome
          </span>
          <span className="text-[10px] text-white/80 hidden sm:inline">
            (PWA &amp; Location require standard browser)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleCopyLink}
          className="px-3 py-1 bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1.5 shadow-sm text-[11px]"
        >
          {copied ? (
            <>
              <MdCheck className="text-emerald-600 font-bold text-sm" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <MdContentCopy className="text-slate-600 text-xs" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        <button
          onClick={handleDismiss}
          className="p-1 text-white/70 hover:text-white rounded-md transition-colors"
          aria-label="Dismiss banner"
        >
          <MdClose className="text-base" />
        </button>
      </div>
    </div>
  );
}
