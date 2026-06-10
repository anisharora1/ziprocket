import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import admin from "../config/firebaseAdmin";
import * as otpCacheService from "../services/otpCacheService";
import * as sessionCacheService from "../services/sessionCacheService";

/**
 * Generate and store OTP in Redis for custom verification flow
 */
export const requestOtp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phone } = req.body;

        if (!phone || phone.length < 10) {
            res.status(400).json({ success: false, message: "Valid 10-digit phone number is required" });
            return;
        }

        const cleanPhone = phone.replace(/\D/g, "").slice(-10);

        // Check resend limits in Redis
        const resendLimitExceeded = await otpCacheService.isResendLimitExceeded(cleanPhone);
        if (resendLimitExceeded) {
            res.status(429).json({
                success: false,
                message: "OTP request limit exceeded. Please try again after an hour."
            });
            return;
        }

        // Generate 6-digit OTP code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP code in Redis (TTL: 5 mins)
        await otpCacheService.saveOtp(cleanPhone, otpCode);

        // Store client's IP and User-Agent metadata for verification check
        const metadata = {
            ip: req.ip || "unknown",
            userAgent: req.headers["user-agent"] || "unknown"
        };
        await otpCacheService.saveOtpMetadata(cleanPhone, metadata);

        // Increment resend counter
        await otpCacheService.incrementResendAttempts(cleanPhone);

        console.log(`[requestOtp] Generated OTP for +91${cleanPhone}: ${otpCode} (Expires in 5m)`);

        // Return OTP in response in development/test environment for easy client testing
        const isDev = process.env.NODE_ENV !== "production";

        res.status(200).json({
            success: true,
            message: "OTP generated successfully",
            otp: isDev ? otpCode : undefined
        });
    } catch (error: any) {
        console.error("requestOtp error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Verify OTP (Supports Firebase token verification and custom Redis OTP verification)
 */
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, phone, otp, role = "customer", name = "User" } = req.body;

        let cleanPhone10 = "";
        let firebaseUid = undefined;

        // 1. Dual Verification Check: Firebase Token vs Redis Custom OTP
        if (token) {
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

            firebaseUid = decodedToken.uid;
            const rawPhone = decodedToken.phone_number; // e.g. "+919117662441"

            if (!rawPhone) {
                res.status(400).json({ success: false, message: "Phone number not associated with this token" });
                return;
            }

            const cleanPhone = rawPhone.replace(/\D/g, "");
            cleanPhone10 = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
        } else if (phone && otp) {
            // Custom Redis OTP verification
            cleanPhone10 = phone.replace(/\D/g, "").slice(-10);

            // Check if attempts are blocked
            const isBlocked = await otpCacheService.isVerifyBlocked(cleanPhone10);
            if (isBlocked) {
                res.status(429).json({
                    success: false,
                    message: "Too many failed attempts. Verification blocked for 5 minutes."
                });
                return;
            }

            const cachedOtp = await otpCacheService.getOtp(cleanPhone10);

            if (!cachedOtp || cachedOtp !== otp) {
                await otpCacheService.incrementFailedAttempts(cleanPhone10);
                res.status(400).json({ success: false, message: "Invalid or expired OTP code" });
                return;
            }

            // Verify requesting vs verifying device metadata (IP and User-Agent)
            const metadata = await otpCacheService.getOtpMetadata(cleanPhone10);
            if (metadata) {
                const currentIp = req.ip || "unknown";
                const currentUA = req.headers["user-agent"] || "unknown";
                if (metadata.ip !== currentIp || metadata.userAgent !== currentUA) {
                    console.warn(
                        `[SECURITY WARNING] OTP verification device mismatch for phone +91${cleanPhone10}. ` +
                        `Request: { IP: ${metadata.ip}, UA: ${metadata.userAgent} }, ` +
                        `Verify: { IP: ${currentIp}, UA: ${currentUA} }`
                    );
                }
            }

            // OTP verified! Delete OTP to prevent reuse
            await otpCacheService.deleteOtp(cleanPhone10);
        } else {
            res.status(400).json({ success: false, message: "Either Firebase token or phone & otp are required" });
            return;
        }

        // 2. Resolve or Create User in MongoDB
        let user = await User.findOne({
            $or: [
                { phone: cleanPhone10 },
                { phone: `+91${cleanPhone10}` },
                { phone: `91${cleanPhone10}` }
            ]
        });

        if (!user) {
            user = new User({
                phone: cleanPhone10,
                name,
                role,
                firebaseUid,
                isPhoneVerified: true,
                approvalStatus: (role === "seller" || role === "delivery") ? "pending" : "approved"
            });
            await user.save();
            console.log(`[verifyOtp] Created new user: ${user.phone} with role: ${role}`);
        } else {
            let updated = false;
            if (firebaseUid && !user.firebaseUid) {
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

        // Admin override check
        if (user.phone === "9117662441") {
            if (user.role !== "admin" || user.approvalStatus !== "approved") {
                user.role = "admin";
                user.approvalStatus = "approved";
                await user.save();
            }
        }

        // Check Approval status
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

        // Invalidate old session cache to force reload on next API request
        await sessionCacheService.deleteSession(user._id.toString());

        // 3. Generate Custom JWT
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

/**
 * Logout User & Invalidate Redis Session
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?._id;
        if (userId) {
            await sessionCacheService.deleteSession(userId.toString());
            console.log(`[Logout] Cleared Redis session cache for user: ${userId}`);
        }
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
        console.error("logout error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

