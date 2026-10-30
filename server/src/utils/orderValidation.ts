import mongoose from "mongoose";
import Order, { IOrder } from "../models/Order";
import Restaurant from "../models/Restaurant";
import User from "../models/User";
import GroceryProduct from "../models/GroceryProduct";
import Payment from "../models/Payment";
import PlatformSettings from "../models/PlatformSettings";
import { getRouteDistanceAndDuration } from "./googleMaps";
import { validateCoupon } from "../controllers/couponController";
import * as redisService from "../services/redisService";
import * as cartCacheService from "../services/cartCacheService";
import { calculateDistance } from "../services/distanceService";
import { emitToRooms } from "../services/socketService";
import { computeBillFromZone } from "./billCalculator";
import { checkRestaurantAcceptingOrders } from "./restaurantHours";
import { verifyItemPrices } from "./itemVerification";
import { parseCoordinates } from "./coordinates";
import { quoteDelivery, quoteMixedDelivery } from "../services/deliveryQuoteService";
import { sanitizeOrderForRestaurant, sanitizeOrderForGrocery } from "./orderSanitizer";

export interface OrderValidationInput {
    items: any[];
    groceryItems?: any[];
    orderType?: "food" | "grocery" | "mixed";
    restaurant?: string;
    address: {
        fullAddress: string;
        lat: number;
        lng: number;
        locationSource?: "gps" | "manual";
        deliveryAddress?: any;
        pincode?: string;
    };
    phone?: string;
    couponCode?: string;
    userId?: string;
    whatsappOrder?: boolean;
    // Optional dependency injection overrides for unit/mock testing
    _zones?: any[];
    _restaurant?: any;
    _settings?: any;
    _getRouteDistanceAndDuration?: (
        originLat: number,
        originLng: number,
        destLat: number,
        destLng: number
    ) => Promise<any>;
}

export interface OrderValidationResult {
    success: boolean;
    message?: string;
    reason?: string;
    shortfall?: number;
    isMixed?: boolean;
    verifiedItems?: any[];
    verifiedItemTotal?: number;
    verifiedBill?: any;
    finalTotal?: number;
    verifiedTotal?: number;
    deliveryFee?: number;
    multiVendorFee?: number;
    applicableZone?: any;
    calculatedDistance?: number;
    distanceSource?: "google" | "estimated";
    routeOrigin?: { lat: number; lng: number };
    straightLineKm?: number;
    validatedCoordinates?: { lat: number; lng: number };
    discountAmount?: number;
    couponDoc?: any;
    assignedModerator?: any;
    formattedDeliveryAddress?: any;

    // Mixed order details
    verifiedFoodItems?: any[];
    verifiedGroceryItems?: any[];
    foodItemTotal?: number;
    groceryItemTotal?: number;
    foodDistance?: number;
    foodDistanceSource?: "google" | "estimated";
    foodRouteOrigin?: { lat: number; lng: number };
    foodStraightLineKm?: number;
    groceryDistance?: number;
    groceryDistanceSource?: "google" | "estimated";
    groceryRouteOrigin?: { lat: number; lng: number };
    groceryStraightLineKm?: number;
}

/**
 * Shared validation and pricing engine for both COD and ONLINE order paths.
 * Validates platform status, hours, inventory, delivery zone, route distance, item prices, min order value, and coupons.
 */
