import express from "express";
import { getMobileAppConfig } from "../controllers/themeCampaignController";

const router = express.Router();

router.get("/mobile", getMobileAppConfig);

export default router;
