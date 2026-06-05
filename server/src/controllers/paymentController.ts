import { Request, Response } from "express";
import {
    createRazorpayOrderSession,
    verifyRazorpayPayment,
    logPaymentCancellation
} from "../services/paymentService";

/**
 * Creates a Razorpay order from the backend
 */
export const createRazorpayOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            res.status(400).json({ success: false, message: "Order ID is required" });
            return;
        }

        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized access" });
            return;
        }

        const orderDetails = await createRazorpayOrderSession(orderId, userId);

        res.status(200).json({
            success: true,
            key: orderDetails.key,
            order: orderDetails.order,
            mongoOrderId: orderDetails.mongoOrderId
        });
    } catch (error: any) {
        console.error("Razorpay order creation failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Verifies Razorpay payment signatures securely on the backend
 */
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

        if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
            res.status(400).json({ success: false, message: "Missing required parameters for payment verification" });
            return;
        }

        const userId = req.user?._id?.toString() || "";
        const verificationResult = await verifyRazorpayPayment(
            orderId,
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature,
            userId
        );

        if (verificationResult.success) {
            res.status(200).json({
                success: true,
                message: "Payment verified successfully",
                order: verificationResult.order
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Cryptographic signature verification failed",
                order: verificationResult.order
            });
        }
    } catch (error: any) {
        console.error("Razorpay payment verification failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Explicitly logs user cancellations or client failures
 */
export const logPaymentFailure = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId, errorDetails } = req.body;

        if (!orderId) {
            res.status(400).json({ success: false, message: "Order ID is required" });
            return;
        }

        const userId = req.user?._id?.toString() || "";
        const cancellationResult = await logPaymentCancellation(orderId, errorDetails, userId);

        res.status(200).json({
            success: true,
            message: "Payment failure/cancellation logged successfully",
            order: cancellationResult.order
        });
    } catch (error: any) {
        console.error("Logging payment failure failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
