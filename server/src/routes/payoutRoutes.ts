import express from "express";
import {
    calculateWeeklyPayouts,
    getPayoutsSummary,
    updatePayoutStatus,
    getGroceryFinancialAnalytics
} from "../controllers/payoutController";
import { protect, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

// Administrative Payout & Settlements Routes (Admin only)
router.get("/", protect, authorize("admin"), getPayoutsSummary);
router.post("/calculate", protect, authorize("admin"), calculateWeeklyPayouts);
router.patch("/:id/status", protect, authorize("admin"), updatePayoutStatus);
router.get("/grocery-analytics", protect, authorize("admin"), getGroceryFinancialAnalytics);

export default router;
