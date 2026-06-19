import express from "express";
import { requestOtp, verifyOtp, logout, refreshToken } from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";
import { uploadSingle } from "../middleware/uploadMiddleware";
import { uploadToCloudinary, deleteFromCloudinary } from "../services/cloudinaryService";
import User from "../models/User";
import { otpRequestLimiter, otpVerificationLimiter } from "../middlewares/otpRateLimitMiddleware";
import { loginLimiter } from "../middlewares/rateLimitMiddleware";

const router = express.Router();

router.post("/request-otp", otpRequestLimiter, requestOtp);
router.post("/verify-otp", otpVerificationLimiter, loginLimiter, verifyOtp);
router.post("/logout", protect, logout);
router.post("/refresh", protect, refreshToken);

// Protected route to get user profile details
router.get("/me", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user?._id).populate("assignedZones", "name center radiusKm pincodes");
        res.status(200).json({
            success: true,
            user
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Protected route to update profile photo
router.put("/profile/photo", protect, uploadSingle("photo"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: "Photo file is required" });
            return;
        }

        const user = await User.findById(req.user?._id);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        // Delete old profile photo if it exists
        if (user.profilePhoto?.publicId) {
            await deleteFromCloudinary(user.profilePhoto.publicId);
        }

        // Upload new photo to Cloudinary under the 'users' folder
        const uploadResult = await uploadToCloudinary(req.file.buffer, "users");

        user.profilePhoto = uploadResult;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile photo updated successfully",
            user
        });
    } catch (error: any) {
        console.error("Profile photo upload failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
