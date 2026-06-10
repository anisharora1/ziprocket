import { Request, Response, NextFunction } from "express";
import * as redisService from "../services/redisService";
import * as otpCacheService from "../services/otpCacheService";

// In-memory fallback maps if Redis is disabled/down
const ipLimitMap = new Map<string, { count: number; resetTime: number }>();
const phoneLimitMap = new Map<string, { count: number; resetTime: number }>();

const OTP_LIMIT_WINDOW_SECS = 900; // 15 minutes
const MAX_OTP_REQUESTS = 3;

// Helper to check if Redis is connected and ready
const isRedisReady = (): boolean => {
    const client = redisService.getClient();
    return process.env.REDIS_ENABLED !== "false" && client !== null && client.status === "ready";
};

/**
 * Checks and increments OTP request limits per phone and per IP
 */
export const otpRequestLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { phone } = req.body;
        if (!phone) {
            res.status(400).json({ success: false, message: "Phone number is required" });
            return;
        }

        const cleanPhone = phone.replace(/\D/g, "").slice(-10);
        if (cleanPhone.length < 10) {
            res.status(400).json({ success: false, message: "Valid 10-digit phone number is required" });
            return;
        }

        const ip = req.ip || "unknown";
        const now = Date.now();

        // 1. IP Rate Limiting Check
        let ipCount = 0;
        if (isRedisReady()) {
            const ipKey = `otp:req:ip:${ip}`;
            try {
                ipCount = await redisService.incr(ipKey);
                if (ipCount === 1) {
                    await redisService.expire(ipKey, OTP_LIMIT_WINDOW_SECS);
                }
            } catch (redisErr: any) {
                console.error(`[otpRequestLimiter Redis Error] IP limit incr failed: ${redisErr.message}`);
                ipCount = 0; // Fall back to memory
            }
        }

        // Memory Fallback if Redis failed or is offline
        if (ipCount === 0) {
            const record = ipLimitMap.get(ip);
            if (record && record.resetTime > now) {
                record.count += 1;
                ipCount = record.count;
            } else {
                ipLimitMap.set(ip, { count: 1, resetTime: now + OTP_LIMIT_WINDOW_SECS * 1000 });
                ipCount = 1;
            }
        }

        if (ipCount > MAX_OTP_REQUESTS) {
            console.warn(`[SECURITY WARNING] OTP request limit exceeded by IP: ${ip} for phone: +91${cleanPhone}`);
            res.status(429).json({
                success: false,
                message: "Too many OTP requests from this device. Please try again after 15 minutes.",
            });
            return;
        }

        // 2. Phone Rate Limiting Check
        let phoneCount = 0;
        if (isRedisReady()) {
            const phoneKey = `otp:req:phone:${cleanPhone}`;
            try {
                phoneCount = await redisService.incr(phoneKey);
                if (phoneCount === 1) {
                    await redisService.expire(phoneKey, OTP_LIMIT_WINDOW_SECS);
                }
            } catch (redisErr: any) {
                console.error(`[otpRequestLimiter Redis Error] Phone limit incr failed: ${redisErr.message}`);
                phoneCount = 0; // Fall back to memory
            }
        }

        // Memory Fallback if Redis failed or is offline
        if (phoneCount === 0) {
            const record = phoneLimitMap.get(cleanPhone);
            if (record && record.resetTime > now) {
                record.count += 1;
                phoneCount = record.count;
            } else {
                phoneLimitMap.set(cleanPhone, { count: 1, resetTime: now + OTP_LIMIT_WINDOW_SECS * 1000 });
                phoneCount = 1;
            }
        }

        if (phoneCount > MAX_OTP_REQUESTS) {
            console.warn(`[SECURITY WARNING] OTP request limit exceeded for phone: +91${cleanPhone} by IP: ${ip}`);
            res.status(429).json({
                success: false,
                message: "OTP request limit exceeded for this phone number. Please try again after 15 minutes.",
            });
            return;
        }

        next();
    } catch (error: any) {
        console.error("[otpRequestLimiter Error]", error.message);
        next(); // Fail-safe fallback
    }
};

/**
 * Checks if the phone number is currently locked out from verification
 */
export const otpVerificationLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return next(); // If verifying via Firebase token, skip phone-based lockout check
        }

        const cleanPhone = phone.replace(/\D/g, "").slice(-10);
        
        let isBlocked = false;
        if (isRedisReady()) {
            try {
                isBlocked = await otpCacheService.isVerifyBlocked(cleanPhone);
            } catch (redisErr: any) {
                console.error(`[otpVerificationLimiter Redis Error] isVerifyBlocked failed: ${redisErr.message}`);
            }
        }

        if (isBlocked) {
            console.warn(`[SECURITY WARNING] Blocked verify attempt for locked out phone: +91${cleanPhone} from IP: ${req.ip}`);
            res.status(429).json({
                success: false,
                message: "Too many failed attempts. Verification is locked for 15 minutes.",
            });
            return;
        }

        next();
    } catch (error: any) {
        console.error("[otpVerificationLimiter Error]", error.message);
        next();
    }
};
