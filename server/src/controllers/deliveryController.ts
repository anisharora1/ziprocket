import { Request, Response } from "express";
import Delivery from "../models/Delivery";
import Order from "../models/Order";
import DeliveryProfile from "../models/DeliveryProfile";
import { uploadToCloudinary } from "../services/cloudinaryService";
import { DELIVERY_CONSTANTS } from "../constants";
import { emitToRooms } from "../services/socketService";
import * as redisService from "../services/redisService";

// Assign a delivery to a delivery boy
export const assignDelivery = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId, deliveryBoyId, earnings } = req.body;
        const finalEarnings = earnings !== undefined ? earnings : DELIVERY_CONSTANTS.FLAT_EARNING_RATE;

        // Check if a delivery already exists for this order
        const existingDelivery = await Delivery.findOne({ order: orderId });
        if (existingDelivery) {
            res.status(400).json({ success: false, message: "Delivery already assigned for this order" });
            return;
        }

        const newDelivery = new Delivery({
            order: orderId,
            deliveryBoy: deliveryBoyId,
            earnings: finalEarnings,
            status: "assigned"
        });

        await newDelivery.save();

        // --- Socket.IO: Notify the delivery boy and the customer ---
        try {
            const order = await Order.findById(orderId).select("user deliveryZone orderType restaurant").lean();
            if (order) {
                emitToRooms(
                    [`delivery:${deliveryBoyId}`, `user:${order.user.toString()}`, "admin"],
                    "delivery_assigned",
                    {
                        orderId: orderId.toString(),
                        deliveryBoyId: deliveryBoyId.toString(),
                        userId: order.user.toString(),
                    }
                );
            }
        } catch (emitErr: any) {
            console.error("[Socket] delivery_assigned emit error:", emitErr.message);
        }

        res.status(201).json({
            success: true,
            message: "Delivery assigned successfully",
            delivery: newDelivery
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Delivery Status (e.g., from 'assigned' -> 'picked' -> 'on_the_way' -> 'delivered')
export const updateDeliveryStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status } = req.body;
        const deliveryId = req.params.id;

        const delivery = await Delivery.findById(deliveryId);
        if (!delivery) {
            res.status(404).json({ success: false, message: "Delivery not found" });
            return;
        }

        delivery.status = status;
        await delivery.save();

        // Sync the order status when delivery status is updated to 'on_the_way' or 'delivered'
        if (status === "on_the_way" || status === "delivered") {
            const orderUpdate: any = { orderStatus: status };
            if (status === "delivered") {
                const orderToCheck = await Order.findById(delivery.order);
                if (orderToCheck && orderToCheck.paymentMethod === "COD") {
                    orderUpdate.paymentStatus = "paid";
                }
            }
            await Order.findByIdAndUpdate(delivery.order, orderUpdate);
        }

        // Invalidate Redis caches and notify via Socket.IO
        try {
            const orderDoc = await Order.findById(delivery.order).select("user deliveryZone orderType restaurant paymentStatus paymentMethod").lean();
            if (orderDoc) {
                await redisService.del(`order:detail:${delivery.order.toString()}`);
                await redisService.deletePattern(`order:user_recent:${orderDoc.user.toString()}*`);

                const rooms: string[] = [`user:${orderDoc.user.toString()}`, "admin"];
                if (orderDoc.orderType === "food" && orderDoc.restaurant) {
                    rooms.push(`seller:${orderDoc.restaurant.toString()}`);
                } else if (orderDoc.orderType === "grocery" && (orderDoc as any).deliveryZone) {
                    rooms.push(`grocery:${(orderDoc as any).deliveryZone.toString()}`);
                }
                const payload = {
                    orderId: delivery.order.toString(),
                    deliveryId: delivery._id.toString(),
                    status,
                    orderStatus: status,
                    orderType: orderDoc.orderType,
                    restaurantId: orderDoc.restaurant?.toString(),
                    zoneId: (orderDoc as any).deliveryZone?.toString(),
                    userId: orderDoc.user.toString(),
                    paymentStatus: orderDoc.paymentStatus,
                };
                emitToRooms(rooms, "delivery_status_updated", payload);
                emitToRooms(rooms, "order_status_updated", payload);
            }
        } catch (emitErr: any) {
            console.error("[Socket] delivery_status_updated emit error:", emitErr.message);
        }

        res.status(200).json({
            success: true,
            message: "Delivery status updated successfully",
            delivery
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get a single delivery by its ID
export const getDeliveryById = async (req: Request, res: Response): Promise<void> => {
    try {
        const delivery = await Delivery.findById(req.params.id)
            .populate({ path: "order", select: "-deliveryOtp" })
            .populate("deliveryBoy", "name email phone");

        if (!delivery) {
            res.status(404).json({ success: false, message: "Delivery not found" });
            return;
        }

        res.status(200).json({
            success: true,
            delivery
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all deliveries assigned to a specific delivery boy
export const getDeliveriesByDeliveryBoy = async (req: Request, res: Response): Promise<void> => {
    try {
        const deliveryBoyId = req.params.deliveryBoyId;
        const { status } = req.query;

        let filter: any = { deliveryBoy: deliveryBoyId };
        
        // Optional filtering by delivery status
        if (status) {
            filter.status = status;
        }

        const deliveries = await Delivery.find(filter)
            .populate({ path: "order", select: "-deliveryOtp" })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            count: deliveries.length,
            deliveries
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all deliveries (useful for Admin dashboard)
export const getAllDeliveries = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status } = req.query;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;
        let filter: any = {};
        
        // Optional filtering by delivery status
        if (status) {
            filter.status = status;
        }

        const [deliveries, total] = await Promise.all([
            Delivery.find(filter)
                .populate({ path: "order", select: "-deliveryOtp" })
                .populate("deliveryBoy", "name phone email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Delivery.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: deliveries.length,
            meta: { total, page, pages: Math.ceil(total / limit), limit },
            deliveries
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get logged-in courier's profile
export const getMyDeliveryProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const profile = await DeliveryProfile.findOne({ user: req.user?._id }).populate("user", "name email phone");
        if (!profile) {
            res.status(404).json({ success: false, message: "Delivery profile not found for this user" });
            return;
        }
        res.status(200).json({ success: true, profile });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update logged-in courier's availability status (isActive)
export const updateMyDeliveryAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
        const { isActive } = req.body;
        if (isActive === undefined) {
            res.status(400).json({ success: false, message: "isActive field is required" });
            return;
        }
        
        const profile = await DeliveryProfile.findOneAndUpdate(
            { user: req.user?._id },
            { isActive },
            { new: true, runValidators: true }
        ).populate("user", "name email phone");

        if (!profile) {
            res.status(404).json({ success: false, message: "Delivery profile not found for this user" });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Delivery availability updated to ${isActive ? "Available" : "Unavailable"}`,
            profile
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get pending delivery queue (Orders that are 'preparing' or 'accepted' and not claimed)
export const getPendingDeliveries = async (req: Request, res: Response): Promise<void> => {
    try {
        const deliveryBoyId = req.user?._id;

        // Fetch courier profile to check their operational zone
        const profile = await DeliveryProfile.findOne({ user: deliveryBoyId }).lean();
        const riderZoneId = profile?.deliveryZone;

        const matchStage: any = {
            orderStatus: { $in: ["accepted", "preparing", "on_the_way"] },
            rejectedBy: { $ne: deliveryBoyId }
        };

        // If rider is registered in a zone, show only orders belonging to that zone
        if (riderZoneId) {
            matchStage.deliveryZone = riderZoneId;
        }

        // Use $lookup to exclude claimed orders without loading entire Delivery collection
        const pendingOrders = await Order.aggregate([
            { $match: matchStage },
            { $lookup: {
                from: "deliveries",
                localField: "_id",
                foreignField: "order",
                as: "existingDelivery"
            }},
            { $match: { existingDelivery: { $size: 0 } } },
            { $sort: { createdAt: -1 as const } },
            { $project: { existingDelivery: 0, deliveryOtp: 0 } }
        ]);

        // Populate references on aggregation results
        const populated = await Order.populate(pendingOrders, [
            { path: "user", select: "name phone" },
            { path: "restaurant", select: "name address location phone" },
            { path: "deliveryZone", select: "name center radiusKm pincodes" },
            { path: "items.menuItem", select: "name" },
            { path: "items.groceryItem", select: "name" }
        ]);

        res.status(200).json({
            success: true,
            count: populated.length,
            orders: populated
        });
    } catch (error: any) {
        console.error("Failed to load pending deliveries:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Accept an order from the delivery boy queue
export const acceptDeliveryOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId } = req.body;
        const deliveryBoyId = req.user?._id;

        if (!orderId) {
            res.status(400).json({ success: false, message: "Order ID is required" });
            return;
        }

        // Prevent double assignments
        const existingDelivery = await Delivery.findOne({ order: orderId });
        if (existingDelivery) {
            res.status(400).json({ success: false, message: "This order has already been assigned/accepted" });
            return;
        }

        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: "Order not found" });
            return;
        }

        const delivery = new Delivery({
            order: orderId,
            deliveryBoy: deliveryBoyId,
            status: "assigned",
            earnings: DELIVERY_CONSTANTS.FLAT_EARNING_RATE
        });
        await delivery.save();

        // Update order status to accepted_by_delivery
        order.orderStatus = "accepted_by_delivery";
        await order.save();

        // Invalidate Redis caches
        await redisService.del(`order:detail:${orderId}`);
        await redisService.deletePattern(`order:user_recent:${order.user.toString()}*`);

        // --- Socket.IO: Notify customer, admin, seller/moderator that a delivery boy accepted ---
        try {
            const rooms: string[] = [`user:${order.user.toString()}`, "admin"];
            // Notify zone room so other delivery boys' UIs remove this from their queue
            if ((order as any).deliveryZone) {
                rooms.push(`delivery_zone:${(order as any).deliveryZone.toString()}`);
            }
            // Notify seller / grocery moderator so their dashboards update immediately
            if (order.orderType === "food" && order.restaurant) {
                rooms.push(`seller:${order.restaurant.toString()}`);
            } else if (order.orderType === "grocery" && (order as any).deliveryZone) {
                rooms.push(`grocery:${(order as any).deliveryZone.toString()}`);
            }
            const payload = {
                orderId: orderId.toString(),
                orderStatus: "accepted_by_delivery",
                deliveryBoyId: deliveryBoyId?.toString(),
                userId: order.user.toString(),
                orderType: order.orderType,
                restaurantId: order.restaurant?.toString(),
                zoneId: (order as any).deliveryZone?.toString(),
            };
            emitToRooms(rooms, "delivery_accepted", payload);
            emitToRooms(rooms, "order_status_updated", payload);
        } catch (emitErr: any) {
            console.error("[Socket] delivery_accepted emit error:", emitErr.message);
        }

        res.status(200).json({
            success: true,
            message: "Delivery order accepted successfully",
            delivery
        });
    } catch (error: any) {
        console.error("Failed to accept delivery order:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Reject an order (add to courier's rejectedBy list)
export const rejectDeliveryOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId } = req.body;
        const deliveryBoyId = req.user?._id;

        if (!orderId) {
            res.status(400).json({ success: false, message: "Order ID is required" });
            return;
        }

        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: "Order not found" });
            return;
        }

        // Add to list of rejected delivery boy IDs
        await Order.findByIdAndUpdate(orderId, {
            $addToSet: { rejectedBy: deliveryBoyId }
        });

        res.status(200).json({
            success: true,
            message: "Delivery order rejected successfully"
        });
    } catch (error: any) {
        console.error("Failed to reject delivery order:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Deliver an order (update both delivery and order records)
export const deliverOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId, otp } = req.body;
        const deliveryBoyId = req.user?._id;

        if (!orderId) {
            res.status(400).json({ success: false, message: "Order ID is required" });
            return;
        }

        const delivery = await Delivery.findOne({ order: orderId, deliveryBoy: deliveryBoyId });
        if (!delivery) {
            res.status(404).json({ success: false, message: "Assigned delivery not found for this courier" });
            return;
        }

        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: "Order not found" });
            return;
        }

        if (order.paymentMethod === "ONLINE") {
            if (!otp) {
                res.status(400).json({ success: false, message: "Please ask the customer for their 4-digit delivery code." });
                return;
            }
            if (otp !== order.deliveryOtp) {
                res.status(400).json({ success: false, message: "Incorrect delivery code. Please check with the customer and try again." });
                return;
            }
        }

        // Upload delivery proof to Cloudinary if provided
        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, "delivery-proofs");
                delivery.deliveryProof = uploadResult;
            } catch (uploadError) {
                console.error("Failed to upload delivery proof:", uploadError);
                res.status(500).json({ success: false, message: "Failed to upload delivery proof image." });
                return;
            }
        }

        delivery.status = "delivered";
        await delivery.save();

        // Fulfill Mongoose Order
        order.orderStatus = "delivered";
        if (order.paymentMethod === "COD") {
            order.paymentStatus = "paid"; // cash collected on doorstep
        }
        order.deliveryOtp = undefined; // clear it after successful use, no reason to keep it around
        await order.save();

        // Invalidate Redis caches so fresh data is returned on refetch
        await redisService.del(`order:detail:${orderId}`);
        await redisService.deletePattern(`order:user_recent:${order.user.toString()}*`);

        // --- Socket.IO: Notify customer, seller, grocery moderator, admin, and delivery boy ---
        try {
            const rooms: string[] = [
                `user:${order.user.toString()}`,
                "admin",
                `delivery:${deliveryBoyId?.toString()}`,
            ];
            if (order.orderType === "food" && order.restaurant) {
                rooms.push(`seller:${order.restaurant.toString()}`);
            } else if (order.orderType === "grocery" && (order as any).deliveryZone) {
                rooms.push(`grocery:${(order as any).deliveryZone.toString()}`);
            }
            const payload = {
                orderId: orderId.toString(),
                orderStatus: "delivered",
                orderType: order.orderType,
                restaurantId: order.restaurant?.toString(),
                zoneId: (order as any).deliveryZone?.toString(),
                userId: order.user.toString(),
                paymentStatus: order.paymentStatus,
            };
            emitToRooms(rooms, "order_delivered", payload);
            emitToRooms(rooms, "order_status_updated", payload);
        } catch (emitErr: any) {
            console.error("[Socket] order_delivered emit error:", emitErr.message);
        }

        res.status(200).json({
            success: true,
            message: "Delivery completed successfully",
            delivery
        });
    } catch (error: any) {
        console.error("Failed to complete delivery:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get active or completed deliveries for dashboard lists
export const getMyDeliveries = async (req: Request, res: Response): Promise<void> => {
    try {
        const deliveryBoyId = req.user?._id;
        const { type } = req.query; // 'active' or 'completed'
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        let filter: any = { deliveryBoy: deliveryBoyId };
        if (type === "completed") {
            filter.status = "delivered";
        } else {
            filter.status = { $in: ["assigned", "picked", "on_the_way"] };
        }

        const [list, total] = await Promise.all([
            Delivery.find(filter)
                .populate({
                    path: "order",
                    select: "-deliveryOtp",
                    populate: [
                        { path: "user", select: "name phone" },
                        { path: "restaurant", select: "name address location phone" },
                        { path: "deliveryZone", select: "name center radiusKm pincodes" },
                        { path: "items.menuItem", select: "name" },
                        { path: "items.groceryItem", select: "name" }
                    ]
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Delivery.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: list.length,
            meta: { total, page, pages: Math.ceil(total / limit), limit },
            deliveries: list
        });
    } catch (error: any) {
        console.error("Failed to fetch courier deliveries:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get rejected orders for this delivery boy
export const getMyRejectedOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const deliveryBoyId = req.user?._id;
        const rejectedOrders = await Order.find({ rejectedBy: deliveryBoyId })
            .populate("user", "name phone")
            .populate("restaurant", "name address phone")
            .sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            count: rejectedOrders.length,
            orders: rejectedOrders
        });
    } catch (error: any) {
        console.error("Failed to fetch courier rejected orders:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Compute total earnings and deliveries stats server-side via aggregation
export const getMyEarningsStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const deliveryBoyId = req.user?._id;
        const result = await Delivery.aggregate([
            { $match: { deliveryBoy: deliveryBoyId, status: "delivered" } },
            { $group: { _id: null, totalEarnings: { $sum: "$earnings" }, totalDeliveries: { $sum: 1 } } }
        ]);
        const stats = result[0] || { totalEarnings: 0, totalDeliveries: 0 };
        res.status(200).json({ success: true, totalEarnings: stats.totalEarnings, totalDeliveries: stats.totalDeliveries });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
