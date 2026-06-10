import * as redisService from "./redisService";

const ZONE_LIST_TTL = 3600; // 1 hour
const FEASIBILITY_TTL = 600; // 10 minutes

/**
 * Generate a cache key for serviceability check, rounding geocoordinates to 4 decimals (approx. 11 meters)
 */
export const getServiceabilityKey = (
    lat?: number,
    lng?: number,
    pincode?: string,
    addressText?: string
): string => {
    const roundedLat = lat !== undefined ? lat.toFixed(4) : "no_lat";
    const roundedLng = lng !== undefined ? lng.toFixed(4) : "no_lng";
    const cleanPin = pincode ? pincode.toString().trim() : "no_pin";
    const cleanAddress = addressText ? addressText.toLowerCase().replace(/[^a-z0-9]/g, "") : "no_address";
    
    return `zone:serviceable:${roundedLat}:${roundedLng}:${cleanPin}:${cleanAddress}`;
};

/**
 * Cache all active zones list
 */
export const cacheAllZones = async (zones: any[]): Promise<void> => {
    await redisService.setJson("zone:all", zones, ZONE_LIST_TTL);
};

/**
 * Retrieve cached active zones list
 */
export const getCachedAllZones = async (): Promise<any[] | null> => {
    return await redisService.getJson<any[]>("zone:all");
};

/**
 * Cache a feasibility validation result
 */
export const cacheServiceability = async (key: string, result: any): Promise<void> => {
    await redisService.setJson(key, result, FEASIBILITY_TTL);
};

/**
 * Retrieve cached feasibility validation result
 */
export const getCachedServiceability = async (key: string): Promise<any | null> => {
    return await redisService.getJson<any>(key);
};

/**
 * Invalidate all zone caches on mutations
 */
export const invalidateZoneCache = async (): Promise<void> => {
    await redisService.del("zone:all");
    await redisService.deletePattern("zone:serviceable:*");
    await redisService.deletePattern("zone:feasibility:*");
};
