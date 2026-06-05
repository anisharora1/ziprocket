import express from "express";
import {
    createCoupon,
    getCoupons,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,
    getCouponAnalytics,
    validateAppliedCoupon,
    getAvailableCoupons
} from "../controllers/couponController";
import { protect, authorize } from "../middleware/authMiddleware";

const router = express.Router();

// User/Customer endpoints
router.post("/validate", validateAppliedCoupon);
router.post("/available", getAvailableCoupons);

// Protected Admin endpoints
router.get("/", protect, authorize("admin"), getCoupons);
router.post("/", protect, authorize("admin"), createCoupon);
router.get("/analytics", protect, authorize("admin"), getCouponAnalytics);
router.put("/:id", protect, authorize("admin"), updateCoupon);
router.delete("/:id", protect, authorize("admin"), deleteCoupon);
router.patch("/:id/toggle", protect, authorize("admin"), toggleCouponStatus);

export default router;
