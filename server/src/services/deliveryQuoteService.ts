import DeliveryZone from "../models/DeliveryZone";
import Restaurant from "../models/Restaurant";
import { parseCoordinates, Coordinates } from "../utils/coordinates";
import { calculateDistance } from "./distanceService";
import { getRouteDistanceAndDuration, RouteMetrics } from "../utils/googleMaps";

export type DeliveryQuoteReason =
    | "invalid_location"
    | "outside_zone"
    | "outside_radius"
    | "restaurant_location_unverified";

export interface DeliveryQuoteInput {
    orderType: "food" | "grocery";
    restaurantId?: string;
    destLat?: number | string | null;
    destLng?: number | string | null;
    pincode?: string;
    addressText?: string;
    forOrder?: boolean;
    // Optional dependency injection overrides for unit/mock testing
    _zones?: any[];
    _restaurant?: any;
    _getRouteDistanceAndDuration?: (
        originLat: number,
        originLng: number,
        destLat: number,
        destLng: number
    ) => Promise<RouteMetrics>;
}

export interface DeliveryQuoteResult {
    deliverable: boolean;
    reason?: DeliveryQuoteReason;
    zone: any | null;
    origin: Coordinates | null;
    distanceKm: number;
    durationMinutes: number;
    source: "google" | "estimated" | null;
    straightKm: number;
}

/**
 * Returns the maximum allowed delivery distance in km for a delivery zone.
 * HARD LIMIT rule: maxDeliveryKm(zone) returns zone.radiusKm.
 */
export function maxDeliveryKm(zone: any): number {
    return zone.radiusKm;
}

/**
 * Single source of truth for delivery feasibility, zone resolution, and distance calculation.
 */
