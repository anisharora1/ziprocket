import { Request, Response } from "express";
import DeliveryZone from "../models/DeliveryZone";
import Restaurant from "../models/Restaurant";
import { getRouteDistanceAndDuration } from "../utils/googleMaps";
import { validateCoupon } from "./couponController";
import { findApplicableZone } from "../services/deliveryRadiusService";

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

        const newZone = new DeliveryZone({
            name, isActive, pincodes, center, radiusKm,
            baseDeliveryFee, baseDistanceKm, extraFeePerKm, minDeliveryFee, maxDeliveryFee, freeDeliveryThreshold,
            smallOrderThreshold, smallOrderFee, smallOrderFeeActive,
            platformFee, platformFeeActive, gstPercentage, gstActive,
            packagingCharge, packagingChargeActive, convenienceFee, convenienceFeeActive,
            surgeMultiplier, surgeActive
        });

        await newZone.save();

        res.status(201).json({
            success: true,
            message: "Delivery zone created successfully",
            zone: newZone
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all Delivery Zones
export const getAllDeliveryZones = async (req: Request, res: Response): Promise<void> => {
    try {
        const zones = await DeliveryZone.find();

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

        res.status(200).json({
            success: true,
            message: "Delivery zone updated successfully",
            zone
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a Delivery Zone
export const deleteDeliveryZone = async (req: Request, res: Response): Promise<void> => {
    try {
        const zone = await DeliveryZone.findByIdAndDelete(req.params.id);

        if (!zone) {
            res.status(404).json({ success: false, message: "Delivery zone not found" });
            return;
        }

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
        const { userLat, userLng, pincode, addressText } = req.body;

        if (!userLat || !userLng) {
            res.status(400).json({ success: false, message: "Please provide user latitude and longitude" });
            return;
        }

        // 1. Resolve closest active zone via deliveryRadiusService
        const applicableZone = await findApplicableZone(userLat, userLng, pincode, addressText);

        if (!applicableZone) {
            res.status(400).json({ 
                success: false, 
                message: "Sorry, you are currently outside our delivery service area." 
            });
            return;
        }

        // 2. Query route-based distance using Google Distance Matrix
        const routeMetrics = await getRouteDistanceAndDuration(
            applicableZone.center.lat,
            applicableZone.center.lng,
            userLat,
            userLng
        );

        const distanceKm = routeMetrics.distanceKm;
        const durationMinutes = routeMetrics.durationMinutes;

        // Calculate the dynamic fee based on route distance
        let totalDeliveryFee = applicableZone.baseDeliveryFee;

        // If distance exceeds the base distance, add the extra per-km fee
        if (distanceKm > applicableZone.baseDistanceKm) {
            const extraDistance = distanceKm - applicableZone.baseDistanceKm;
            totalDeliveryFee += (extraDistance * applicableZone.extraFeePerKm);
        }

        // Clamp within min & max caps
        let deliveryFee = Math.min(applicableZone.maxDeliveryFee, Math.max(applicableZone.minDeliveryFee, totalDeliveryFee));
        deliveryFee = Math.ceil(deliveryFee);

        res.status(200).json({
            success: true,
            isDeliverable: true,
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            durationMinutes: durationMinutes + 10, // Fulfillment Buffer
            deliveryFee,
            zoneName: applicableZone.name,
            zoneId: applicableZone._id
        });

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

        // Find applicable operating DeliveryZone via deliveryRadiusService
        const zones = await DeliveryZone.find({ isActive: true });
        if (zones.length === 0) {
            res.status(400).json({ success: false, message: "No active delivery zones available right now." });
            return;
        }

        let activeZone = await findApplicableZone(
            userLat,
            userLng,
            pincode || (address && address.pincode),
            address && address.fullAddress
        );
        
        if (!activeZone) {
            res.status(400).json({ 
                success: false, 
                message: "Selected location lies outside our operational delivery limits. You won't be able to checkout." 
            });
            return;
        }

        // Calculate Subtotal (Item Total)
        const itemTotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

        // 4. Resolve vendor coordinates to compute route distance
        let distanceKm = 2.5; 
        let durationMinutes = 10;

        if (userLat && userLng && activeZone) {
            let originLat = activeZone.center.lat;
            let originLng = activeZone.center.lng;

            if (orderType === "food" && vendorId && vendorId !== "grocery") {
                const rest = await Restaurant.findById(vendorId);
                if (rest && rest.location && rest.location.lat !== undefined && rest.location.lng !== undefined) {
                    originLat = rest.location.lat;
                    originLng = rest.location.lng;
                }
            }

            const routeMetrics = await getRouteDistanceAndDuration(originLat, originLng, userLat, userLng);
            distanceKm = routeMetrics.distanceKm;
            durationMinutes = routeMetrics.durationMinutes;
        }

        // Delivery Fee calculations based on resolved zone's profile parameters
        let rawDeliveryFee = activeZone.baseDeliveryFee;
        if (distanceKm > activeZone.baseDistanceKm) {
            const extraDistance = distanceKm - activeZone.baseDistanceKm;
            rawDeliveryFee += extraDistance * activeZone.extraFeePerKm;
        }

        // Clamp raw fee within min & max caps
        let deliveryFee = Math.min(activeZone.maxDeliveryFee, Math.max(activeZone.minDeliveryFee, rawDeliveryFee));
        deliveryFee = Math.ceil(deliveryFee);

        // Apply free delivery threshold
        if (itemTotal >= activeZone.freeDeliveryThreshold) {
            deliveryFee = 0;
        }

        // Small Order Handling Fee
        let smallOrderFee = 0;
        if (itemTotal > 0 && itemTotal < activeZone.smallOrderThreshold && activeZone.smallOrderFeeActive) {
            smallOrderFee = activeZone.smallOrderFee;
        }

        // Surge pricing multiplier
        let surgeCharge = 0;
        if (activeZone.surgeActive && activeZone.surgeMultiplier > 1.0) {
            surgeCharge = Math.ceil(deliveryFee * (activeZone.surgeMultiplier - 1.0));
            deliveryFee = Math.ceil(deliveryFee * activeZone.surgeMultiplier);
        }

        // Platform fee
        const platformFee = activeZone.platformFeeActive ? activeZone.platformFee : 0;

        // Packaging charge
        const packagingCharge = activeZone.packagingChargeActive ? activeZone.packagingCharge : 0;

        // Convenience fee
        const convenienceFee = activeZone.convenienceFeeActive ? activeZone.convenienceFee : 0;

        // GST calculation
        let gst = 0;
        if (activeZone.gstActive) {
            gst = Math.round(itemTotal * (activeZone.gstPercentage / 100));
        }

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

        // Compute Grand Total
        const grandTotal = Math.max(0, itemTotal - discountAmount + deliveryFee + smallOrderFee + platformFee + packagingCharge + convenienceFee + gst);

        res.status(200).json({
            success: true,
            zoneId: activeZone._id,
            zoneName: activeZone.name,
            itemTotal,
            deliveryFee,
            smallOrderFee,
            platformFee,
            packagingCharge,
            convenienceFee,
            gst,
            surgeCharge,
            discountAmount,
            couponApplied,
            couponError,
            grandTotal,
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            durationMinutes: durationMinutes + 15 // Culinary preparation + transit buffer
        });

    } catch (error: any) {
        console.error("Dynamic bill calculations failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
