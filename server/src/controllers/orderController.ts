import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/Order";
import Restaurant from "../models/Restaurant";
import User from "../models/User";
import MenuItem from "../models/MenuItem";
import GroceryProduct from "../models/GroceryProduct";
import DeliveryModel from "../models/Delivery";
import * as redisService from "../services/redisService";
import * as cartCacheService from "../services/cartCacheService";
import * as restaurantCacheService from "../services/restaurantCacheService";
import PlatformSettings from "../models/PlatformSettings";
import { emitToRooms } from "../services/socketService";
import { handleOrderDelivered } from "../utils/orderCompletion";
import { validateAndPriceOrder, finalizeOrderPlacement } from "../utils/orderValidation";

// Create a new order (primarily for COD flow; ONLINE orders are created upon verified payment)
export const createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            restaurant,
            items,
            paymentMethod = "COD",
            address,
            whatsappOrder,
            orderType = "food",
            couponCode,
            phone
        } = req.body;

        const userId = req.user ? req.user._id.toString() : req.body.user;

        const validation = await validateAndPriceOrder({
            items,
            orderType,
            restaurant,
            address,
            phone,
            couponCode,
            userId,
            whatsappOrder
        });

        if (!validation.success) {
            res.status(400).json({ success: false, message: validation.message });
            return;
        }

        const {
            verifiedItems,
            verifiedItemTotal,
            verifiedTotal,
            verifiedBill,
            deliveryFee,
            applicableZone,
            calculatedDistance,
            discountAmount,
            assignedModerator,
            formattedDeliveryAddress,
            couponDoc
        } = validation;

        const newOrder = await finalizeOrderPlacement({
            user: userId,
            restaurant: orderType === "food" ? restaurant : undefined,
            orderType,
            items: verifiedItems!,
            itemTotal: verifiedItemTotal!,
            totalAmount: verifiedTotal!,
            deliveryCharge: deliveryFee!,
            paymentMethod,
            paymentStatus: paymentMethod === "ONLINE" ? "paid" : "pending",
            orderStatus: "placed",
            distance: calculatedDistance!,
            address: {
                fullAddress: address.fullAddress,
                lat: address.lat,
                lng: address.lng,
                locationSource: address.locationSource === "gps" ? "gps" : "manual",
                deliveryAddress: formattedDeliveryAddress
            },
            whatsappOrder: !!whatsappOrder,
            deliveryZone: applicableZone?._id,
            moderator: assignedModerator,
            couponCode,
            discountAmount,
            couponDoc,
            grandTotalBeforeDiscount: verifiedBill?.grandTotal
        });

        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            order: newOrder
        });
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

        if (orderToCheck.orderStatus === orderStatus) {
            res.status(200).json({ success: true, message: "Order is already in this status.", order: orderToCheck });
            return;
        }

        // State-transition validation — prevent invalid jumps (e.g., placed → delivered)
        const VALID_TRANSITIONS: Record<string, string[]> = {
            pending: ["placed", "cancelled"],
            placed: ["accepted", "preparing", "cancelled"], // "preparing" added — grocery moderators accept directly into preparing, restaurants go through "accepted" first
            accepted: ["preparing", "cancelled"],
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
        if (orderStatus === "delivered") {
            updateData.deliveredAt = new Date();
            if (orderToCheck.paymentMethod === "COD") {
                updateData.paymentStatus = "paid";
            }
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

        // Respond immediately — the caller doesn't need to wait for background tasks
        res.status(200).json({
            success: true,
            message: `Order status updated to ${orderStatus}`,
            order
        });

        // Everything from here runs in the background, after the response has already gone out
        (async () => {
            try {
                // Invalidate Redis caches in parallel
                await Promise.all([
                    redisService.del(`order:detail:${orderId}`),
                    redisService.deletePattern(`order:user_recent:${order.user.toString()}:*`),
                ]);

                // Handle cancellations and increment the respective cancellation count
                if (orderStatus === "cancelled") {
                    if (cancelledBy === "customer") {
                        await User.findByIdAndUpdate(order.user, { $inc: { cancellationCount: 1 } });
                    } else if (cancelledBy === "restaurant") {
                        await Restaurant.findByIdAndUpdate(order.restaurant, { $inc: { cancellationCount: 1 } });
                    }
                }

                // Increment total orders count for the restaurant only upon successful delivery
                if (orderStatus === "delivered") {
                    await handleOrderDelivered(order);
                }

                // --- Socket.IO: Notify relevant parties of order status change ---
                const rooms: string[] = [
                    `user:${order.user.toString()}`,
                    "admin",
                ];
                if (order.orderType === "food" && order.restaurant) {
                    rooms.push(`seller:${order.restaurant.toString()}`);
                    if ((order as any).deliveryZone) rooms.push(`grocery:${(order as any).deliveryZone.toString()}`);
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
            } catch (bgError: any) {
                console.error(`[updateOrderStatus background] Failed for order ${orderId}:`, bgError.message);
            }
        })();
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
                {
                    $addFields: {
                        itemValueTotal: {
                            $sum: {
                                $map: {
                                    input: "$items",
                                    as: "item",
                                    in: { $multiply: ["$$item.price", "$$item.quantity"] }
                                }
                            }
                        }
                    }
                },
                { $group: {
                    _id: null,
                    totalItemRevenue: { $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, "$itemValueTotal", 0] } },
                    completedOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] } },
                    preparingOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "preparing"] }, 1, 0] } },
                    cancelledOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } },
                    totalOrders: { $sum: 1 }
                }}
            ]),
            Order.aggregate([
                { $match: { restaurant: restaurant._id, createdAt: { $gte: today } } },
                {
                    $addFields: {
                        itemValueTotal: {
                            $sum: { $map: { input: "$items", as: "item", in: { $multiply: ["$$item.price", "$$item.quantity"] } } }
                        }
                    }
                },
                { $group: {
                    _id: null,
                    todayItemRevenue: { $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, "$itemValueTotal", 0] } },
                    todayOrdersCount: { $sum: 1 }
                }}
            ])
        ]);

        const o = overall[0] || { totalItemRevenue: 0, completedOrders: 0, preparingOrders: 0, cancelledOrders: 0, totalOrders: 0 };
        const t = todayStats[0] || { todayItemRevenue: 0, todayOrdersCount: 0 };

        res.status(200).json({
            success: true,
            totalRevenue: o.totalItemRevenue, // now: pure item value, not the customer's full bill
            completedOrdersCount: o.completedOrders,
            preparingOrdersCount: o.preparingOrders,
            cancelledOrdersCount: o.cancelledOrders,
            totalOrdersCount: o.totalOrders,
            averageOrderValue: o.completedOrders > 0 ? Math.round(o.totalItemRevenue / o.completedOrders) : 0,
            todayRevenue: t.todayItemRevenue,
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
                if ((order as any).deliveryZone) rooms.push(`grocery:${(order as any).deliveryZone.toString()}`);
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

// Get pending food orders (waiting on restaurant confirmation) for grocery moderators & admins
export const getPendingFoodOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        let query: any = { orderType: "food", orderStatus: "placed" };
        if (req.user?.role === "grocery_moderator") {
            const currentUser = await User.findById(req.user._id);
            query.deliveryZone = { $in: currentUser?.assignedZones || [] };
        }
        const orders = await Order.find(query)
            .populate("restaurant", "name phone")
            .populate("items.menuItem", "name")
            .populate("deliveryZone", "name")
            .sort({ createdAt: 1 }) // oldest first — the ones waiting longest surface at the top
            .lean();

        const normalizedOrders = orders.map((o: any) => ({
            ...o,
            items: o.items.map((item: any) => ({ ...item, name: item.menuItem?.name || "Item" }))
        }));

        res.status(200).json({ success: true, count: normalizedOrders.length, orders: normalizedOrders });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};


