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

export interface OrderValidationInput {
    items: any[];
    orderType?: "food" | "grocery";
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
}

export interface OrderValidationResult {
    success: boolean;
    message?: string;
    verifiedItems?: any[];
    verifiedItemTotal?: number;
    verifiedBill?: any;
    finalTotal?: number;
    verifiedTotal?: number;
    deliveryFee?: number;
    applicableZone?: any;
    calculatedDistance?: number;
    discountAmount?: number;
    couponDoc?: any;
    assignedModerator?: any;
    formattedDeliveryAddress?: any;
}

/**
 * Shared validation and pricing engine for both COD and ONLINE order paths.
 * Validates platform status, hours, inventory, delivery zone, route distance, item prices, min order value, and coupons.
 */
export async function validateAndPriceOrder(input: OrderValidationInput): Promise<OrderValidationResult> {
    const {
        items,
        orderType = "food",
        restaurant,
        address,
        phone,
        couponCode,
        userId
    } = input;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return { success: false, message: "Cart mein kam se kam ek item hona zaroori hai." };
    }

    // 1. Check Platform Settings
    let settings = await redisService.getJson<any>("platform:settings");
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

        // Grocery Operations Check
        if (orderType === "grocery" && settings.groceryStatus !== "open") {
            const groceryMsg = settings.groceryStatus === "disabled"
                ? "Grocery ordering abhi ke liye band hai."
                : "Grocery service abhi band hai.";
            return {
                success: false,
                message: groceryMsg
            };
        }
    }

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

    // 4. Strict Geofence Delivery Zone Validation
    if (!address || address.lat === undefined || address.lng === undefined) {
        return { success: false, message: "Sahi delivery coordinates (lat/lng) zaroori hain." };
    }

    const DeliveryZone = mongoose.model("DeliveryZone");
    const activeZones = await DeliveryZone.find({ isActive: true });
    
    if (activeZones.length === 0) {
        return { success: false, message: "Filhal koi delivery zone uplabdh nahi hai." };
    }

    let applicableZone: any = null;
    for (const zone of activeZones) {
        const dist = calculateDistance(zone.center.lat, zone.center.lng, address.lat, address.lng);
        if (dist <= zone.radiusKm) {
            applicableZone = zone;
            break; 
        }
        if (address.pincode && zone.pincodes && zone.pincodes.includes(address.pincode)) {
            applicableZone = zone;
            break;
        }
    }

    if (!applicableZone) {
        return { 
            success: false, 
            message: "Maaf karein, aapke area mein abhi delivery uplabdh nahi hai." 
        };
    }

    // 5. Dynamic Route-Based Distance Recalculation
    let originLat = applicableZone.center.lat;
    let originLng = applicableZone.center.lng;

    if (orderType === "food" && fetchedRestaurant) {
        if (fetchedRestaurant.location && fetchedRestaurant.location.lat !== undefined && fetchedRestaurant.location.lng !== undefined) {
            originLat = fetchedRestaurant.location.lat;
            originLng = fetchedRestaurant.location.lng;
        }
    }

    const routeMetrics = await getRouteDistanceAndDuration(originLat, originLng, address.lat, address.lng);
    const calculatedDistance = routeMetrics.distanceKm;

    // Strict limit check: route distance cannot exceed max radius * 1.5
    const maxRadius = applicableZone.radiusKm || 15;
    if (calculatedDistance > maxRadius * 1.5) {
        return {
            success: false,
            message: `Maaf karein, aapka road distance (${calculatedDistance}km) hamari delivery limit se bahar hai.`
        };
    }

    // 6. Server-side Price Verification
    let verifiedItemTotal = 0;
    let verifiedItems: any[] = [];
    try {
        const verification = await verifyItemPrices(items, orderType, restaurant);
        verifiedItemTotal = verification.verifiedItemTotal;
        verifiedItems = verification.verifiedItems;
    } catch (verifErr: any) {
        return {
            success: false,
            message: verifErr.message || "Price verification fail ho gaya."
        };
    }

    // 7. Minimum Order Value Enforcement
    const minOrderValue = orderType === "food" ? (settings?.minOrderValueFood || 0) : (settings?.minOrderValueGrocery || 0);
    if (verifiedItemTotal < minOrderValue) {
        return {
            success: false,
            message: `Kam se kam ₹${minOrderValue} ka order hona zaroori hai. Kripya kuch aur items cart mein jodein.`
        };
    }

    // 8. Bill calculation
    const verifiedBill = computeBillFromZone(applicableZone, verifiedItemTotal, calculatedDistance, orderType);

    // Update user phone number if provided
    if (phone && userId) {
        await User.findByIdAndUpdate(userId, { phone });
    }

    // 9. Auto Order Routing to least-busy moderator inside deliveryZone (Grocery)
    let assignedModerator = undefined;
    if (orderType === "grocery") {
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
            orderType === "food" ? restaurant : undefined,
            orderType
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
        discountAmount: calculatedDiscount,
        couponDoc,
        assignedModerator,
        formattedDeliveryAddress
    };
}

export interface FinalizeOrderInput {
    user: any;
    restaurant?: any;
    orderType: "food" | "grocery";
    items: any[];
    itemTotal: number;
    totalAmount: number;
    deliveryCharge: number;
    paymentMethod: "COD" | "ONLINE";
    paymentStatus?: "pending" | "paid" | "failed";
    orderStatus?: any;
    distance: number;
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
}

/**
 * Creates the real Order document, executes atomic grocery stock deduction,
 * records coupon usage and payments, invalidates Redis caches, and emits Socket.IO events.
 */
export async function finalizeOrderPlacement(input: FinalizeOrderInput): Promise<IOrder> {
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
            address,
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
