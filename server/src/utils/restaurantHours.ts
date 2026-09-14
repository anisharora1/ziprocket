export function isWithinOperatingHours(open?: string, close?: string, now: Date = new Date()): boolean {
    if (!open || !close) return true;
    const [openH, openM] = open.split(":").map(Number);
    const [closeH, closeM] = close.split(":").map(Number);
    if (isNaN(openH) || isNaN(closeH)) return true;

    // Use Asia/Kolkata timezone to determine current hours and minutes
    const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' } as const;
    const timeString = new Intl.DateTimeFormat('en-US', options).format(now);
    const cleanTime = timeString.replace(/[^\d:]/g, '');
    const [currH, currM] = cleanTime.split(":").map(Number);

    const currentMinutes = (!isNaN(currH) ? currH : now.getHours()) * 60 + (!isNaN(currM) ? currM : now.getMinutes());
    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);

    if (closeMinutes <= openMinutes) {
        // Overnight hours (e.g. open 18:00, close 02:00) — wraps past midnight
        return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

export interface RestaurantAcceptanceCheckResult {
    isAccepting: boolean;
    reason: "ok" | "not_found" | "inactive" | "closed" | "disabled" | "outside_hours";
    message: string;
}

/**
 * Validates whether a restaurant is currently accepting orders across all 3 criteria:
 * 1. Manual seller toggle (isActive)
 * 2. Admin availability status (availabilityStatus: open/closed/disabled)
 * 3. Daily operating hours (operatingHours: open/close)
 */
export function checkRestaurantAcceptingOrders(restaurant: any, now: Date = new Date()): RestaurantAcceptanceCheckResult {
    if (!restaurant) {
        return {
            isAccepting: false,
            reason: "not_found",
            message: "This restaurant no longer exists."
        };
    }

    if (restaurant.isActive === false) {
        return {
            isAccepting: false,
            reason: "inactive",
            message: "This restaurant is currently closed."
        };
    }

    if (restaurant.availabilityStatus !== "open") {
        const restMsg = restaurant.availabilityStatus === "disabled"
            ? "This restaurant is temporarily disabled."
            : "This restaurant is currently closed.";
        return {
            isAccepting: false,
            reason: restaurant.availabilityStatus === "disabled" ? "disabled" : "closed",
            message: restMsg
        };
    }

    if (restaurant.operatingHours?.open && restaurant.operatingHours?.close) {
        if (!isWithinOperatingHours(restaurant.operatingHours.open, restaurant.operatingHours.close, now)) {
            return {
                isAccepting: false,
                reason: "outside_hours",
                message: `This restaurant is currently closed. It reopens at ${restaurant.operatingHours.open}.`
            };
        }
    }

    return {
        isAccepting: true,
        reason: "ok",
        message: ""
    };
}

/**
 * Boolean convenience helper to check if a restaurant is accepting orders right now.
 */
export function isRestaurantAcceptingOrders(restaurant: any, now: Date = new Date()): boolean {
    return checkRestaurantAcceptingOrders(restaurant, now).isAccepting;
}

