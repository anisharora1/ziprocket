/**
 * billCalculator.ts
 *
 * Pure, shared billing logic extracted from deliveryZoneController.calculateBillDetails.
 * Both the checkout-preview endpoint and createOrder call this — so there is exactly
 * one source of truth for pricing, not two copies that can drift apart.
 *
 * No database calls. No side effects. Just math.
 */

export interface BillZoneParams {
    baseDeliveryFee: number;
    baseDistanceKm: number;
    extraFeePerKm: number;
    minDeliveryFee: number;
    maxDeliveryFee: number;
    freeDeliveryThreshold: number;

    smallOrderThreshold: number;
    smallOrderFee: number;
    smallOrderFeeActive: boolean;

    platformFee: number;
    platformFeeActive: boolean;
    gstPercentage: number;
    gstActive: boolean;
    packagingCharge: number;
    packagingChargeActive: boolean;
    convenienceFee: number;
    convenienceFeeActive: boolean;

    surgeMultiplier: number;
    surgeActive: boolean;
}

export interface BillDetails {
    itemTotal: number;
    deliveryFee: number;
    smallOrderFee: number;
    surgeCharge: number;
    platformFee: number;
    packagingCharge: number;
    convenienceFee: number;
    gst: number;
    grandTotal: number;
}

/**
 * Compute a full bill breakdown from zone pricing parameters.
 *
 * @param zone        - Pricing parameters from the DeliveryZone document (or a subset matching BillZoneParams).
 * @param itemTotal   - The verified sum of (price × quantity) for all items in the cart.
 * @param distanceKm  - Road-distance in km from origin to destination.
 * @param _orderType  - "food" | "grocery" (reserved for future per-type logic).
 * @returns BillDetails with every line item and the grand total.
 */
export function computeBillFromZone(
    zone: BillZoneParams,
    itemTotal: number,
    distanceKm: number,
    _orderType: "food" | "grocery" = "food"
): BillDetails {
    // ── Delivery Fee ───────────────────────────────────────────────────
    let rawDeliveryFee = zone.baseDeliveryFee;
    if (distanceKm > zone.baseDistanceKm) {
        const extraDistance = distanceKm - zone.baseDistanceKm;
        rawDeliveryFee += extraDistance * zone.extraFeePerKm;
    }

    // Clamp within min & max caps
    let deliveryFee = Math.min(zone.maxDeliveryFee, Math.max(zone.minDeliveryFee, rawDeliveryFee));
    deliveryFee = Math.ceil(deliveryFee);

    // Free delivery threshold
    if (itemTotal >= zone.freeDeliveryThreshold) {
        deliveryFee = 0;
    }

    // ── Small Order Handling Fee ────────────────────────────────────────
    let smallOrderFee = 0;
    if (itemTotal > 0 && itemTotal < zone.smallOrderThreshold && zone.smallOrderFeeActive) {
        smallOrderFee = zone.smallOrderFee;
    }

    // ── Surge Pricing ──────────────────────────────────────────────────
    let surgeCharge = 0;
    if (zone.surgeActive && zone.surgeMultiplier > 1.0) {
        surgeCharge = Math.ceil(deliveryFee * (zone.surgeMultiplier - 1.0));
        deliveryFee = Math.ceil(deliveryFee * zone.surgeMultiplier);
    }

    // ── Flat Fees ──────────────────────────────────────────────────────
    const platformFee = zone.platformFeeActive ? zone.platformFee : 0;
    const packagingCharge = zone.packagingChargeActive ? zone.packagingCharge : 0;
    const convenienceFee = zone.convenienceFeeActive ? zone.convenienceFee : 0;

    // ── GST ────────────────────────────────────────────────────────────
    let gst = 0;
    if (zone.gstActive) {
        gst = Math.round(itemTotal * (zone.gstPercentage / 100));
    }

    // ── Grand Total ────────────────────────────────────────────────────
    const grandTotal = Math.max(
        0,
        itemTotal + deliveryFee + smallOrderFee + platformFee + packagingCharge + convenienceFee + gst
    );

    return {
        itemTotal,
        deliveryFee,
        smallOrderFee,
        surgeCharge,
        platformFee,
        packagingCharge,
        convenienceFee,
        gst,
        grandTotal,
    };
}
