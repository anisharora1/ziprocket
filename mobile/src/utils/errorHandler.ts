/**
 * Utility to parse and map authentication & network errors
 * into clean, user-friendly Hinglish messages.
 * Note: Never log OTPs or tokens.
 */

export function getFriendlyErrorMessage(error: any): string {
  if (!error) {
    return 'Kuch galat ho gaya. Kripya thodi der baad try karein.';
  }

  // 1. If error is already a friendly string
  if (typeof error === 'string') {
    return mapFriendlyString(error);
  }

  // 2. Firebase Auth SDK Errors
  const firebaseCode = error.code || (error.message ? parseFirebaseCode(error.message) : null);
  if (firebaseCode) {
    switch (firebaseCode) {
      case 'auth/invalid-verification-code':
        return 'OTP galat hai. Kripya sahi OTP enter karein.';
      case 'auth/code-expired':
        return 'OTP expire ho chuka hai. Kripya naya OTP mangwayein.';
      case 'auth/too-many-requests':
        return 'Bahut saare attempts ho gaye hain. Kripya kuch der baad try karein.';
      case 'auth/network-request-failed':
        return 'Internet connection check karein aur dobara try karein.';
      case 'auth/invalid-phone-number':
        return 'Kripya sahi 10-digit mobile number enter karein.';
      case 'auth/quota-exceeded':
        return 'SMS limit poori ho gayi hai. Kripya baad mein try karein.';
      case 'auth/app-not-authorized':
        return 'App authorization fail ho gayi. Firebase SHA fingerprint check karein.';
      default:
        if (firebaseCode.startsWith('auth/')) {
          return 'Verification mein dikkat aayi. Kripya dobara try karein.';
        }
    }
  }

  // 3. Axios Backend API Errors
  if (error.response) {
    const status = error.response.status;
    const backendMessage = error.response.data?.message || error.response.data?.error;

    // 403 Forbidden: e.g. Blocked by admin / pending / rejected
    if (status === 403) {
      return backendMessage || 'Aapka account block kiya gaya hai. Customer support se sampark karein.';
    }

    if (status === 429) {
      return 'Bahut saare attempts ho gaye hain. Kripya kuch der baad try karein.';
    }

    if (status === 400) {
      if (backendMessage) {
        return backendMessage;
      }
      return 'Invalid details. Kripya sahi details enter karein.';
    }

    if (status === 401) {
      return backendMessage || 'Verification fail ho gaya. Kripya dobara login karein.';
    }

    if (status >= 500) {
      return 'Server par samasya aayi. Kripya thodi der baad dobara try karein.';
    }

    if (backendMessage) {
      return backendMessage;
    }
  } else if (error.request) {
    // Network error / offline
    return 'Internet connection check karein aur dobara try karein.';
  }

  // 4. Standard JS error message
  if (error.message) {
    return mapFriendlyString(error.message);
  }

  return 'Kuch galat ho gaya. Kripya thodi der baad try karein.';
}

function parseFirebaseCode(msg: string): string | null {
  const match = msg.match(/auth\/[a-zA-Z0-9-]+/);
  return match ? match[0] : null;
}

function mapFriendlyString(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes('network error') ||
    lower.includes('failed to fetch') ||
    lower.includes('network-request-failed') ||
    lower.includes('econnrefused')
  ) {
    return 'Internet connection check karein aur dobara try karein.';
  }

  if (lower.includes('invalid-verification-code') || lower.includes('invalid code') || lower.includes('incorrect')) {
    return 'OTP galat hai. Kripya sahi OTP enter karein.';
  }

  if (lower.includes('code-expired') || lower.includes('expired')) {
    return 'OTP expire ho chuka hai. Kripya naya OTP mangwayein.';
  }

  if (lower.includes('too many') || lower.includes('too-many-requests')) {
    return 'Bahut saare attempts ho gaye hain. Kripya kuch der baad try karein.';
  }

  return msg;
}
