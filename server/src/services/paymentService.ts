import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order";
import Payment from "../models/Payment";

const getRazorpayInstance = () => {
    return new Razorpay({
        key_id: process.env.Test_PAYMENT_API_KEY || "",
        key_secret: process.env.Test_PAYMENT_SECRET_KEY || ""
    });
};

/**
 * Creates a Razorpay order session for a checkout Order document
 */
export const createRazorpayOrderSession = async (orderId: string, userId: string) => {
    const order = await Order.findById(orderId);
    if (!order) {
        throw new Error("Order not found");
    }

    const amountInPaise = Math.round(order.totalAmount * 100);

    const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${orderId.toString().substring(14)}`,
        notes: {
            orderId: orderId.toString(),
            userId: userId
        }
    };

    const razorpay = getRazorpayInstance();
    const rzpOrder = await razorpay.orders.create(options);
    
    return {
        key: process.env.Test_PAYMENT_API_KEY,
        order: rzpOrder,
        mongoOrderId: orderId
    };
};

/**
 * Verifies Razorpay HMAC-SHA256 signatures and records the transaction outcome
 */
export const verifyRazorpayPayment = async (
    orderId: string,
    razorpayPaymentId: string,
    razorpayOrderId: string,
    razorpaySignature: string,
    userId: string
): Promise<{ success: boolean; order: any }> => {
    const generatedSignature = crypto
        .createHmac("sha256", process.env.Test_PAYMENT_SECRET_KEY || "")
        .update(razorpayOrderId + "|" + razorpayPaymentId)
        .digest("hex");

    const isValid = generatedSignature === razorpaySignature;

    if (isValid) {
        // Update Order to paid
        const order = await Order.findByIdAndUpdate(
            orderId,
            { paymentStatus: "paid" },
            { new: true }
        );

        if (!order) {
            throw new Error("Order not found");
        }

        // Record successful payment document
        const payment = new Payment({
            order: orderId,
            user: userId || order.user,
            amount: order.totalAmount,
            method: "CARD",
            status: "success",
            transactionId: razorpayPaymentId
        });
        await payment.save();

        return { success: true, order };
    } else {
        // Update Order to failed
        const order = await Order.findByIdAndUpdate(
            orderId,
            { paymentStatus: "failed" },
            { new: true }
        );

        // Record failed payment document
        const payment = new Payment({
            order: orderId,
            user: userId || order?.user,
            amount: order ? order.totalAmount : 0,
            method: "CARD",
            status: "failed",
            transactionId: razorpayPaymentId
        });
        await payment.save();

        return { success: false, order };
    }
};

/**
 * Logs user cancellations or transactional payment failures
 */
export const logPaymentCancellation = async (orderId: string, errorDetails: any, userId: string) => {
    const order = await Order.findByIdAndUpdate(
        orderId,
        { paymentStatus: "failed" },
        { new: true }
    );

    if (!order) {
        throw new Error("Order not found");
    }

    // Log cancellation document
    const payment = new Payment({
        order: orderId,
        user: userId || order.user,
        amount: order.totalAmount,
        method: "CARD",
        status: "failed",
        transactionId: errorDetails?.payment_id || "cancelled"
    });
    await payment.save();

    return { order };
};
