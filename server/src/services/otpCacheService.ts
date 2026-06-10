import * as redisService from "./redisService";

const OTP_TTL = 300; // 5 minutes
const RESEND_LIMIT_TTL = 900; // 15 minutes
const ATTEMPT_LIMIT_TTL = 900; // 15 minutes

const MAX_RESEND_ATTEMPTS = 3;
const MAX_VERIFY_ATTEMPTS = 5;

// In-memory fallback stores when Redis is disabled/offline
const otpStore = new Map<string, { code: string; expiresAt: number }>();
const attemptsStore = new Map<string, { count: number; expiresAt: number }>();
const resendStore = new Map<string, { count: number; expiresAt: number }>();
const metadataStore = new Map<string, { ip: string; userAgent: string; expiresAt: number }>();

const isRedisReady = (): boolean => {
    const client = redisService.getClient();
    return process.env.REDIS_ENABLED !== "false" && client !== null && client.status === "ready";
};

/**
 * Save OTP code in Redis (or in-memory fallback)
 */
export const saveOtp = async (phone: string, code: string): Promise<void> => {
    if (isRedisReady()) {
        const key = `otp:code:${phone}`;
        await redisService.set(key, code, OTP_TTL);
        
        // Reset failed verification attempts for this request
        const attemptsKey = `otp:attempts:${phone}`;
        await redisService.del(attemptsKey);
        return;
    }

    // Memory Fallback
    const now = Date.now();
    otpStore.set(phone, { code, expiresAt: now + OTP_TTL * 1000 });
    attemptsStore.delete(phone);
};

/**
 * Get OTP code from Redis (or in-memory fallback)
 */
export const getOtp = async (phone: string): Promise<string | null> => {
    if (isRedisReady()) {
        return await redisService.get(`otp:code:${phone}`);
    }

    // Memory Fallback
    const now = Date.now();
    const entry = otpStore.get(phone);
    if (entry && entry.expiresAt > now) {
        return entry.code;
    }
    otpStore.delete(phone);
    return null;
};

/**
 * Delete OTP code from Redis (or in-memory fallback)
 */
export const deleteOtp = async (phone: string): Promise<void> => {
    if (isRedisReady()) {
        await redisService.del(`otp:code:${phone}`);
        await redisService.del(`otp:attempts:${phone}`);
        await redisService.del(`otp:metadata:${phone}`);
        return;
    }

    // Memory Fallback
    otpStore.delete(phone);
    attemptsStore.delete(phone);
    metadataStore.delete(phone);
};

/**
 * Increment and get resend attempts
 */
export const incrementResendAttempts = async (phone: string): Promise<number> => {
    if (isRedisReady()) {
        const key = `otp:resend_limit:${phone}`;
        const count = await redisService.incr(key);
        if (count === 1) {
            await redisService.expire(key, RESEND_LIMIT_TTL);
        }
        return count;
    }

    // Memory Fallback
    const now = Date.now();
    const entry = resendStore.get(phone);
    if (entry && entry.expiresAt > now) {
        entry.count += 1;
        return entry.count;
    } else {
        resendStore.set(phone, { count: 1, expiresAt: now + RESEND_LIMIT_TTL * 1000 });
        return 1;
    }
};

/**
 * Get resend attempts count
 */
export const getResendAttempts = async (phone: string): Promise<number> => {
    if (isRedisReady()) {
        const count = await redisService.get(keyForResendLimit(phone));
        return count ? parseInt(count, 10) : 0;
    }

    // Memory Fallback
    const now = Date.now();
    const entry = resendStore.get(phone);
    if (entry && entry.expiresAt > now) {
        return entry.count;
    }
    resendStore.delete(phone);
    return 0;
};

/**
 * Increment and get failed verification attempts
 */
export const incrementFailedAttempts = async (phone: string): Promise<number> => {
    if (isRedisReady()) {
        const key = `otp:attempts:${phone}`;
        const count = await redisService.incr(key);
        if (count === 1) {
            await redisService.expire(key, ATTEMPT_LIMIT_TTL);
        }
        return count;
    }

    // Memory Fallback
    const now = Date.now();
    const entry = attemptsStore.get(phone);
    if (entry && entry.expiresAt > now) {
        entry.count += 1;
        return entry.count;
    } else {
        attemptsStore.set(phone, { count: 1, expiresAt: now + ATTEMPT_LIMIT_TTL * 1000 });
        return 1;
    }
};

/**
 * Get failed verification attempts count
 */
export const getFailedAttempts = async (phone: string): Promise<number> => {
    if (isRedisReady()) {
        const count = await redisService.get(`otp:attempts:${phone}`);
        return count ? parseInt(count, 10) : 0;
    }

    // Memory Fallback
    const now = Date.now();
    const entry = attemptsStore.get(phone);
    if (entry && entry.expiresAt > now) {
        return entry.count;
    }
    attemptsStore.delete(phone);
    return 0;
};

/**
 * Check if the number of resend attempts has been exceeded
 */
export const isResendLimitExceeded = async (phone: string): Promise<boolean> => {
    const count = await getResendAttempts(phone);
    return count >= MAX_RESEND_ATTEMPTS;
};

/**
 * Check if verification is blocked due to too many failed attempts
 */
export const isVerifyBlocked = async (phone: string): Promise<boolean> => {
    const count = await getFailedAttempts(phone);
    return count >= MAX_VERIFY_ATTEMPTS;
};

/**
 * Save OTP request metadata (IP and User-Agent)
 */
export const saveOtpMetadata = async (phone: string, metadata: { ip: string; userAgent: string }): Promise<void> => {
    if (isRedisReady()) {
        const key = `otp:metadata:${phone}`;
        await redisService.setJson(key, metadata, OTP_TTL);
        return;
    }

    // Memory Fallback
    const now = Date.now();
    metadataStore.set(phone, { ...metadata, expiresAt: now + OTP_TTL * 1000 });
};

/**
 * Get OTP request metadata (IP and User-Agent)
 */
export const getOtpMetadata = async (phone: string): Promise<{ ip: string; userAgent: string } | null> => {
    if (isRedisReady()) {
        const key = `otp:metadata:${phone}`;
        return await redisService.getJson<{ ip: string; userAgent: string }>(key);
    }

    // Memory Fallback
    const now = Date.now();
    const entry = metadataStore.get(phone);
    if (entry && entry.expiresAt > now) {
        return { ip: entry.ip, userAgent: entry.userAgent };
    }
    metadataStore.delete(phone);
    return null;
};

// Private helper
const keyForResendLimit = (phone: string): string => `otp:resend_limit:${phone}`;
