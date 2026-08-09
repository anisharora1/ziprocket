import express from "express";
import {
    createRazorpayOrder,
    verifyPayment,
    logPaymentFailure
} from "../controllers/paymentController";
import { protect, authorize } from "../middlewares/authMiddleware";
import { paymentLimiter } from "../middlewares/rateLimitMiddleware";

const router = express.Router();

// Apply payment rate limiters globally to payment routes
router.use(paymentLimiter);

// All payment endpoints are protected and accessible by authenticated customers/admins
router.post("/create", protect, authorize("customer", "admin"), createRazorpayOrder);
router.post("/verify", protect, authorize("customer", "admin"), verifyPayment);
router.post("/failure", protect, authorize("customer", "admin"), logPaymentFailure);

export default router;
