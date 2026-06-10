import * as redisService from "./redisService";

const SESSION_TTL = 86400; // 24 hours default

/**
 * Cache user session profile in Redis
 */
export const setSession = async (userId: string, user: any, ttlSeconds: number = SESSION_TTL): Promise<void> => {
    const key = `session:${userId}`;
    // Store user as JSON
    await redisService.setJson(key, user, ttlSeconds);
};

/**
 * Retrieve user session profile from Redis
 */
export const getSession = async (userId: string): Promise<any | null> => {
    const key = `session:${userId}`;
    return await redisService.getJson<any>(key);
};

/**
 * Clear/Invalidate user session on logout or profile update
 */
export const deleteSession = async (userId: string): Promise<void> => {
    const key = `session:${userId}`;
    await redisService.del(key);
};
