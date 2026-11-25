import * as redisService from "./redisService";

const MOBILE_CONFIG_TTL = 60; // 60 seconds
const MOBILE_CONFIG_PREFIX = "app_config:mobile";

export interface CachedMobileConfig {
    payload: any;
    etag: string;
}

export const getMobileConfigKey = (surface: string, zoneId?: string): string => {
    const zoneKey = zoneId && zoneId.trim() ? zoneId.trim() : "all";
    return `${MOBILE_CONFIG_PREFIX}:${surface}:${zoneKey}`;
};

export const getCachedMobileConfig = async (
    surface: string,
    zoneId?: string
): Promise<CachedMobileConfig | null> => {
    const key = getMobileConfigKey(surface, zoneId);
    return await redisService.getJson<CachedMobileConfig>(key);
};

export const cacheMobileConfig = async (
    surface: string,
    zoneId: string | undefined,
    data: CachedMobileConfig
): Promise<void> => {
    const key = getMobileConfigKey(surface, zoneId);
    await redisService.setJson(key, data, MOBILE_CONFIG_TTL);
};

export const invalidateMobileConfigCache = async (): Promise<void> => {
    await redisService.deletePattern(`${MOBILE_CONFIG_PREFIX}:*`);
};