export async function validateAndPriceOrder(input: OrderValidationInput): Promise<OrderValidationResult> {
    const {
        items,
        groceryItems: inputGroceryItems,
        orderType = "food",
        restaurant,
        address,
        phone,
        couponCode,
        userId
    } = input;

    const hasExplicitGroceryItems = Array.isArray(inputGroceryItems) && inputGroceryItems.length > 0;
    let foodItems: any[] = [];
    let groceryItems: any[] = [];

    if (hasExplicitGroceryItems) {
        foodItems = items || [];
        groceryItems = inputGroceryItems || [];
    } else if (orderType === "mixed") {
        foodItems = (items || []).filter((it: any) =>
            it.menuItem ||
            (typeof it.id === "string" && it.id.startsWith("food-")) ||
            (typeof it.itemId === "string" && it.itemId.startsWith("food-"))
        );
        groceryItems = (items || []).filter((it: any) =>
            it.groceryItem ||
            (typeof it.id === "string" && it.id.startsWith("groc-")) ||
            (typeof it.itemId === "string" && it.itemId.startsWith("groc-"))
        );
    } else {
        if (orderType === "food") {
            foodItems = items || [];
        } else {
            groceryItems = items || [];
        }
    }

    const isMixed = foodItems.length > 0 && groceryItems.length > 0;

    if (!isMixed && (!items || !Array.isArray(items) || items.length === 0)) {
        return { success: false, message: "Cart mein kam se kam ek item hona zaroori hai." };
    }

    // 1. Check Platform Settings
    let settings = input._settings || await redisService.getJson<any>("platform:settings");
    if (!settings) {
        settings = await PlatformSettings.findOne().lean();
        if (settings) {
            await redisService.setJson("platform:settings", settings, 60);
        }
    }

    if (settings) {
        // Maintenance Mode Check
        if (settings.maintenanceMode) {
            return {
                success: false,
                message: "App mein maintenance chal raha hai. Kripya thodi der baad check karein."
            };
        }

        // Global Platform Status Check
        if (!settings.isPlatformOpen) {
            return {
                success: false,
                message: "Ordering abhi uplabdh nahi hai. Kripya thodi der baad try karein."
            };
        }

        // Operating Hours Check (Asia/Kolkata timezone)
        if (settings.operatingHours?.open && settings.operatingHours?.close) {
            const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' } as const;
            const timeString = new Intl.DateTimeFormat('en-US', options).format(new Date());
            const [currH, currM] = timeString.split(":").map(Number);
            const [openH, openM] = settings.operatingHours.open.split(":").map(Number);
            const [closeH, closeM] = settings.operatingHours.close.split(":").map(Number);

            const currVal = currH * 60 + currM;
            const openVal = openH * 60 + openM;
            const closeVal = closeH * 60 + closeM;

            let isWithinHours = false;
            if (openVal <= closeVal) {
                isWithinHours = currVal >= openVal && currVal < closeVal;
            } else {
                // overnight hours
                isWithinHours = currVal >= openVal || currVal < closeVal;
            }

            if (!isWithinHours) {
                const [h, m] = settings.operatingHours.open.split(":").map(Number);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const displayH = h % 12 || 12;
                const displayM = m.toString().padStart(2, '0');
                const formattedOpenTime = `${displayH}:${displayM} ${ampm}`;

                return {
                    success: false,
                    message: `Aaj ke liye orders band hain. Hum ${formattedOpenTime} par dobara open karenge.`
                };
            }
        }

        // Grocery Operations Check
        if ((orderType === "grocery" || isMixed) && settings.groceryStatus !== "open") {
            const groceryMsg = settings.groceryStatus === "disabled"
                ? "Grocery ordering abhi ke liye band hai."
                : "Grocery service abhi band hai.";
            return {
                success: false,
                message: groceryMsg
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // PATH A: MIXED ORDER (Food + Grocery)
    // ─────────────────────────────────────────────────────────────────
    if (isMixed) {
        if (!restaurant) {
            return { success: false, message: "Restaurant zaroori hai food items ke liye." };
        }

        // Restaurant Availability Check
        const fetchedRestaurant = input._restaurant || await Restaurant.findById(restaurant);
        const availability = checkRestaurantAcceptingOrders(fetchedRestaurant);
        if (!availability.isAccepting) {
            return {
                success: false,
                message: availability.message
            };
        }

        // Inventory Stock Pre-check for Grocery
        const groceryItemIds = groceryItems.map((i: any) =>
            i.groceryItem || (typeof i.itemId === "string" ? i.itemId.replace("groc-", "") : (typeof i.id === "string" ? i.id.replace("groc-", "") : undefined))
        ).filter(Boolean);
        const products = await GroceryProduct.find({ _id: { $in: groceryItemIds } });
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        for (const item of groceryItems) {
            const rawId = item.groceryItem || (typeof item.itemId === "string" ? item.itemId.replace("groc-", "") : item.id?.replace("groc-", ""));
            const product = productMap.get(rawId?.toString());
            if (!product) {
                return { success: false, message: "Grocery product nahi mila." };
            }
            if (product.stockQuantity < item.quantity) {
                return {
                    success: false,
                    message: `${product.name} ka stock kam hai. Available: ${product.stockQuantity}, Manga gaya: ${item.quantity}`
                };
            }
        }

        // Feasibility via quoteMixedDelivery (strict radius, no tolerance)
        const mixedQuote = await quoteMixedDelivery({
            restaurantId: restaurant,
            destLat: address?.lat,
            destLng: address?.lng,
            pincode: address?.pincode,
            addressText: address?.fullAddress,
            forOrder: true,
            _zones: input._zones,
            _restaurant: input._restaurant,
            _getRouteDistanceAndDuration: input._getRouteDistanceAndDuration
        });

        if (!mixedQuote.deliverable) {
            let errorMsg = "Maaf karein, aapke area mein abhi delivery uplabdh nahi hai.";
            if (mixedQuote.reason === "invalid_location") {
                errorMsg = "Sahi delivery coordinates (lat/lng) zaroori hain.";
            } else if (mixedQuote.reason === "outside_zone") {
                errorMsg = "Maaf karein, aapke area mein abhi delivery uplabdh nahi hai.";
            } else if (mixedQuote.reason === "outside_radius") {
                errorMsg = `Maaf karein, aapka distance (${mixedQuote.distanceKm}km) hamari delivery limit se bahar hai.`;
            } else if (mixedQuote.reason === "restaurant_location_unverified") {
                errorMsg = "Restaurant ki location verify nahi hai.";
            }

            return {
                success: false,
                reason: mixedQuote.reason,
                message: errorMsg
            };
        }

        const applicableZone = mixedQuote.zone;
        const calculatedDistance = mixedQuote.distanceKm;
        const parsedDestCoords = parseCoordinates(address?.lat, address?.lng)!;

        // Server-side Price Verification (separate food and grocery)
        let verifiedFoodTotal = 0;
        let verifiedFoodItems: any[] = [];
        try {
            const foodVerif = await verifyItemPrices(foodItems, "food", restaurant);
            verifiedFoodTotal = foodVerif.verifiedItemTotal;
            verifiedFoodItems = foodVerif.verifiedItems;
        } catch (verifErr: any) {
            return { success: false, message: verifErr.message || "Food price verification fail ho gaya." };
        }

        let verifiedGroceryTotal = 0;
        let verifiedGroceryItems: any[] = [];
        try {
            const grocVerif = await verifyItemPrices(groceryItems, "grocery", undefined);
            verifiedGroceryTotal = grocVerif.verifiedItemTotal;
            verifiedGroceryItems = grocVerif.verifiedItems;
        } catch (verifErr: any) {
            return { success: false, message: verifErr.message || "Grocery price verification fail ho gaya." };
        }

        // Minimum order value checks (separate for food and grocery per Requirement 4b)
        const minOrderValueFood = settings?.minOrderValueFood || 0;
        const minOrderValueGrocery = settings?.minOrderValueGrocery || 0;

        if (verifiedFoodTotal < minOrderValueFood) {
            const shortfall = minOrderValueFood - verifiedFoodTotal;
            return {
                success: false,
                reason: "below_food_minimum",
                message: `Kam se kam ₹${minOrderValueFood} ka food order hona zaroori hai. Shortfall: ₹${shortfall}`,
                shortfall
            };
        }

        if (verifiedGroceryTotal < minOrderValueGrocery) {
            const shortfall = minOrderValueGrocery - verifiedGroceryTotal;
            return {
                success: false,
                reason: "below_grocery_minimum",
                message: `Kam se kam ₹${minOrderValueGrocery} ka grocery order hona zaroori hai. Shortfall: ₹${shortfall}`,
                shortfall
            };
        }

        const verifiedItemTotal = verifiedFoodTotal + verifiedGroceryTotal;
        const multiVendorFee = applicableZone.multiVendorFee !== undefined ? applicableZone.multiVendorFee : 5;

        // Bill calculation: ONE delivery fee from larger distance, free delivery threshold uses combined item total
        const verifiedBill = computeBillFromZone(
            applicableZone,
            verifiedItemTotal,
            calculatedDistance,
            "mixed",
            { isMixed: true, multiVendorFee }
        );

        if (phone && userId) {
            await User.findByIdAndUpdate(userId, { phone });
        }

        // Auto Order Routing to least-busy moderator inside deliveryZone (Grocery)
        let assignedModerator = undefined;
        const moderators = await User.find({
            role: "grocery_moderator",
            assignedZones: applicableZone._id,
            isBlocked: false
        });

        if (moderators.length > 0) {
            const modIds = moderators.map(m => m._id);
            const activeCounts = await Order.aggregate([
                {
                    $match: {
                        moderator: { $in: modIds },
                        orderType: "grocery",
                        orderStatus: { $in: ["placed", "accepted", "preparing", "on_the_way"] }
                    }
                },
                { $group: { _id: "$moderator", count: { $sum: 1 } } }
            ]);

            const countMap = new Map(activeCounts.map(a => [a._id.toString(), a.count]));
            moderators.sort((a, b) => (countMap.get(a._id.toString()) || 0) - (countMap.get(b._id.toString()) || 0));
            assignedModerator = moderators[0]._id;
        }

        // Coupon validation
        let calculatedDiscount = 0;
        let couponDoc = null;
        if (couponCode) {
            const validation = await validateCoupon(
                couponCode,
                userId || "",
                verifiedItemTotal,
                applicableZone._id.toString(),
                restaurant,
                "food"
            );
            if (!validation.success) {
                return { success: false, message: `Coupon validation failed: ${validation.message}` };
            }
            calculatedDiscount = validation.discountAmount;
            couponDoc = validation.coupon;
        }

        const finalTotal = Math.max(0, verifiedBill.grandTotal - calculatedDiscount);

        let formattedDeliveryAddress = undefined;
        if (address.deliveryAddress) {
            if (typeof address.deliveryAddress === "object") {
                formattedDeliveryAddress = address.deliveryAddress;
            } else if (typeof address.deliveryAddress === "string") {
                formattedDeliveryAddress = {
                    houseNumber: address.deliveryAddress,
                    landmark: address.deliveryAddress,
                    street: "",
                    locality: "",
                    village: "",
                    pincode: address.pincode || "",
                    instructions: ""
                };
            }
        }

        return {
            success: true,
            isMixed: true,
            verifiedItems: [...verifiedFoodItems, ...verifiedGroceryItems],
            verifiedFoodItems,
            verifiedGroceryItems,
            foodItemTotal: verifiedFoodTotal,
            groceryItemTotal: verifiedGroceryTotal,
            verifiedItemTotal,
            verifiedBill,
            finalTotal,
            verifiedTotal: finalTotal,
            deliveryFee: verifiedBill.deliveryFee,
            multiVendorFee: verifiedBill.multiVendorFee,
            applicableZone,
            calculatedDistance,
            distanceSource: mixedQuote.foodQuote.source || mixedQuote.groceryQuote.source || undefined,
            routeOrigin: mixedQuote.foodQuote.origin || undefined,
            straightLineKm: mixedQuote.foodQuote.straightKm,
            foodDistance: mixedQuote.foodQuote.distanceKm,
            foodDistanceSource: mixedQuote.foodQuote.source || undefined,
            foodRouteOrigin: mixedQuote.foodQuote.origin || undefined,
            foodStraightLineKm: mixedQuote.foodQuote.straightKm,
            groceryDistance: mixedQuote.groceryQuote.distanceKm,
            groceryDistanceSource: mixedQuote.groceryQuote.source || undefined,
            groceryRouteOrigin: mixedQuote.groceryQuote.origin || undefined,
            groceryStraightLineKm: mixedQuote.groceryQuote.straightKm,
            validatedCoordinates: parsedDestCoords,
            discountAmount: calculatedDiscount,
            couponDoc,
            assignedModerator,
            formattedDeliveryAddress
        };
    }

    // ─────────────────────────────────────────────────────────────────
    // PATH B: SINGLE ORDER (Pure Food OR Pure Grocery) - UNTOUCHED
    // ─────────────────────────────────────────────────────────────────

    // 2. Restaurant Availability Check (Food only)
    let fetchedRestaurant: any = null;
    if (orderType === "food" && restaurant) {
        fetchedRestaurant = await Restaurant.findById(restaurant);
        const availability = checkRestaurantAcceptingOrders(fetchedRestaurant);
        if (!availability.isAccepting) {
            return {
                success: false,
                message: availability.message
            };
        }
    }

    // 3. Inventory Stock Pre-check for Grocery
    if (orderType === "grocery") {
        const groceryItemIds = items.map((i: any) => i.groceryItem);
        const products = await GroceryProduct.find({ _id: { $in: groceryItemIds } });
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        for (const item of items) {
            const product = productMap.get(item.groceryItem?.toString());
            if (!product) {
                return { success: false, message: "Grocery product nahi mila." };
            }
            if (product.stockQuantity < item.quantity) {
                return {
                    success: false,
                    message: `${product.name} ka stock kam hai. Available: ${product.stockQuantity}, Manga gaya: ${item.quantity}`
                };
            }
        }
    }

    // 4. Delivery Feasibility, Zone Resolution, and Distance Calculation via quoteDelivery
    const quote = await quoteDelivery({
        orderType: orderType as "food" | "grocery",
        restaurantId: orderType === "food" ? restaurant : undefined,
        destLat: address?.lat,
        destLng: address?.lng,
        pincode: address?.pincode,
        addressText: address?.fullAddress,
        forOrder: true,
        _zones: input._zones,
        _restaurant: input._restaurant,
        _getRouteDistanceAndDuration: input._getRouteDistanceAndDuration
    });

    if (!quote.deliverable) {
        let errorMsg = "Maaf karein, aapke area mein abhi delivery uplabdh nahi hai.";
        if (quote.reason === "invalid_location") {
            errorMsg = "Sahi delivery coordinates (lat/lng) zaroori hain.";
        } else if (quote.reason === "outside_zone") {
            errorMsg = "Maaf karein, aapke area mein abhi delivery uplabdh nahi hai.";
        } else if (quote.reason === "outside_radius") {
            errorMsg = `Maaf karein, aapka distance (${quote.distanceKm || quote.straightKm}km) hamari delivery limit se bahar hai.`;
        } else if (quote.reason === "restaurant_location_unverified") {
            errorMsg = "Restaurant ki location verify nahi hai.";
        }

        return {
            success: false,
            reason: quote.reason,
            message: errorMsg
        };
    }

    const applicableZone = quote.zone;
    const calculatedDistance = quote.distanceKm;
    const distanceSource = quote.source || undefined;
    const routeOrigin = quote.origin || undefined;
    const straightLineKm = quote.straightKm;
    const parsedDestCoords = parseCoordinates(address?.lat, address?.lng)!;

    const singleOrderType: "food" | "grocery" = orderType === "grocery" ? "grocery" : "food";

    // 6. Server-side Price Verification
    let verifiedItemTotal = 0;
    let verifiedItems: any[] = [];
    try {
        const verification = await verifyItemPrices(items, singleOrderType, restaurant);
        verifiedItemTotal = verification.verifiedItemTotal;
        verifiedItems = verification.verifiedItems;
    } catch (verifErr: any) {
        return {
            success: false,
            message: verifErr.message || "Price verification fail ho gaya."
        };
    }

    // 7. Minimum Order Value Enforcement
    const minOrderValue = singleOrderType === "food" ? (settings?.minOrderValueFood || 0) : (settings?.minOrderValueGrocery || 0);
    if (verifiedItemTotal < minOrderValue) {
        const shortfall = minOrderValue - verifiedItemTotal;
        return {
            success: false,
            reason: singleOrderType === "food" ? "below_food_minimum" : "below_grocery_minimum",
            message: `Kam se kam ₹${minOrderValue} ka order hona zaroori hai. Kripya kuch aur items cart mein jodein.`,
            shortfall
        };
    }

    // 8. Bill calculation
    const verifiedBill = computeBillFromZone(applicableZone, verifiedItemTotal, calculatedDistance, singleOrderType);

    // Update user phone number if provided
    if (phone && userId) {
        await User.findByIdAndUpdate(userId, { phone });
    }

    // 9. Auto Order Routing to least-busy moderator inside deliveryZone (Grocery)
    let assignedModerator = undefined;
    if (singleOrderType === "grocery") {
        const moderators = await User.find({
            role: "grocery_moderator",
            assignedZones: applicableZone._id,
            isBlocked: false
        });

        if (moderators.length > 0) {
            const modIds = moderators.map(m => m._id);
            const activeCounts = await Order.aggregate([
                {
                    $match: {
                        moderator: { $in: modIds },
                        orderType: "grocery",
                        orderStatus: { $in: ["placed", "accepted", "preparing", "on_the_way"] }
                    }
                },
                { $group: { _id: "$moderator", count: { $sum: 1 } } }
            ]);

            const countMap = new Map(activeCounts.map(a => [a._id.toString(), a.count]));
            moderators.sort((a, b) => (countMap.get(a._id.toString()) || 0) - (countMap.get(b._id.toString()) || 0));
            assignedModerator = moderators[0]._id;
        }
    }

    // 10. Coupon Validation
    let calculatedDiscount = 0;
    let couponDoc = null;

    if (couponCode) {
        const validation = await validateCoupon(
            couponCode,
            userId || "",
            verifiedItemTotal,
            applicableZone._id.toString(),
            singleOrderType === "food" ? restaurant : undefined,
            singleOrderType
        );

        if (!validation.success) {
            return { success: false, message: `Coupon validation failed: ${validation.message}` };
        }
        
        calculatedDiscount = validation.discountAmount;
        couponDoc = validation.coupon;
    }

    const finalTotal = Math.max(0, verifiedBill.grandTotal - calculatedDiscount);

    // Format delivery address structure
    let formattedDeliveryAddress = undefined;
    if (address.deliveryAddress) {
        if (typeof address.deliveryAddress === "object") {
            formattedDeliveryAddress = address.deliveryAddress;
        } else if (typeof address.deliveryAddress === "string") {
            formattedDeliveryAddress = {
                houseNumber: address.deliveryAddress,
                landmark: address.deliveryAddress,
                street: "",
                locality: "",
                village: "",
                pincode: address.pincode || "",
                instructions: ""
            };
        }
    }

    return {
        success: true,
        verifiedItems,
        verifiedItemTotal,
        verifiedBill,
        finalTotal,
        verifiedTotal: finalTotal,
        deliveryFee: verifiedBill.deliveryFee,
        applicableZone,
        calculatedDistance,
        distanceSource,
        routeOrigin,
        straightLineKm,
        validatedCoordinates: parsedDestCoords,
        discountAmount: calculatedDiscount,
        couponDoc,
        assignedModerator,
        formattedDeliveryAddress
    };
}

export interface FinalizeOrderInput {
    user: any;
    restaurant?: any;
    orderType: "food" | "grocery" | "mixed";
    items: any[];
    itemTotal: number;
    totalAmount: number;
    deliveryCharge: number;
    paymentMethod: "COD" | "ONLINE";
    paymentStatus?: "pending" | "paid" | "failed";
    orderStatus?: any;
    distance: number;
    distanceSource?: "google" | "estimated";
    routeOrigin?: { lat: number; lng: number };
    straightLineKm?: number;
    address: {
        fullAddress: string;
        lat: number;
        lng: number;
        locationSource?: "gps" | "manual";
        deliveryAddress?: any;
    };
    whatsappOrder?: boolean;
    deliveryZone?: any;
    moderator?: any;
    couponCode?: string;
    discountAmount?: number;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    couponDoc?: any;
    grandTotalBeforeDiscount?: number;
    checkoutGroupId?: string;
    groupRole?: "food" | "grocery";
    multiVendorFee?: number;

    // Mixed order parameters
    isMixed?: boolean;
    foodItems?: any[];
    groceryItems?: any[];
    foodItemTotal?: number;
    groceryItemTotal?: number;
    foodDistance?: number;
    foodDistanceSource?: "google" | "estimated";
    foodRouteOrigin?: { lat: number; lng: number };
    foodStraightLineKm?: number;
    groceryDistance?: number;
    groceryDistanceSource?: "google" | "estimated";
    groceryRouteOrigin?: { lat: number; lng: number };
    groceryStraightLineKm?: number;
}

export interface FinalizeMixedOrderInput {
    user: any;
    restaurant: any;
    foodItems: any[];
    groceryItems: any[];
    foodItemTotal: number;
    groceryItemTotal: number;
    totalAmount: number;
    deliveryCharge: number;
    multiVendorFee: number;
    paymentMethod: "COD" | "ONLINE";
    paymentStatus?: "pending" | "paid" | "failed";
    orderStatus?: any;
    foodDistance: number;
    foodDistanceSource?: "google" | "estimated";
    foodRouteOrigin?: { lat: number; lng: number };
    foodStraightLineKm?: number;
    groceryDistance: number;
    groceryDistanceSource?: "google" | "estimated";
    groceryRouteOrigin?: { lat: number; lng: number };
    groceryStraightLineKm?: number;
    address: {
        fullAddress: string;
        lat: number;
        lng: number;
        locationSource?: "gps" | "manual";
        deliveryAddress?: any;
    };
    whatsappOrder?: boolean;
    deliveryZone?: any;
    moderator?: any;
    couponCode?: string;
    discountAmount?: number;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    couponDoc?: any;
    grandTotalBeforeDiscount?: number;
    checkoutGroupId?: string;
}

export interface FinalizeMixedOrderResult {
    foodOrder: IOrder;
    groceryOrder: IOrder;
    checkoutGroupId: string;
}

/**
 * Creates two linked orders (one food, one grocery) sharing checkoutGroupId,
 * atomic grocery stock deduction, one payment, and rollback on failure.
 */
export async function finalizeMixedOrderPlacement(input: FinalizeMixedOrderInput): Promise<FinalizeMixedOrderResult> {
    const {
        user,
        restaurant,
        foodItems,
        groceryItems,
        foodItemTotal,
        groceryItemTotal,
        totalAmount,
        deliveryCharge,
        multiVendorFee,
        paymentMethod,
        paymentStatus = paymentMethod === "ONLINE" ? "paid" : "pending",
        orderStatus = "placed",
        foodDistance,
        foodDistanceSource,
        foodRouteOrigin,
        foodStraightLineKm,
        groceryDistance,
        groceryDistanceSource,
        groceryRouteOrigin,
        groceryStraightLineKm,
        address,
        whatsappOrder,
        deliveryZone,
        moderator,
        couponCode,
        discountAmount = 0,
        razorpayOrderId,
        razorpayPaymentId,
        couponDoc,
        checkoutGroupId = `cg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    } = input;

    // 1. Atomic batch stock deduction for Grocery
    if (groceryItems && groceryItems.length > 0) {
        const bulkOps = groceryItems.map((item: any) => ({
            updateOne: {
                filter: { _id: item.groceryItem, stockQuantity: { $gte: item.quantity } },
                update: { $inc: { stockQuantity: -item.quantity } }
            }
        }));
        const bulkResult = await GroceryProduct.bulkWrite(bulkOps, { ordered: true });

        if (bulkResult.modifiedCount !== groceryItems.length) {
            const rollbackOps = groceryItems.slice(0, bulkResult.modifiedCount).map((item: any) => ({
                updateOne: {
                    filter: { _id: item.groceryItem },
                    update: { $inc: { stockQuantity: item.quantity } }
                }
            }));
            if (rollbackOps.length > 0) {
                await GroceryProduct.bulkWrite(rollbackOps);
            }
            throw new Error("Stock availability badal gayi hai. Kripya apna cart dobara check karein.");
        }
    }

    // 2. Order creation with ordered steps and rollback on failure
    let foodOrder: any = null;
    let groceryOrder: any = null;

    try {
        const deliveryOtp = paymentMethod === "ONLINE" ? String(Math.floor(1000 + Math.random() * 9000)) : undefined;

        const validatedAddressCoords = parseCoordinates(address?.lat, address?.lng);
        const finalLat = validatedAddressCoords ? validatedAddressCoords.lat : Number(address?.lat);
        const finalLng = validatedAddressCoords ? validatedAddressCoords.lng : Number(address?.lng);
        const cleanAddress = {
            ...address,
            lat: finalLat,
            lng: finalLng
        };

        // Split totalAmount: grocery carries pure item total, food carries remainder including fees
        const groceryOrderTotal = Math.round(groceryItemTotal);
        const foodOrderTotal = Math.max(0, totalAmount - groceryOrderTotal);

        // 2a. Primary Order (Food)
        foodOrder = new Order({
            user,
            restaurant,
            orderType: "food",
            checkoutGroupId,
            groupRole: "food",
            items: foodItems,
            itemTotal: foodItemTotal,
            totalAmount: foodOrderTotal,
            deliveryCharge,
            multiVendorFee,
            paymentMethod,
            paymentStatus,
            orderStatus,
            distance: foodDistance,
            distanceSource: foodDistanceSource,
            routeOrigin: foodRouteOrigin,
            straightLineKm: foodStraightLineKm,
            address: cleanAddress,
            whatsappOrder,
            deliveryZone,
            couponCode,
            discountAmount,
            razorpayOrderId,
            deliveryOtp
        });
        await foodOrder.save();

        // 2b. Sibling Order (Grocery) - deliveryCharge: 0, multiVendorFee: 0 per Requirement 5
        groceryOrder = new Order({
            user,
            orderType: "grocery",
            checkoutGroupId,
            groupRole: "grocery",
            items: groceryItems,
            itemTotal: groceryItemTotal,
            totalAmount: groceryOrderTotal,
            deliveryCharge: 0,
            multiVendorFee: 0,
            paymentMethod,
            paymentStatus,
            orderStatus,
            distance: groceryDistance,
            distanceSource: groceryDistanceSource,
            routeOrigin: groceryRouteOrigin,
            straightLineKm: groceryStraightLineKm,
            address: cleanAddress,
            whatsappOrder,
            deliveryZone,
            moderator,
            razorpayOrderId,
            deliveryOtp
        });
        await groceryOrder.save();

        // 3. Clear Redis caches
        if (user) {
            await cartCacheService.deleteCachedCart(user.toString());
            await redisService.deletePattern(`order:user_recent:${user.toString()}*`);
        }

        // 4. Record coupon usage
        if (couponCode && couponDoc) {
            try {
                const CouponModel = mongoose.model("Coupon");
                const CouponUsageModel = mongoose.model("CouponUsage");
                await CouponModel.findByIdAndUpdate(couponDoc._id, { $inc: { usedCount: 1 } });
                const newUsage = new CouponUsageModel({
                    user,
                    coupon: couponDoc._id,
                    order: foodOrder._id,
                    discountApplied: discountAmount
                });
                await newUsage.save();
            } catch (cErr: any) {
                console.error("[Coupon] Coupon record error:", cErr.message);
            }
        }

        // 5. Record Payment document once for combined total
        if (paymentMethod === "ONLINE" && razorpayPaymentId) {
            const payment = new Payment({
                order: foodOrder._id,
                user: user,
                amount: totalAmount,
                method: "CARD",
                status: "success",
                transactionId: razorpayPaymentId
            });
            await payment.save();
        }

        // 6. Socket emissions with strict data isolation (Requirement 11)
        if (orderStatus === "placed") {
            try {
                // Restaurant room gets food order ONLY, filtered strictly
                if (restaurant) {
                    emitToRooms(`seller:${restaurant.toString()}`, "new_order", {
                        order: sanitizeOrderForRestaurant(foodOrder),
                        orderType: "food",
                        restaurantId: restaurant.toString()
                    });
                }

                // Grocery room gets grocery order ONLY, filtered strictly
                if (deliveryZone) {
                    emitToRooms(`grocery:${deliveryZone.toString()}`, "new_order", {
                        order: sanitizeOrderForGrocery(groceryOrder),
                        orderType: "grocery",
                        zoneId: deliveryZone.toString()
                    });
                }

                // Customer room gets notification
                if (user) {
                    emitToRooms(`user:${user.toString()}`, "new_order", {
                        order: foodOrder,
                        siblingOrder: groceryOrder,
                        checkoutGroupId,
                        isMixed: true
                    });
                }

                // Admin gets both
                emitToRooms("admin", "new_order", {
                    order: foodOrder,
                    siblingOrder: groceryOrder,
                    checkoutGroupId,
                    isMixed: true
                });
            } catch (emitErr: any) {
                console.error("[Socket] new_order emit error for mixed orders:", emitErr.message);
            }
        }

        return { foodOrder, groceryOrder, checkoutGroupId };
    } catch (saveError: any) {
        // Rollback created orders if any step fails
        if (foodOrder?._id) {
            try { await Order.findByIdAndDelete(foodOrder._id); } catch (_) {}
        }
        if (groceryOrder?._id) {
            try { await Order.findByIdAndDelete(groceryOrder._id); } catch (_) {}
        }
        // Rollback deducted stock
        if (groceryItems && groceryItems.length > 0) {
            try {
                const rollbackOps = groceryItems.map((item: any) => ({
                    updateOne: {
                        filter: { _id: item.groceryItem },
                        update: { $inc: { stockQuantity: item.quantity } }
                    }
                }));
                await GroceryProduct.bulkWrite(rollbackOps);
            } catch (_) {}
        }
        throw saveError;
    }
}

/**
 * Creates the real Order document, executes atomic grocery stock deduction,
 * records coupon usage and payments, invalidates Redis caches, and emits Socket.IO events.
 */
export async function finalizeOrderPlacement(input: FinalizeOrderInput): Promise<IOrder> {
    if (input.isMixed && input.foodItems && input.groceryItems) {
        const result = await finalizeMixedOrderPlacement({
            user: input.user,
            restaurant: input.restaurant,
            foodItems: input.foodItems,
            groceryItems: input.groceryItems,
            foodItemTotal: input.foodItemTotal || 0,
            groceryItemTotal: input.groceryItemTotal || 0,
            totalAmount: input.totalAmount,
            deliveryCharge: input.deliveryCharge,
            multiVendorFee: input.multiVendorFee || 0,
            paymentMethod: input.paymentMethod,
            paymentStatus: input.paymentStatus,
            orderStatus: input.orderStatus,
            foodDistance: input.foodDistance || input.distance,
            foodDistanceSource: input.foodDistanceSource || input.distanceSource,
            foodRouteOrigin: input.foodRouteOrigin || input.routeOrigin,
            foodStraightLineKm: input.foodStraightLineKm || input.straightLineKm,
            groceryDistance: input.groceryDistance || input.distance,
            groceryDistanceSource: input.groceryDistanceSource || input.distanceSource,
            groceryRouteOrigin: input.groceryRouteOrigin || input.routeOrigin,
            groceryStraightLineKm: input.groceryStraightLineKm || input.straightLineKm,
            address: input.address,
            whatsappOrder: input.whatsappOrder,
            deliveryZone: input.deliveryZone,
            moderator: input.moderator,
            couponCode: input.couponCode,
            discountAmount: input.discountAmount,
            razorpayOrderId: input.razorpayOrderId,
            razorpayPaymentId: input.razorpayPaymentId,
            couponDoc: input.couponDoc,
            grandTotalBeforeDiscount: input.grandTotalBeforeDiscount,
            checkoutGroupId: input.checkoutGroupId
        });
        return result.foodOrder;
    }

    const {
        user,
        restaurant,
        orderType,
        items,
        itemTotal,
        totalAmount,
        deliveryCharge,
        paymentMethod,
        paymentStatus = paymentMethod === "ONLINE" ? "paid" : "pending",
        orderStatus = "placed",
        distance,
        distanceSource,
        routeOrigin,
        straightLineKm,
        address,
        whatsappOrder,
        deliveryZone,
        moderator,
        couponCode,
        discountAmount = 0,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        couponDoc,
        grandTotalBeforeDiscount
    } = input;

    // 1. Perform atomic batch stock deduction using bulkWrite for Grocery
    if (orderType === "grocery" && items.length > 0) {
        const bulkOps = items.map((item: any) => ({
            updateOne: {
                filter: { _id: item.groceryItem, stockQuantity: { $gte: item.quantity } },
                update: { $inc: { stockQuantity: -item.quantity } }
            }
        }));
        const bulkResult = await GroceryProduct.bulkWrite(bulkOps, { ordered: true });

        if (bulkResult.modifiedCount !== items.length) {
            // Rollback all successfully deducted items
            const rollbackOps = items.slice(0, bulkResult.modifiedCount).map((item: any) => ({
                updateOne: {
                    filter: { _id: item.groceryItem },
                    update: { $inc: { stockQuantity: item.quantity } }
                }
            }));
            if (rollbackOps.length > 0) {
                await GroceryProduct.bulkWrite(rollbackOps);
            }
            throw new Error("Stock availability badal gayi hai. Kripya apna cart dobara check karein.");
        }
    }

    try {
        const deliveryOtp = paymentMethod === "ONLINE" ? String(Math.floor(1000 + Math.random() * 9000)) : undefined;

        const validatedAddressCoords = parseCoordinates(address?.lat, address?.lng);
        const finalLat = validatedAddressCoords ? validatedAddressCoords.lat : Number(address?.lat);
        const finalLng = validatedAddressCoords ? validatedAddressCoords.lng : Number(address?.lng);

        const newOrder = new Order({
            user,
            restaurant: orderType === "food" ? restaurant : undefined,
            orderType,
            items,
            itemTotal,
            totalAmount,
            deliveryCharge,
            paymentMethod,
            paymentStatus,
            orderStatus,
            distance,
            distanceSource,
            routeOrigin,
            straightLineKm,
            address: {
                ...address,
                lat: finalLat,
                lng: finalLng
            },
            whatsappOrder,
            deliveryZone,
            moderator,
            couponCode,
            discountAmount,
            razorpayOrderId,
            deliveryOtp
        });

        await newOrder.save();

        // Clear user's cached cart and recent orders list from Redis
        if (user) {
            await cartCacheService.deleteCachedCart(user.toString());
            await redisService.deletePattern(`order:user_recent:${user.toString()}*`);
        }

        // Record coupon usage atomically
        if (couponCode && couponDoc) {
            const CouponModel = mongoose.model("Coupon");
            const CouponUsageModel = mongoose.model("CouponUsage");

            const updatedCoupon = await CouponModel.findOneAndUpdate(
                { _id: couponDoc._id, usedCount: { $lt: couponDoc.totalUsageLimit } },
                { $inc: { usedCount: 1 } },
                { new: true }
            );

            if (!updatedCoupon) {
                // Limit was hit concurrently - roll back discount
                newOrder.discountAmount = 0;
                newOrder.totalAmount = grandTotalBeforeDiscount || totalAmount;
                newOrder.couponCode = undefined;
                await newOrder.save();
            } else {
                const userUsageCount = await CouponUsageModel.countDocuments({ user, coupon: couponDoc._id });
                if (userUsageCount >= couponDoc.perUserUsageLimit) {
                    await CouponModel.findByIdAndUpdate(couponDoc._id, { $inc: { usedCount: -1 } });
                    newOrder.discountAmount = 0;
                    newOrder.totalAmount = grandTotalBeforeDiscount || totalAmount;
                    newOrder.couponCode = undefined;
                    await newOrder.save();
                } else {
                    const newUsage = new CouponUsageModel({
                        user,
                        coupon: couponDoc._id,
                        order: newOrder._id,
                        discountApplied: discountAmount
                    });
                    await newUsage.save();
                }
            }
        }

        // Record Payment document if paid online
        if (paymentMethod === "ONLINE" && razorpayPaymentId) {
            const payment = new Payment({
                order: newOrder._id,
                user: user,
                amount: newOrder.totalAmount,
                method: "CARD",
                status: "success",
                transactionId: razorpayPaymentId
            });
            await payment.save();
        }

        // Socket.IO: Notify seller/moderator and customer of new placed order
        if (newOrder.orderStatus === "placed") {
            try {
                const rooms: string[] = ["admin"];
                if (orderType === "food" && restaurant) {
                    rooms.push(`seller:${restaurant.toString()}`);
                    if (deliveryZone) rooms.push(`grocery:${deliveryZone.toString()}`);
                } else if (orderType === "grocery" && deliveryZone) {
                    rooms.push(`grocery:${deliveryZone.toString()}`);
                }
                if (user) {
                    rooms.push(`user:${user.toString()}`);
                }
                emitToRooms(rooms, "new_order", {
                    order: newOrder,
                    orderType,
                    restaurantId: orderType === "food" ? restaurant?.toString() : undefined,
                    zoneId: orderType === "grocery" ? deliveryZone?.toString() : undefined,
                });
            } catch (emitErr: any) {
                console.error("[Socket] new_order emit error:", emitErr.message);
            }
        }

        return newOrder;
    } catch (saveError: any) {
        // Revert deducted stock if order save fails
        if (orderType === "grocery" && items.length > 0) {
            const rollbackOps = items.map((item: any) => ({
                updateOne: {
                    filter: { _id: item.groceryItem },
                    update: { $inc: { stockQuantity: item.quantity } }
                }
            }));
            await GroceryProduct.bulkWrite(rollbackOps);
        }
        throw saveError;
    }
}
