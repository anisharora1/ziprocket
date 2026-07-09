import * as redisService from "../services/redisService";

const FRONTEND_REFERER = "http://localhost:3000/";
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface LandmarkResult {
    name: string;
    category: string;
    distance: number;
    priority: number;
}

export interface AddressComponents {
    village: string;
    locality: string;
    sublocality: string;
    neighborhood: string;
    wardNo: string;
    district: string;
    state: string;
    postalCode: string;
}

const LANDMARK_CATEGORIES = [
    {
        category: "Market",
        priority: 1,
        types: [
            "shopping_mall", "supermarket", "grocery_store", "market",
            "department_store", "convenience_store", "store", "clothing_store"
        ]
    },
    {
        category: "School",
        priority: 2,
        types: ["school", "primary_school", "secondary_school", "university", "college", "preschool"]
    },
    {
        category: "Hospital",
        priority: 3,
        types: ["hospital", "medical_clinic", "dentist", "doctor", "pharmacy", "drugstore"]
    },
    {
        category: "Temple",
        priority: 4,
        types: ["place_of_worship", "hindu_temple", "church", "mosque", "synagogue", "shrine"]
    },
    {
        category: "Petrol Pump",
        priority: 5,
        types: ["gas_station"]
    },
    {
        category: "Bus Stop",
        priority: 6,
        types: ["bus_stop", "bus_station", "transit_station", "train_station"]
    },
    {
        category: "Government Office",
        priority: 7,
        types: [
            "local_government_office", "city_hall", "town_hall", "post_office",
            "police", "courthouse", "fire_station", "embassy"
        ]
    }
];

/**
 * Computes distance in meters between two geocoordinates using the Haversine formula
 */
export const getHaversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lng2 - lng1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Detects if a given address string contains a Plus Code
 */
export const detectPlusCode = (address: string): boolean => {
    return /[a-z0-9]{2,8}\+[a-z0-9]{2,3}/i.test(address);
};

/**
 * Removes Plus Codes from an address string and cleans up separators
 */
export const cleanPlusCode = (address: string): string => {
    const plusCodeRegex = /[a-z0-9]{2,8}\+[a-z0-9]{2,3}/i;
    let cleaned = address.replace(plusCodeRegex, "").trim();
    cleaned = cleaned.replace(/^[\s,:-]+/, "").replace(/[\s,:-]+$/, "").trim();
    cleaned = cleaned.replace(/,\s*,/g, ", ");
    return cleaned;
};

/**
 * Determines if a geocoded address is incomplete (e.g. Plus Code, or lacking street/locality details)
 */
export const isIncompleteAddress = (components: any[], formattedAddress: string): boolean => {
    if (detectPlusCode(formattedAddress)) {
        return true;
    }

    const localTypes = [
        "sublocality",
        "sublocality_level_1",
        "sublocality_level_2",
        "sublocality_level_3",
        "locality",
        "neighborhood",
        "route",
        "street_number",
        "premise",
        "subpremise",
        "establishment",
        "point_of_interest"
    ];

    const hasLocalDetails = components.some(comp =>
        comp.types.some((t: string) => localTypes.includes(t))
    );

    return !hasLocalDetails;
};

/**
 * Fetches nearby places using the Google Places API v1 searchNearby endpoint (cached for 24h)
 */
export const fetchNearbyPlaces = async (lat: number, lng: number): Promise<any[]> => {
    const roundedLat = lat.toFixed(4);
    const roundedLng = lng.toFixed(4);
    const cacheKey = `places:nearby:${roundedLat}:${roundedLng}`;

    // Try cache first
    try {
        const cached = await redisService.getJson<any[]>(cacheKey);
        if (cached) {
            console.log(`[Cache Hit] Nearby places for key: ${cacheKey}`);
            return cached;
        }
    } catch (err: any) {
        console.warn("Failed to read places cache:", err.message);
    }

    console.log(`[Cache Miss] Fetching nearby places for lat: ${lat}, lng: ${lng}`);
    try {
        const url = "https://places.googleapis.com/v1/places:searchNearby";
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_API_KEY || "",
                "X-Goog-FieldMask": "places.displayName,places.types,places.location,places.formattedAddress",
                "Referer": FRONTEND_REFERER
            },
            body: JSON.stringify({
                locationRestriction: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: 1000.0 // Search up to 1000m
                    }
                },
                maxResultCount: 20
            })
        });
        const data = await res.json() as any;
        const places = data.places || [];

        // Cache result for 24 hours
        try {
            await redisService.setJson(cacheKey, places, 86400);
        } catch (cErr: any) {
            console.warn("Failed to write places cache:", cErr.message);
        }

        return places;
    } catch (err) {
        console.error("Error fetching nearby places from Google API:", err);
        return [];
    }
};

/**
 * Prioritizes and selects the best landmark within close, mid, and far distance bands
 */
export const getBestLandmark = (places: any[], lat: number, lng: number): LandmarkResult | null => {
    const landmarks: LandmarkResult[] = [];

    for (const place of places) {
        const displayName = place.displayName?.text;
        const types = place.types || [];
        const loc = place.location;

        if (!displayName || !loc) continue;

        // Find if this place matches any prioritized category
        for (const cat of LANDMARK_CATEGORIES) {
            const matches = types.some((t: string) => cat.types.includes(t));
            if (matches) {
                const distance = getHaversineDistance(lat, lng, loc.latitude, loc.longitude);
                landmarks.push({
                    name: displayName,
                    category: cat.category,
                    distance,
                    priority: cat.priority
                });
                break;
            }
        }
    }

    if (landmarks.length === 0) return null;

    // Filter into three distance bands:
    const ultraClose = landmarks.filter(l => l.distance <= 150);
    const close = landmarks.filter(l => l.distance > 150 && l.distance <= 500);
    const nearby = landmarks.filter(l => l.distance > 500 && l.distance <= 1000);

    const selectBestInList = (list: LandmarkResult[]): LandmarkResult | null => {
        if (list.length === 0) return null;
        // Sort by category priority, then by distance (closest first)
        return list.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.distance - b.distance;
        })[0];
    };

    return selectBestInList(ultraClose) || selectBestInList(close) || selectBestInList(nearby) || null;
};

