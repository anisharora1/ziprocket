import { Request, Response } from "express";
import DeliveryZone from "../models/DeliveryZone";
import Restaurant from "../models/Restaurant";
import MenuItem from "../models/MenuItem";
import { getRouteDistanceAndDuration } from "../utils/googleMaps";
import { validateCoupon } from "./couponController";
import { findApplicableZone } from "../services/deliveryRadiusService";
import * as zoneCacheService from "../services/zoneCacheService";
import * as redisService from "../services/redisService";
import { computeBillFromZone } from "../utils/billCalculator";
import { quoteDelivery } from "../services/deliveryQuoteService";
import PlatformSettings from "../models/PlatformSettings";
import { verifyItemPrices } from "../utils/itemVerification";
import { checkRestaurantAcceptingOrders } from "../utils/restaurantHours";

// --- CRUD OPERATIONS (For Admin Panel) ---

// Create a new Delivery Zone
export const createDeliveryZone = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            name, isActive, pincodes, center, radiusKm,
            baseDeliveryFee, baseDistanceKm, extraFeePerKm, minDeliveryFee, maxDeliveryFee, freeDeliveryThreshold,
            smallOrderThreshold, smallOrderFee, smallOrderFeeActive,
            platformFee, platformFeeActive, gstPercentage, gstActive,
            packagingCharge, packagingChargeActive, convenienceFee, convenienceFeeActive,
            surgeMultiplier, surgeActive
        } = req.body;

        if (maxDeliveryFee !== undefined && minDeliveryFee !== undefined && Number(maxDeliveryFee) < Number(minDeliveryFee)) {
            res.status(400).json({ success: false, message: "Maximum delivery cap cannot be lower than the minimum delivery cap." });
            return;
        }

        const newZone = new DeliveryZone({
            name, isActive, pincodes, center, radiusKm,
            baseDeliveryFee, baseDistanceKm, extraFeePerKm, minDeliveryFee, maxDeliveryFee, freeDeliveryThreshold,
            smallOrderThreshold, smallOrderFee, smallOrderFeeActive,
            platformFee, platformFeeActive, gstPercentage, gstActive,
            packagingCharge, packagingChargeActive, convenienceFee, convenienceFeeActive,
            surgeMultiplier, surgeActive
        });

        await newZone.save();

        // Invalidate zone caches
        await zoneCacheService.invalidateZoneCache();

        res.status(201).json({
            success: true,
            message: "Delivery zone created successfully",
            zone: newZone
        });
    } catch (error: any) {
        if (error.name === "ValidationError") {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all Delivery Zones
export const getAllDeliveryZones = async (req: Request, res: Response): Promise<void> => {
    try {
        const cachedZones = await zoneCacheService.getCachedAllZones();
        if (cachedZones) {
            console.log(`[Zone Cache] Hit for all zones`);
            res.status(200).json({
                success: true,
                count: cachedZones.length,
                zones: cachedZones
            });
            return;
        }

        const zones = await DeliveryZone.find();

        // Cache zones list in Redis
        await zoneCacheService.cacheAllZones(zones);

        res.status(200).json({
            success: true,
            count: zones.length,
            zones
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single Delivery Zone by ID
export const getDeliveryZoneById = async (req: Request, res: Response): Promise<void> => {
    try {
        const zone = await DeliveryZone.findById(req.params.id);

        if (!zone) {
            res.status(404).json({ success: false, message: "Delivery zone not found" });
            return;
        }

        res.status(200).json({
            success: true,
            zone
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update a Delivery Zone
export const updateDeliveryZone = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            name, isActive, pincodes, center, radiusKm,
            baseDeliveryFee, baseDistanceKm, extraFeePerKm, minDeliveryFee, maxDeliveryFee, freeDeliveryThreshold,
            smallOrderThreshold, smallOrderFee, smallOrderFeeActive,
            platformFee, platformFeeActive, gstPercentage, gstActive,
            packagingCharge, packagingChargeActive, convenienceFee, convenienceFeeActive,
            surgeMultiplier, surgeActive
        } = req.body;

        if (maxDeliveryFee !== undefined && minDeliveryFee !== undefined && Number(maxDeliveryFee) < Number(minDeliveryFee)) {
            res.status(400).json({ success: false, message: "Maximum delivery cap cannot be lower than the minimum delivery cap." });
            return;
        }

        const zone = await DeliveryZone.findByIdAndUpdate(
            req.params.id,
            {
                name, isActive, pincodes, center, radiusKm,
                baseDeliveryFee, baseDistanceKm, extraFeePerKm, minDeliveryFee, maxDeliveryFee, freeDeliveryThreshold,
                smallOrderThreshold, smallOrderFee, smallOrderFeeActive,
                platformFee, platformFeeActive, gstPercentage, gstActive,
                packagingCharge, packagingChargeActive, convenienceFee, convenienceFeeActive,
                surgeMultiplier, surgeActive
            },
            { new: true, runValidators: true }
        );

        if (!zone) {
            res.status(404).json({ success: false, message: "Delivery zone not found" });
            return;
        }

        // Invalidate zone caches
        await zoneCacheService.invalidateZoneCache();

        res.status(200).json({
            success: true,
            message: "Delivery zone updated successfully",
            zone
        });
    } catch (error: any) {
        if (error.name === "ValidationError") {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a Delivery Zone
export const deleteDeliveryZone = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurantCount = await Restaurant.countDocuments({ deliveryZone: req.params.id });
        if (restaurantCount > 0) {
            res.status(400).json({
                success: false,
                message: `Cannot delete this zone — ${restaurantCount} restaurant(s) are still assigned to it. Reassign or remove them first.`
            });
            return;
        }

        const zone = await DeliveryZone.findByIdAndDelete(req.params.id);

        if (!zone) {
            res.status(404).json({ success: false, message: "Delivery zone not found" });
            return;
        }

        // Invalidate zone caches
        await zoneCacheService.invalidateZoneCache();

        res.status(200).json({
            success: true,
            message: "Delivery zone deleted successfully"
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- LOGIC & CALCULATIONS (For Frontend Checkout/Validation) ---

// Endpoint to check if user is within radius and calculate dynamic delivery fee
export const checkDeliveryFeasibilityAndFee = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userLat, userLng, pincode, addressText, orderType = "food", items, restaurantId } = req.body;

        if (userLat === undefined || userLng === undefined || userLat === null || userLng === null) {
            res.status(400).json({ success: false, isDeliverable: false, reason: "invalid_location", message: "Please provide user latitude and longitude" });
            return;
        }

        const feasibilityRestaurantId = orderType === "food" ? (restaurantId || req.body.vendorId) : undefined;
        const quoteOrderType = orderType === "food" && !feasibilityRestaurantId ? "grocery" : orderType;

        const feasibilityKey = `zone:feasibility:${orderType}:${feasibilityRestaurantId || "area"}:${zoneCacheService.getServiceabilityKey(userLat, userLng, pincode, addressText)}`;
        const cachedFeasibility = await redisService.getJson<any>(feasibilityKey);
        if (cachedFeasibility && (!items || items.length === 0)) {
            console.log(`[Feasibility Cache] Hit for key: ${feasibilityKey}`);
            res.status(200).json(cachedFeasibility);
            return;
        }

        const quote = await quoteDelivery({
            orderType: quoteOrderType,
            restaurantId: feasibilityRestaurantId,
            destLat: userLat,
            destLng: userLng,
            pincode,
            addressText,
            forOrder: false
        });

        if (!quote.deliverable) {
            let message = "Sorry, you are currently outside our delivery service area.";
            if (quote.reason === "invalid_location") {
                message = "Please provide valid latitude and longitude.";
            } else if (quote.reason === "outside_zone") {
                message = "Sorry, you are currently outside our delivery service area.";
            } else if (quote.reason === "outside_radius") {
                message = "Location is outside the maximum delivery radius.";
            } else if (quote.reason === "restaurant_location_unverified") {
                message = "Restaurant location is unverified.";
            }

            const responsePayload = {
                success: true,
                isDeliverable: false,
                reason: quote.reason,
                message
            };
            await redisService.setJson(feasibilityKey, responsePayload, 600);
            res.status(200).json(responsePayload);
            return;
        }

        const applicableZone = quote.zone;
        const distanceKm = quote.distanceKm;
        const durationMinutes = quote.durationMinutes;

        // Calculate the dynamic fee based on route distance
        let totalDeliveryFee = applicableZone.baseDeliveryFee;
        if (distanceKm > applicableZone.baseDistanceKm) {
            const extraDistance = distanceKm - applicableZone.baseDistanceKm;
            totalDeliveryFee += (extraDistance * applicableZone.extraFeePerKm);
        }

        let deliveryFee = Math.min(applicableZone.maxDeliveryFee, Math.max(applicableZone.minDeliveryFee, totalDeliveryFee));
        deliveryFee = Math.ceil(deliveryFee);

        let prepBuffer = orderType === "grocery" ? 5 : 15; // existing default, unchanged fallback
        if (orderType === "food" && items?.length) {
            const menuItemIds = items.map((i: any) => i.menuItem || i._id || (typeof i.id === "string" ? i.id.replace("food-", "") : undefined)).filter(Boolean);
            const menuItemDocs = await MenuItem.find({ _id: { $in: menuItemIds } }, { prepTimeMinutes: 1 });
            if (menuItemDocs.length) {
                prepBuffer = Math.max(...menuItemDocs.map((m: any) => m.prepTimeMinutes || 15));
            }
        }

        const responsePayload = {
            success: true,
            isDeliverable: true,
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            durationMinutes: durationMinutes + prepBuffer, // Fulfillment Buffer (item-aware prep time or grocery packing)
            deliveryFee,
            zoneName: applicableZone.name,
            zoneId: applicableZone._id
        };

        // Cache the feasibility calculation for 10 minutes when no custom items passed
        if (!items || items.length === 0) {
            await redisService.setJson(feasibilityKey, responsePayload, 600);
        }

        res.status(200).json(responsePayload);

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Endpoint to calculate secure itemized dynamic checkout bill details
export const calculateBillDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const { vendorId, items, userLat, userLng, orderType = "food", pincode, address, couponCode, userId } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ success: false, message: "Cart items are required for calculation" });
            return;
        }

        const destLat = userLat !== undefined ? userLat : address?.lat;
        const destLng = userLng !== undefined ? userLng : address?.lng;
        const pin = pincode || (address && address.pincode);
        const addrText = address && (address.fullAddress || address.deliveryAddress?.locality);

        const quote = await quoteDelivery({
            orderType,
            restaurantId: orderType === "food" ? vendorId : undefined,
            destLat,
            destLng,
            pincode: pin,
            addressText: addrText,
            forOrder: true
        });

        if (!quote.deliverable) {
            let message = "Selected location lies outside our operational delivery limits. You won't be able to checkout.";
            if (quote.reason === "invalid_location") {
                message = "Please provide valid delivery coordinates.";
            } else if (quote.reason === "outside_zone") {
                message = "Selected location lies outside our operational delivery limits. You won't be able to checkout.";
            } else if (quote.reason === "outside_radius") {
                message = "Delivery address is outside the maximum delivery radius.";
            } else if (quote.reason === "restaurant_location_unverified") {
                message = "Restaurant location is unverified.";
            }

            res.status(200).json({ 
                success: true, 
                isDeliverable: false,
                reason: quote.reason,
                message 
            });
            return;
        }

        const activeZone = quote.zone;
        const distanceKm = quote.distanceKm;
        const durationMinutes = quote.durationMinutes;

        // Check restaurant status and availability for food orders
        if (orderType === "food" && vendorId && vendorId !== "grocery") {
            const rest = await Restaurant.findById(vendorId);
            const availability = checkRestaurantAcceptingOrders(rest);
            if (!availability.isAccepting) {
                res.status(400).json({ success: false, message: availability.message });
                return;
            }
        }

        // Calculate Subtotal (Item Total) via server-verified prices
        let itemTotal = 0;
        try {
            const verification = await verifyItemPrices(items, orderType, orderType === "food" ? vendorId : undefined);
            itemTotal = verification.verifiedItemTotal;
        } catch (verifErr: any) {
            res.status(400).json({ success: false, message: verifErr.message || "Failed to verify item prices." });
            return;
        }

        // Delivery Fee calculations, taxes, platform fees — all via shared utility
        const bill = computeBillFromZone(activeZone, itemTotal, distanceKm, orderType);

        // Surge charge for display (already factored into bill.deliveryFee)
        let surgeCharge = bill.surgeCharge;

        // Coupon validation & calculations
        let discountAmount = 0;
        let couponApplied = false;
        let couponError = undefined;

        if (couponCode) {
            const validation = await validateCoupon(
                couponCode, 
                userId, 
                itemTotal, 
                activeZone._id.toString(), 
                orderType === "food" ? vendorId : undefined,
                orderType
            );

            if (validation.success) {
                discountAmount = validation.discountAmount;
                couponApplied = true;
            } else {
                couponError = validation.message;
            }
        }

        // Apply coupon discount to the shared bill's grand total
        const grandTotal = Math.max(0, bill.grandTotal - discountAmount);

        let prepBuffer = orderType === "grocery" ? 5 : 15; // existing default, unchanged fallback
        if (orderType === "food" && items?.length) {
            const menuItemIds = items.map((i: any) => i.menuItem || i._id || (typeof i.id === "string" ? i.id.replace("food-", "") : undefined)).filter(Boolean);
            const menuItemDocs = await MenuItem.find({ _id: { $in: menuItemIds } }, { prepTimeMinutes: 1 });
            if (menuItemDocs.length) {
                prepBuffer = Math.max(...menuItemDocs.map((m: any) => m.prepTimeMinutes || 15));
            }
        }

        // Minimum order value validation
        const platformSettings = await PlatformSettings.findOne();
        const minOrderValue = orderType === "food" ? (platformSettings?.minOrderValueFood || 0) : (platformSettings?.minOrderValueGrocery || 0);
        const isBelowMinimum = itemTotal < minOrderValue;
        const amountNeededForMinOrder = isBelowMinimum ? minOrderValue - itemTotal : 0;

        res.status(200).json({
            success: true,
            zoneId: activeZone._id,
            zoneName: activeZone.name,
            itemTotal,
            deliveryFee: bill.deliveryFee,
            freeDeliveryThreshold: activeZone.freeDeliveryThreshold,
            smallOrderFee: bill.smallOrderFee,
            platformFee: bill.platformFee,
            packagingCharge: bill.packagingCharge,
            convenienceFee: bill.convenienceFee,
            gst: bill.gst,
            surgeCharge,
            discountAmount,
            couponApplied,
            couponError,
            grandTotal,
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            durationMinutes: durationMinutes + prepBuffer, // Culinary preparation / grocery packing + transit buffer
            minOrderValue,
            isBelowMinimum,
            amountNeededForMinOrder
        });

    } catch (error: any) {
        console.error("Dynamic bill calculations failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