export async function quoteDelivery(input: DeliveryQuoteInput): Promise<DeliveryQuoteResult> {
    const {
        orderType,
        restaurantId,
        destLat,
        destLng,
        pincode,
        addressText,
        forOrder = true,
        _zones,
        _restaurant,
        _getRouteDistanceAndDuration
    } = input;

    const coords = parseCoordinates(destLat, destLng);
    const hasCoordinatesInput = destLat !== undefined && destLat !== null && destLng !== undefined && destLng !== null;

    // 1. Validate destination coordinates
    if (!coords) {
        // If coordinates were explicitly provided but failed validation, reject immediately
        if (hasCoordinatesInput) {
            return {
                deliverable: false,
                reason: "invalid_location",
                zone: null,
                origin: null,
                distanceKm: 0,
                durationMinutes: 0,
                source: null,
                straightKm: 0
            };
        }

        // Orders always need valid coordinates
        if (forOrder) {
            return {
                deliverable: false,
                reason: "invalid_location",
                zone: null,
                origin: null,
                distanceKm: 0,
                durationMinutes: 0,
                source: null,
                straightKm: 0
            };
        }

        // Browsing mode (forOrder: false) with missing coordinates: allow resolving zone by pincode or locality
        const activeZones = _zones || (await DeliveryZone.find({ isActive: true }).lean());
        const cleanPin = pincode ? pincode.toString().trim() : "";
        let fallbackZone: any = null;

        if (cleanPin) {
            fallbackZone = activeZones.find(z => z.pincodes && z.pincodes.includes(cleanPin)) || null;
        }

        if (!fallbackZone && addressText) {
            const normalizedAddress = addressText.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (normalizedAddress) {
                fallbackZone = activeZones.find(z => {
                    const normName = z.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                    return normalizedAddress.includes(normName) || normName.includes(normalizedAddress);
                }) || null;
            }
        }

        if (!fallbackZone) {
            return {
                deliverable: false,
                reason: "outside_zone",
                zone: null,
                origin: null,
                distanceKm: 0,
                durationMinutes: 0,
                source: null,
                straightKm: 0
            };
        }

        return {
            deliverable: false,
            reason: "invalid_location",
            zone: fallbackZone,
            origin: null,
            distanceKm: 0,
            durationMinutes: 0,
            source: null,
            straightKm: 0
        };
    }

    // 2. Resolve the zone by COORDINATES (distance from zone.center <= zone.radiusKm)
    const activeZones = _zones || (await DeliveryZone.find({ isActive: true }).lean());
    let resolvedZone: any = null;

    for (const zone of activeZones) {
        const distFromCenter = calculateDistance(zone.center.lat, zone.center.lng, coords.lat, coords.lng);
        if (distFromCenter <= zone.radiusKm) {
            resolvedZone = zone;
            break;
        }
    }

    // If destination does not strictly lie within radius, associate closest zone in reasonable proximity (or single zone)
    // so that the HARD LIMIT check can report outside_radius with accurate straight-line and route distances
    if (!resolvedZone && activeZones.length > 0) {
        let closestZone = activeZones[0];
        let minDist = calculateDistance(closestZone.center.lat, closestZone.center.lng, coords.lat, coords.lng);
        for (let i = 1; i < activeZones.length; i++) {
            const d = calculateDistance(activeZones[i].center.lat, activeZones[i].center.lng, coords.lat, coords.lng);
            if (d < minDist) {
                minDist = d;
                closestZone = activeZones[i];
            }
        }

        if (minDist <= closestZone.radiusKm * 2 || activeZones.length === 1) {
            resolvedZone = closestZone;
        }
    }

    if (!resolvedZone) {
        return {
            deliverable: false,
            reason: "outside_zone",
            zone: null,
            origin: null,
            distanceKm: 0,
            durationMinutes: 0,
            source: null,
            straightKm: 0
        };
    }

    // 3. Resolve Origin
    let origin: Coordinates | null = null;

    if (orderType === "food") {
        let restaurant = _restaurant;
        if (!restaurant && restaurantId) {
            restaurant = await Restaurant.findById(restaurantId).lean();
        }

        if (!restaurant || !restaurant.location || restaurant.locationNeedsReview === true) {
            return {
                deliverable: false,
                reason: "restaurant_location_unverified",
                zone: resolvedZone,
                origin: null,
                distanceKm: 0,
                durationMinutes: 0,
                source: null,
                straightKm: 0
            };
        }

        const restaurantCoords = parseCoordinates(restaurant.location.lat, restaurant.location.lng);
        if (!restaurantCoords) {
            return {
                deliverable: false,
                reason: "restaurant_location_unverified",
                zone: resolvedZone,
                origin: null,
                distanceKm: 0,
                durationMinutes: 0,
                source: null,
                straightKm: 0
            };
        }

        origin = restaurantCoords;
    } else {
        // Grocery: origin = zone.center
        const centerCoords = parseCoordinates(resolvedZone.center.lat, resolvedZone.center.lng);
        if (!centerCoords) {
            return {
                deliverable: false,
                reason: "invalid_location",
                zone: resolvedZone,
                origin: null,
                distanceKm: 0,
                durationMinutes: 0,
                source: null,
                straightKm: 0
            };
        }

        origin = centerCoords;
    }

    // 4. Calculate Distance and Apply HARD LIMIT
    const straightDistRaw = calculateDistance(origin.lat, origin.lng, coords.lat, coords.lng);
    const straightKm = parseFloat(straightDistRaw.toFixed(2));
    const maxKm = maxDeliveryKm(resolvedZone);

    const routeCalculator = _getRouteDistanceAndDuration || getRouteDistanceAndDuration;
    const routeMetrics = await routeCalculator(origin.lat, origin.lng, coords.lat, coords.lng);

    // HARD LIMIT: not deliverable if straight-line > maxDeliveryKm(zone) OR routed distance > maxDeliveryKm(zone)
    if (straightKm > maxKm || routeMetrics.distanceKm > maxKm) {
        return {
            deliverable: false,
            reason: "outside_radius",
            zone: resolvedZone,
            origin,
            distanceKm: routeMetrics.distanceKm,
            durationMinutes: routeMetrics.durationMinutes,
            source: routeMetrics.source,
            straightKm
        };
    }

    return {
        deliverable: true,
        zone: resolvedZone,
        origin,
        distanceKm: routeMetrics.distanceKm,
        durationMinutes: routeMetrics.durationMinutes,
        source: routeMetrics.source,
        straightKm
    };
}
