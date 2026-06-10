import express from "express";
import { getPublicPromotions } from "../controllers/adminController";

const router = express.Router();

router.get("/", getPublicPromotions);

export default router;
