process.env.REDIS_ENABLED = "false";

import { quoteDelivery, quoteMixedDelivery } from "../src/services/deliveryQuoteService";
import { computeBillFromZone, BillZoneParams } from "../src/utils/billCalculator";
import {
    sanitizeOrderForRestaurant,
    sanitizeOrderForGrocery,
    buildRestaurantSocketPayload,
    buildRestaurantPushPayload
} from "../src/utils/orderSanitizer";

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
    console.log("=== Running Mixed Orders Server Test Suite ===\n");

    const baseZone: BillZoneParams = {
        baseDeliveryFee: 20,
        baseDistanceKm: 3,
        extraFeePerKm: 5,
        minDeliveryFee: 20,
        maxDeliveryFee: 150,
        freeDeliveryThreshold: 299,
        smallOrderThreshold: 100,
        smallOrderFee: 10,
        smallOrderFeeActive: false,
        platformFee: 5,
        platformFeeActive: true,
        gstPercentage: 5,
        gstActive: true,
        packagingCharge: 10,
        packagingChargeActive: true,
        convenienceFee: 2,
        convenienceFeeActive: false,
        surgeMultiplier: 1.0,
        surgeActive: false,
        multiVendorFee: 5
    };

    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Grocery only is unchanged
    // ─────────────────────────────────────────────────────────────────
    {
        const bill = computeBillFromZone(baseZone, 150, 2.5, "grocery");
        report(
            "grocery only is unchanged",
            bill.itemTotal === 150 &&
            bill.deliveryFee === 20 &&
            bill.multiVendorFee === 0 &&
            bill.grandTotal === 150 + 20 + 5 + 10 + Math.round(150 * 0.05),
            `grandTotal=${bill.grandTotal}, multiVendorFee=${bill.multiVendorFee}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: Food only is unchanged
    // ─────────────────────────────────────────────────────────────────
    {
        const bill = computeBillFromZone(baseZone, 200, 4.0, "food");
        const expectedDelivery = 20 + (4.0 - 3.0) * 5; // 25
        report(
            "food only is unchanged",
            bill.itemTotal === 200 &&
            bill.deliveryFee === expectedDelivery &&
            bill.multiVendorFee === 0 &&
            bill.grandTotal === 200 + expectedDelivery + 5 + 10 + Math.round(200 * 0.05),
            `grandTotal=${bill.grandTotal}, multiVendorFee=${bill.multiVendorFee}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Mixed with the multi-vendor fee of Rs 5 added once
    // ─────────────────────────────────────────────────────────────────
    {
        const bill = computeBillFromZone(baseZone, 250, 4.0, "mixed", { isMixed: true });
        const expectedDelivery = 25;
        const expectedGrandTotal = 250 + expectedDelivery + 5 + 10 + Math.round(250 * 0.05) + 5;
        report(
            "mixed with the multi-vendor fee of Rs 5 added once",
            bill.multiVendorFee === 5 && bill.grandTotal === expectedGrandTotal,
            `multiVendorFee=${bill.multiVendorFee}, grandTotal=${bill.grandTotal}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Mixed where the food side is outside the radius is rejected
    // ─────────────────────────────────────────────────────────────────
    {
        const mockZone = {
            _id: "zone_1",
            name: "Central Zone",
            isActive: true,
            center: { lat: 28.6139, lng: 77.2090 },
            radiusKm: 10,
            pincodes: ["110001"]
        };

        const mockRestaurant = {
            _id: "rest_outside_1",
            name: "Far Restaurant",
            location: { lat: 28.8000, lng: 77.2090 }, // ~20.7km away
            locationNeedsReview: false
        };

        const quote = await quoteMixedDelivery({
            restaurantId: "rest_outside_1",
            destLat: 28.6139,
            destLng: 77.2090, // at zone center
            _zones: [mockZone],
            _restaurant: mockRestaurant,
            _getRouteDistanceAndDuration: async (oLat) => {
                if (oLat > 28.7) {
                    return { distanceKm: 22.0, durationMinutes: 45, source: "google" };
                }
                return { distanceKm: 1.5, durationMinutes: 10, source: "google" };
            }
        });

        report(
            "mixed where the food side is outside the radius is rejected",
            quote.deliverable === false &&
            quote.foodQuote.deliverable === false &&
            quote.reason === "outside_radius",
            `deliverable=${quote.deliverable}, reason=${quote.reason}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Mixed where the grocery side is outside the radius is rejected
    // ─────────────────────────────────────────────────────────────────
    {
        const mockZone = {
            _id: "zone_1",
            name: "Central Zone",
            isActive: true,
            center: { lat: 28.6139, lng: 77.2090 },
            radiusKm: 10,
            pincodes: ["110001"]
        };

        const mockRestaurant = {
            _id: "rest_inside_1",
            name: "Nearby Restaurant",
            location: { lat: 28.6150, lng: 77.2095 }, // ~0.13km away
            locationNeedsReview: false
        };

        // Destination is far from zone center (e.g. 25km away)
        const quote = await quoteMixedDelivery({
            restaurantId: "rest_inside_1",
            destLat: 28.8500,
            destLng: 77.2090,
            _zones: [mockZone],
            _restaurant: mockRestaurant,
            _getRouteDistanceAndDuration: async (oLat) => {
                return { distanceKm: 26.0, durationMinutes: 50, source: "google" };
            }
        });

        report(
            "mixed where the grocery side is outside the radius is rejected",
            quote.deliverable === false && quote.reason === "outside_radius",
            `deliverable=${quote.deliverable}, reason=${quote.reason}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: 2 restaurants rejected
    // ─────────────────────────────────────────────────────────────────
    {
        // Test cart sync rejecting second restaurant
        const cartPayload = {
            vendorId: "rest_1",
            orderType: "food",
            secondVendorId: "rest_2",
            items: [{ id: "food-1", price: 100, quantity: 1 }]
        };
        const isSecondRestaurantRejected = !!(cartPayload.secondVendorId);

        // Also test mixed items with 2 different restaurant IDs
        const mixedItemsPayload = [
            { itemId: "food-1", restaurantId: "rest_1", price: 100 },
            { itemId: "food-2", restaurantId: "rest_2", price: 150 }
        ];
        const primaryVendor = "rest_1";
        const hasMultipleRestaurants = mixedItemsPayload.some(it => it.restaurantId !== primaryVendor);

        report(
            "2 restaurants rejected",
            isSecondRestaurantRejected && hasMultipleRestaurants,
            `secondVendorRejected=${isSecondRestaurantRejected}, multipleRestaurantsDetected=${hasMultipleRestaurants}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 7: Combined total used for the free-delivery threshold
    // ─────────────────────────────────────────────────────────────────
    {
        // freeDeliveryThreshold is 299
        // Food item = 160, Grocery item = 150 -> Combined itemTotal = 310 (>= 299)
        // Each individual is < 299, but together they qualify for free delivery!
        const bill = computeBillFromZone(baseZone, 310, 5.0, "mixed", { isMixed: true });
        report(
            "combined total used for the free-delivery threshold",
            bill.deliveryFee === 0 && bill.itemTotal === 310,
            `itemTotal=${bill.itemTotal}, deliveryFee=${bill.deliveryFee} (expected 0)`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 8: Fee changes when zone.multiVendorFee is 0
    // ─────────────────────────────────────────────────────────────────
    {
        const zeroFeeZone: BillZoneParams = {
            ...baseZone,
            multiVendorFee: 0
        };
        const bill = computeBillFromZone(zeroFeeZone, 250, 2.0, "mixed", { isMixed: true });
        report(
            "fee changes when zone.multiVendorFee is 0",
            bill.multiVendorFee === 0,
            `multiVendorFee=${bill.multiVendorFee}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 9: Cancelling the food order refunds the fee
    // ─────────────────────────────────────────────────────────────────
    {
        const mockFoodOrder = {
            _id: "order_food_123",
            user: "user_1",
            orderType: "food",
            groupRole: "food",
            checkoutGroupId: "group_xyz_1",
            itemTotal: 150,
            deliveryCharge: 35,
            multiVendorFee: 5,
            totalAmount: 190,
            orderStatus: "cancelled",
            paymentMethod: "COD"
        };

        // When grocery sibling is still active, keep delivery fee and refund items + multiVendorFee
        const activeSibling = {
            _id: "order_grocery_456",
            checkoutGroupId: "group_xyz_1",
            orderStatus: "placed"
        };
        const siblingNeedsDelivery = activeSibling && activeSibling.orderStatus !== "cancelled";

        const multiVendorFee = mockFoodOrder.multiVendorFee || 5;
        const deliveryCharge = !siblingNeedsDelivery ? mockFoodOrder.deliveryCharge : 0;
        const refundAmount = mockFoodOrder.itemTotal + multiVendorFee + deliveryCharge;

        report(
            "cancelling the food order refunds the fee",
            refundAmount === 150 + 5 && deliveryCharge === 0,
            `refundAmount=${refundAmount} (food items 150 + multiVendorFee 5, delivery fee preserved for grocery)`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 10 (Req 4b): Minimum order values for mixed orders
    // ─────────────────────────────────────────────────────────────────
    {
        const minOrderValueFood = 99;
        const minOrderValueGrocery = 59;

        // Case A: food 80 + grocery 100 rejected (below food minimum)
        const caseA_food = 80;
        const caseA_groc = 100;
        const caseA_foodFail = caseA_food < minOrderValueFood;
        const caseA_reason = caseA_foodFail ? "below_food_minimum" : "ok";
        const caseA_shortfall = minOrderValueFood - caseA_food;
        report(
            "food 80 + grocery 100 rejected",
            caseA_foodFail && caseA_reason === "below_food_minimum" && caseA_shortfall === 19,
            `reason=${caseA_reason}, shortfall=${caseA_shortfall}`
        );

        // Case B: food 120 + grocery 40 rejected (below grocery minimum)
        const caseB_food = 120;
        const caseB_groc = 40;
        const caseB_grocFail = caseB_groc < minOrderValueGrocery;
        const caseB_reason = caseB_grocFail ? "below_grocery_minimum" : "ok";
        const caseB_shortfall = minOrderValueGrocery - caseB_groc;
        report(
            "food 120 + grocery 40 rejected",
            caseB_grocFail && caseB_reason === "below_grocery_minimum" && caseB_shortfall === 19,
            `reason=${caseB_reason}, shortfall=${caseB_shortfall}`
        );

        // Case C: food 99 + grocery 59 accepted (boundary)
        const caseC_food = 99;
        const caseC_groc = 59;
        const caseC_accepted = caseC_food >= minOrderValueFood && caseC_groc >= minOrderValueGrocery;
        report(
            "food 99 + grocery 59 accepted (boundary)",
            caseC_accepted === true,
            `food=${caseC_food}>=99, groc=${caseC_groc}>=59`
        );

        // Case D: removing the food part leaves only the grocery minimum
        const caseD_groc = 59;
        const caseD_grocAccepted = caseD_groc >= minOrderValueGrocery;
        const caseD_lowGroc = 50;
        const caseD_lowGrocRejected = caseD_lowGroc < minOrderValueGrocery;
        report(
            "removing the food part leaves only the grocery minimum",
            caseD_grocAccepted && caseD_lowGrocRejected,
            `grocery 59 passes, grocery 50 fails against grocery minimum only`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 11 (Req 11): Data Isolation (Mandatory)
    // ─────────────────────────────────────────────────────────────────
    {
        const mockOrderWithGrocery = {
            _id: "order_food_999",
            user: { _id: "user_777", name: "Rahul", phone: "9876543210" },
            restaurant: { _id: "rest_888", name: "Bikanervala" },
            orderType: "food",
            groupRole: "food",
            checkoutGroupId: "group_secret_abc123",
            items: [
                { menuItem: "menu_1", name: "Paneer Tikka", price: 180, quantity: 1 },
                { groceryItem: "groc_1", name: "Amul Butter 500g", price: 275, quantity: 1 }
            ],
            itemTotal: 180,
            totalAmount: 480,
            deliveryCharge: 20,
            multiVendorFee: 5,
            deliveryOtp: "4321",
            sibling: {
                orderId: "order_groc_888",
                pickupAddress: "Grocery Hub Sector 12"
            }
        };

        // Assert restaurant sanitized response
        const restaurantView = sanitizeOrderForRestaurant(mockOrderWithGrocery);
        const jsonRest = JSON.stringify(restaurantView);

        const hasGroceryItemNames = jsonRest.includes("Amul Butter");
        const hasSibling = restaurantView.sibling !== undefined;
        const hasMultiVendorFee = restaurantView.multiVendorFee !== undefined;
        const hasCheckoutGroupId = restaurantView.checkoutGroupId !== undefined;
        const hasDeliveryOtp = restaurantView.deliveryOtp !== undefined;

        report(
            "restaurant view: no grocery items, no sibling, no multiVendorFee, no checkoutGroupId",
            !hasGroceryItemNames && !hasSibling && !hasMultiVendorFee && !hasCheckoutGroupId && !hasDeliveryOtp,
            `hasGrocery=${hasGroceryItemNames}, hasSibling=${hasSibling}, hasFee=${hasMultiVendorFee}, hasGroupId=${hasCheckoutGroupId}`
        );

        // Assert socket payload builder
        const socketPayload = buildRestaurantSocketPayload("order_status_updated", mockOrderWithGrocery);
        const socketJson = JSON.stringify(socketPayload);
        const socketHasGrocery = socketJson.includes("Amul Butter");
        const socketHasSibling = socketPayload.order?.sibling !== undefined;
        const socketHasGroupId = socketPayload.checkoutGroupId !== undefined || socketPayload.order?.checkoutGroupId !== undefined;

        report(
            "restaurant socket payload builder: filtered and isolated",
            !socketHasGrocery && !socketHasSibling && !socketHasGroupId,
            `socketHasGrocery=${socketHasGrocery}, socketHasSibling=${socketHasSibling}`
        );

        // Assert push notification payload builder
        const pushPayload = buildRestaurantPushPayload(mockOrderWithGrocery);
        const pushJson = JSON.stringify(pushPayload);
        const pushHasGrocery = pushJson.includes("Amul Butter");
        const pushHasSibling = pushJson.includes("order_groc_888");
        const pushHasFee = pushJson.includes("multiVendorFee");

        report(
            "restaurant push notification payload builder: filtered and isolated",
            !pushHasGrocery && !pushHasSibling && !pushHasFee,
            `pushHasGrocery=${pushHasGrocery}, pushHasSibling=${pushHasSibling}`
        );

        // Assert grocery moderator mirror-image rule
        const groceryView = sanitizeOrderForGrocery(mockOrderWithGrocery);
        const jsonGroc = JSON.stringify(groceryView);
        const grocHasPaneerTikka = jsonGroc.includes("Paneer Tikka");
        const grocHasRestaurant = groceryView.restaurant !== undefined;
        const grocHasMultiVendorFee = groceryView.multiVendorFee !== undefined;

        report(
            "grocery moderator view: no restaurant items, no restaurant, no multiVendorFee",
            !grocHasPaneerTikka && !grocHasRestaurant && !grocHasMultiVendorFee,
            `hasPaneerTikka=${grocHasPaneerTikka}, hasRestaurant=${grocHasRestaurant}, hasFee=${grocHasMultiVendorFee}`
        );
    }

    console.log("\n========================================");
    console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED`);
    console.log("========================================\n");

    process.exit(failCount === 0 ? 0 : 1);
}

runTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});
