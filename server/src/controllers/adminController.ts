import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Restaurant from "../models/Restaurant";
import Order from "../models/Order";
import Delivery from "../models/Delivery";
import DeliveryProfile from "../models/DeliveryProfile";
import BannerAd from "../models/BannerAd";
import Payment from "../models/Payment";
import MenuItem from "../models/MenuItem";
import * as sessionCacheService from "../services/sessionCacheService";
import * as restaurantCacheService from "../services/restaurantCacheService";
import * as redisService from "../services/redisService";
import { broadcastSettings } from "../utils/platformSse";
import PlatformSettings from "../models/PlatformSettings";

// --- DASHBOARD METRICS ---
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const DeliveryZone = mongoose.model("DeliveryZone");

        // Run overall count and aggregation queries in parallel
        const [
            totalUsers,
            totalRestaurants,
            totalDeliveries,
            activeZones,
            orderAggregate,
            zoneOrderAggregate,
            moderatorZoneAggregate
        ] = await Promise.all([
            User.countDocuments({ role: "customer" }),
            Restaurant.countDocuments(),
            Delivery.countDocuments(),
            DeliveryZone.find({ isActive: true }),
            Order.aggregate([
                {
                    $group: {
                        _id: null,
                        totalOrders: { $sum: 1 },
                        onlinePaymentsCount: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ["$paymentMethod", "ONLINE"] }, { $eq: ["$paymentStatus", "paid"] }] },
                                    1,
                                    0
                                ]
                            }
                        },
                        codOrdersCount: {
                            $sum: {
                                $cond: [{ $eq: ["$paymentMethod", "COD"] }, 1, 0]
                            }
                        },
                        failedPaymentsCount: {
                            $sum: {
                                $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0]
                            }
                        },
                        onlineRevenue: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ["$paymentMethod", "ONLINE"] }, { $eq: ["$paymentStatus", "paid"] }] },
                                    "$totalAmount",
                                    0
                                ]
                            }
                        },
                        codRevenue: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ["$paymentMethod", "COD"] }, { $ne: ["$orderStatus", "cancelled"] }] },
                                    "$totalAmount",
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),
            Order.aggregate([
                {
                    $group: {
                        _id: "$deliveryZone",
                        totalOrders: { $sum: 1 },
                        totalRevenue: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $and: [{ $eq: ["$paymentMethod", "ONLINE"] }, { $eq: ["$paymentStatus", "paid"] }] },
                                            { $and: [{ $eq: ["$paymentMethod", "COD"] }, { $ne: ["$orderStatus", "cancelled"] }] }
                                        ]
                                    },
                                    "$totalAmount",
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),
            User.aggregate([
                { $match: { role: "grocery_moderator" } },
                { $unwind: "$assignedZones" },
                { $group: { _id: "$assignedZones", count: { $sum: 1 } } }
            ])
        ]);

        const orderStats = orderAggregate[0] || {
            totalOrders: 0,
            onlinePaymentsCount: 0,
            codOrdersCount: 0,
            failedPaymentsCount: 0,
            onlineRevenue: 0,
            codRevenue: 0
        };

        const totalRevenue = (orderStats.onlineRevenue || 0) + (orderStats.codRevenue || 0);

        // Build lookup maps for zone order stats and moderator counts
        const zoneOrderMap = new Map<string, { totalOrders: number; totalRevenue: number }>();
        for (const item of zoneOrderAggregate) {
            if (item._id) {
                zoneOrderMap.set(item._id.toString(), {
                    totalOrders: item.totalOrders || 0,
                    totalRevenue: item.totalRevenue || 0
                });
            }
        }

        const moderatorCountMap = new Map<string, number>();
        for (const item of moderatorZoneAggregate) {
            if (item._id) {
                moderatorCountMap.set(item._id.toString(), item.count || 0);
            }
        }

        const zoneAnalytics = activeZones.map((zone: any) => {
            const zoneIdStr = zone._id.toString();
            const zoneOrderData = zoneOrderMap.get(zoneIdStr) || { totalOrders: 0, totalRevenue: 0 };
            const activeModerators = moderatorCountMap.get(zoneIdStr) || 0;

            return {
                zoneId: zone._id,
                name: zone.name,
                center: zone.center,
                radiusKm: zone.radiusKm,
                totalOrders: zoneOrderData.totalOrders,
                activeModerators,
                totalRevenue: zoneOrderData.totalRevenue
            };
        });

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                totalRestaurants,
                totalDeliveries,
                totalOrders: orderStats.totalOrders,
                onlinePaymentsCount: orderStats.onlinePaymentsCount,
                codOrdersCount: orderStats.codOrdersCount,
                failedPaymentsCount: orderStats.failedPaymentsCount,
                totalRevenue,
                onlineRevenue: orderStats.onlineRevenue,
                codRevenue: orderStats.codRevenue,
                zoneAnalytics
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- CANCELLATION MONITORING ---

