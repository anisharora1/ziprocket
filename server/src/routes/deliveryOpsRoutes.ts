import { Router } from "express";
import { protect, authorize } from "../middlewares/authMiddleware";
import {
    submitCashSettlement,
    getMySettlements,
    reviewCashSettlement,
    getPendingSettlements,
    getDeliveryOpsSummary,
    getMonthlyDistanceReport
} from "../controllers/deliveryOpsController";

const router = Router();

router.post("/settlements", protect, authorize("delivery"), submitCashSettlement);
router.get("/settlements/my", protect, authorize("delivery"), getMySettlements);
router.get("/settlements/pending", protect, authorize("admin"), getPendingSettlements);
router.patch("/settlements/:id/review", protect, authorize("admin"), reviewCashSettlement);
router.get("/ops-summary", protect, authorize("admin"), getDeliveryOpsSummary);
router.get("/distance-report", protect, authorize("admin"), getMonthlyDistanceReport);

export default router;
