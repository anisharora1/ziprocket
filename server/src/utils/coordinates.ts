export interface Coordinates {
    lat: number;
    lng: number;
}

/**
 * Validates and parses latitude and longitude coordinates.
 * Accepts numbers or numeric strings.
 * Rejects null, undefined, NaN, Infinity, (0,0), and anything outside India (lat 6 to 38, lng 68 to 98).
 */
export function parseCoordinates(lat: any, lng: any): Coordinates | null {
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
        return null;
    }

    if (typeof lat === "string" && lat.trim() === "") return null;
    if (typeof lng === "string" && lng.trim() === "") return null;

    const parsedLat = typeof lat === "number" ? lat : (typeof lat === "string" ? Number(lat.trim()) : NaN);
    const parsedLng = typeof lng === "number" ? lng : (typeof lng === "string" ? Number(lng.trim()) : NaN);

    if (isNaN(parsedLat) || isNaN(parsedLng)) return null;
    if (!isFinite(parsedLat) || !isFinite(parsedLng)) return null;

    // Reject (0, 0)
    if (parsedLat === 0 && parsedLng === 0) return null;

    // Bounds for India: lat 6 to 38, lng 68 to 98
    if (parsedLat < 6 || parsedLat > 38 || parsedLng < 68 || parsedLng > 98) {
        return null;
    }

    return { lat: parsedLat, lng: parsedLng };
}
