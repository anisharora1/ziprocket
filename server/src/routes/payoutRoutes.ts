import express from "express";
import {
    calculateSettlements,
    getPayoutsSummary,
    updatePayoutStatus,
    getMyPayouts,
    getGroceryFinancialAnalytics
} from "../controllers/payoutController";
import { protect, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

// Restaurant Partner Route (Seller only)
router.get("/my-payouts", protect, authorize("seller"), getMyPayouts);

// Administrative Payout & Settlements Routes (Admin only)
router.get("/", protect, authorize("admin"), getPayoutsSummary);
router.post("/calculate", protect, authorize("admin"), calculateSettlements);
router.patch("/:id/status", protect, authorize("admin"), updatePayoutStatus);
router.get("/grocery-analytics", protect, authorize("admin"), getGroceryFinancialAnalytics);

export default router;
