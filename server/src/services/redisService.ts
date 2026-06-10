import Redis from "ioredis";

const isEnabled = process.env.REDIS_ENABLED !== "false";
let redisClient: Redis | null = null;

if (isEnabled) {
    try {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || "127.0.0.1",
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            retryStrategy(times) {
                // Return a delay after which to retry, max 2000ms
                return Math.min(times * 100, 2000);
            }
        });

        redisClient.on("error", (err) => {
            console.error("[Redis Error]", err.message);
        });

        redisClient.on("connect", () => {
            console.log("Redis connected successfully 🚀");
        });

        redisClient.connect().catch((err) => {
            console.error("Failed to connect to Redis on startup:", err.message);
        });
    } catch (e: any) {
        console.error("Failed to initialize Redis Client:", e.message);
        redisClient = null;
    }
} else {
    console.log("Redis caching is explicitly disabled in .env");
}

export const getClient = (): Redis | null => redisClient;

/**
 * Get a value by key
 */
export const get = async (key: string): Promise<string | null> => {
    if (!redisClient) return null;
    try {
        return await redisClient.get(key);
    } catch (error: any) {
        console.error(`[Redis GET Failed] Key: ${key}. Error:`, error.message);
        return null;
    }
};

/**
 * Set a key with optional TTL (in seconds)
 */
export const set = async (key: string, value: string, ttlSeconds?: number): Promise<void> => {
    if (!redisClient) return;
    try {
        if (ttlSeconds && ttlSeconds > 0) {
            await redisClient.set(key, value, "EX", ttlSeconds);
        } else {
            await redisClient.set(key, value);
        }
    } catch (error: any) {
        console.error(`[Redis SET Failed] Key: ${key}. Error:`, error.message);
    }
};

/**
 * Set JSON object directly
 */
export const setJson = async (key: string, val: any, ttlSeconds?: number): Promise<void> => {
    await set(key, JSON.stringify(val), ttlSeconds);
};

/**
 * Get and parse JSON object directly
 */
export const getJson = async <T>(key: string): Promise<T | null> => {
    const data = await get(key);
    if (!data) return null;
    try {
        return JSON.parse(data) as T;
    } catch (error: any) {
        console.error(`[Redis JSON Parse Failed] Key: ${key}. Error:`, error.message);
        return null;
    }
};

/**
 * Delete a key
 */
export const del = async (key: string): Promise<void> => {
    if (!redisClient) return;
    try {
        await redisClient.del(key);
    } catch (error: any) {
        console.error(`[Redis DEL Failed] Key: ${key}. Error:`, error.message);
    }
};

/**
 * Increment a key's integer value
 */
export const incr = async (key: string): Promise<number> => {
    if (!redisClient) return 0;
    try {
        return await redisClient.incr(key);
    } catch (error: any) {
        console.error(`[Redis INCR Failed] Key: ${key}. Error:`, error.message);
        return 0;
    }
};

/**
 * Set expiration for a key (in seconds)
 */
export const expire = async (key: string, seconds: number): Promise<void> => {
    if (!redisClient) return;
    try {
        await redisClient.expire(key, seconds);
    } catch (error: any) {
        console.error(`[Redis EXPIRE Failed] Key: ${key}. Error:`, error.message);
    }
};

/**
 * Delete keys by pattern (using non-blocking SCAN in production)
 */
export const deletePattern = async (pattern: string): Promise<void> => {
    if (!redisClient) return;
    try {
        let cursor = "0";
        do {
            const reply = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
            cursor = reply[0];
            const keys = reply[1];
            if (keys.length > 0) {
                await redisClient.del(...keys);
            }
        } while (cursor !== "0");
    } catch (error: any) {
        console.error(`[Redis DeletePattern Failed] Pattern: ${pattern}. Error:`, error.message);
    }
};
