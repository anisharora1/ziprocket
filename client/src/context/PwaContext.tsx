'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sendGAEvent } from '@next/third-parties/google';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextType {
  mounted: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isInstalling: boolean;
  isOffline: boolean;
  showOnlineToast: boolean;
  showUpdateToast: boolean;
  showFirstVisitModal: boolean;
  showInstalledToast: boolean;
  installApp: () => Promise<void>;
  dismissFirstVisitModal: () => void;
  triggerServiceWorkerUpdate: () => void;
  setShowOnlineToast: (val: boolean) => void;
  setShowUpdateToast: (val: boolean) => void;
  setShowInstalledToast: (val: boolean) => void;
}

// Module-level capture so beforeinstallprompt is never missed if fired before React hydrates
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export const PwaProvider = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [showFirstVisitModal, setShowFirstVisitModal] = useState(false);
  const [showInstalledToast, setShowInstalledToast] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Helper to check if app is running in standalone PWA mode or marked installed
  const checkIsInstalled = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isAndroidTWA = document.referrer.startsWith('android-app://');
    const isLocalStorageInstalled = localStorage.getItem('pwa-installed') === 'true';
    return isStandalone || isIOSStandalone || isAndroidTWA || isLocalStorageInstalled;
  }, []);

  const dismissFirstVisitModal = useCallback(() => {
    setShowFirstVisitModal(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    const installed = checkIsInstalled();
    setIsInstalled(installed);

    // Clean up any legacy first-visit dismissed flag
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pwa-first-visit-dismissed');
    }

    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
      if (!installed) {
        setShowFirstVisitModal(true);
      }
    }

    // Track the platform mode (PWA standalone vs Browser) in Google Analytics
    sendGAEvent({
      event: 'platform_launch',
      platform_mode: installed ? 'pwa' : 'browser',
    });

    // Check if app is installed via getInstalledRelatedApps API if supported
    if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
      (navigator as any).getInstalledRelatedApps().then((relatedApps: any[]) => {
        if (relatedApps && relatedApps.length > 0) {
          setIsInstalled(true);
          setShowFirstVisitModal(false);
          localStorage.setItem('pwa-installed', 'true');
        }
      }).catch(() => { });
    }

    // 1. Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      globalDeferredPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstalling(false);

      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      if (!isStandaloneMode) {
        setIsInstalled(false);
        setShowFirstVisitModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 2. Listen for appinstalled event (fired when user successfully installs app)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstalling(false);
      setShowFirstVisitModal(false);
      setShowInstalledToast(true);
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      localStorage.setItem('pwa-installed', 'true');
      sendGAEvent({ event: 'pwa_install', status: 'success' });
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 3. Listen for display-mode standalone changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setIsInstalling(false);
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        setShowFirstVisitModal(false);
        localStorage.setItem('pwa-installed', 'true');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleDisplayModeChange);
    }

    // 4. Monitor network connectivity status
    const handleOffline = () => {
      setIsOffline(true);
      setShowOnlineToast(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowOnlineToast(true);
      const timer = setTimeout(() => {
        setShowOnlineToast(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    setIsOffline(!navigator.onLine);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // 5. Register & Manage Service Worker updates
    let handleControllerChange: (() => void) | null = null;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
        setRegistration(reg);

        if (reg.waiting) {
          setShowUpdateToast(true);
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdateToast(true);
              }
            });
          }
        });
      }).catch((err) => {
        console.log('Service Worker registration info:', err);
      });

      // Handle page refreshing when new worker activates
      let refreshing = false;
      const hasControllerOnLoad = !!navigator.serviceWorker.controller;
      handleControllerChange = () => {
        // Only reload if the page was already controlled by a service worker (i.e. on SW updates)
        if (hasControllerOnLoad && navigator.serviceWorker.controller && !refreshing) {
          refreshing = true;
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } else if ((mediaQuery as any).removeListener) {
        (mediaQuery as any).removeListener(handleDisplayModeChange);
      }
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (handleControllerChange && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
    };
  }, [checkIsInstalled]);

  // Auto-hide the installation success toast after ~4 seconds
  useEffect(() => {
    if (showInstalledToast) {
      const timer = setTimeout(() => {
        setShowInstalledToast(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showInstalledToast]);

  const installApp = async () => {
    if (isInstalled) {
      return;
    }

    const promptToUse = deferredPrompt || globalDeferredPrompt;
    if (!promptToUse) {
      return;
    }

    try {
      setIsInstalling(true);
      // Call prompt() immediately — no awaits before this line.
      // Any async wait here (like navigator.serviceWorker.ready) can burn
      // through Chrome's user-activation window and cause it to silently
      // fall back to the "Add to home screen" shortcut instead of a real install.
      await promptToUse.prompt();
      sendGAEvent({ event: 'pwa_prompt_shown' });

      const choiceResult = await promptToUse.userChoice;

      if (choiceResult && choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setShowFirstVisitModal(false);
        setShowInstalledToast(true);
        localStorage.setItem('pwa-installed', 'true');
        sendGAEvent({ event: 'pwa_prompt_accepted' });
      } else {
        // User cancelled or dismissed the prompt
        dismissFirstVisitModal();
        sendGAEvent({ event: 'pwa_prompt_dismissed' });
      }
    } catch (err) {
      console.error('PWA installation error:', err);
    } finally {
      // The beforeinstallprompt event is consumed once prompt() is called
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalling(false);
    }
  };

  const triggerServiceWorkerUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return (
    <PwaContext.Provider
      value={{
        mounted,
        isInstallable: !!(deferredPrompt || globalDeferredPrompt),
        isInstalled,
        isInstalling,
        isOffline,
        showOnlineToast,
        showUpdateToast,
        showFirstVisitModal,
        showInstalledToast,
        installApp,
        dismissFirstVisitModal,
        triggerServiceWorkerUpdate,
        setShowOnlineToast,
        setShowUpdateToast,
        setShowInstalledToast,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (context === undefined) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
};
