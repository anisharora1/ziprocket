import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/Order";
import Restaurant from "../models/Restaurant";
import User from "../models/User";
import MenuItem from "../models/MenuItem";
import GroceryProduct from "../models/GroceryProduct";
import DeliveryModel from "../models/Delivery";
import { getRouteDistanceAndDuration } from "../utils/googleMaps";
import { validateCoupon } from "./couponController";
import * as redisService from "../services/redisService";
import * as cartCacheService from "../services/cartCacheService";
import * as restaurantCacheService from "../services/restaurantCacheService";
import PlatformSettings from "../models/PlatformSettings";
import { calculateDistance } from "../services/distanceService";
import { emitToRooms } from "../services/socketService";
import { computeBillFromZone } from "../utils/billCalculator";

// Create a new order
export const createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            restaurant,
            items,
            totalAmount,
            deliveryCharge,
            paymentMethod,
            distance,
            address,
            whatsappOrder,
            orderType = "food",
            couponCode
        } = req.body;

        // Check Platform Settings (cached in Redis for 60s to avoid repeated DB hits)
        let settings = await redisService.getJson<any>("platform:settings");
        if (!settings) {
            settings = await PlatformSettings.findOne().lean();
            if (settings) {
                await redisService.setJson("platform:settings", settings, 60);
            }
        }
        if (settings) {
            // 1. Maintenance Mode Check
            if (settings.maintenanceMode) {
                res.status(400).json({
                    success: false,
                    message: "We are currently performing maintenance. Please check back soon."
                });
                return;
            }

            // 2. Global Platform Status Check
            if (!settings.isPlatformOpen) {
                res.status(400).json({
                    success: false,
                    message: "Ordering is currently unavailable. Please try again later."
                });
                return;
            }

            // 3. Operating Hours Check (Asia/Kolkata timezone)
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

                res.status(400).json({
                    success: false,
                    message: `Orders are closed for today. We will reopen at ${formattedOpenTime}.`
                });
                return;
            }

            // 4. Grocery Operations Check
            if (orderType === "grocery" && settings.groceryStatus !== "open") {
                const groceryMsg = settings.groceryStatus === "disabled"
                    ? "Grocery ordering is temporarily disabled."
                    : "Grocery operations are currently closed.";
                res.status(400).json({
                    success: false,
                    message: groceryMsg
                });
                return;
            }
        }

        // 5. Restaurant Availability Check (Food only)
        let fetchedRestaurant: any = null;
        if (orderType === "food" && restaurant) {
            fetchedRestaurant = await Restaurant.findById(restaurant);
            if (!fetchedRestaurant || fetchedRestaurant.availabilityStatus !== "open") {
                const restMsg = fetchedRestaurant && fetchedRestaurant.availabilityStatus === "disabled"
                    ? "This restaurant is temporarily disabled."
                    : "This restaurant is currently closed.";
                res.status(400).json({
                    success: false,
                    message: restMsg
                });
                return;
            }
        }

        // Securely override user from authenticated request session
        const user = req.user ? req.user._id : req.body.user;

        // Inventory Stock Validations for Grocery (Batch Query)
        let productMap: Map<string, any> = new Map();
        if (orderType === "grocery") {
            const groceryItemIds = items.map((i: any) => i.groceryItem);
            const products = await GroceryProduct.find({ _id: { $in: groceryItemIds } });
            productMap = new Map(products.map(p => [p._id.toString(), p]));

            for (const item of items) {
                const product = productMap.get(item.groceryItem?.toString());
                if (!product) {
                    res.status(404).json({ success: false, message: "Grocery product not found" });
                    return;
                }
                if (product.stockQuantity < item.quantity) {
                    res.status(400).json({
                        success: false,
                        message: `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`
                    });
                    return;
                }
            }
        }

        // 1. Strict Geofence Delivery Zone Validation (API Level Protection)
        if (!address || address.lat === undefined || address.lng === undefined) {
            res.status(400).json({ success: false, message: "Valid delivery coordinates (lat/lng) are required." });
            return;
        }

        const DeliveryZone = mongoose.model("DeliveryZone");
        const activeZones = await DeliveryZone.find({ isActive: true });
        
        if (activeZones.length === 0) {
            res.status(400).json({ success: false, message: "No active delivery zones available right now." });
            return;
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
            res.status(400).json({ 
                success: false, 
                message: "Sorry, delivery is currently unavailable in your area." 
            });
            return;
        }

        const deliveryZone = applicableZone._id;

        // 2. Dynamic Route-Based Distance Recalculation using Google Distance Matrix
        let calculatedDistance = distance || 2.5;
        let originLat = applicableZone.center.lat;
        let originLng = applicableZone.center.lng;

        if (orderType === "food" && fetchedRestaurant) {
            if (fetchedRestaurant.location && fetchedRestaurant.location.lat !== undefined && fetchedRestaurant.location.lng !== undefined) {
                originLat = fetchedRestaurant.location.lat;
                originLng = fetchedRestaurant.location.lng;
            }
        }

        const routeMetrics = await getRouteDistanceAndDuration(originLat, originLng, address.lat, address.lng);
        calculatedDistance = routeMetrics.distanceKm;

        // Strict limit check: route distance cannot exceed max radius * 1.5 (detour factor)
        const maxRadius = applicableZone.radiusKm || 15;
        if (calculatedDistance > maxRadius * 1.5) {
            res.status(400).json({
                success: false,
                message: `Sorry, your resolved road distance of ${calculatedDistance}km exceeds our delivery limits.`
            });
            return;
        }

        // ── SERVER-SIDE PRICE VERIFICATION ──────────────────────────────
        // Re-fetch real prices for every item — never trust client-submitted item.price
        let verifiedItemTotal = 0;
        const verifiedItems: any[] = [];
        for (const item of items) {
            let product: any;
            if (orderType === "food") {
                product = await MenuItem.findById(item.menuItem);
                if (product && product.restaurant?.toString() !== restaurant?.toString()) {
                    res.status(400).json({
                        success: false,
                        message: `"${product.name}" doesn't belong to this restaurant. Please clear your cart and try again.`
                    });
                    return;
                }
            } else {
                product = productMap.get(item.groceryItem?.toString()); // already fetched above for stock check
            }
            if (!product) {
                res.status(404).json({ success: false, message: "One or more items in your cart are no longer available." });
                return;
            }
            const realPrice = (product.discountedPrice !== undefined && Number(product.discountedPrice) > 0) ? product.discountedPrice : product.price;
            verifiedItemTotal += realPrice * item.quantity;
            verifiedItems.push({ ...item, price: realPrice }); // overwrite client-submitted price
        }

        // Reuse the shared bill calculation logic (single source of truth with checkout preview)
        const verifiedBill = computeBillFromZone(applicableZone, verifiedItemTotal, calculatedDistance, orderType);

        // Update user phone number if updated during checkout review
        const { phone } = req.body;
        if (phone && user) {
            await User.findByIdAndUpdate(user, { phone });
        }

        // Auto Order Routing to least-busy moderator inside deliveryZone (Single Aggregation Query)
        let assignedModerator = undefined;
        if (orderType === "grocery") {
            const moderators = await User.find({
                role: "grocery_moderator",
                assignedZones: deliveryZone,
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

        // Secure Coupon Validation on placement (using server-verified subtotal, not client-submitted)
        let calculatedDiscount = 0;
        let couponDoc = null;

        if (couponCode) {
            const validation = await validateCoupon(
                couponCode,
                user,
                verifiedItemTotal, // server-verified item subtotal
                deliveryZone.toString(),
                orderType === "food" ? restaurant : undefined,
                orderType
            );

            if (!validation.success) {
                res.status(400).json({ success: false, message: `Coupon validation failed: ${validation.message}` });
                return;
            }
            
            calculatedDiscount = validation.discountAmount;
            couponDoc = validation.coupon;
        }

        // Final server-verified total (bill grand total minus any applicable coupon discount)
        const finalTotal = Math.max(0, verifiedBill.grandTotal - calculatedDiscount);

        // Perform atomic batch stock deduction using bulkWrite (single DB round trip)
        if (orderType === "grocery") {
            const bulkOps = items.map((item: any) => ({
                updateOne: {
                    filter: { _id: item.groceryItem, stockQuantity: { $gte: item.quantity } },
                    update: { $inc: { stockQuantity: -item.quantity } }
                }
            }));
            const bulkResult = await GroceryProduct.bulkWrite(bulkOps, { ordered: true });

            if (bulkResult.modifiedCount !== items.length) {
                // Some items failed the stock guard — rollback all successfully deducted items
                const rollbackOps = items.slice(0, bulkResult.modifiedCount).map((item: any) => ({
                    updateOne: {
                        filter: { _id: item.groceryItem },
                        update: { $inc: { stockQuantity: item.quantity } }
                    }
                }));
                if (rollbackOps.length > 0) {
                    await GroceryProduct.bulkWrite(rollbackOps);
                }
                res.status(400).json({
                    success: false,
                    message: "Stock availability changed while processing order. Please review your cart."
                });
                return;
            }
        }

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

        try {
            const deliveryOtp = paymentMethod === "ONLINE" ? String(Math.floor(1000 + Math.random() * 9000)) : undefined;

            const newOrder = new Order({
                user,
                restaurant: orderType === "food" ? restaurant : undefined,
                orderType,
                items: verifiedItems, // server-verified prices, not client-submitted
                totalAmount: finalTotal, // server-computed total
                deliveryCharge: verifiedBill.deliveryFee, // server-computed delivery fee
                paymentMethod,
                orderStatus: "pending", // true initial state — transitions to "placed" after verification
                distance: calculatedDistance,
                address: {
                    fullAddress: address.fullAddress,
                    lat: address.lat,
                    lng: address.lng,
                    deliveryAddress: formattedDeliveryAddress
                },
                whatsappOrder,
                deliveryZone,
                moderator: assignedModerator,
                couponCode,
                discountAmount: calculatedDiscount,
                deliveryOtp
            });

            await newOrder.save();

            // For COD orders, immediately transition to "placed" — no payment to wait for.
            // For ONLINE orders, stay "pending" until verifyRazorpayPayment confirms payment.
            if (paymentMethod === "COD") {
                newOrder.orderStatus = "placed";
                await newOrder.save();
            }

            // Clear user's cached cart and recent orders list from Redis
            if (user) {
                await cartCacheService.deleteCachedCart(user.toString());
                // Delete ALL paginated variants of the user's orders cache.
                // Previously used del('order:user_recent:userId') which never matched
                // the actual keys stored as 'order:user_recent:userId:p1:l20' etc.
                await redisService.deletePattern(`order:user_recent:${user.toString()}*`);
            }

            // Increment total orders count for the restaurant (Food only)
            if (orderType === "food" && restaurant) {
                await Restaurant.findByIdAndUpdate(restaurant, { $inc: { totalOrders: 1 } });
            }

            // Record coupon usage if successfully placed
            if (couponDoc) {
                const CouponModel = mongoose.model("Coupon");
                const CouponUsageModel = mongoose.model("CouponUsage");

                // Atomically increment usedCount ONLY if still under the limit — this is the actual enforcement point, not the earlier validateCoupon check.
                const updatedCoupon = await CouponModel.findOneAndUpdate(
                    { _id: couponDoc._id, usedCount: { $lt: couponDoc.totalUsageLimit } },
                    { $inc: { usedCount: 1 } },
                    { new: true }
                );

                if (!updatedCoupon) {
                    // Limit was hit by a concurrent request between validation and this point — roll back the discount, don't fail the whole order.
                    newOrder.discountAmount = 0;
                    newOrder.totalAmount = verifiedBill.grandTotal; // full server-verified amount, no discount
                    newOrder.couponCode = undefined;
                    await newOrder.save();
                } else {
                    // Re-check per-user limit atomically too, in case of a concurrent double-submit from the same user.
                    const userUsageCount = await CouponUsageModel.countDocuments({ user, coupon: couponDoc._id });
                    if (userUsageCount >= couponDoc.perUserUsageLimit) {
                        // Roll back both the order discount AND the usedCount increment we just made.
                        await CouponModel.findByIdAndUpdate(couponDoc._id, { $inc: { usedCount: -1 } });
                        newOrder.discountAmount = 0;
                        newOrder.totalAmount = verifiedBill.grandTotal;
                        newOrder.couponCode = undefined;
                        await newOrder.save();
                    } else {
                        const newUsage = new CouponUsageModel({ user, coupon: couponDoc._id, order: newOrder._id, discountApplied: calculatedDiscount });
                        await newUsage.save();
                    }
                }
            }

            // --- Socket.IO: Notify seller/grocery moderator of new order ---
            // Only emit new_order notifications once the order has transitioned to "placed".
            // For ONLINE orders still in "pending", the notification fires from verifyRazorpayPayment instead.
            if (newOrder.orderStatus === "placed") {
                try {
                    const rooms: string[] = ["admin"];
                    if (orderType === "food" && restaurant) {
                        rooms.push(`seller:${restaurant}`);
                    } else if (orderType === "grocery" && deliveryZone) {
                        rooms.push(`grocery:${deliveryZone.toString()}`);
                    }
                    // Also notify the customer so their orders list refreshes via socket
                    if (user) {
                        rooms.push(`user:${user.toString()}`);
                    }
                    emitToRooms(rooms, "new_order", {
                        order: newOrder,
                        orderType,
                        restaurantId: orderType === "food" ? restaurant : undefined,
                        zoneId: orderType === "grocery" ? deliveryZone?.toString() : undefined,
                    });
                } catch (emitErr: any) {
                    console.error("[Socket] new_order emit error:", emitErr.message);
                }
            }

            res.status(201).json({
                success: true,
                message: newOrder.orderStatus === "pending" ? "Order submitted — awaiting payment" : "Order placed successfully",
                order: newOrder
            });
        } catch (saveError: any) {
            // Revert deducted stock if order save fails (batch rollback)
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
    } catch (error: any) {
        console.error("Order creation failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get a single order by ID
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
    try {
        const orderId = req.params.id;
        const cacheKey = `order:detail:${orderId}`;

        let order = await redisService.getJson<any>(cacheKey);
        
        if (!order) {
            order = await Order.findById(orderId)
                .populate("user", "name email phone")
                .populate("restaurant", "name phone location")
                .populate("items.menuItem", "name price images")
                .populate("items.groceryItem", "name price images unit weightSize brand")
                .lean();

            if (!order) {
                res.status(404).json({ success: false, message: "Order not found" });
                return;
            }

            // Cache duration: 10 mins for active/mutable orders, 1 hour for terminal states
            const isTerminal = ["delivered", "cancelled"].includes(order.orderStatus);
            const ttl = isTerminal ? 3600 : 600;
            await redisService.setJson(cacheKey, order, ttl);
        }

        // --- SECURE OWNERSHIP CHECK (parallelized) ---
        if (req.user?.role !== "admin") {
            const userId = req.user?._id?.toString();
            const isCustomer = userId === (order.user?._id || order.user)?.toString();

            if (!isCustomer) {
                const restId = order.restaurant ? (order.restaurant._id || order.restaurant)?.toString() : null;
                const DeliveryModel = mongoose.model("Delivery");

                // Run all ownership checks in parallel (only the relevant ones)
                const [restaurant, activeDelivery, modUser] = await Promise.all([
                    restId ? Restaurant.findById(restId).select("owner").lean() : null,
                    DeliveryModel.findOne({ order: order._id, deliveryBoy: req.user?._id }).select("_id").lean(),
                    (order.orderType === "grocery" && req.user?.role === "grocery_moderator")
                        ? User.findById(userId).select("assignedZones").lean()
                        : null
                ]);

                const isSeller = restaurant && restaurant.owner?.toString() === userId;
                const isDelivery = !!activeDelivery;
                const zoneId = (order.deliveryZone?._id || order.deliveryZone)?.toString();
                const isGroceryModerator = modUser?.assignedZones?.map((z: any) => z.toString()).includes(zoneId);

                if (!isSeller && !isDelivery && !isGroceryModerator) {
                    console.warn(`[SECURITY WARNING] Unauthorized order details access attempt. User: ${userId}, Order: ${order._id}, IP: ${req.ip}`);
                    res.status(403).json({ success: false, message: "Unauthorized to view this order" });
                    return;
                }
            }
        }

        // Redact delivery OTP from all roles except admin and the customer who placed the order
        const userId = req.user?._id?.toString();
        if (req.user?.role !== "admin" && userId !== (order.user?._id || order.user)?.toString()) {
            delete order.deliveryOtp;
        }

        res.status(200).json({
            success: true,
            order
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all orders for a specific user (Customer App)
export const getUserOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.params.userId;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;
        const cacheKey = `order:user_recent:${userId}:p${page}:l${limit}`;

        const cachedUserOrders = await redisService.getJson<any>(cacheKey);
        if (cachedUserOrders) {
            res.status(200).json(cachedUserOrders);
            return;
        }

        const filter = { user: userId };
        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate("restaurant", "name image")
                .populate("items.menuItem", "name")
                .populate("items.groceryItem", "name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(filter)
        ]);

        const responseData = {
            success: true,
            count: orders.length,
            meta: { total, page, pages: Math.ceil(total / limit), limit },
            orders
        };

        // Cache page for 10 minutes
        await redisService.setJson(cacheKey, responseData, 600);

        res.status(200).json(responseData);
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all orders for a specific restaurant (Restaurant Dashboard)
export const getRestaurantOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurantId = req.params.restaurantId;
        
        // Secure Ownership Check
        if (req.user?.role !== "admin") {
            const restaurant = await Restaurant.findById(restaurantId);
            if (!restaurant || restaurant.owner?.toString() !== req.user?._id?.toString()) {
                console.warn(`[SECURITY WARNING] Unauthorized restaurant orders access attempt. User: ${req.user?._id}, Restaurant: ${restaurantId}`);
                res.status(403).json({ success: false, message: "Unauthorized to view these orders" });
                return;
            }
        }

        const { orderStatus } = req.query;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        let filter: any = { restaurant: restaurantId };
        
        // Optional filtering by order status
        if (orderStatus) {
            filter.orderStatus = orderStatus;
        } else {
            // By default, exclude unverified "pending" orders — restaurants should only see confirmed orders
            filter.orderStatus = { $ne: "pending" };
        }

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate("user", "name phone")
                .populate("items.menuItem", "name price")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: orders.length,
            meta: { total, page, pages: Math.ceil(total / limit), limit },
            orders
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Order Status (e.g., placed -> accepted -> preparing -> on_the_way -> delivered or cancelled)
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderStatus, cancelledBy } = req.body;
        const orderId = req.params.id;

        const validStatuses = ["pending", "placed", "accepted", "preparing", "on_the_way", "delivered", "cancelled"];
        if (!validStatuses.includes(orderStatus)) {
            res.status(400).json({ success: false, message: "Invalid order status" });
            return;
        }

        const orderToCheck = await Order.findById(orderId);
        if (!orderToCheck) {
            res.status(404).json({ success: false, message: "Order not found" });
            return;
        }

        // State-transition validation — prevent invalid jumps (e.g., placed → delivered)
        const VALID_TRANSITIONS: Record<string, string[]> = {
            pending:   ["placed", "cancelled"],
            placed:    ["accepted", "cancelled"],
            accepted:  ["preparing", "cancelled"],
            preparing: ["on_the_way", "cancelled"],
            accepted_by_delivery: ["on_the_way", "cancelled"],
            on_the_way: ["delivered"],
            delivered: [],
            cancelled: [],
        };
        if (!VALID_TRANSITIONS[orderToCheck.orderStatus]?.includes(orderStatus)) {
            res.status(400).json({ success: false, message: `Cannot move an order from "${orderToCheck.orderStatus}" directly to "${orderStatus}".` });
            return;
        }

        if (req.user?.role !== "admin") {
            if (orderToCheck.orderType === "grocery") {
                if (req.user?.role !== "grocery_moderator") {
                    res.status(403).json({ success: false, message: "Unauthorized to modify this grocery order" });
                    return;
                }
            } else {
                const restaurant = await Restaurant.findById(orderToCheck.restaurant);
                if (!restaurant || restaurant.owner?.toString() !== req.user?._id?.toString()) {
                    res.status(403).json({ success: false, message: "Unauthorized to modify this order" });
                    return;
                }
            }
        }

        const updateData: any = { orderStatus };
        if (orderStatus === "delivered" && orderToCheck.paymentMethod === "COD") {
            updateData.paymentStatus = "paid";
        }

        const order = await Order.findByIdAndUpdate(
            orderId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!order) {
            res.status(404).json({ success: false, message: "Order not found" });
            return;
        }

        // Invalidate Redis caches for this order and user orders list
        await redisService.del(`order:detail:${orderId}`);
        // Use pattern delete to clear ALL paginated variants (e.g. :p1:l20, :p2:l20, etc.)
        await redisService.deletePattern(`order:user_recent:${order.user.toString()}:*`);

        // Handle cancellations and increment the respective cancellation count
        if (orderStatus === "cancelled") {
            if (cancelledBy === "customer") {
                await User.findByIdAndUpdate(order.user, { $inc: { cancellationCount: 1 } });
            } else if (cancelledBy === "restaurant") {
                await Restaurant.findByIdAndUpdate(order.restaurant, { $inc: { cancellationCount: 1 } });
            }
        }

        // --- Socket.IO: Notify relevant parties of order status change ---
        try {
            const rooms: string[] = [
                `user:${order.user.toString()}`,
                "admin",
            ];
            if (order.orderType === "food" && order.restaurant) {
                rooms.push(`seller:${order.restaurant.toString()}`);
            } else if (order.orderType === "grocery" && (order as any).deliveryZone) {
                rooms.push(`grocery:${(order as any).deliveryZone.toString()}`);
            }
            // Notify the assigned delivery boy if one has claimed this order
            const activeDelivery = await DeliveryModel.findOne({ order: orderId }).select("deliveryBoy").lean();
            if (activeDelivery?.deliveryBoy) {
                rooms.push(`delivery:${activeDelivery.deliveryBoy.toString()}`);
            }
            emitToRooms(rooms, "order_status_updated", {
                orderId: order._id.toString(),
                orderStatus,
                orderType: order.orderType,
                restaurantId: order.restaurant?.toString(),
                zoneId: (order as any).deliveryZone?.toString(),
                userId: order.user.toString(),
            });
        } catch (emitErr: any) {
            console.error("[Socket] order_status_updated emit error:", emitErr.message);
        }

        res.status(200).json({
            success: true,
            message: `Order status updated to ${orderStatus}`,
            order
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Payment Status (e.g., after successful online payment gateway webhook)
export const updatePaymentStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { paymentStatus } = req.body;
        const orderId = req.params.id;

        const validStatuses = ["pending", "paid", "failed"];
        if (!validStatuses.includes(paymentStatus)) {
            res.status(400).json({ success: false, message: "Invalid payment status" });
            return;
        }

        const order = await Order.findByIdAndUpdate(
            orderId,
            { paymentStatus },
            { new: true, runValidators: true }
        );

        if (!order) {
            res.status(404).json({ success: false, message: "Order not found" });
            return;
        }

        // Invalidate Redis caches
        await redisService.del(`order:detail:${orderId}`);
        await redisService.deletePattern(`order:user_recent:${order.user.toString()}:*`);

        // --- Socket.IO: Notify customer of payment status change ---
        try {
            emitToRooms([`user:${order.user.toString()}`, "admin"], "payment_status_updated", {
                orderId: order._id.toString(),
                paymentStatus,
                userId: order.user.toString(),
            });
        } catch (emitErr: any) {
            console.error("[Socket] payment_status_updated emit error:", emitErr.message);
        }

        res.status(200).json({
            success: true,
            message: `Payment status updated to ${paymentStatus}`,
            order
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all orders (Admin Dashboard)
export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderStatus, paymentStatus, whatsappOrder } = req.query;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        let filter: any = {};

        if (orderStatus) filter.orderStatus = orderStatus;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (whatsappOrder !== undefined) filter.whatsappOrder = whatsappOrder === 'true';

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate("user", "name phone email")
                .populate("restaurant", "name")
                .populate("items.menuItem", "name")
                .populate("items.groceryItem", "name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Order.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: orders.length,
            meta: { total, page, pages: Math.ceil(total / limit), limit },
            orders
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get orders for the authenticated seller's restaurant
export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user?._id });
        if (!restaurant) {
            res.status(404).json({ success: false, message: "No restaurant found for this seller" });
            return;
        }

        const { orderStatus } = req.query;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        let filter: any = { restaurant: restaurant._id };
        
        if (orderStatus) {
            filter.orderStatus = orderStatus;
        } else {
            // By default, exclude unverified "pending" orders — sellers should only see confirmed orders
            filter.orderStatus = { $ne: "pending" };
        }

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate("user", "name phone")
                .populate("items.menuItem", "name price")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: orders.length,
            meta: { total, page, pages: Math.ceil(total / limit), limit },
            orders
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get aggregated dashboard & finance stats for the authenticated seller's restaurant
export const getSellerDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user?._id });
        if (!restaurant) {
            res.status(404).json({ success: false, message: "No restaurant found for this seller" });
            return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [overall, todayStats] = await Promise.all([
            Order.aggregate([
                { $match: { restaurant: restaurant._id } },
                { $group: {
                    _id: null,
                    totalRevenue: { $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, "$totalAmount", 0] } },
                    completedOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] } },
                    preparingOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "preparing"] }, 1, 0] } },
                    cancelledOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } },
                    totalOrders: { $sum: 1 }
                }}
            ]),
            Order.aggregate([
                { $match: { restaurant: restaurant._id, createdAt: { $gte: today } } },
                { $group: {
                    _id: null,
                    todayRevenue: { $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, "$totalAmount", 0] } },
                    todayOrdersCount: { $sum: 1 }
                }}
            ])
        ]);

        const o = overall[0] || { totalRevenue: 0, completedOrders: 0, preparingOrders: 0, cancelledOrders: 0, totalOrders: 0 };
        const t = todayStats[0] || { todayRevenue: 0, todayOrdersCount: 0 };

        res.status(200).json({
            success: true,
            totalRevenue: o.totalRevenue,
            completedOrdersCount: o.completedOrders,
            preparingOrdersCount: o.preparingOrders,
            cancelledOrdersCount: o.cancelledOrders,
            totalOrdersCount: o.totalOrders,
            averageOrderValue: o.completedOrders > 0 ? Math.round(o.totalRevenue / o.completedOrders) : 0,
            todayRevenue: t.todayRevenue,
            todayOrdersCount: t.todayOrdersCount,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all grocery orders (Grocery Moderator Dashboard)
export const getGroceryOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        let query: any = { orderType: "grocery" };

        // Restrict to assigned zones if the requester is a grocery moderator (not admin)
        if (req.user && req.user.role === "grocery_moderator") {
            const currentUser = await User.findById(req.user._id);
            const zones = currentUser?.assignedZones || [];
            query.deliveryZone = { $in: zones };
        }

        const tab = req.query.tab as string;
        if (tab === "active") {
            query.orderStatus = { $in: ["placed", "accepted", "preparing", "accepted_by_delivery", "on_the_way"] };
        } else if (tab === "completed") {
            query.orderStatus = { $in: ["delivered", "cancelled"] };
        }

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate("user", "name phone email")
                .populate("items.groceryItem", "name price images brand unit weightSize")
                .populate("deliveryZone", "name center radiusKm pincodes")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Order.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            count: orders.length,
            meta: { total, page, pages: Math.ceil(total / limit), limit },
            orders
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cancel an order (User Order Cancellation System)
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const order = await Order.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: "Order not found" });
            return;
        }

        const isOwner = order.user.toString() === req.user?._id?.toString();
        const isAdmin = req.user?.role === "admin";
        if (!isOwner && !isAdmin) {
            res.status(403).json({ success: false, message: "Not authorized to cancel this order" });
            return;
        }

        if (!isAdmin) {
            if (!["pending", "placed"].includes(order.orderStatus)) {
                res.status(400).json({
                    success: false,
                    message: "Order cannot be cancelled. The restaurant has already accepted or started preparing it."
                });
                return;
            }
            if (order.paymentMethod === "ONLINE") {
                res.status(400).json({
                    success: false,
                    message: "Paid online orders cannot be cancelled."
                });
                return;
            }
        } else {
            if (["delivered", "cancelled"].includes(order.orderStatus)) {
                res.status(400).json({
                    success: false,
                    message: "This order is already delivered or cancelled."
                });
                return;
            }
        }

        // Restore grocery stock if this is a grocery order
        if (order.orderType === "grocery" && order.items) {
            for (const item of order.items) {
                if (item.groceryItem) {
                    await GroceryProduct.findByIdAndUpdate(item.groceryItem, {
                        $inc: { stockQuantity: item.quantity }
                    });
                }
            }
        }

        // Set order cancellation details
        order.orderStatus = "cancelled";
        order.cancellationReason = reason || "Cancelled by user";
        order.cancelledAt = new Date();

        await order.save();

        // Invalidate Redis caches
        await redisService.del(`order:detail:${id}`);
        await redisService.deletePattern(`order:user_recent:${order.user.toString()}:*`);

        // --- Socket.IO: Notify seller/grocery moderator + delivery boys of cancellation ---
        try {
            const rooms: string[] = [
                `user:${order.user.toString()}`,
                "admin",
            ];
            if (order.orderType === "food" && order.restaurant) {
                rooms.push(`seller:${order.restaurant.toString()}`);
            } else if (order.orderType === "grocery" && (order as any).deliveryZone) {
                rooms.push(`grocery:${(order as any).deliveryZone.toString()}`);
            }
            if ((order as any).deliveryZone) {
                rooms.push(`delivery_zone:${(order as any).deliveryZone.toString()}`);
            }
            emitToRooms(rooms, "order_cancelled", {
                orderId: id,
                reason: order.cancellationReason,
                orderType: order.orderType,
                restaurantId: order.restaurant?.toString(),
                zoneId: (order as any).deliveryZone?.toString(),
                userId: order.user.toString(),
            });
        } catch (emitErr: any) {
            console.error("[Socket] order_cancelled emit error:", emitErr.message);
        }

        res.status(200).json({
            success: true,
            message: "Order cancelled successfully",
            order
        });
    } catch (error: any) {
        console.error("Order cancellation failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get distinct users who have placed grocery orders in the moderator's assigned zones
export const getGroceryZoneUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        let query: any = { orderType: "grocery" };

        if (req.user && req.user.role === "grocery_moderator") {
            const currentUser = await User.findById(req.user._id);
            const zones = currentUser?.assignedZones || [];
            query.deliveryZone = { $in: zones };
        } else if (req.user && req.user.role !== "admin") {
            res.status(403).json({ success: false, message: "Unauthorized to access this route" });
            return;
        }

        // Get distinct user IDs from the matching orders
        const distinctUserIds = await Order.distinct("user", query);

        // Fetch those users
        const users = await User.find({ _id: { $in: distinctUserIds } })
            .select("name phone createdAt addresses")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Rate a completed food order
export const rateOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { rating } = req.body;
        const userId = req.user?._id;

        if (!rating || Number(rating) < 1 || Number(rating) > 5) {
            res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
            return;
        }

        const order = await Order.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: "Order not found." });
            return;
        }
        if (order.user.toString() !== userId?.toString()) {
            res.status(403).json({ success: false, message: "Not authorized to rate this order." });
            return;
        }
        if (order.orderStatus !== "delivered") {
            res.status(400).json({ success: false, message: "Only delivered orders can be rated." });
            return;
        }
        if (order.orderType !== "food" || !order.restaurant) {
            res.status(400).json({ success: false, message: "Only restaurant orders can be rated." });
            return;
        }
        if (order.rating) {
            res.status(400).json({ success: false, message: "You've already rated this order." });
            return;
        }

        order.rating = Number(rating);
        await order.save();

        // Recompute the restaurant's live average rating
        const agg = await Order.aggregate([
            { $match: { restaurant: order.restaurant, rating: { $exists: true } } },
            { $group: { _id: null, avgRating: { $avg: "$rating" } } }
        ]);
        const newAvg = agg[0]?.avgRating || 0;
        await Restaurant.findByIdAndUpdate(order.restaurant, { rating: Math.round(newAvg * 10) / 10 });
        await restaurantCacheService.invalidateRestaurantCache(order.restaurant.toString());

        res.status(200).json({ success: true, message: "Thanks for rating your order!", rating: order.rating });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

