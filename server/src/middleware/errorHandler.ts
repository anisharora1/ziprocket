import { Request, Response, NextFunction } from "express";

// Check if a message contains technical details that shouldn't be exposed
function isTechnicalError(msg: string): boolean {
  if (!msg) return true;
  
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

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Log the full technical error internally for debugging
  console.error("[Global Error Handler] Caught internal error:", {
    message: err.message,
    stack: err.stack,
    status: err.status || err.statusCode,
    originalError: err
  });

  const status = err.status || err.statusCode || 500;
  let message = err.message || "Something went wrong. Please try again later.";

  // Overwrite database, system, or 500 messages with a friendly fallback
  if (status === 500 || isTechnicalError(message)) {
    message = "Something went wrong. Please try again later.";
  }

  res.status(status).json({
    success: false,
    message
  });
};
