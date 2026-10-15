import mongoose, { Types } from "mongoose";
import DeviceToken, { IDeviceToken } from "../models/DeviceToken";
import Order from "../models/Order";
import { getOrCreateSettings } from "../controllers/platformSettingsController";
import { isWithinRadius } from "./distanceService";

export interface AudienceRadius {
    lat: number;
    lng: number;
    km: number;
}

export interface AudienceOptions {
    segment?: {
        type: string;
        params?: Record<string, any>;
    };
    zoneIds?: (string | Types.ObjectId)[];
    radius?: AudienceRadius;
    overrideQuietHours?: boolean;
}

export interface AudienceCounts {
    targeted: number;
    skippedCap: number;
    skippedQuiet: number;
}

export interface AudienceResult {
    tokens: IDeviceToken[];
    counts: AudienceCounts;
}

/**
 * Returns YYYY-MM-DD string in Asia/Kolkata timezone
 */
export const getKolkataDateString = (date = new Date()): string => {
    return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};

/**
 * Checks if a given Date falls inside Asia/Kolkata quiet hours
 */
export const isQuietHours = (
    date = new Date(),
    startStr = "22:00",
    endStr = "08:00"
): boolean => {
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
    const parts = timeFormatter.formatToParts(date);
    const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = startStr.split(":").map(Number);
    const [endH, endM] = endStr.split(":").map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    if (startMinutes > endMinutes) {
        // e.g. 22:00 to 08:00 (spans midnight)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
};

/**
 * If scheduledAt is inside quiet hours, shifts it forward to the next quietHoursEnd (in UTC Date)
 */
export const adjustScheduledTimeForQuietHours = (
    scheduledAt: Date,
    quietStart = "22:00",
    quietEnd = "08:00"
): Date => {
    if (!isQuietHours(scheduledAt, quietStart, quietEnd)) {
        return scheduledAt;
    }

    const dateStr = scheduledAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const [year, month, day] = dateStr.split("-").map(Number);

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
    const parts = timeFormatter.formatToParts(scheduledAt);
    const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = quietStart.split(":").map(Number);
    const [endH, endM] = quietEnd.split(":").map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    let targetDay = day;
    let targetMonth = month;
    let targetYear = year;

    // If time is late night (>= startMinutes), the end of quiet hours is the next morning
    if (currentMinutes >= startMinutes) {
        const nextDayKolkata = new Date(Date.UTC(year, month - 1, day + 1));
        targetYear = nextDayKolkata.getUTCFullYear();
        targetMonth = nextDayKolkata.getUTCMonth() + 1;
        targetDay = nextDayKolkata.getUTCDate();
    }

    // End hours in IST converted to UTC: IST = UTC + 5:30 -> UTC = IST - 330 minutes
    const endMinutesFromMidnight = endH * 60 + endM;
    const utcMinutesFromMidnight = endMinutesFromMidnight - 330;

    return new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 0, utcMinutesFromMidnight, 0, 0));
};

interface UserOrderSummary {
    totalDelivered: number;
    lastDeliveredAt: Date | null;
    delivered30d: number;
    delivered60d: number;
    food60d: number;
    grocery60d: number;
}

/**
 * Fetches base audience device tokens and computes aggregated order history for customers
 */
