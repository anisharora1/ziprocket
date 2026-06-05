import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Restaurant from "../models/Restaurant";
import Order from "../models/Order";
import Delivery from "../models/Delivery";
import DeliveryProfile from "../models/DeliveryProfile";
import BannerAd from "../models/BannerAd";
import Payment from "../models/Payment";

// --- DASHBOARD METRICS ---
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const totalUsers = await User.countDocuments({ role: "customer" });
        const totalRestaurants = await Restaurant.countDocuments();
        const totalDeliveries = await Delivery.countDocuments();
        const totalOrders = await Order.countDocuments();

        // Payment analytics metrics
        const onlinePaymentsCount = await Order.countDocuments({ paymentMethod: "ONLINE", paymentStatus: "paid" });
        const codOrdersCount = await Order.countDocuments({ paymentMethod: "COD" });
        const failedPaymentsCount = await Order.countDocuments({ paymentStatus: "failed" });

        // Sum totalAmount of all paid ONLINE orders and all non-cancelled COD orders for accurate revenue
        const revenueOrders = await Order.find({
            $or: [
                { paymentMethod: "ONLINE", paymentStatus: "paid" },
                { paymentMethod: "COD", orderStatus: { $ne: "cancelled" } }
            ]
        });
        const totalRevenue = revenueOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

        // Revenue Share Breakdown
        const onlineRevenue = revenueOrders
            .filter(order => order.paymentMethod === "ONLINE")
            .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const codRevenue = revenueOrders
            .filter(order => order.paymentMethod === "COD")
            .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

        // Zone-wise Analytics
        const DeliveryZone = mongoose.model("DeliveryZone");
        const activeZones = await DeliveryZone.find({ isActive: true });
        const zoneAnalytics = await Promise.all(activeZones.map(async (zone: any) => {
            const zoneId = zone._id;
            
            // Count total orders in this zone
            const totalOrders = await Order.countDocuments({ deliveryZone: zoneId });
            
            // Count active moderators assigned to this zone
            const activeModerators = await User.countDocuments({ 
                role: "grocery_moderator", 
                assignedZones: zoneId 
            });

            // Calculate zone-specific total sales/revenue (paid ONLINE or non-cancelled COD)
            const zoneRevenueOrders = await Order.find({
                deliveryZone: zoneId,
                $or: [
                    { paymentMethod: "ONLINE", paymentStatus: "paid" },
                    { paymentMethod: "COD", orderStatus: { $ne: "cancelled" } }
                ]
            });
            const zoneRevenue = zoneRevenueOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

            return {
                zoneId,
                name: zone.name,
                center: zone.center,
                radiusKm: zone.radiusKm,
                totalOrders,
                activeModerators,
                totalRevenue: zoneRevenue
            };
        }));

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                totalRestaurants,
                totalDeliveries,
                totalOrders,
                onlinePaymentsCount,
                codOrdersCount,
                failedPaymentsCount,
                totalRevenue,
                onlineRevenue,
                codRevenue,
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
            const restaurant = await Restaurant.findByIdAndUpdate(id, { status: "approved" }, { new: true });
            if (!restaurant) { res.status(404).json({ success: false, message: "Not found" }); return; }
            userId = restaurant.owner;
            // Update user role
            await User.findByIdAndUpdate(userId, { role: "seller" });
        } else if (type === 'delivery') {
            const profile = await DeliveryProfile.findByIdAndUpdate(id, { status: "approved" }, { new: true });
            if (!profile) { res.status(404).json({ success: false, message: "Not found" }); return; }
            userId = profile.user;
            // Update user role
            await User.findByIdAndUpdate(userId, { role: "delivery" });
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
import MenuItem from "../models/MenuItem";

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
            res.status(400).json({ success: false, message: "User with this phone number already exists" });
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

// Admin action: Fetch all delivery boys / couriers and populate their User accounts
export const getAllDeliveryProfiles = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status } = req.query;
        let filter: any = {};
        if (status) filter.status = status;

        const profiles = await DeliveryProfile.find(filter)
            .populate("user", "name phone email isBlocked role")
            .sort({ createdAt: -1 });

        // Calculate real workload dynamically by counting in-progress Delivery documents for each rider
        const profilesWithWorkload = await Promise.all(profiles.map(async (profile) => {
            let activeOrdersCount = 0;
            if (profile.user) {
                activeOrdersCount = await Delivery.countDocuments({
                    deliveryBoy: profile.user._id,
                    status: { $in: ["assigned", "picked", "on_the_way"] }
                });
            }
            return {
                ...profile.toObject(),
                activeOrdersCount
            };
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
