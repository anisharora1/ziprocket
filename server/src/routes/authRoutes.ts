import express from "express";
import { requestOtp, verifyOtp } from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);

import User from "../models/User";

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

export default router;
