import express from "express";
import { applyRestaurant, applyDelivery } from "../controllers/applicationController";
import { protect } from "../middlewares/authMiddleware";
import { uploadSingle } from "../middlewares/uploadMiddleware";

const router = express.Router();

router.post("/restaurant", protect, applyRestaurant);
router.post("/delivery", protect, uploadSingle("idProof"), applyDelivery);

export default router;
