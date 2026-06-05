import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import admin from "../config/firebaseAdmin";

// requestOtp is no longer needed but kept for backward compatibility and as a clean placeholder
export const requestOtp = async (req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({ 
            success: true, 
            message: "Please use Firebase Phone Authentication on the client side directly."
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, role = "customer", name = "User" } = req.body;

        if (!token) {
            res.status(400).json({ success: false, message: "Firebase ID Token is required" });
            return;
        }

        // Verify Firebase ID Token using Firebase Admin SDK
        let decodedToken: any;
        if (process.env.NODE_ENV !== "production" && typeof token === "string" && token.startsWith("mock-")) {
            const mockPhone = token.replace("mock-", "");
            const formattedPhone = mockPhone.startsWith("+") ? mockPhone : `+91${mockPhone}`;
            decodedToken = {
                uid: `mock-uid-${mockPhone}`,
                phone_number: formattedPhone
            };
            console.log(`[verifyOtp] Dev Bypass: Using mock user: ${decodedToken.uid}, Phone: ${decodedToken.phone_number}`);
        } else {
            try {
                decodedToken = await admin.auth().verifyIdToken(token);
            } catch (authError: any) {
                console.error("Firebase token verification failed:", authError);
                res.status(401).json({ success: false, message: "Invalid or expired Firebase token" });
                return;
            }
        }

        const firebaseUid = decodedToken.uid;
        const rawPhone = decodedToken.phone_number; // e.g. "+919117662441"

        if (!rawPhone) {
            res.status(400).json({ success: false, message: "Phone number not associated with this token" });
            return;
        }

        console.log(`[verifyOtp] Verified Firebase user: ${firebaseUid}, Phone: ${rawPhone}`);

        // Standardize phone number formatting to search the database robustly
        const cleanPhone = rawPhone.replace(/\D/g, ""); // "919117662441"
        const phone10Digit = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone; // last 10 digits e.g. "9117662441"

        // Find user by phone number in MongoDB (check all formats to be safe)
        let user = await User.findOne({
            $or: [
                { phone: rawPhone },
                { phone: cleanPhone },
                { phone: phone10Digit }
            ]
        });

        if (!user) {
            // Create user if not found
            user = new User({
                phone: phone10Digit, // Save 10-digit version as the primary identifier to match legacy data
                name,
                role,
                firebaseUid,
                isPhoneVerified: true,
                approvalStatus: (role === "seller" || role === "delivery") ? "pending" : "approved"
            });
            await user.save();
            console.log(`[verifyOtp] Created new user: ${user.phone} with role: ${role}`);
        } else {
            // Login user if already exists, update firebaseUid and verified status if missing
            let updated = false;
            if (!user.firebaseUid) {
                user.firebaseUid = firebaseUid;
                updated = true;
            }
            if (!user.isPhoneVerified) {
                user.isPhoneVerified = true;
                updated = true;
            }
            if (updated) {
                await user.save();
            }
            console.log(`[verifyOtp] Found existing user: ${user.phone}, role: ${user.role}`);
        }

        // --- ADMIN OVERRIDE ---
        if (user.phone === "9117662441") {
            if (user.role !== "admin" || user.approvalStatus !== "approved") {
                user.role = "admin";
                user.approvalStatus = "approved";
                await user.save();
            }
        }

        // Check Admin Approval for Sellers and Delivery Boys
        if (user.role === "seller" || user.role === "delivery") {
            if (user.approvalStatus === "pending") {
                res.status(403).json({ 
                    success: false, 
                    message: "Your application is currently pending admin approval. We will notify you once approved!" 
                });
                return;
            } else if (user.approvalStatus === "rejected") {
                res.status(403).json({ 
                    success: false, 
                    message: "Your application has been rejected. Please contact support for more details." 
                });
                return;
            }
        }

        // Generate custom JWT
        const jwtToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || "fallback_secret",
            { expiresIn: "30d" }
        );

        res.status(200).json({
            success: true,
            message: "User authenticated successfully",
            token: jwtToken,
            user: {
                _id: user._id,
                name: user.name,
                phone: user.phone,
                role: user.role
            }
        });

    } catch (error: any) {
        console.error("verifyOtp error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
