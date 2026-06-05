import DeliveryZone from "../models/DeliveryZone";
import Restaurant from "../models/Restaurant";
import { calculateDistance } from "./distanceService";
import { getRouteDistanceAndDuration } from "../utils/googleMaps";

/**
 * Finds the applicable active delivery zone for a given geolocated coordinate, pincode, or address text
 */
export const findApplicableZone = async (
    lat?: number,
    lng?: number,
    pincode?: string,
    addressText?: string
): Promise<any | null> => {
    const activeZones = await DeliveryZone.find({ isActive: true });
    
    const inputDesc = `Lat=${lat}, Lng=${lng}, Pincode=${pincode || "N/A"}, AddressText="${addressText || "N/A"}"`;
    console.log(`[Zone Check] Started feasibility validation. Input details: ${inputDesc}`);

    if (activeZones.length === 0) {
        console.warn("[Zone Check] Validation Result: FAILED. Reason: No active delivery zones defined in database.");
        return null;
    }

    const cleanPin = pincode ? pincode.toString().trim() : "";
    const normalizedAddress = addressText ? addressText.toLowerCase().replace(/[^a-z0-9]/g, "") : "";

    // 1. First Pass: Coordinates Radius distance check
    if (lat !== undefined && lng !== undefined) {
        for (const zone of activeZones) {
            const dist = calculateDistance(zone.center.lat, zone.center.lng, lat, lng);
            console.log(`[Zone Check] Checking Zone '${zone.name}': Distance from center to user is ${dist.toFixed(2)} km (Zone Radius Limit: ${zone.radiusKm} km)`);
            if (dist <= zone.radiusKm) {
                console.log(`[Zone Check] Validation Result: SUCCESS. Matched Zone: '${zone.name}' via radius check.`);
                return zone;
            }
        }
    }

    // 2. Second Pass: Pincode lookup check
    if (cleanPin) {
        for (const zone of activeZones) {
            const matchesPincode = zone.pincodes && zone.pincodes.includes(cleanPin);
            console.log(`[Zone Check] Checking Zone '${zone.name}': Pincode '${cleanPin}' in zone list? ${matchesPincode ? "YES" : "NO"}`);
            if (matchesPincode) {
                console.log(`[Zone Check] Validation Result: SUCCESS. Matched Zone: '${zone.name}' via Pincode fallback.`);
                return zone;
            }
        }
    }

    // 3. Third Pass: Locality/Zone name variation match
    if (normalizedAddress) {
        for (const zone of activeZones) {
            const normalizedZoneName = zone.name.toLowerCase().replace(/[^a-z0-9]/g, "");
            const isMatch = normalizedAddress.includes(normalizedZoneName) || normalizedZoneName.includes(normalizedAddress);
            console.log(`[Zone Check] Checking Zone '${zone.name}': Locality name variation match with address? ${isMatch ? "YES" : "NO"}`);
            if (isMatch) {
                console.log(`[Zone Check] Validation Result: SUCCESS. Matched Zone: '${zone.name}' via Locality Name fallback.`);
                return zone;
            }
        }
    }

    console.warn(`[Zone Check] Validation Result: FAILED. Reason: User location does not fall within any operational zone boundaries (checked ${activeZones.length} zones).`);
    return null;
};

/**
 * Validates if restaurant serviceability limits cover the user coordinates
 */
export const checkRestaurantServiceability = async (
    restaurantId: string,
    userLat: number,
    userLng: number,
    pincode?: string,
    addressText?: string
): Promise<{
    isDeliverable: boolean;
    distanceKm: number;
    durationMinutes: number;
    zone?: any;
    error?: string;
}> => {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
        return { isDeliverable: false, distanceKm: 0, durationMinutes: 0, error: "Restaurant not found" };
    }

    if (!restaurant.isActive || restaurant.status !== "approved" || restaurant.isBlocked) {
        return { isDeliverable: false, distanceKm: 0, durationMinutes: 0, error: "Restaurant is currently inactive or blocked" };
    }

    if (!restaurant.location || restaurant.location.lat === undefined || restaurant.location.lng === undefined) {
        return { isDeliverable: false, distanceKm: 0, durationMinutes: 0, error: "Restaurant coordinates are not defined" };
    }

    // Identify applicable delivery zone of user location
    const zone = await findApplicableZone(userLat, userLng, pincode, addressText);
    if (!zone) {
        return { isDeliverable: false, distanceKm: 0, durationMinutes: 0, error: "Location lies outside operational delivery limits" };
    }

    // Call routing calculator
    const routeMetrics = await getRouteDistanceAndDuration(
        restaurant.location.lat,
        restaurant.location.lng,
        userLat,
        userLng
    );

    return {
        isDeliverable: true,
        distanceKm: routeMetrics.distanceKm,
        durationMinutes: routeMetrics.durationMinutes,
        zone
    };
};
