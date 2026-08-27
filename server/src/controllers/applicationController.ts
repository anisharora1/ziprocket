import { Request, Response } from "express";
import Restaurant from "../models/Restaurant";
import DeliveryProfile from "../models/DeliveryProfile";
import { uploadToCloudinary } from "../services/cloudinaryService";
import * as restaurantCacheService from "../services/restaurantCacheService";
import { getForwardGeocode } from "../utils/googleMaps";

export const applyRestaurant = async (req: Request, res: Response): Promise<void> => {
    try {
        const { restaurantName, address, ownerName, phone, cuisines, fssaiNumber, panNumber, gstNumber, accountNumber, ifscCode, deliveryZone } = req.body;
        const userId = (req as any).user?.id; // Assuming auth middleware sets this

        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        // Check if application already exists
        const existing = await Restaurant.findOne({ owner: userId });
        if (existing) {
            res.status(400).json({ success: false, message: "Application already submitted." });
            return;
        }

        const geocodeResult = await getForwardGeocode(address);
        if (!geocodeResult) {
            res.status(400).json({
                success: false,
                message: "We couldn't locate this address on the map. Please provide a more specific address (nearby landmark, area, pincode) and try again."
            });
            return;
        }

        const newRestaurant = new Restaurant({
            name: restaurantName,
            owner: userId,
            phone,
            location: {
                address: geocodeResult.formattedAddress || address,
                lat: geocodeResult.lat,
                lng: geocodeResult.lng
            },
            ownerName,
            cuisines,
            fssaiNumber,
            panNumber,
            gstNumber,
            bankDetails: {
                accountNumber,
                ifscCode
            },
            status: "pending",
            deliveryZone: (deliveryZone && String(deliveryZone).trim() !== "") ? deliveryZone : undefined
        });

        await newRestaurant.save();
        await restaurantCacheService.invalidateRestaurantCache();

        res.status(201).json({ success: true, message: "Restaurant application submitted successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const applyDelivery = async (req: Request, res: Response): Promise<void> => {
    try {
        const { fullName, phone, address, vehicleType, vehicleNumber, email, city, aadhaarNumber, licenseNumber, panNumber, accountNumber, ifscCode, deliveryZone } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const existing = await DeliveryProfile.findOne({ user: userId });
        if (existing) {
            res.status(400).json({ success: false, message: "Application already submitted." });
            return;
        }

        if (!req.file) {
            res.status(400).json({ success: false, message: "A valid KYC ID proof document image is required." });
            return;
        }

        // Format validation
        const AADHAAR_REGEX = /^\d{12}$/;
        const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        const PHONE_REGEX = /^[6-9]\d{9}$/;

        if (aadhaarNumber && !AADHAAR_REGEX.test(aadhaarNumber)) {
            res.status(400).json({ success: false, message: "Aadhaar number must be exactly 12 digits." });
            return;
        }
        if (panNumber && !PAN_REGEX.test(panNumber.toUpperCase())) {
            res.status(400).json({ success: false, message: "Please enter a valid PAN number (e.g. ABCDE1234F)." });
            return;
        }
        if (ifscCode && !IFSC_REGEX.test(ifscCode.toUpperCase())) {
            res.status(400).json({ success: false, message: "Please enter a valid IFSC code (e.g. SBIN0001234)." });
            return;
        }
        if (phone && !PHONE_REGEX.test(phone)) {
            res.status(400).json({ success: false, message: "Please enter a valid 10-digit Indian mobile number." });
            return;
        }
        if (accountNumber && !/^\d{9,18}$/.test(accountNumber)) {
            res.status(400).json({ success: false, message: "Please enter a valid bank account number." });
            return;
        }
        if (!vehicleNumber) {
            res.status(400).json({ success: false, message: "Vehicle registration number is required." });
            return;
        }

        const normalizedPan = panNumber ? panNumber.toUpperCase() : "";
        const normalizedIfsc = ifscCode ? ifscCode.toUpperCase() : "";

        // Duplicate-identity detection across different accounts
        if (aadhaarNumber) {
            const duplicateAadhaar = await DeliveryProfile.findOne({ aadhaarNumber, user: { $ne: userId } });
            if (duplicateAadhaar) {
                res.status(400).json({ success: false, message: "This Aadhaar number is already associated with another account." });
                return;
            }
        }
        if (normalizedPan) {
            const duplicatePan = await DeliveryProfile.findOne({ panNumber: normalizedPan, user: { $ne: userId } });
            if (duplicatePan) {
                res.status(400).json({ success: false, message: "This PAN number is already associated with another account." });
                return;
            }
        }

        let proofUrl = "";
        let proofPublicId = "";
        try {
            const uploadResult = await uploadToCloudinary(req.file.buffer, "users");
            proofUrl = uploadResult.url;
            proofPublicId = uploadResult.publicId;
        } catch (uploadError) {
            console.error("Cloudinary KYC upload failed:", uploadError);
            res.status(500).json({ success: false, message: "Failed to upload KYC document image." });
            return;
        }

        const newProfile = new DeliveryProfile({
            user: userId,
            fullName,
            phone,
            address: address || city,
            vehicleType,
            vehicleNumber,
            idProofString: proofUrl,
            idProofPublicId: proofPublicId,
            email,
            city,
            aadhaarNumber,
            licenseNumber,
            panNumber: normalizedPan,
            bankDetails: {
                accountNumber,
                ifscCode: normalizedIfsc
            },
            status: "pending",
            deliveryZone: (deliveryZone && String(deliveryZone).trim() !== "") ? deliveryZone : undefined
        });

        await newProfile.save();

        res.status(201).json({ success: true, message: "Delivery application submitted successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