/**
 * Aggregates detailed components from Google Geocoding API results list
 */
export const extractGoogleComponents = (results: any[]): AddressComponents => {
    let village = "";
    let locality = "";
    let sublocality = "";
    let neighborhood = "";
    let wardNo = "";
    let district = "";
    let state = "";
    let postalCode = "";

    // Scan across all results to capture components
    for (const res of results) {
        if (res.address_components) {
            for (const comp of res.address_components) {
                const types = comp.types;
                const longName = comp.long_name;

                if (types.includes("postal_code") && !postalCode) {
                    postalCode = longName;
                }
                if (types.includes("administrative_area_level_1") && !state) {
                    state = longName;
                }
                if (types.includes("administrative_area_level_2") && !district) {
                    district = longName;
                }
                if (types.includes("locality") && !locality) {
                    locality = longName;
                }
                if (types.includes("sublocality") || types.includes("sublocality_level_1")) {
                    if (!sublocality) sublocality = longName;
                }
                if (types.includes("sublocality_level_2") || types.includes("sublocality_level_3") || types.includes("neighborhood")) {
                    if (!neighborhood) neighborhood = longName;
                }

                // Ward No detection
                const wardMatch = longName.match(/(?:ward\s+(?:no\.?\s*)?|ward\s+number\s+)(\d+)/i);
                if (wardMatch && !wardNo) {
                    wardNo = `Ward No ${wardMatch[1]}`;
                }
            }
        }

        if (res.formatted_address && !wardNo) {
            const wardMatch = res.formatted_address.match(/(?:ward\s+(?:no\.?\s*)?|ward\s+number\s+)(\d+)/i);
            if (wardMatch) {
                wardNo = `Ward No ${wardMatch[1]}`;
            }
        }
    }

    // Rural village check: in India, level_3 (tehsil/taluka) or level_4/5 (village/panchayat)
    for (const res of results) {
        if (res.address_components) {
            for (const comp of res.address_components) {
                const types = comp.types;
                if (types.includes("administrative_area_level_3") || types.includes("administrative_area_level_4") || types.includes("administrative_area_level_5")) {
                    if (!village && comp.long_name !== district && comp.long_name !== state) {
                        village = comp.long_name;
                    }
                }
            }
        }
    }

    return { village, locality, sublocality, neighborhood, wardNo, district, state, postalCode };
};

/**
 * Aggregates detailed components from OpenStreetMap Nominatim reverse address details
 */
export const extractNominatimComponents = (address: any, displayName: string): AddressComponents => {
    const village = address.village || address.hamlet || address.isolated_dwelling || address.croft || address.town || "";
    const locality = address.suburb || address.neighbourhood || address.residential || "";
    const sublocality = address.allotments || address.quarter || "";
    const neighborhood = address.neighbourhood || "";
    const district = address.state_district || address.county || address.district || "";
    const state = address.state || "";
    const postalCode = address.postcode || "";

    let wardNo = "";
    const wardMatch = displayName.match(/(?:ward\s+(?:no\.?\s*)?|ward\s+number\s+)(\d+)/i);
    if (wardMatch) {
        wardNo = `Ward No ${wardMatch[1]}`;
    }

    return { village, locality, sublocality, neighborhood, wardNo, district, state, postalCode };
};

/**
 * Combines available components into a clean, comma-separated string without repetition
 */
export const buildCombinedAddress = (components: AddressComponents): string => {
    const rawParts = [
        components.wardNo,
        components.neighborhood,
        components.sublocality,
        components.locality,
        components.village,
        components.district,
        components.state
    ];

    const cleanParts: string[] = [];
    for (const part of rawParts) {
        if (!part) continue;
        const normalized = part.trim();
        // Prevent duplicate parts or minor substring repetitions
        const isDuplicate = cleanParts.some(p =>
            p.toLowerCase().includes(normalized.toLowerCase()) ||
            normalized.toLowerCase().includes(p.toLowerCase())
        );
        if (!isDuplicate) {
            cleanParts.push(normalized);
        }
    }

    let baseAddr = cleanParts.join(", ");
    if (components.postalCode) {
        baseAddr += ` ${components.postalCode.trim()}`;
    }
    return baseAddr;
};

/**
 * Generates a clean, readable address optimized for rural areas in India:
 * Format: Near Landmark, Village Name, Ward No, Pin Code, District, State
 */
export const buildRuralAddressString = (components: AddressComponents, landmarkName?: string): string => {
    const villageName = components.village || components.neighborhood || components.sublocality || components.locality || "";
    
    const parts: string[] = [];

    if (villageName) parts.push(villageName.trim());
    if (components.wardNo) parts.push(components.wardNo.trim());
    if (components.postalCode) parts.push(components.postalCode.trim());
    if (components.district) parts.push(components.district.trim());
    if (components.state) parts.push(components.state.trim());

    let baseAddr = parts.join(", ");
    baseAddr = cleanPlusCode(baseAddr);

    if (landmarkName) {
        const cleanLandmark = landmarkName.trim();
        if (!baseAddr.toLowerCase().includes(cleanLandmark.toLowerCase())) {
            return `Near ${cleanLandmark}, ${baseAddr}`;
        }
    }

    return baseAddr;
};
