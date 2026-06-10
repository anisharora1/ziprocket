import * as redisService from "./redisService";

const CART_TTL = 604800; // 7 days in seconds

/**
 * Cache shopping cart in Redis
 */
export const cacheCart = async (userId: string, cart: any): Promise<void> => {
    const key = `cart:${userId}`;
    await redisService.setJson(key, cart, CART_TTL);
};

/**
 * Retrieve cached shopping cart
 */
export const getCachedCart = async (userId: string): Promise<any | null> => {
    const key = `cart:${userId}`;
    return await redisService.getJson<any>(key);
};

/**
 * Delete cached cart from Redis (e.g. on order completion)
 */
export const deleteCachedCart = async (userId: string): Promise<void> => {
    const key = `cart:${userId}`;
    await redisService.del(key);
};
