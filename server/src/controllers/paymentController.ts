import { Request, Response } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import PaymentIntent from "../models/PaymentIntent";
import { validateAndPriceOrder, finalizeOrderPlacement } from "../utils/orderValidation";
import {
    createRazorpayOrderSession,
    verifyRazorpayPayment as verifyLegacyPayment,
    logPaymentCancellation
} from "../services/paymentService";

const getRazorpayInstance = () => {
    return new Razorpay({
        key_id: process.env.Test_PAYMENT_API_KEY || process.env.RAZORPAY_KEY_ID || "",
        key_secret: process.env.Test_PAYMENT_SECRET_KEY || process.env.RAZORPAY_KEY_SECRET || ""
    });
};

/**
 * Creates a PaymentIntent and a Razorpay Order session without creating an Order document.
 * The order is only created once payment is verified successfully.
 */
export const createPaymentIntent = async (req: Request, res: Response): Promise<void> => {
    try {
        const { items, orderType = "food", restaurant, address, phone, couponCode, whatsappOrder } = req.body;
        const userId = req.user?._id?.toString() || req.body.user;

        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized access" });
            return;
        }

        // Shared server-side validation & pricing engine
        const validation = await validateAndPriceOrder({
            items,
            orderType,
            restaurant,
            address,
            phone,
            couponCode,
            userId,
            whatsappOrder
        });

        if (!validation.success) {
            res.status(400).json({ success: false, message: validation.message });
            return;
        }

        const {
            verifiedItems,
            verifiedItemTotal,
            verifiedTotal,
            verifiedBill,
            deliveryFee,
            applicableZone,
            calculatedDistance,
            discountAmount,
            assignedModerator,
            formattedDeliveryAddress,
            couponDoc
        } = validation;

        const apiKey = process.env.Test_PAYMENT_API_KEY || process.env.RAZORPAY_KEY_ID || "";
        const apiSecret = process.env.Test_PAYMENT_SECRET_KEY || process.env.RAZORPAY_KEY_SECRET || "";

        const razorpay = new Razorpay({ key_id: apiKey, key_secret: apiSecret });
        const rzpOrder = await razorpay.orders.create({
            amount: Math.round(verifiedTotal! * 100),
            currency: "INR",
            receipt: `intent_${Date.now()}`
        });

        await PaymentIntent.create({
            razorpayOrderId: rzpOrder.id,
            user: userId,
            verifiedTotal: verifiedTotal!,
            orderPayload: {
                user: userId,
                restaurant: orderType === "food" ? restaurant : undefined,
                orderType,
                phone,
                couponCode,
                couponDoc,
                items: verifiedItems,
                itemTotal: verifiedItemTotal,
                address: {
                    fullAddress: address.fullAddress,
                    lat: address.lat,
                    lng: address.lng,
                    locationSource: address.locationSource === "gps" ? "gps" : "manual",
                    deliveryAddress: formattedDeliveryAddress
                },
                deliveryCharge: deliveryFee,
                totalAmount: verifiedTotal,
                grandTotalBeforeDiscount: verifiedBill?.grandTotal,
                discountAmount,
                distance: calculatedDistance,
                deliveryZone: applicableZone?._id,
                moderator: assignedModerator,
                whatsappOrder: !!whatsappOrder,
                paymentMethod: "ONLINE"
            }
        });

        res.status(200).json({
            success: true,
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key: apiKey
        });
    } catch (error: any) {
        console.error("Payment intent creation failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Verifies Razorpay payment and creates the real Order document.
 * This is the ONLY place an online order gets created.
 */
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

        // Support legacy verification fallback if orderId is explicitly passed
        if (orderId && !razorpayOrderId) {
            const userId = req.user?._id?.toString() || "";
            const verificationResult = await verifyLegacyPayment(
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
            return;
        }

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            res.status(400).json({ success: false, message: "Payment verify karne ke liye zaroori details missing hain." });
            return;
        }

        const intent = await PaymentIntent.findOne({ razorpayOrderId, used: false });
        if (!intent) {
            res.status(400).json({
                success: false,
                message: "Yeh payment session expire ho chuka hai ya use ho gaya hai. Kripya dobara try karein."
            });
            return;
        }

        const apiKey = process.env.Test_PAYMENT_API_KEY || process.env.RAZORPAY_KEY_ID || "";
        const apiSecret = process.env.Test_PAYMENT_SECRET_KEY || process.env.RAZORPAY_KEY_SECRET || "";

        // 1. Cryptographic HMAC signature verification
        const generatedSignature = crypto
            .createHmac("sha256", apiSecret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");

        const isValid = generatedSignature.length === razorpaySignature.length &&
            crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(razorpaySignature));

        if (!isValid) {
            res.status(400).json({ success: false, message: "Payment verification fail ho gaya." });
            return;
        }

        // 2. Fetch payment directly from Razorpay API to confirm capture & amount
        const razorpay = new Razorpay({ key_id: apiKey, key_secret: apiSecret });
        const payment: any = await razorpay.payments.fetch(razorpayPaymentId);
        const expectedAmountInPaise = Math.round(intent.verifiedTotal * 100);

        if (!payment || payment.status !== "captured" || payment.amount !== expectedAmountInPaise) {
            console.warn(`[Payment Security] Verification mismatch: expected ${expectedAmountInPaise}, received ${payment?.amount}, status: ${payment?.status}`);
            res.status(400).json({ success: false, message: "Payment amount match nahi hua — kripya customer support se sampark karein." });
            return;
        }

        // 3. Consume the intent atomically to prevent replay attacks
        const updatedIntent = await PaymentIntent.findOneAndUpdate(
            { _id: intent._id, used: false },
            { $set: { used: true } },
            { new: true }
        );

        if (!updatedIntent) {
            res.status(400).json({
                success: false,
                message: "Yeh payment session expire ho chuka hai ya use ho gaya hai. Kripya dobara try karein."
            });
            return;
        }

        // 4. Create the real Order document now that payment is confirmed
        const newOrder = await finalizeOrderPlacement({
            ...intent.orderPayload,
            orderStatus: "placed",
            paymentStatus: "paid",
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        } as any);

        res.status(200).json({
            success: true,
            order: newOrder
        });
    } catch (error: any) {
        console.error("Razorpay payment verification failed:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Creates a Razorpay order from the backend (Legacy endpoint for existing orders)
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
 * Explicitly logs user cancellations or client failures
 */
export const logPaymentFailure = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId, errorDetails } = req.body;

        if (!orderId) {
            res.status(200).json({ success: true, message: "Failure acknowledged" });
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
