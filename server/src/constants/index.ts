/**
 * Centralized system constants and configurations
 */

export const DELIVERY_CONSTANTS = {
    FLAT_EARNING_RATE: 45, // INR earned per delivery by courier
    DEFAULT_DISTANCE_KM: 2.5,
    MAX_RADIUS_DETOUR_FACTOR: 1.5,
    MAX_DELIVERY_RADIUS_KM: 15,
};

export const PAGINATION_CONSTANTS = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    SEARCH_DEFAULT_LIMIT: 12,
};

export const CACHE_TTL = {
    SESSION: 3600, // 1 hour
    RESTAURANT: 600, // 10 mins
    ZONE: 1800, // 30 mins
    CART: 86400, // 24 hours
};

export const TIMEZONE = "Asia/Kolkata";
