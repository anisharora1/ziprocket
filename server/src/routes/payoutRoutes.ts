import express from "express";
import {
    calculateWeeklyPayouts,
    getPayoutsSummary,
    updatePayoutStatus,
    getGroceryFinancialAnalytics
} from "../controllers/payoutController";
import { protect, authorize } from "../middleware/authMiddleware";

const router = express.Router();

// Administrative Payout & Settlements Routes (Admin only)
router.get("/payouts", protect, authorize("admin"), getPayoutsSummary);
router.post("/payouts/calculate", protect, authorize("admin"), calculateWeeklyPayouts);
router.patch("/payouts/:id/status", protect, authorize("admin"), updatePayoutStatus);
router.get("/payouts/grocery-analytics", protect, authorize("admin"), getGroceryFinancialAnalytics);

export default router;
