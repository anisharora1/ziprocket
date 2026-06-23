/**
 * Centralized utility to parse and map raw technical error messages
 * into user-friendly, concise, and actionable notifications.
 */

// Helper to determine if a message is user-friendly and doesn't contain technical terms
export function isFriendlyMessage(msg: string): boolean {
  if (!msg) return false;
  
  const technicalKeywords = [
    "mongodb", "mongoose", "firebase", "sql", "database", "query", "syntax", "ref", "index", 
    "unhandled", "exception", "nullpointer", "stack", "trace", "internal server error", 
    "axios", "fetch", "network-request-failed", "too-many-requests", "code-expired",
    "jwt", "unauthorized-domain", "billing-not-enabled", "invalid-app-credential", "auth/",
    "http://", "https://", "localhost", "uncaught", "promise", "rejected", "failed with status",
    "bad request", "server error", "error code", "host", "port", "connect", "timeout", "cors"
  ];
  
  const lowercaseMsg = msg.toLowerCase();
  return !technicalKeywords.some(keyword => lowercaseMsg.includes(keyword));
}

// Extract Firebase auth error code from a message string if any
function parseFirebaseCodeFromMessage(msg: string): string | null {
  const match = msg.match(/auth\/[a-zA-Z0-9-]+/);
  return match ? match[0] : null;
}

// Convert a raw text string or known code into a clean message
export function cleanRawMessage(msg: string): string {
  if (!msg) {
    return "Something went wrong. Please try again later.";
  }
  
  const lowercaseMsg = msg.toLowerCase();

  // 1. Connection / Offline / Fetch errors
  if (
    lowercaseMsg.includes("network error") ||
    lowercaseMsg.includes("failed to fetch") ||
    lowercaseMsg.includes("err_network") ||
    lowercaseMsg.includes("network-request-failed") ||
    lowercaseMsg.includes("unable to connect") ||
    lowercaseMsg.includes("econnrefused") ||
    lowercaseMsg.includes("network request failed")
  ) {
    return "Unable to connect to the internet. Please check your connection.";
  }

  // 2. Too many attempts / Rate limiting
  if (
    lowercaseMsg.includes("too many requests") ||
    lowercaseMsg.includes("too-many-requests") ||
    lowercaseMsg.includes("rate limit") ||
    lowercaseMsg.includes("limit exceeded") ||
    lowercaseMsg.includes("blocked for 5 minutes") ||
    lowercaseMsg.includes("blocked") ||
    lowercaseMsg.includes("too_many_attempts")
  ) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  // 3. OTP verification codes
  if (
    lowercaseMsg.includes("invalid-verification-code") ||
    lowercaseMsg.includes("invalid verification code") ||
    lowercaseMsg.includes("otp you entered is incorrect") ||
    lowercaseMsg.includes("otp code is invalid") ||
    lowercaseMsg.includes("invalid or expired otp")
  ) {
    return "The OTP you entered is incorrect. Please try again.";
  }

  // 4. OTP expiration
  if (
    lowercaseMsg.includes("code-expired") ||
    lowercaseMsg.includes("expired-code") ||
    (lowercaseMsg.includes("expired") && (lowercaseMsg.includes("otp") || lowercaseMsg.includes("code") || lowercaseMsg.includes("session")))
  ) {
    return "Your OTP has expired. Please request a new OTP.";
  }

  // 5. General Firebase auth code verification failures / blocked number
  if (
    lowercaseMsg.includes("invalid-phone-number") ||
    lowercaseMsg.includes("invalid mobile number") ||
    lowercaseMsg.includes("valid 10-digit")
  ) {
    return "Please enter a valid 10-digit phone number.";
  }

  if (lowercaseMsg.includes("sms quota") || lowercaseMsg.includes("quota-exceeded") || lowercaseMsg.includes("quota exceeded")) {
    return "SMS quota exceeded. Please try again later.";
  }

  // 6. Generic database, internal server errors, or token authorization issues
  if (
    lowercaseMsg.includes("internal server error") ||
    lowercaseMsg.includes("axios error") ||
    lowercaseMsg.includes("database") ||
    lowercaseMsg.includes("mongo") ||
    lowercaseMsg.includes("mongoose") ||
    lowercaseMsg.includes("jwt") ||
    lowercaseMsg.includes("unauthorized-domain") ||
    lowercaseMsg.includes("billing-not-enabled") ||
    lowercaseMsg.includes("invalid-app-credential") ||
    lowercaseMsg.includes("token") ||
    lowercaseMsg.includes("cast to objectid") ||
    lowercaseMsg.includes("validation failed") ||
    lowercaseMsg.includes("syntaxerror") ||
    lowercaseMsg.includes("server error")
  ) {
    return "Something went wrong. Please try again later.";
  }

  // Return clean messages if they are already friendly
  if (isFriendlyMessage(msg)) {
    return msg;
  }

  return "Something went wrong. Please try again later.";
}

/**
 * Parses any incoming error object or string and returns a human-friendly string.
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) {
    return "Something went wrong. Please try again later.";
  }

  // 1. If error is already a string
  if (typeof error === "string") {
    return cleanRawMessage(error);
  }

  // 2. Firebase SDK Error (has code like auth/...)
  const firebaseCode = error.code || (error.message ? parseFirebaseCodeFromMessage(error.message) : null);
  if (firebaseCode) {
    if (firebaseCode === "auth/invalid-verification-code") {
      return "The OTP you entered is incorrect. Please try again.";
    }
    if (firebaseCode === "auth/network-request-failed") {
      return "Unable to connect to the internet. Please check your connection.";
    }
    if (firebaseCode === "auth/too-many-requests") {
      return "Too many attempts. Please wait a few minutes and try again.";
    }
    if (firebaseCode === "auth/code-expired") {
      return "Your OTP has expired. Please request a new OTP.";
    }
    if (firebaseCode === "auth/invalid-phone-number") {
      return "Please enter a valid 10-digit phone number.";
    }
    if (firebaseCode === "auth/quota-exceeded") {
      return "SMS quota exceeded. Please try again later.";
    }
    if (firebaseCode.startsWith("auth/")) {
      return "We could not verify your number right now. Please try again.";
    }
  }

  // 3. Axios Error Response
  if (error.response) {
    const status = error.response.status;
    const backendMessage = error.response.data?.message || error.response.data?.error || "";

    if (status === 429) {
      return "Too many attempts. Please wait a few minutes and try again.";
    }
    if (status === 401 || status === 403) {
      // Keep customized auth messages if they are clean (e.g. "Your application is pending admin approval...")
      if (backendMessage && isFriendlyMessage(backendMessage)) {
        return backendMessage;
      }
      return "You are not authorized to perform this action. Please log in again.";
    }
    if (status >= 500) {
      return "Something went wrong. Please try again later.";
    }

    if (backendMessage) {
      return cleanRawMessage(backendMessage);
    }
  } else if (error.request) {
    // Axios request made but no response (offline / timeout)
    return "Unable to connect to the internet. Please check your connection.";
  }

  // 4. Standard Javascript Error object or message
  if (error.message) {
    return cleanRawMessage(error.message);
  }

  return "Something went wrong. Please try again later.";
}
