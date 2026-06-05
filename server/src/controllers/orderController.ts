import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/Order";
import Restaurant from "../models/Restaurant";
import User from "../models/User";
import MenuItem from "../models/MenuItem";
import GroceryProduct from "../models/GroceryProduct";
import { getRouteDistanceAndDuration } from "../utils/googleMaps";
import { validateCoupon } from "./couponController";

// Helper function to calculate distance using Haversine
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Create a new order
export const createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            user, // Usually extracted from auth middleware: req.user._id
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

        // Inventory Stock Validations and Deductions for Grocery
        if (orderType === "grocery") {
            for (const item of items) {
                const product = await GroceryProduct.findById(item.groceryItem);
                if (!product) {
                    res.status(404).json({ success: false, message: `Grocery product not found` });
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

            // Deduct stock levels
            for (const item of items) {
                await GroceryProduct.findByIdAndUpdate(item.groceryItem, {
                    $inc: { stockQuantity: -item.quantity }
                });
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

        let applicableZone = null;
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

        if (orderType === "food" && restaurant) {
            const rest = await Restaurant.findById(restaurant);
            if (rest && rest.location && rest.location.lat !== undefined && rest.location.lng !== undefined) {
                originLat = rest.location.lat;
                originLng = rest.location.lng;
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

        // Update user phone number if updated during checkout review
        const { phone } = req.body;
        if (phone && user) {
            await User.findByIdAndUpdate(user, { phone });
        }

        // Auto Order Routing to least-busy moderator inside deliveryZone
        let assignedModerator = undefined;
        if (orderType === "grocery") {
            const moderators = await User.find({
                role: "grocery_moderator",
                assignedZones: deliveryZone,
                isBlocked: false
            });

            if (moderators.length > 0) {
                const moderatorsWithWorkload = await Promise.all(moderators.map(async (mod) => {
                    const activeCount = await Order.countDocuments({
                        moderator: mod._id,
                        orderType: "grocery",
                        orderStatus: { $in: ["placed", "accepted", "preparing", "on_the_way"] }
                    });
                    return { moderator: mod, activeCount };
                }));

                // Sort by activeCount ascending
                moderatorsWithWorkload.sort((a, b) => a.activeCount - b.activeCount);
                assignedModerator = moderatorsWithWorkload[0].moderator._id;
            }
        }

        // Secure Coupon Validation on placement
        let calculatedDiscount = 0;
        let couponDoc = null;

        if (couponCode) {
            const validation = await validateCoupon(
                couponCode,
                user,
                totalAmount - deliveryCharge, // item subtotal before delivery fees
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

        const newOrder = new Order({
            user,
            restaurant: orderType === "food" ? restaurant : undefined,
            orderType,
            items,
            totalAmount: Math.max(0, totalAmount - calculatedDiscount), // Secure reduction
            deliveryCharge,
            paymentMethod,
            distance: calculatedDistance,
            address,
            whatsappOrder,
            deliveryZone,
            moderator: assignedModerator,
            couponCode,
            discountAmount: calculatedDiscount
        });

        await newOrder.save();

        // Increment total orders count for the restaurant (Food only)
        if (orderType === "food" && restaurant) {
            await Restaurant.findByIdAndUpdate(restaurant, { $inc: { totalOrders: 1 } });
        }

        // Record coupon usage if successfully placed
        if (couponDoc) {
            const CouponUsageModel = mongoose.model("CouponUsage");
            const newUsage = new CouponUsageModel({
                user,
                coupon: couponDoc._id,
                order: newOrder._id,
                discountApplied: calculatedDiscount
            });
            await newUsage.save();

            // Increment coupon usedCount
            const CouponModel = mongoose.model("Coupon");
            await CouponModel.findByIdAndUpdate(couponDoc._id, { $inc: { usedCount: 1 } });
        }

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
        const order = await Order.findById(req.params.id)
            .populate("user", "name email phone")
            .populate("restaurant", "name phone location")
            .populate("items.menuItem", "name price images")
            .populate("items.groceryItem", "name price images unit weightSize brand");

        if (!order) {
            res.status(404).json({ success: false, message: "Order not found" });
            return;
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

        const orders = await Order.find({ user: userId })
            .populate("restaurant", "name image")
            .populate("items.menuItem", "name")
            .populate("items.groceryItem", "name")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all orders for a specific restaurant (Restaurant Dashboard)
export const getRestaurantOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurantId = req.params.restaurantId;
        const { orderStatus } = req.query;

        let filter: any = { restaurant: restaurantId };
        
        // Optional filtering by order status (e.g., to see only 'pending' or 'accepted' orders)
        if (orderStatus) {
            filter.orderStatus = orderStatus;
        }

        const orders = await Order.find(filter)
            .populate("user", "name phone")
            .populate("items.menuItem", "name price")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
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

        const validStatuses = ["placed", "accepted", "preparing", "on_the_way", "delivered", "cancelled"];
        if (!validStatuses.includes(orderStatus)) {
            res.status(400).json({ success: false, message: "Invalid order status" });
            return;
        }

        const orderToCheck = await Order.findById(orderId);
        if (!orderToCheck) {
            res.status(404).json({ success: false, message: "Order not found" });
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

        // Handle cancellations and increment the respective cancellation count
        if (orderStatus === "cancelled") {
            if (cancelledBy === "customer") {
                await User.findByIdAndUpdate(order.user, { $inc: { cancellationCount: 1 } });
            } else if (cancelledBy === "restaurant") {
                await Restaurant.findByIdAndUpdate(order.restaurant, { $inc: { cancellationCount: 1 } });
            }
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
        let filter: any = {};

        if (orderStatus) filter.orderStatus = orderStatus;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (whatsappOrder !== undefined) filter.whatsappOrder = whatsappOrder === 'true';

        const orders = await Order.find(filter)
            .populate("user", "name phone email")
            .populate("restaurant", "name")
            .populate("items.menuItem", "name")
            .populate("items.groceryItem", "name")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
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
        let filter: any = { restaurant: restaurant._id };
        
        if (orderStatus) {
            filter.orderStatus = orderStatus;
        }

        const orders = await Order.find(filter)
            .populate("user", "name phone")
            .populate("items.menuItem", "name price")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all grocery orders (Grocery Moderator Dashboard)
export const getGroceryOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        let query: any = { orderType: "grocery" };

        // Restrict to assigned zones if the requester is a grocery moderator (not admin)
        if (req.user && req.user.role === "grocery_moderator") {
            const currentUser = await User.findById(req.user._id);
            const zones = currentUser?.assignedZones || [];
            query.deliveryZone = { $in: zones };
        }

        const orders = await Order.find(query)
            .populate("user", "name phone email")
            .populate("items.groceryItem", "name price images brand unit weightSize")
            .populate("deliveryZone", "name center radiusKm pincodes")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
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

        // Verify permission: orderStatus must be "placed" (Pending / Waiting for acceptance)
        if (order.orderStatus !== "placed") {
            res.status(400).json({
                success: false,
                message: "Order cannot be cancelled. The restaurant has already accepted or started preparing it."
            });
            return;
        }

        // Verify payment method: online paid orders cannot be cancelled
        if (order.paymentMethod === "ONLINE") {
            res.status(400).json({
                success: false,
                message: "Paid online orders cannot be cancelled."
            });
            return;
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

