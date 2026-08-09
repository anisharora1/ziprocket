import express from "express";
import { getSettings, streamSettings, updateSettings } from "../controllers/platformSettingsController";
import { protect, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

// Public platform settings access
router.get("/settings", getSettings);
router.get("/settings/stream", streamSettings);

// Admin platform settings mutation
router.patch("/settings", protect, authorize("admin"), updateSettings);

export default router;
