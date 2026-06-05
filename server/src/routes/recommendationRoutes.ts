import express from "express";
import { getCartRecommendations } from "../controllers/recommendationController";

const router = express.Router();

router.post("/", getCartRecommendations);

export default router;
