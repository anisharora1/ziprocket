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

        const { label, fullAddress, pincode, city, state, country, lat, lng, isDefault } = req.body;

        if (!fullAddress || !pincode || !city || !state || lat === undefined || lng === undefined) {
            res.status(400).json({ success: false, message: "Required address details are missing" });
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
            fullAddress,
            pincode,
            city,
            state,
            country: country || "India",
            location: { lat, lng },
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

        const { label, fullAddress, pincode, city, state, country, lat, lng, isDefault } = req.body;
        const addressId = req.params.id;

        const address = await Address.findOne({ _id: addressId, user: req.user._id });
        if (!address) {
            res.status(404).json({ success: false, message: "Address not found or unauthorized" });
            return;
        }

        // Resolve geofence boundary zone if coordinates are updating
        let resolvedZoneId = address.deliveryZone;
        if (lat !== undefined && lng !== undefined) {
            const applicableZone = await findApplicableZone(lat, lng, pincode || address.pincode);
            resolvedZoneId = applicableZone ? applicableZone._id as any : undefined;
        }

        if (isDefault) {
            await Address.updateMany({ user: req.user._id }, { isDefault: false });
        }

        address.label = label || address.label;
        address.fullAddress = fullAddress || address.fullAddress;
        address.pincode = pincode || address.pincode;
        address.city = city || address.city;
        address.state = state || address.state;
        address.country = country || address.country;
        if (lat !== undefined && lng !== undefined) {
            address.location = { lat, lng };
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
