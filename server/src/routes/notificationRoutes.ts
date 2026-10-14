import { Router } from "express";
import { registerDevice, unlinkUser, updatePreferences, trackOpened } from "../controllers/notificationController";
import { optionalAuth } from "../middlewares/optionalAuthMiddleware";
import { protect } from "../middlewares/authMiddleware";
import { notificationLimiter } from "../middlewares/rateLimitMiddleware";

const router = Router();

// Customer-facing notification endpoints
router.post("/register-device", notificationLimiter, optionalAuth, registerDevice);
router.post("/unlink-user", notificationLimiter, unlinkUser);
router.put("/preferences", protect, updatePreferences);
router.post("/opened", notificationLimiter, trackOpened);

export default router;
