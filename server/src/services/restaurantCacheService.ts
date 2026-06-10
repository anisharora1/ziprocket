import * as redisService from "./redisService";

const CACHE_TTL = 3600; // 1 hour

/**
 * Cache a restaurant list query result
 */
export const cacheRestaurantList = async (keySuffix: string, list: any[]): Promise<void> => {
    const key = `restaurants:${keySuffix}`;
    await redisService.setJson(key, list, CACHE_TTL);
};

/**
 * Retrieve cached restaurant list query result
 */
export const getCachedRestaurantList = async (keySuffix: string): Promise<any[] | null> => {
    const key = `restaurants:${keySuffix}`;
    return await redisService.getJson<any[]>(key);
};

/**
 * Cache single restaurant details
 */
export const cacheRestaurantDetail = async (id: string, detail: any): Promise<void> => {
    const key = `restaurant:detail:${id}`;
    await redisService.setJson(key, detail, CACHE_TTL);
};

/**
 * Retrieve cached single restaurant details
 */
export const getCachedRestaurantDetail = async (id: string): Promise<any | null> => {
    const key = `restaurant:detail:${id}`;
    return await redisService.getJson<any>(key);
};

/**
 * Cache menu items list for a restaurant
 */
export const cacheRestaurantMenu = async (restaurantId: string, menu: any[]): Promise<void> => {
    const key = `restaurant:menu:${restaurantId}`;
    await redisService.setJson(key, menu, CACHE_TTL);
};

/**
 * Retrieve cached menu items list for a restaurant
 */
export const getCachedRestaurantMenu = async (restaurantId: string): Promise<any[] | null> => {
    const key = `restaurant:menu:${restaurantId}`;
    return await redisService.getJson<any[]>(key);
};

/**
 * Invalidate cached restaurant details, menus, and listings on mutations
 */
export const invalidateRestaurantCache = async (restaurantId?: string): Promise<void> => {
    // 1. Invalidate listings (popular, all, search lists)
    await redisService.deletePattern("restaurants:*");
    
    // 2. Invalidate specific restaurant details if id provided
    if (restaurantId) {
        await redisService.del(`restaurant:detail:${restaurantId}`);
        await redisService.del(`restaurant:menu:${restaurantId}`);
    }
};
