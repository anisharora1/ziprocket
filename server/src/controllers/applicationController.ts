import { Request, Response } from "express";
import Restaurant from "../models/Restaurant";
import DeliveryProfile from "../models/DeliveryProfile";

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

        const newRestaurant = new Restaurant({
            name: restaurantName,
            owner: userId,
            phone,
            location: {
                address,
                lat: 0,
                lng: 0
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
            deliveryZone
        });

        await newRestaurant.save();

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

        const newProfile = new DeliveryProfile({
            user: userId,
            fullName,
            phone,
            address: address || city, // Fallback if address is missing but city is provided
            vehicleType,
            vehicleNumber: vehicleNumber || "N/A", // vehicleNumber isn't in frontend form state yet
            idProofString,
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
            deliveryZone
        });

        await newProfile.save();

        res.status(201).json({ success: true, message: "Delivery application submitted successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
