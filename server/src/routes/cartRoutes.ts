import express from "express";
import { getCart, syncCart } from "../controllers/cartController";
import { protect } from "../middlewares/authMiddleware";

const router = express.Router();

router.get("/", protect, getCart);
router.post("/", protect, syncCart);

export default router;
