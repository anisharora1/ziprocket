import express from "express";
import {
    createRazorpayOrder,
    verifyPayment,
    logPaymentFailure
} from "../controllers/paymentController";
import { protect, authorize } from "../middleware/authMiddleware";

const router = express.Router();

// All payment endpoints are protected and accessible by authenticated customers/admins
router.post("/create", protect, authorize("customer", "admin"), createRazorpayOrder);
router.post("/verify", protect, authorize("customer", "admin"), verifyPayment);
router.post("/failure", protect, authorize("customer", "admin"), logPaymentFailure);

export default router;
