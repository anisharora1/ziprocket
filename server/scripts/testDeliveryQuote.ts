import { parseCoordinates } from "../src/utils/coordinates";
import { quoteDelivery } from "../src/services/deliveryQuoteService";
import { computeBillFromZone, BillZoneParams } from "../src/utils/billCalculator";
import { calculateDistance } from "../src/services/distanceService";

let passCount = 0;
let failCount = 0;

function report(testName: string, passed: boolean, details?: string) {
    if (passed) {
        passCount++;
        console.log(`[PASS] ${testName}${details ? ` - ${details}` : ""}`);
    } else {
        failCount++;
        console.error(`[FAIL] ${testName}${details ? ` - ${details}` : ""}`);
    }
}

async function runTests() {
    console.log("=== Running Delivery Distance & Quote Tests ===\n");

    const mockZone = {
        _id: "mock_zone_delhi_1",
        name: "Central Delhi Hub",
        isActive: true,
        center: { lat: 28.6139, lng: 77.2090 },
        radiusKm: 10,
        pincodes: ["110001", "110002"],
        baseDeliveryFee: 20,
        baseDistanceKm: 3,
        extraFeePerKm: 5,
        minDeliveryFee: 20,
        maxDeliveryFee: 150,
        freeDeliveryThreshold: 999999,
        smallOrderThreshold: 100,
        smallOrderFee: 10,
        smallOrderFeeActive: false,
        platformFee: 5,
        platformFeeActive: false,
        gstPercentage: 5,
        gstActive: false,
        packagingCharge: 10,
        packagingChargeActive: false,
        convenienceFee: 2,
        convenienceFeeActive: false,
        surgeMultiplier: 1.0,
        surgeActive: false
    };

    // 1. Valid point
    const validPointCoords = parseCoordinates(28.6200, 77.2100);
    const validQuote = await quoteDelivery({
        orderType: "grocery",
        destLat: 28.6200,
        destLng: 77.2100,
        forOrder: true,
        _zones: [mockZone],
        _getRouteDistanceAndDuration: async () => ({ distanceKm: 1.2, durationMinutes: 5, source: "google" })
    });
    report(
        "valid point",
        validPointCoords !== null && validQuote.deliverable === true,
        `deliverable=${validQuote.deliverable}, dist=${validQuote.distanceKm}km`
    );

    // 2. null
    const nullCoords = parseCoordinates(null, null);
    const nullQuote = await quoteDelivery({
        orderType: "grocery",
        destLat: null,
        destLng: null,
        forOrder: true,
        _zones: [mockZone]
    });
    report(
        "null coordinates",
        nullCoords === null && nullQuote.deliverable === false && nullQuote.reason === "invalid_location",
        `reason=${nullQuote.reason}`
    );

    // 3. "abc"
    const abcCoords = parseCoordinates("abc", "abc");
    const abcQuote = await quoteDelivery({
        orderType: "grocery",
        destLat: "abc",
        destLng: "abc",
        forOrder: true,
        _zones: [mockZone]
    });
    report(
        '"abc" coordinates',
        abcCoords === null && abcQuote.deliverable === false && abcQuote.reason === "invalid_location",
        `reason=${abcQuote.reason}`
    );

    // 4. (0,0)
    const zeroCoords = parseCoordinates(0, 0);
    const zeroQuote = await quoteDelivery({
        orderType: "grocery",
        destLat: 0,
        destLng: 0,
        forOrder: true,
        _zones: [mockZone]
    });
    report(
        "(0,0) coordinates",
        zeroCoords === null && zeroQuote.deliverable === false && zeroQuote.reason === "invalid_location",
        `reason=${zeroQuote.reason}`
    );

    // 5. lat 91
    const lat91Coords = parseCoordinates(91, 77.2);
    const lat91Quote = await quoteDelivery({
        orderType: "grocery",
        destLat: 91,
        destLng: 77.2,
        forOrder: true,
        _zones: [mockZone]
    });
    report(
        "lat 91",
        lat91Coords === null && lat91Quote.deliverable === false && lat91Quote.reason === "invalid_location",
        `reason=${lat91Quote.reason}`
    );

    // 6. a point outside India
    const outsideIndiaCoords = parseCoordinates(40.7128, -74.0060);
    const outsideIndiaQuote = await quoteDelivery({
        orderType: "grocery",
        destLat: 40.7128,
        destLng: -74.0060,
        forOrder: true,
        _zones: [mockZone]
    });
    report(
        "a point outside India",
        outsideIndiaCoords === null && outsideIndiaQuote.deliverable === false && outsideIndiaQuote.reason === "invalid_location",
        `reason=${outsideIndiaQuote.reason}`
    );

    // 7. Exactly at the radius (10.0 km)
    // dLat for 10.0 km north = (10 / 6371) * (180 / Math.PI)
    const deltaLat10 = (10.0 / 6371) * (180 / Math.PI);
    const exactLat = mockZone.center.lat + deltaLat10;
    const exactLng = mockZone.center.lng;
    const exactDistance = calculateDistance(mockZone.center.lat, mockZone.center.lng, exactLat, exactLng);

    const exactRadiusQuote = await quoteDelivery({
        orderType: "grocery",
        destLat: exactLat,
        destLng: exactLng,
        forOrder: true,
        _zones: [mockZone],
        _getRouteDistanceAndDuration: async () => ({ distanceKm: 10.0, durationMinutes: 25, source: "google" })
    });
    report(
        "exactly at the radius",
        exactRadiusQuote.deliverable === true && exactDistance <= 10.0001,
        `deliverable=${exactRadiusQuote.deliverable}, straightDist=${exactDistance.toFixed(2)}km`
    );

    // 8. 0.1 km beyond the radius (10.1 km)
    const deltaLat10_1 = (10.1 / 6371) * (180 / Math.PI);
    const beyondLat = mockZone.center.lat + deltaLat10_1;
    const beyondLng = mockZone.center.lng;
    const beyondDistance = calculateDistance(mockZone.center.lat, mockZone.center.lng, beyondLat, beyondLng);

    const beyondRadiusQuote = await quoteDelivery({
        orderType: "grocery",
        destLat: beyondLat,
        destLng: beyondLng,
        forOrder: true,
        _zones: [mockZone],
        _getRouteDistanceAndDuration: async () => ({ distanceKm: 10.1, durationMinutes: 26, source: "google" })
    });
    report(
        "0.1 km beyond the radius",
        beyondRadiusQuote.deliverable === false && beyondRadiusQuote.reason === "outside_radius",
        `deliverable=${beyondRadiusQuote.deliverable}, reason=${beyondRadiusQuote.reason}, straightDist=${beyondDistance.toFixed(2)}km`
    );

    // 9. straight-line 12 km with a 10 km radius being rejected even when the mocked route distance is 8.2 km
    const deltaLat12 = (12.0 / 6371) * (180 / Math.PI);
    const lat12 = mockZone.center.lat + deltaLat12;
    const lng12 = mockZone.center.lng;
    const straightDist12 = calculateDistance(mockZone.center.lat, mockZone.center.lng, lat12, lng12);

    const rejectedQuote = await quoteDelivery({
        orderType: "grocery",
        destLat: lat12,
        destLng: lng12,
        forOrder: true,
        _zones: [mockZone],
        _getRouteDistanceAndDuration: async () => ({ distanceKm: 8.2, durationMinutes: 20, source: "google" })
    });
    report(
        "straight-line 12 km with a 10 km radius being rejected even when the mocked route distance is 8.2 km",
        rejectedQuote.deliverable === false && rejectedQuote.reason === "outside_radius",
        `deliverable=${rejectedQuote.deliverable}, reason=${rejectedQuote.reason}, straightKm=${rejectedQuote.straightKm}, routeDistance=${rejectedQuote.distanceKm}`
    );

    // 10. Fees for 2.5, 3, 3.1, 6 and 9.9 km with zone settings base 20, base distance 3, extra 5 per km
    const testZoneParams: BillZoneParams = {
        baseDeliveryFee: 20,
        baseDistanceKm: 3,
        extraFeePerKm: 5,
        minDeliveryFee: 20,
        maxDeliveryFee: 150,
        freeDeliveryThreshold: 999999,
        smallOrderThreshold: 100,
        smallOrderFee: 10,
        smallOrderFeeActive: false,
        platformFee: 5,
        platformFeeActive: false,
        gstPercentage: 5,
        gstActive: false,
        packagingCharge: 10,
        packagingChargeActive: false,
        convenienceFee: 2,
        convenienceFeeActive: false,
        surgeMultiplier: 1.0,
        surgeActive: false
    };

    const fee2_5 = computeBillFromZone(testZoneParams, 100, 2.5).deliveryFee;
    report("fee for 2.5 km (base 20, base dist 3, extra 5/km)", fee2_5 === 20, `fee=${fee2_5}, expected=20`);

    const fee3_0 = computeBillFromZone(testZoneParams, 100, 3.0).deliveryFee;
    report("fee for 3.0 km (base 20, base dist 3, extra 5/km)", fee3_0 === 20, `fee=${fee3_0}, expected=20`);

    const fee3_1 = computeBillFromZone(testZoneParams, 100, 3.1).deliveryFee;
    report("fee for 3.1 km (base 20, base dist 3, extra 5/km)", fee3_1 === 21, `fee=${fee3_1}, expected=21`);

    const fee6_0 = computeBillFromZone(testZoneParams, 100, 6.0).deliveryFee;
    report("fee for 6.0 km (base 20, base dist 3, extra 5/km)", fee6_0 === 35, `fee=${fee6_0}, expected=35`);

    const fee9_9 = computeBillFromZone(testZoneParams, 100, 9.9).deliveryFee;
    report("fee for 9.9 km (base 20, base dist 3, extra 5/km)", fee9_9 === 55, `fee=${fee9_9}, expected=55`);

    console.log(`\n========================================`);
    console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED`);
    console.log(`========================================\n`);

    process.exit(failCount === 0 ? 0 : 1);
}

runTests().catch((err) => {
    console.error("Test execution failed with error:", err);
    process.exit(1);
});
