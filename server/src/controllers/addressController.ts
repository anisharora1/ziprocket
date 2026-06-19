import { Request as AuthenticatedRequest, Response } from "express";
import Address from "../models/Address";
import { findApplicableZone } from "../services/deliveryRadiusService";

// Get all saved addresses of the authenticated user
export const getMyAddresses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: "Unauthorized access" });
            return;
        }

        const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, updatedAt: -1 });
        res.status(200).json({ success: true, count: addresses.length, addresses });
    } catch (error: any) {
        console.error("Fetch saved addresses failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create and save a new delivery address
export const createAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: "Unauthorized access" });
            return;
        }

        const { label, location, deliveryAddress, isDefault } = req.body;

        // Resolve coordinates
        const lat = location?.lat !== undefined ? location.lat : req.body.lat;
        const lng = location?.lng !== undefined ? location.lng : req.body.lng;

        if (lat === undefined || lng === undefined) {
            res.status(400).json({ success: false, message: "Coordinates (lat/lng) are required" });
            return;
        }

        // Resolve deliveryAddress fields
        let houseNumber = deliveryAddress?.houseNumber || req.body.houseNumber || "";
        let street = deliveryAddress?.street || req.body.street || "";
        let locality = deliveryAddress?.locality || req.body.locality || req.body.fullAddress || "";
        let village = deliveryAddress?.village || req.body.village || req.body.city || "";
        let landmark = deliveryAddress?.landmark || req.body.landmark || "";
        let pincode = deliveryAddress?.pincode || req.body.pincode || "";
        let instructions = deliveryAddress?.instructions || req.body.instructions || "";

        // If they sent old flat fields but no nested deliveryAddress, we construct it:
        if (!houseNumber && req.body.fullAddress) {
            houseNumber = "N/A";
            locality = req.body.fullAddress;
            village = req.body.city || "Unknown";
            landmark = "N/A";
        }

        if (!houseNumber || !locality || !village || !landmark) {
            res.status(400).json({ success: false, message: "Required deliveryAddress fields (houseNumber, locality, village, landmark) are missing" });
            return;
        }

        // 1. Resolve Delivery Zone containment via deliveryRadiusService
        const applicableZone = await findApplicableZone(lat, lng, pincode);
        const resolvedZoneId = applicableZone ? applicableZone._id : undefined;

        // 2. Manage default address flag: if set to default, unset other defaults
        if (isDefault) {
            await Address.updateMany({ user: req.user._id }, { isDefault: false });
        }

        // 3. Create the address record
        const newAddress = new Address({
            user: req.user._id,
            label: label || "Home",
            location: { lat, lng },
            deliveryAddress: {
                houseNumber,
                street,
                locality,
                village,
                landmark,
                pincode,
                instructions
            },
            deliveryZone: resolvedZoneId,
            isDefault: isDefault || false
        });

        await newAddress.save();

        res.status(201).json({
            success: true,
            message: "Address saved successfully",
            address: newAddress
        });
    } catch (error: any) {
        console.error("Save address failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update an existing saved address
export const updateAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: "Unauthorized access" });
            return;
        }

        const { label, location, deliveryAddress, isDefault } = req.body;
        const addressId = req.params.id;

        const address = await Address.findOne({ _id: addressId, user: req.user._id });
        if (!address) {
            res.status(454).json({ success: false, message: "Address not found or unauthorized" });
            return;
        }

        // Resolve coordinates
        const lat = location?.lat !== undefined ? location.lat : req.body.lat;
        const lng = location?.lng !== undefined ? location.lng : req.body.lng;

        // Resolve geofence boundary zone if coordinates are updating
        let resolvedZoneId = address.deliveryZone;
        if (lat !== undefined && lng !== undefined) {
            const currentPin = deliveryAddress?.pincode || req.body.pincode || address.deliveryAddress?.pincode || address.pincode;
            const applicableZone = await findApplicableZone(lat, lng, currentPin);
            resolvedZoneId = applicableZone ? applicableZone._id as any : undefined;
        }

        if (isDefault) {
            await Address.updateMany({ user: req.user._id }, { isDefault: false });
        }

        address.label = label || address.label;
        if (lat !== undefined && lng !== undefined) {
            address.location = { lat, lng };
        }

        // Handle nested or flat address updates
        if (deliveryAddress || req.body.houseNumber || req.body.village || req.body.landmark || req.body.fullAddress) {
            const currentDeliv = address.deliveryAddress || {
                houseNumber: "N/A",
                street: "",
                locality: address.fullAddress || "",
                village: address.city || "Unknown",
                landmark: "N/A",
                pincode: address.pincode || "",
                instructions: ""
            };

            const mergedDeliv = {
                houseNumber: deliveryAddress?.houseNumber !== undefined ? deliveryAddress.houseNumber : (req.body.houseNumber !== undefined ? req.body.houseNumber : currentDeliv.houseNumber),
                street: deliveryAddress?.street !== undefined ? deliveryAddress.street : (req.body.street !== undefined ? req.body.street : currentDeliv.street),
                locality: deliveryAddress?.locality !== undefined ? deliveryAddress.locality : (req.body.locality !== undefined ? req.body.locality : (req.body.fullAddress !== undefined ? req.body.fullAddress : currentDeliv.locality)),
                village: deliveryAddress?.village !== undefined ? deliveryAddress.village : (req.body.village !== undefined ? req.body.village : (req.body.city !== undefined ? req.body.city : currentDeliv.village)),
                landmark: deliveryAddress?.landmark !== undefined ? deliveryAddress.landmark : (req.body.landmark !== undefined ? req.body.landmark : currentDeliv.landmark),
                pincode: deliveryAddress?.pincode !== undefined ? deliveryAddress.pincode : (req.body.pincode !== undefined ? req.body.pincode : currentDeliv.pincode),
                instructions: deliveryAddress?.instructions !== undefined ? deliveryAddress.instructions : (req.body.instructions !== undefined ? req.body.instructions : currentDeliv.instructions)
            };

            address.deliveryAddress = mergedDeliv;
        }

        address.deliveryZone = resolvedZoneId as any;
        address.isDefault = isDefault !== undefined ? isDefault : address.isDefault;

        await address.save();

        res.status(200).json({
            success: true,
            message: "Address updated successfully",
            address
        });
    } catch (error: any) {
        console.error("Update address failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a saved address
export const deleteAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: "Unauthorized access" });
            return;
        }

        const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        
        if (!address) {
            res.status(404).json({ success: false, message: "Address not found or unauthorized" });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Address removed successfully"
        });
    } catch (error: any) {
        console.error("Delete address failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Set address as primary default
export const setDefaultAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const addressId = req.params.id;

        // Unset defaults on other entries
        await Address.updateMany({ user: req.user._id }, { isDefault: false });

        const address = await Address.findOneAndUpdate(
            { _id: addressId, user: req.user._id },
            { isDefault: true },
            { new: true }
        );

        if (!address) {
            res.status(404).json({ success: false, message: "Address not found or unauthorized" });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Default address updated successfully",
            address
        });
    } catch (error: any) {
        console.error("Set default address failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
