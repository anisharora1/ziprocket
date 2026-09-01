/**
 * Utility to detect common in-app browsers (WhatsApp, Instagram, Facebook, etc.)
 * and iOS Safari. Geolocation and PWA installation often fail silently inside WebViews.
 */

export const isInAppBrowser = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) return false;
  const ua = window.navigator.userAgent || window.navigator.vendor || (window as any).opera || '';

  const inAppRules = [
    /WhatsApp/i,
    /Instagram/i,
    /FBAN|FBAV|FB_IAB|FB4A/i,
    /Messenger/i,
    /Twitter/i,
    /Line\//i,
    /MicroMessenger/i,
    /Snapchat/i,
    /musical_ly|BytedanceWebview|ByteLocale|ByteFullConfig/i,
    /\bwv\b/i, // Android WebView
  ];

  return inAppRules.some((rule) => rule.test(ua));
};

export const isIOSSafari = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) return false;
  const ua = window.navigator.userAgent || '';

  // Detect iOS (iPhone, iPad, iPod, or iPad on iOS 13+ with multi-touch)
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!isIOS) return false;

  // Must have WebKit and Safari in user agent
  const isWebKit = /WebKit/i.test(ua);
  const isSafari = /Safari/i.test(ua);

  // Exclude iOS wrappers (Chrome=CriOS, Firefox=FxiOS, Edge=EdgiOS, Opera=OPiOS/OPT, DuckDuckGo)
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT|DuckDuckGo/i.test(ua);

  // Exclude in-app browsers
  const inApp = isInAppBrowser();

  return isWebKit && isSafari && !isOtherBrowser && !inApp;
};

export const isStandaloneMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  return isDisplayStandalone || isIOSStandalone;
};
