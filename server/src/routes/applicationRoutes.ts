import express from "express";
import { applyRestaurant, applyDelivery } from "../controllers/applicationController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/restaurant", protect, applyRestaurant);
router.post("/delivery", protect, applyDelivery);

export default router;
