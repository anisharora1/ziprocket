import { Router } from "express";
import {
    getSegments,
    previewAudience,
    sendTest,
    createCampaign,
    getCampaigns,
    cancelCampaign
} from "../controllers/adminNotificationController";
import { protect, authorize } from "../middlewares/authMiddleware";
import { adminLimiter } from "../middlewares/rateLimitMiddleware";
import { validateObjectId } from "../middlewares/authSecurityMiddleware";

const router = Router();

// Apply admin protection, authorization, and rate limiting
router.use(protect);
router.use(authorize("admin"));
router.use(adminLimiter);

router.get("/segments", getSegments);
router.post("/audience-preview", previewAudience);
router.post("/send-test", sendTest);
router.post("/campaigns", createCampaign);
router.get("/campaigns", getCampaigns);
router.post("/campaigns/:id/cancel", validateObjectId(["id"]), cancelCampaign);

export default router;
