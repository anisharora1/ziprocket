import { Request, Response, NextFunction } from "express";
import * as redisService from "./redisService";

interface RateLimiterOptions {
    prefix: string;      // e.g., "auth:otp", "search"
    limit: number;       // Max number of requests allowed in the window
    windowSecs: number;  // Window duration in seconds
    message?: string;    // Custom error message
}

/**
 * Creates an Express middleware that rate limits requests based on client identifier (User ID or IP)
 */
export const createRateLimiter = (options: RateLimiterOptions) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Safe bypass if Redis is disabled or down
        if (process.env.REDIS_ENABLED === "false" || !redisService.getClient()) {
            return next();
        }

        try {
            // Identify client by user ID if logged in, otherwise IP
            const identifier = req.user?._id?.toString() || req.ip || "anonymous";
            const key = `ratelimit:${options.prefix}:${identifier}`;

            const current = await redisService.incr(key);

            if (current === 1) {
                // Set TTL for window on first request
                await redisService.expire(key, options.windowSecs);
            }

            res.setHeader("X-RateLimit-Limit", options.limit);
            res.setHeader("X-RateLimit-Remaining", Math.max(0, options.limit - current));

            if (current > options.limit) {
                res.status(429).json({
                    success: false,
                    message: options.message || "Too many requests. Please try again later."
                });
                return;
            }

            next();
        } catch (error: any) {
            console.error(`[RateLimiter Error] Prefix: ${options.prefix}. Error:`, error.message);
            next(); // Fail-safe fallback: allow request if rate limiting system fails
        }
    };
};
export default createRateLimiter;
