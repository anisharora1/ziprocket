import rateLimit, { Store, IncrementResponse } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import * as redisService from "../services/redisService";
import { Request, Response } from "express";

const redisClient = redisService.getClient();

// Custom Store that dynamically uses Redis if ready, otherwise falls back to memory
class SafeDynamicStore implements Store {
    private localStore: Record<string, { totalHits: number; resetTime: number }> = {};
    private redisStoreInstance: RedisStore | null = null;
    prefix: string;
    windowMs: number = 15 * 60 * 1000;
    options: any = null;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    init(options: any) {
        this.options = options;
        if (options && options.windowMs) {
            this.windowMs = options.windowMs;
        }
        const redisStore = this.getRedisStore();
        if (redisStore && typeof redisStore.init === 'function') {
            redisStore.init(options);
        }
    }

    private getLocalKeyInfo(key: string, windowMs: number) {
        const now = Date.now();
        if (!this.localStore[key] || this.localStore[key].resetTime < now) {
            this.localStore[key] = {
                totalHits: 0,
                resetTime: now + windowMs
            };
        }
        return this.localStore[key];
    }

    private getRedisStore(): RedisStore | null {
        if (!this.redisStoreInstance && redisClient && redisClient.status === "ready") {
            try {
                this.redisStoreInstance = new RedisStore({
                    // @ts-ignore
                    sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)),
                    prefix: `rl:${this.prefix}:`,
                });
                if (this.options && typeof this.redisStoreInstance.init === 'function') {
                    this.redisStoreInstance.init(this.options);
                }
            } catch (err: any) {
                console.error(`[RateLimit SafeStore] Failed to initialize RedisStore for ${this.prefix}:`, err.message);
            }
        }
        return this.redisStoreInstance;
    }

    async increment(key: string): Promise<IncrementResponse> {
        const redisStore = this.getRedisStore();
        if (redisClient && redisClient.status === "ready" && redisStore) {
            try {
                return await redisStore.increment(key);
            } catch (err: any) {
                console.error(`[RateLimit SafeStore Error] increment failed on Redis for ${this.prefix}: ${err.message}. Falling back to memory.`);
            }
        }

        const info = this.getLocalKeyInfo(key, this.windowMs);
        info.totalHits += 1;
        return {
            totalHits: info.totalHits,
            resetTime: new Date(info.resetTime)
        };
    }

    async decrement(key: string): Promise<void> {
        const redisStore = this.getRedisStore();
        if (redisClient && redisClient.status === "ready" && redisStore) {
            try {
                return await redisStore.decrement(key);
            } catch (err: any) {
                console.error(`[RateLimit SafeStore Error] decrement failed on Redis for ${this.prefix}: ${err.message}`);
            }
        }

        if (this.localStore[key]) {
            this.localStore[key].totalHits = Math.max(0, this.localStore[key].totalHits - 1);
        }
    }

    async resetKey(key: string): Promise<void> {
        const redisStore = this.getRedisStore();
        if (redisClient && redisClient.status === "ready" && redisStore) {
            try {
                return await redisStore.resetKey(key);
            } catch (err: any) {
                console.error(`[RateLimit SafeStore Error] resetKey failed on Redis for ${this.prefix}: ${err.message}`);
            }
        }

        delete this.localStore[key];
    }
}

// Custom logger for rate limit violations
const handleLimitReached = (limiterName: string) => {
    return (req: Request, res: Response, next: any, options: any) => {
        console.warn(
            `[SECURITY WARNING] Rate limit exceeded on [${limiterName}] limiter. ` +
            `IP: ${req.ip}, Path: ${req.originalUrl}, UA: ${req.headers["user-agent"]}`
        );
        res.status(options.statusCode).json({
            success: false,
            message: options.message,
        });
    };
};

// 1. Global API Limiter: 2000 requests per 15 minutes
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    store: new SafeDynamicStore("global"),
    message: "Too many requests. Please try again after 15 minutes.",
    handler: handleLimitReached("Global"),
});

// 2. Login Limiter: 5 attempts per 15 minutes
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: new SafeDynamicStore("login"),
    message: "Too many login attempts. Please try again after 15 minutes.",
    handler: handleLimitReached("Login"),
});

// 3. Registration Limiter: 5 attempts per 15 minutes
export const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: new SafeDynamicStore("registration"),
    message: "Too many registration attempts. Please try again after 15 minutes.",
    handler: handleLimitReached("Registration"),
});

// 4. Search Limiter: 30 requests per minute
export const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: new SafeDynamicStore("search"),
    message: "Too many search requests. Please slow down.",
    handler: handleLimitReached("Search"),
});

// 5. Payment Limiter: 5 requests per 15 minutes (strictly checked)
export const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: new SafeDynamicStore("payment"),
    message: "Too many payment requests. Please try again after 15 minutes.",
    handler: handleLimitReached("Payment"),
});

// 6. Admin Limiter: 20 requests per minute
export const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: new SafeDynamicStore("admin"),
    message: "Too many administrative requests. Please slow down.",
    handler: handleLimitReached("Admin"),
});
