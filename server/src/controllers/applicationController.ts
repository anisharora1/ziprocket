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
        const { fullName, phone, address, vehicleType, vehicleNumber, idProofString, email, city, aadhaarNumber, licenseNumber, panNumber, accountNumber, ifscCode, deliveryZone } = req.body;
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

        let proofUrl = idProofString || "";
        let proofPublicId = "";

        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, "users");
                proofUrl = uploadResult.url;
                proofPublicId = uploadResult.publicId;
            } catch (uploadError) {
                console.error("Cloudinary KYC upload failed:", uploadError);
                res.status(500).json({ success: false, message: "Failed to upload KYC document image." });
                return;
            }
        } else if (!idProofString) {
            res.status(400).json({ success: false, message: "KYC ID proof image file is required." });
            return;
        }

        const newProfile = new DeliveryProfile({
            user: userId,
            fullName,
            phone,
            address: address || city, // Fallback if address is missing but city is provided
            vehicleType,
            vehicleNumber: vehicleNumber || "N/A", // vehicleNumber isn't in frontend form state yet
            idProofString: proofUrl,
            idProofPublicId: proofPublicId,
            email,
            city,
            aadhaarNumber,
            licenseNumber,
            panNumber,
            bankDetails: {
                accountNumber,
                ifscCode
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
