import {
    getAutocompleteSuggestions,
    getPlaceDetails,
    getReverseGeocode
} from "../utils/googleMaps";

/**
 * Validates latitude and longitude format and range limits
 */
export const validateCoordinates = (lat: any, lng: any): { isValid: boolean; latNum?: number; lngNum?: number } => {
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
        return { isValid: false };
    }
    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        return { isValid: false };
    }
    return { isValid: true, latNum, lngNum };
};

/**
 * Helper to format coordinates into a standard GeoJSON Point object
 */
export const toGeoJSONPoint = (lat: number, lng: number) => {
    return {
        type: "Point",
        coordinates: [lng, lat] // [longitude, latitude] sequence per GeoJSON spec
    };
};

/**
 * Coordinate with Google Maps Place Autocomplete
 */
export const fetchAutocompleteSuggestions = async (input: string) => {
    return await getAutocompleteSuggestions(input);
};

/**
 * Coordinate with Google Maps Place Details
 */
export const fetchPlaceDetails = async (placeId: string) => {
    return await getPlaceDetails(placeId);
};

/**
 * Coordinate with Google Maps Reverse Geocode
 */
export const fetchReverseGeocode = async (lat: number, lng: number) => {
    return await getReverseGeocode(lat, lng);
};

/**
 * Coordinates OpenStreetMap Nominatim API calls to geocode address texts
 */
export const geocodeAddressText = async (address: string) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
    const response = await fetch(url, {
        headers: {
            "User-Agent": "ZipRocket/1.0"
        }
    });
    const data = await response.json() as any[];

    if (!data || data.length === 0) {
        return null;
    }

    const resolved = data[0];
    let pincode = resolved.address?.postcode || "";
    if (!pincode) {
        const match = (resolved.display_name || "").match(/\b\d{6}\b/);
        if (match) pincode = match[0];
    }

    return {
        fullAddress: resolved.display_name,
        lat: parseFloat(resolved.lat),
        lng: parseFloat(resolved.lon),
        pincode,
        city: resolved.address?.town || resolved.address?.city || resolved.address?.village || resolved.address?.suburb || resolved.address?.state_district || resolved.address?.county || "Unknown",
        state: resolved.address?.state || "Bihar",
        country: resolved.address?.country || "India"
    };
};
