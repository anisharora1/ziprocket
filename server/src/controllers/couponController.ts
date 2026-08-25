import { Request, Response } from "express";
import Coupon from "../models/Coupon";
import CouponUsage from "../models/CouponUsage";
import Order from "../models/Order";
import mongoose from "mongoose";

// Admin action: Create a new Coupon
export const createCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            code,
            title,
            description,
            discountType,
            discountValue,
            maxDiscountAmount,
            minOrderAmount,
            expiryDate,
            totalUsageLimit,
            perUserUsageLimit,
            isActive,
            applicableZones,
            applicableRestaurants,
            applicableFor = "both",
            isFirstOrderOnly,
            isNewUserOnly
        } = req.body;

        if (!code || !title || !description || !discountType || discountValue === undefined || !expiryDate) {
            res.status(400).json({ success: false, message: "Missing required fields for coupon creation" });
            return;
        }

        if (discountType === "percentage" && Number(discountValue) > 100) {
            res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
            return;
        }
        if (discountType === "percentage" && !maxDiscountAmount) {
            res.status(400).json({ success: false, message: "A maximum discount cap is required for percentage-based coupons, to prevent unlimited discount amounts." });
            return;
        }

        const uppercaseCode = code.toUpperCase().trim();
        
        // Check duplicate code
        const existing = await Coupon.findOne({ code: uppercaseCode });
        if (existing) {
            res.status(400).json({ success: false, message: `Coupon with code '${uppercaseCode}' already exists` });
            return;
        }

        const newCoupon = new Coupon({
            code: uppercaseCode,
            title,
            description,
            discountType,
            discountValue: Number(discountValue),
            maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
            minOrderAmount: minOrderAmount ? Number(minOrderAmount) : 0,
            expiryDate: new Date(expiryDate),
            totalUsageLimit: totalUsageLimit ? Number(totalUsageLimit) : 1000,
            perUserUsageLimit: perUserUsageLimit ? Number(perUserUsageLimit) : 1,
            isActive: isActive !== undefined ? isActive : true,
            applicableZones: applicableZones || [],
            applicableRestaurants: applicableRestaurants || [],
            applicableFor: applicableFor,
            isFirstOrderOnly: isFirstOrderOnly !== undefined ? isFirstOrderOnly : false,
            isNewUserOnly: isNewUserOnly !== undefined ? isNewUserOnly : false
        });

        await newCoupon.save();

        res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            coupon: newCoupon
        });
    } catch (error: any) {
        if (error.name === "ValidationError") {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Get all coupons
export const getCoupons = async (req: Request, res: Response): Promise<void> => {
    try {
        const coupons = await Coupon.find()
            .populate("applicableZones", "name")
            .populate("applicableRestaurants", "name")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: coupons.length,
            coupons
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Update a Coupon
export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const updateFields = { ...req.body };

        const existingCoupon = await Coupon.findById(id);
        if (!existingCoupon) {
            res.status(404).json({ success: false, message: "Coupon not found" });
            return;
        }

        if (updateFields.code) {
            updateFields.code = updateFields.code.toUpperCase().trim();
            const existing = await Coupon.findOne({ code: updateFields.code, _id: { $ne: id } });
            if (existing) {
                res.status(400).json({ success: false, message: `Another coupon with code '${updateFields.code}' already exists` });
                return;
            }
        }

        const effectiveDiscountType = updateFields.discountType || existingCoupon.discountType;
        const effectiveDiscountValue = updateFields.discountValue !== undefined ? Number(updateFields.discountValue) : existingCoupon.discountValue;
        const effectiveMaxDiscount = updateFields.maxDiscountAmount !== undefined 
            ? (updateFields.maxDiscountAmount === "" ? null : Number(updateFields.maxDiscountAmount))
            : existingCoupon.maxDiscountAmount;

        if (effectiveDiscountType === "percentage" && Number(effectiveDiscountValue) > 100) {
            res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
            return;
        }
        if (effectiveDiscountType === "percentage" && !effectiveMaxDiscount) {
            res.status(400).json({ success: false, message: "A maximum discount cap is required for percentage-based coupons, to prevent unlimited discount amounts." });
            return;
        }

        if (updateFields.discountValue !== undefined) updateFields.discountValue = Number(updateFields.discountValue);
        if (updateFields.maxDiscountAmount !== undefined) {
            updateFields.maxDiscountAmount = updateFields.maxDiscountAmount === "" ? null : Number(updateFields.maxDiscountAmount);
        }
        if (updateFields.minOrderAmount !== undefined) updateFields.minOrderAmount = Number(updateFields.minOrderAmount);
        if (updateFields.totalUsageLimit !== undefined) updateFields.totalUsageLimit = Number(updateFields.totalUsageLimit);
        if (updateFields.perUserUsageLimit !== undefined) updateFields.perUserUsageLimit = Number(updateFields.perUserUsageLimit);
        if (updateFields.expiryDate) updateFields.expiryDate = new Date(updateFields.expiryDate);

        const coupon = await Coupon.findByIdAndUpdate(
            id,
            updateFields,
            { new: true, runValidators: true }
        ).populate("applicableZones", "name").populate("applicableRestaurants", "name");

        if (!coupon) {
            res.status(404).json({ success: false, message: "Coupon not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            coupon
        });
    } catch (error: any) {
        if (error.name === "ValidationError") {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Delete a Coupon
export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);

        if (!coupon) {
            res.status(404).json({ success: false, message: "Coupon not found" });
            return;
        }

        // Remove usages as well
        await CouponUsage.deleteMany({ coupon: id });

        res.status(200).json({
            success: true,
            message: "Coupon deleted successfully"
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Toggle isActive status
export const toggleCouponStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const coupon = await Coupon.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );

        if (!coupon) {
            res.status(404).json({ success: false, message: "Coupon not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Coupon status toggled to ${isActive ? "Active" : "Inactive"}`,
            coupon
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin action: Coupon Analytics Metrics
export const getCouponAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const totalRedemptions = await CouponUsage.countDocuments();
        
        // Sum total discount given
        const savingsResult = await CouponUsage.aggregate([
            {
                $group: {
                    _id: null,
                    totalSavings: { $sum: "$discountApplied" }
                }
            }
        ]);
        const totalDiscountGiven = savingsResult[0]?.totalSavings || 0;

        // Group by coupons to see most popular
        const popularCoupons = await CouponUsage.aggregate([
            {
                $group: {
                    _id: "$coupon",
                    usageCount: { $sum: 1 },
                    totalSavings: { $sum: "$discountApplied" }
                }
            },
            { $sort: { usageCount: -1 } },
            { $limit: 10 }
        ]);

        const couponIds = popularCoupons.map(p => p._id);
        const couponDocs = await Coupon.find({ _id: { $in: couponIds } })
            .select("code title discountType discountValue").lean();
        const couponMap = new Map(couponDocs.map(c => [c._id.toString(), c]));

        const populatedPopular = popularCoupons.map(item => {
            const coupDetails = couponMap.get(item._id?.toString());
            return {
                ...item,
                code: coupDetails?.code || "DELETED",
                title: coupDetails?.title || "Deleted Coupon",
                discountType: coupDetails?.discountType,
                discountValue: coupDetails?.discountValue
            };
        });

        res.status(200).json({
            success: true,
            analytics: {
                totalRedemptions,
                totalDiscountGiven,
                popularCoupons: populatedPopular
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper: Secure coupon validator engine (shared with calculateBill and createOrder)
export const validateCoupon = async (
    code: string,
    userId: string,
    subtotal: number,
    zoneId?: string,
    restaurantId?: string,
    orderType?: "food" | "grocery",
    preFetchedContext?: {
        coupon?: any;
        userPastOrdersCount?: number;
        userCouponUsagesMap?: Map<string, number>;
    }
): Promise<{ success: boolean; coupon?: any; message: string; discountAmount: number }> => {
    const uppercaseCode = code.toUpperCase().trim();
    
    // 1. Check existence
    const coupon = preFetchedContext?.coupon || await Coupon.findOne({ code: uppercaseCode });
    if (!coupon) {
        return { success: false, message: "Invalid coupon code.", discountAmount: 0 };
    }

    // 2. Check active toggle
    if (!coupon.isActive) {
        return { success: false, message: "This coupon is currently inactive.", discountAmount: 0 };
    }

    // 3. Check expiration
    if (new Date() > new Date(coupon.expiryDate)) {
        return { success: false, message: "This coupon has expired.", discountAmount: 0 };
    }

    // 4. Check minimum order subtotal amount
    if (subtotal < coupon.minOrderAmount) {
        return { success: false, message: `Minimum order of ₹${coupon.minOrderAmount} is required for this coupon.`, discountAmount: 0 };
    }

    // 5. Check global total usage limits
    if (coupon.usedCount >= coupon.totalUsageLimit) {
        return { success: false, message: "This coupon limit has been fully exhausted.", discountAmount: 0 };
    }

    // 6. Check zone eligibility geofence rules
    if (coupon.applicableZones && coupon.applicableZones.length > 0) {
        if (!zoneId || !coupon.applicableZones.some((z: any) => z.toString() === zoneId.toString())) {
            return { success: false, message: "This coupon is not serviceable in your current area/zone.", discountAmount: 0 };
        }
    }

    // 7. Check restaurant eligibility rules
    if (coupon.applicableRestaurants && coupon.applicableRestaurants.length > 0) {
        if (!restaurantId || !coupon.applicableRestaurants.some((r: any) => r.toString() === restaurantId.toString())) {
            return { success: false, message: "This coupon is not valid for this selected restaurant.", discountAmount: 0 };
        }
    }

    // 7.5 Check food/grocery scope restrictions
    if (coupon.applicableFor && coupon.applicableFor !== "both" && orderType) {
        if (coupon.applicableFor !== orderType) {
            return { success: false, message: `This coupon is only valid for ${coupon.applicableFor === "food" ? "food delivery" : "grocery"} orders.`, discountAmount: 0 };
        }
    }

    // 8. Check first-order rules
    if (coupon.isFirstOrderOnly || coupon.isNewUserOnly) {
        if (!userId) {
            return { success: false, message: "Please log in to apply this coupon.", discountAmount: 0 };
        }
        const pastOrders = preFetchedContext?.userPastOrdersCount !== undefined
            ? preFetchedContext.userPastOrdersCount
            : await Order.countDocuments({ user: userId, orderStatus: { $ne: "cancelled" } });

        if (pastOrders > 0) {
            return { success: false, message: "This coupon is only valid on your first successful order.", discountAmount: 0 };
        }
    }

    // 9. Check per-user usage limits constraints
    if (userId) {
        const userUsage = preFetchedContext?.userCouponUsagesMap
            ? (preFetchedContext.userCouponUsagesMap.get(coupon._id.toString()) || 0)
            : await CouponUsage.countDocuments({ user: userId, coupon: coupon._id });

        if (userUsage >= coupon.perUserUsageLimit) {
            return { success: false, message: `You have already used coupon '${uppercaseCode}' the maximum allowed times.`, discountAmount: 0 };
        }
    }

    // Calculate discount value
    let discountAmount = 0;
    if (coupon.discountType === "flat") {
        discountAmount = Math.min(subtotal, coupon.discountValue);
    } else if (coupon.discountType === "percentage") {
        const calc = subtotal * (coupon.discountValue / 100);
        discountAmount = coupon.maxDiscountAmount ? Math.min(calc, coupon.maxDiscountAmount) : calc;
    }

    // Return successfully validated details
    return {
        success: true,
        coupon,
        message: `Promo applied! You saved ₹${Math.round(discountAmount)}.`,
        discountAmount: Math.round(discountAmount)
    };
};

// User action: Validate coupon POST endpoint
export const validateAppliedCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, userId, subtotal, zoneId, restaurantId, orderType } = req.body;

        if (!code || subtotal === undefined) {
            res.status(400).json({ success: false, message: "Coupon code and subtotal are required." });
            return;
        }

        const result = await validateCoupon(code, userId, Number(subtotal), zoneId, restaurantId, orderType);

        if (!result.success) {
            res.status(400).json({ success: false, message: result.message });
            return;
        }

        res.status(200).json({
            success: true,
            message: result.message,
            discountAmount: result.discountAmount,
            couponCode: result.coupon.code
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// User action: Fetch available coupon suggestions inside checkout context
export const getAvailableCoupons = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, subtotal, zoneId, restaurantId, orderType } = req.body;

        const allActiveCoupons = await Coupon.find({ isActive: true, expiryDate: { $gt: new Date() } });

        // Pre-fetch user-level past order count & coupon usages if user is logged in
        let userPastOrdersCount: number | undefined = undefined;
        const userCouponUsagesMap = new Map<string, number>();

        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const [pastOrders, usages] = await Promise.all([
                Order.countDocuments({ user: userId, orderStatus: { $ne: "cancelled" } }),
                CouponUsage.aggregate([
                    { $match: { user: new mongoose.Types.ObjectId(userId) } },
                    { $group: { _id: "$coupon", count: { $sum: 1 } } }
                ])
            ]);
            userPastOrdersCount = pastOrders;
            for (const item of usages) {
                if (item._id) {
                    userCouponUsagesMap.set(item._id.toString(), item.count || 0);
                }
            }
        }

        const applicable: any[] = [];
        const unapplicable: any[] = [];

        for (const coupon of allActiveCoupons) {
            const validation = await validateCoupon(
                coupon.code,
                userId,
                Number(subtotal || 0),
                zoneId,
                restaurantId,
                orderType,
                {
                    coupon,
                    userPastOrdersCount,
                    userCouponUsagesMap
                }
            );
            
            let resolvedDiscount = 0;
            if (coupon.discountType === "flat") {
                resolvedDiscount = Math.min(subtotal || 0, coupon.discountValue);
            } else if (coupon.discountType === "percentage") {
                const calc = (subtotal || 0) * (coupon.discountValue / 100);
                resolvedDiscount = coupon.maxDiscountAmount ? Math.min(calc, coupon.maxDiscountAmount) : calc;
            }

            const couponData = {
                _id: coupon._id,
                code: coupon.code,
                title: coupon.title,
                description: coupon.description,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                maxDiscountAmount: coupon.maxDiscountAmount,
                minOrderAmount: coupon.minOrderAmount,
                expiryDate: coupon.expiryDate,
                applicableFor: coupon.applicableFor || "both",
                isFirstOrderOnly: coupon.isFirstOrderOnly,
                isNewUserOnly: coupon.isNewUserOnly,
                estimatedDiscount: Math.round(resolvedDiscount)
            };

            if (validation.success) {
                applicable.push({
                    ...couponData,
                    message: validation.message
                });
            } else {
                unapplicable.push({
                    ...couponData,
                    reason: validation.message
                });
            }
        }

        // Sort applicable by highest discount value to recommend the absolute best coupon!
        applicable.sort((a, b) => b.estimatedDiscount - a.estimatedDiscount);

        res.status(200).json({
            success: true,
            applicable,
            unapplicable
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