async function fetchBaseAudienceAndSummaries(
    zoneIds?: (string | Types.ObjectId)[],
    radius?: AudienceRadius
) {
    const settingsDoc = await getOrCreateSettings();
    const notificationSettings = settingsDoc.notificationSettings || {
        maxPromoPerDay: 2,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        inactiveDays: 14,
        newUserDays: 7,
        regularMinOrders30d: 4,
        foodLoverMinOrders60d: 2,
        foodLoverSharePct: 60
    };

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const tokenQuery: any = {
        marketingOptIn: true,
        lastSeenAt: { $gte: sixtyDaysAgo }
    };

    // Zone filter
    if (zoneIds && zoneIds.length > 0) {
        const validZoneIds = zoneIds
            .filter(id => mongoose.Types.ObjectId.isValid(id.toString()))
            .map(id => new mongoose.Types.ObjectId(id.toString()));
        if (validZoneIds.length > 0) {
            tokenQuery.zoneId = { $in: validZoneIds };
        }
    }

    // Radius bounding-box prefilter
    if (radius && typeof radius.lat === "number" && typeof radius.lng === "number" && typeof radius.km === "number") {
        const deltaLat = radius.km / 111.0;
        const cosLat = Math.cos((radius.lat * Math.PI) / 180.0);
        const deltaLng = radius.km / (111.0 * (Math.abs(cosLat) > 0.0001 ? Math.abs(cosLat) : 1));

        tokenQuery["lastLocation.lat"] = { $gte: radius.lat - deltaLat, $lte: radius.lat + deltaLat };
        tokenQuery["lastLocation.lng"] = { $gte: radius.lng - deltaLng, $lte: radius.lng + deltaLng };
    }

    // Retrieve tokens and populate user details
    const rawTokens = await DeviceToken.find(tokenQuery)
        .populate("user", "role isBlocked createdAt")
        .exec();

    // In-memory filter for user validity and accurate Haversine radius
    const baseTokens: IDeviceToken[] = [];
    const customerUserIdsSet = new Set<string>();

    for (const token of rawTokens) {
        // Base audience: user is null OR (user.role === 'customer' and not blocked)
        if (token.user) {
            const u = token.user as any;
            if (u.role !== "customer" || u.isBlocked) {
                continue;
            }
            customerUserIdsSet.add(u._id.toString());
        }

        // Exact Haversine check if radius filter is requested
        if (radius && typeof radius.lat === "number" && typeof radius.lng === "number" && typeof radius.km === "number") {
            if (!token.lastLocation || typeof token.lastLocation.lat !== "number" || typeof token.lastLocation.lng !== "number") {
                continue;
            }
            const within = isWithinRadius(radius.lat, radius.lng, token.lastLocation.lat, token.lastLocation.lng, radius.km);
            if (!within) {
                continue;
            }
        }

        baseTokens.push(token);
    }

    // Aggregate delivered order history for the relevant customers
    const userSummaryMap = new Map<string, UserOrderSummary>();

    if (customerUserIdsSet.size > 0) {
        const customerObjectIds = Array.from(customerUserIdsSet).map(id => new mongoose.Types.ObjectId(id));
        const orderAggregation = await Order.aggregate([
            {
                $match: {
                    user: { $in: customerObjectIds },
                    orderStatus: "delivered"
                }
            },
            {
                $project: {
                    user: 1,
                    orderType: 1,
                    orderDate: { $ifNull: ["$deliveredAt", "$createdAt"] }
                }
            },
            {
                $group: {
                    _id: "$user",
                    totalDelivered: { $sum: 1 },
                    lastDeliveredAt: { $max: "$orderDate" },
                    delivered30d: {
                        $sum: {
                            $cond: [{ $gte: ["$orderDate", thirtyDaysAgo] }, 1, 0]
                        }
                    },
                    delivered60d: {
                        $sum: {
                            $cond: [{ $gte: ["$orderDate", sixtyDaysAgo] }, 1, 0]
                        }
                    },
                    food60d: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$orderType", "food"] },
                                        { $gte: ["$orderDate", sixtyDaysAgo] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    grocery60d: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$orderType", "grocery"] },
                                        { $gte: ["$orderDate", sixtyDaysAgo] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        for (const row of orderAggregation) {
            userSummaryMap.set(row._id.toString(), {
                totalDelivered: row.totalDelivered || 0,
                lastDeliveredAt: row.lastDeliveredAt ? new Date(row.lastDeliveredAt) : null,
                delivered30d: row.delivered30d || 0,
                delivered60d: row.delivered60d || 0,
                food60d: row.food60d || 0,
                grocery60d: row.grocery60d || 0
            });
        }
    }

    return {
        baseTokens,
        userSummaryMap,
        notificationSettings
    };
}

/**
 * Checks if a token matches the segment criteria
 */
function matchesSegment(
    token: IDeviceToken,
    segmentType: string,
    userSummaryMap: Map<string, UserOrderSummary>,
    notificationSettings: any,
    now: Date
): boolean {
    if (segmentType === "all") {
        return true;
    }

    // All other segments require a registered customer account (guests cannot match)
    if (!token.user) {
        return false;
    }

    const u = token.user as any;
    const userIdStr = u._id ? u._id.toString() : token.user.toString();
    const summary = userSummaryMap.get(userIdStr) || {
        totalDelivered: 0,
        lastDeliveredAt: null,
        delivered30d: 0,
        delivered60d: 0,
        food60d: 0,
        grocery60d: 0
    };

    const newUserCutoff = new Date(now.getTime() - (notificationSettings.newUserDays || 7) * 24 * 60 * 60 * 1000);
    const inactiveCutoff = new Date(now.getTime() - (notificationSettings.inactiveDays || 14) * 24 * 60 * 60 * 1000);
    const userCreatedAt = u.createdAt ? new Date(u.createdAt) : new Date(0);

    switch (segmentType) {
        case "new_users":
            return userCreatedAt >= newUserCutoff && summary.totalDelivered === 0;

        case "never_ordered":
            return userCreatedAt < newUserCutoff && summary.totalDelivered === 0;

        case "food_lovers": {
            const minFood = notificationSettings.foodLoverMinOrders60d ?? 2;
            const minShare = notificationSettings.foodLoverSharePct ?? 60;
            if (summary.food60d < minFood || summary.delivered60d <= 0) return false;
            return (summary.food60d / summary.delivered60d) * 100 >= minShare;
        }

        case "grocery_shoppers": {
            const minGrocery = notificationSettings.foodLoverMinOrders60d ?? 2;
            const minShare = notificationSettings.foodLoverSharePct ?? 60;
            if (summary.grocery60d < minGrocery || summary.delivered60d <= 0) return false;
            return (summary.grocery60d / summary.delivered60d) * 100 >= minShare;
        }

        case "regular": {
            const minRegular = notificationSettings.regularMinOrders30d ?? 4;
            return summary.delivered30d >= minRegular;
        }

        case "inactive": {
            return (
                summary.totalDelivered >= 1 &&
                summary.lastDeliveredAt !== null &&
                summary.lastDeliveredAt < inactiveCutoff
            );
        }

        default:
            return false;
    }
}

/**
 * Returns matching tokens and counts (targeted, skippedCap, skippedQuiet) for a specific audience configuration
 */
export const getAudience = async (options: AudienceOptions): Promise<AudienceResult> => {
    const { segment, zoneIds, radius, overrideQuietHours } = options;
    const segmentType = segment?.type || "all";
    const now = new Date();

    const { baseTokens, userSummaryMap, notificationSettings } = await fetchBaseAudienceAndSummaries(
        zoneIds,
        radius
    );

    const todayKolkata = getKolkataDateString(now);
    const maxPromoPerDay = notificationSettings.maxPromoPerDay || 2;
    const isQuiet = isQuietHours(now, notificationSettings.quietHoursStart, notificationSettings.quietHoursEnd);

    const eligibleTokens: IDeviceToken[] = [];
    let skippedCap = 0;

    for (const token of baseTokens) {
        if (!matchesSegment(token, segmentType, userSummaryMap, notificationSettings, now)) {
            continue;
        }

        // Cap filter: exclude tokens that already reached maxPromoPerDay today in Asia/Kolkata
        if (token.marketingDay === todayKolkata && (token.marketingCount || 0) >= maxPromoPerDay) {
            skippedCap++;
        } else {
            eligibleTokens.push(token);
        }
    }

    const skippedQuiet = isQuiet && !overrideQuietHours ? eligibleTokens.length : 0;

    return {
        tokens: eligibleTokens,
        counts: {
            targeted: eligibleTokens.length,
            skippedCap,
            skippedQuiet
        }
    };
};

/**
 * Returns audience counts for every segment (for the admin cards)
 */
export const getAllSegmentCounts = async (
    zoneIds?: (string | Types.ObjectId)[],
    radius?: AudienceRadius
): Promise<Record<string, AudienceCounts>> => {
    const now = new Date();
    const { baseTokens, userSummaryMap, notificationSettings } = await fetchBaseAudienceAndSummaries(
        zoneIds,
        radius
    );

    const todayKolkata = getKolkataDateString(now);
    const maxPromoPerDay = notificationSettings.maxPromoPerDay || 2;
    const isQuiet = isQuietHours(now, notificationSettings.quietHoursStart, notificationSettings.quietHoursEnd);

    const segments = [
        "all",
        "new_users",
        "never_ordered",
        "food_lovers",
        "grocery_shoppers",
        "regular",
        "inactive"
    ];

    const result: Record<string, AudienceCounts> = {};

    for (const seg of segments) {
        let eligibleCount = 0;
        let skippedCap = 0;

        for (const token of baseTokens) {
            if (!matchesSegment(token, seg, userSummaryMap, notificationSettings, now)) {
                continue;
            }

            if (token.marketingDay === todayKolkata && (token.marketingCount || 0) >= maxPromoPerDay) {
                skippedCap++;
            } else {
                eligibleCount++;
            }
        }

        result[seg] = {
            targeted: eligibleCount,
            skippedCap,
            skippedQuiet: isQuiet ? eligibleCount : 0
        };
    }

    return result;
};
