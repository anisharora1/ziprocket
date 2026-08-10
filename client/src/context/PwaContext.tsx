'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  isOffline: boolean;
  showOnlineToast: boolean;
  showUpdateToast: boolean;
  showFirstVisitModal: boolean;
  installApp: () => Promise<void>;
  dismissFirstVisitModal: () => void;
  triggerServiceWorkerUpdate: () => void;
  setShowOnlineToast: (val: boolean) => void;
  setShowUpdateToast: (val: boolean) => void;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export const PwaProvider = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [showFirstVisitModal, setShowFirstVisitModal] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Helper to check if app is running in standalone PWA mode
  const checkIsInstalled = () => {
    if (typeof window === 'undefined') return false;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isAndroidTWA = document.referrer.startsWith('android-app://');
    return isStandalone || isIOSStandalone || isAndroidTWA;
  };

  useEffect(() => {
    setMounted(true);
    const installed = checkIsInstalled();
    setIsInstalled(installed);

    // Track the platform mode (PWA standalone vs Browser) in Google Analytics
    sendGAEvent({
      event: 'platform_launch',
      platform_mode: installed ? 'pwa' : 'browser',
    });

    // 1. Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Check if we should display the first visit modal
      const dismissedTime = localStorage.getItem('pwa-first-visit-dismissed');
      const isDismissedRecently = dismissedTime && 
        (Date.now() - parseInt(dismissedTime, 10) < 3 * 24 * 60 * 60 * 1000); // 3 days

      if (!installed && !isDismissedRecently) {
        setShowFirstVisitModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 2. Listen for appinstalled event (fired when user installs app)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowFirstVisitModal(false);
      setDeferredPrompt(null);
      localStorage.removeItem('pwa-first-visit-dismissed');
      sendGAEvent({ event: 'pwa_install', status: 'success' });
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 3. Monitor network connectivity status
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

    // 4. Register & Manage Service Worker updates
    let handleControllerChange: (() => void) | null = null;

    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
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
          console.error('Service Worker registration failed:', err);
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
      } else {
        // Unregister any active service workers in development mode to prevent cached assets from intercepting local changes
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log("Unregistered stale Service Worker in development mode");
                window.location.reload();
              }
            });
          }
        });
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (handleControllerChange && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    sendGAEvent({ event: 'pwa_prompt_shown' });
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setShowFirstVisitModal(false);
      setDeferredPrompt(null);
      sendGAEvent({ event: 'pwa_prompt_accepted' });
    } else {
      // Dismiss the first-visit modal if it is active so we don't annoy them
      dismissFirstVisitModal();
      sendGAEvent({ event: 'pwa_prompt_dismissed' });
    }
  };

  const dismissFirstVisitModal = () => {
    setShowFirstVisitModal(false);
    localStorage.setItem('pwa-first-visit-dismissed', Date.now().toString());
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
        isInstallable: !!deferredPrompt,
        isInstalled,
        isOffline,
        showOnlineToast,
        showUpdateToast,
        showFirstVisitModal,
        installApp,
        dismissFirstVisitModal,
        triggerServiceWorkerUpdate,
        setShowOnlineToast,
        setShowUpdateToast,
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
