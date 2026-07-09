import { Request, Response, NextFunction } from "express";

// Check if a message contains technical details that shouldn't be exposed
function isTechnicalError(msg: string): boolean {
  if (!msg) return false;
  
  const technicalKeywords = [
    "mongodb", "mongoose", "database", "sql", "query", "syntax", "ref", "index", 
    "unhandled", "exception", "nullpointer", "stack", "trace", "internal server error", 
    "axios", "fetch", "network-request-failed", "too-many-requests", "code-expired",
    "jwt", "unauthorized-domain", "billing-not-enabled", "invalid-app-credential", "auth/",
    "http://", "https://", "localhost", "uncaught", "promise", "rejected", "failed with status",
    "cast to objectid", "validation failed", "syntaxerror", "server error", "connection",
    "dial tcp", "econnrefused", "timeout", "duplicate key", "write conflict"
  ];
  
  const lowercaseMsg = msg.toLowerCase();
  return technicalKeywords.some(keyword => lowercaseMsg.includes(keyword));
}

export const responseStandardizer = (req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json;

  res.json = function (body: any): Response {
    if (body && typeof body === "object") {
      const { success, message, ...rest } = body;

      if (success === true) {
        // If it is already in the exact standardized structure (success, message, data), preserve it
        const keys = Object.keys(body);
        if (
          keys.length === 3 &&
          keys.includes("success") &&
          keys.includes("message") &&
          keys.includes("data")
        ) {
          return originalJson.call(this, body);
        }

        // Standardize success response
        const standardizedBody = {
          success: true,
          message: message || "Operation completed successfully",
          data: rest
        };

        return originalJson.call(this, standardizedBody);
      } else if (success === false) {
        const errors = body.errors || [];
        let cleanMessage = message || "Something went wrong. Please try again later.";

        // Overwrite internal server errors, db errors, or status 500 error messages with a friendly fallback
        if (res.statusCode === 500 || isTechnicalError(cleanMessage)) {
          cleanMessage = "Something went wrong. Please try again later.";
        }

        const standardizedBody = {
          success: false,
          message: cleanMessage,
          errors
        };

        return originalJson.call(this, standardizedBody);
      }
    }

    return originalJson.call(this, body);
  };

  next();
};