// Get users with a high number of order cancellations
export const getHighCancellationUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // Default threshold is 3 if not provided in the query
        const threshold = parseInt(req.query.threshold as string) || 3;

        const users = await User.find({ cancellationCount: { $gte: threshold } })
            .select("-addresses -walletBalance") // Exclude sensitive/unnecessary info
            .sort({ cancellationCount: -1 });

        res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get restaurants with a high number of order cancellations
export const getHighCancellationRestaurants = async (req: Request, res: Response): Promise<void> => {
    try {
        // Default threshold is 3 if not provided in the query
        const threshold = parseInt(req.query.threshold as string) || 3;

        const restaurants = await Restaurant.find({ cancellationCount: { $gte: threshold } })
            .populate("owner", "name email phone")
            .sort({ cancellationCount: -1 });

        res.status(200).json({
            success: true,
            count: restaurants.length,
            restaurants
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- BLOCKING / ACTIONS ---

// Admin action: Block or unblock a user based on their behavior
export const toggleUserBlockStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.params.userId;
        const { isBlocked } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            { isBlocked },
            { new: true, runValidators: true }
        );

        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        // Invalidate session cache in Redis
        await sessionCacheService.deleteSession(userId.toString());

        res.status(200).json({
            success: true,
            message: `User has been ${isBlocked ? "blocked" : "unblocked"} successfully`,
            user
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Block or unblock a restaurant
export const toggleRestaurantBlockStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurantId = req.params.restaurantId;
        const { isBlocked } = req.body;

        const restaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { isBlocked },
            { new: true, runValidators: true }
        );

        if (!restaurant) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Restaurant has been ${isBlocked ? "blocked" : "unblocked"} successfully`,
            restaurant
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- RESET COUNTS ---

// Reset a user's cancellation count (e.g., after issuing a warning and they behave well)
export const resetUserCancellationCount = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.params.userId;

        const user = await User.findByIdAndUpdate(
            userId,
            { cancellationCount: 0 },
            { new: true }
        );

        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        // Invalidate session cache in Redis
        await sessionCacheService.deleteSession(userId.toString());

        res.status(200).json({
            success: true,
            message: "User cancellation count has been reset to 0",
            user
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Reset a restaurant's cancellation count
export const resetRestaurantCancellationCount = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurantId = req.params.restaurantId;

        const restaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { cancellationCount: 0 },
            { new: true }
        );

        if (!restaurant) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Restaurant cancellation count has been reset to 0",
            restaurant
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- DELIVERY PERSONNEL MANAGEMENT ---
export const addDeliveryBoy = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, phone, email } = req.body;
        
        // Using User model for delivery boys as well
        const newDeliveryBoy = new User({
            name,
            phone,
            email,
            role: "delivery",
            isPhoneVerified: true // Assume verified for test purposes
        });
        
        await newDeliveryBoy.save();
        
        res.status(201).json({
            success: true,
            message: "Delivery boy added successfully",
            deliveryBoy: newDeliveryBoy
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- APPLICATIONS MANAGEMENT ---
export const getPendingApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        const pendingRestaurants = await Restaurant.find({ status: "pending" }).populate("owner", "name phone");
        const pendingDeliveries = await DeliveryProfile.find({ status: "pending" }).populate("user", "name phone");

        res.status(200).json({
            success: true,
            applications: {
                restaurants: pendingRestaurants,
                deliveries: pendingDeliveries
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const approveApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        const { type, id } = req.params; // type = 'restaurant' | 'delivery'
        
        let userId;

        if (type === 'restaurant') {
            const existingRestaurant = await Restaurant.findById(id);
            if (!existingRestaurant) { res.status(404).json({ success: false, message: "Not found" }); return; }

            if (existingRestaurant.locationNeedsReview || !existingRestaurant.location?.lat || !existingRestaurant.location?.lng) {
                res.status(400).json({ success: false, message: "This restaurant's location hasn't been confirmed yet. Please set its map pin before approving." });
                return;
            }

            const restaurant = await Restaurant.findByIdAndUpdate(id, { status: "approved" }, { new: true });
            if (!restaurant) { res.status(404).json({ success: false, message: "Not found" }); return; }
            userId = restaurant.owner;
            // Update user role
            await User.findByIdAndUpdate(userId, { role: "seller" });
            if (userId) {
                await sessionCacheService.deleteSession(userId.toString());
            }
        } else if (type === 'delivery') {
            const profile = await DeliveryProfile.findByIdAndUpdate(id, { status: "approved" }, { new: true });
            if (!profile) { res.status(404).json({ success: false, message: "Not found" }); return; }
            userId = profile.user;
            // Update user role
            await User.findByIdAndUpdate(userId, { role: "delivery" });
            if (userId) {
                await sessionCacheService.deleteSession(userId.toString());
            }
        } else {
            res.status(400).json({ success: false, message: "Invalid type" });
            return;
        }

        res.status(200).json({ success: true, message: "Application approved successfully" });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const rejectApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        const { type, id } = req.params;
        
        if (type === 'restaurant') {
            await Restaurant.findByIdAndUpdate(id, { status: "rejected" });
        } else if (type === 'delivery') {
            await DeliveryProfile.findByIdAndUpdate(id, { status: "rejected" });
        }

        res.status(200).json({ success: true, message: "Application rejected successfully" });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- MENU MODERATION ---

// Admin action: Block or unblock a menu item
export const toggleMenuItemBlockStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const menuItemId = req.params.menuItemId;
        const { isAvailable } = req.body; // Using isAvailable to block it from customer view

        const menuItem = await MenuItem.findByIdAndUpdate(
            menuItemId,
            { isAvailable },
            { new: true, runValidators: true }
        );

        if (!menuItem) {
            res.status(404).json({ success: false, message: "Menu item not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Menu item availability has been updated`,
            menuItem
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Delete a menu item entirely
export const adminDeleteMenuItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const menuItem = await MenuItem.findByIdAndDelete(req.params.menuItemId);

        if (!menuItem) {
            res.status(404).json({ success: false, message: "Menu item not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Menu item deleted successfully by admin"
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Create a new grocery moderator account directly
export const createGroceryModerator = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, phone, assignedZones } = req.body;

        if (!name || !phone) {
            res.status(400).json({ success: false, message: "Name and Phone number are required" });
            return;
        }

        if (!assignedZones || !Array.isArray(assignedZones) || assignedZones.length === 0) {
            res.status(400).json({ success: false, message: "At least one delivery zone must be selected for the grocery moderator" });
            return;
        }

        // Check if user already exists
        let user = await User.findOne({ phone });
        if (user) {
            if (user.role === "grocery_moderator") {
                res.status(400).json({ success: false, message: "User with this phone number is already a grocery moderator" });
                return;
            }

            // Promote existing user to grocery_moderator
            user.role = "grocery_moderator";
            user.name = name;
            user.assignedZones = assignedZones;
            user.approvalStatus = "approved";
            await user.save();

            // Invalidate session cache in Redis
            await sessionCacheService.deleteSession(user._id.toString());

            const populatedModerator = await User.findById(user._id).populate("assignedZones", "name center radiusKm pincodes");

            res.status(200).json({
                success: true,
                message: "Existing user promoted to Grocery Moderator successfully",
                moderator: populatedModerator
            });
            return;
        }

        user = new User({
            name,
            phone,
            assignedZones,
            role: "grocery_moderator",
            isPhoneVerified: true,
            approvalStatus: "approved"
        });

        await user.save();

        const populatedModerator = await User.findById(user._id).populate("assignedZones", "name center radiusKm pincodes");

        res.status(201).json({
            success: true,
            message: "Grocery Moderator created successfully",
            moderator: populatedModerator
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Update a grocery moderator's details
export const updateGroceryModerator = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, phone, assignedZones, isBlocked } = req.body;

        if (!name || !phone) {
            res.status(400).json({ success: false, message: "Name and Phone number are required" });
            return;
        }

        if (!assignedZones || !Array.isArray(assignedZones) || assignedZones.length === 0) {
            res.status(400).json({ success: false, message: "At least one delivery zone must be selected for the grocery moderator" });
            return;
        }

        // Verify if phone is already taken by another user
        const existingUser = await User.findOne({ phone, _id: { $ne: id } });
        if (existingUser) {
            res.status(400).json({ success: false, message: "Another user with this phone number already exists" });
            return;
        }

        const updateData: any = {
            name,
            phone,
            assignedZones
        };

        if (isBlocked !== undefined) {
            updateData.isBlocked = isBlocked;
        }

        const moderator = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate("assignedZones", "name center radiusKm pincodes");

        if (!moderator || moderator.role !== "grocery_moderator") {
            res.status(404).json({ success: false, message: "Grocery Moderator not found" });
            return;
        }

        // Invalidate session cache in Redis
        await sessionCacheService.deleteSession(id.toString());

        res.status(200).json({
            success: true,
            message: "Grocery Moderator updated successfully",
            moderator
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Fetch all grocery moderator users
export const getGroceryModerators = async (req: Request, res: Response): Promise<void> => {
    try {
        const moderators = await User.find({ role: "grocery_moderator" })
            .populate("assignedZones", "name center radiusKm pincodes")
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: moderators.length,
            moderators
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Remove a grocery moderator (downgrade to regular customer)
export const removeGroceryModerator = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user || user.role !== "grocery_moderator") {
            res.status(404).json({ success: false, message: "Grocery moderator not found." });
            return;
        }
        user.role = "customer";
        user.assignedZones = [];
        await user.save();
        await sessionCacheService.deleteSession(user._id.toString());
        res.status(200).json({ success: true, message: "Moderator access removed." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Fetch all delivery boys / couriers and populate their User accounts
export const getAllDeliveryProfiles = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status } = req.query;
        let filter: any = {};
        if (status) filter.status = status;

        const profiles = await DeliveryProfile.find(filter)
            .populate("user", "name phone email isBlocked role")
            .sort({ createdAt: -1 });

        // Single aggregation to count active deliveries per rider (replaces N+1 individual queries)
        const activeCountsAgg = await Delivery.aggregate([
            { $match: { status: { $in: ["assigned", "picked", "on_the_way"] } } },
            { $group: { _id: "$deliveryBoy", count: { $sum: 1 } } }
        ]);
        const activeCountMap = new Map(activeCountsAgg.map(a => [a._id.toString(), a.count]));

        const profilesWithWorkload = profiles.map(profile => ({
            ...profile.toObject(),
            activeOrdersCount: activeCountMap.get((profile.user as any)?._id?.toString()) || 0
        }));

        res.status(200).json({
            success: true,
            count: profilesWithWorkload.length,
            profiles: profilesWithWorkload
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Update a delivery profile (approve, reject, block/unblock, edit vehicle details)
export const updateDeliveryProfileStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status, isBlocked, vehicleType, vehicleNumber } = req.body;
        const profileId = req.params.id;

        const updateFields: any = {};
        if (status !== undefined) updateFields.status = status;
        if (isBlocked !== undefined) updateFields.isBlocked = isBlocked;
        if (vehicleType !== undefined) updateFields.vehicleType = vehicleType;
        if (vehicleNumber !== undefined) updateFields.vehicleNumber = vehicleNumber;

        const profile = await DeliveryProfile.findByIdAndUpdate(
            profileId,
            updateFields,
            { new: true, runValidators: true }
        ).populate("user", "name phone email isBlocked role");

        if (!profile) {
            res.status(404).json({ success: false, message: "Delivery profile not found" });
            return;
        }

        // Sync role and block status of underlying user model if status or block is updated
        if (status === "approved") {
            await User.findByIdAndUpdate(profile.user, { role: "delivery" });
        }
        if (isBlocked !== undefined) {
            await User.findByIdAndUpdate(profile.user, { isBlocked });
        }

        if (profile.user) {
            const riderUserId = (profile.user as any)._id || profile.user;
            await sessionCacheService.deleteSession(riderUserId.toString());
        }

        res.status(200).json({
            success: true,
            message: "Delivery profile updated successfully",
            profile
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- PROMOTIONS & BANNER ADS MANAGEMENT ---

// Admin action: Fetch all banner ads / promotions
export const getAllPromotions = async (req: Request, res: Response): Promise<void> => {
    try {
        const promotions = await BannerAd.find()
            .populate("restaurant", "name owner phone cuisines")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: promotions.length,
            promotions
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Create a new promotion or banner ad
export const createPromotion = async (req: Request, res: Response): Promise<void> => {
    try {
        const { restaurant, targetType, category, image, title, description, startDate, endDate, isActive } = req.body;

        if (!title || !description || !image) {
            res.status(400).json({ success: false, message: "Title, description, and image are required." });
            return;
        }
        if (targetType === "restaurant" && !restaurant) {
            res.status(400).json({ success: false, message: "A restaurant must be selected for restaurant-type promotions." });
            return;
        }
        if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
            res.status(400).json({ success: false, message: "End date must be after start date." });
            return;
        }
        try {
            new URL(image);
        } catch {
            res.status(400).json({ success: false, message: "Image must be a valid URL." });
            return;
        }

        const promotion = new BannerAd({
            restaurant: restaurant || undefined,
            targetType: targetType || "restaurant",
            category: category || undefined,
            image,
            title,
            description,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
            isActive: isActive !== undefined ? isActive : true
        });

        await promotion.save();

        res.status(201).json({
            success: true,
            message: "Promotion created successfully",
            promotion
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Toggle isActive status of a promotion
export const togglePromotionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { isActive } = req.body;
        const promoId = req.params.id;

        const promotion = await BannerAd.findByIdAndUpdate(
            promoId,
            { isActive },
            { new: true, runValidators: true }
        ).populate("restaurant", "name owner phone cuisines");

        if (!promotion) {
            res.status(404).json({ success: false, message: "Promotion not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Promotion has been ${isActive ? "activated" : "deactivated"} successfully`,
            promotion
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Delete a promotion ad completely
export const deletePromotion = async (req: Request, res: Response): Promise<void> => {
    try {
        const promoId = req.params.id;

        const promotion = await BannerAd.findByIdAndDelete(promoId);

        if (!promotion) {
            res.status(404).json({ success: false, message: "Promotion not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Promotion deleted successfully by admin"
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Public: Fetch all active banner ads / promotions (No Auth Required)
export const getPublicPromotions = async (req: Request, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const promotions = await BannerAd.find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        })
            .populate("restaurant", "name cuisines image rating")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: promotions.length,
            promotions
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Update a restaurant's availability status (open, closed, disabled)
export const updateRestaurantAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
        const { restaurantId } = req.params;
        const { availabilityStatus } = req.body;

        const validStatuses = ["open", "closed", "disabled"];
        if (!validStatuses.includes(availabilityStatus)) {
            res.status(400).json({ success: false, message: "Invalid availability status" });
            return;
        }

        const restaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            { availabilityStatus },
            { new: true, runValidators: true }
        );

        if (!restaurant) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        // Invalidate Redis cache for lists and detail view
        await restaurantCacheService.invalidateRestaurantCache(restaurantId as string);

        // Also broadcast settings/update trigger via SSE so clients get real-time state changes
        const settings = await PlatformSettings.findOne() || {};
        broadcastSettings(settings);

        res.status(200).json({
            success: true,
            message: `Restaurant availability updated to ${availabilityStatus}`,
            restaurant
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Get count of currently connected live users
export const getLiveUserCount = async (req: Request, res: Response): Promise<void> => {
    try {
        const redis = redisService.getClient();
        const count = redis ? await redis.scard("online_users") : 0;
        res.status(200).json({ success: true, count });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
