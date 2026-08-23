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

    if (order.user.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You do not own this order");
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
    const rzpOrder: any = await razorpay.orders.create(options);
    
    // Save rzpOrder.id onto the Mongo order to prevent replay attacks
    await Order.findByIdAndUpdate(orderId, { razorpayOrderId: rzpOrder.id });

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
    const order = await Order.findById(orderId);
    if (!order) {
        throw new Error("Order not found");
    }

    // 1. Confirm that the given razorpayOrderId belongs to this exact order
    if (!order.razorpayOrderId || order.razorpayOrderId !== razorpayOrderId) {
        console.warn(`[Payment Security] Mismatched Razorpay Order ID for order ${orderId}. Expected: ${order.razorpayOrderId}, Received: ${razorpayOrderId}`);
        return { success: false, order };
    }

    // 2. Cryptographic signature check with timing-safe comparison
    const generatedSignature = crypto
        .createHmac("sha256", process.env.Test_PAYMENT_SECRET_KEY || "")
        .update(razorpayOrderId + "|" + razorpayPaymentId)
        .digest("hex");

    const isValid = generatedSignature.length === razorpaySignature.length &&
        crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(razorpaySignature));

    if (!isValid) {
        // Update Order to failed
        const failedOrder = await Order.findByIdAndUpdate(
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

        return { success: false, order: failedOrder };
    }

    // 3. Fetch payment directly from Razorpay API to re-validate amount and captured status
    const razorpay = getRazorpayInstance();
    const paymentDetails: any = await razorpay.payments.fetch(razorpayPaymentId);
    const expectedAmountInPaise = Math.round(order.totalAmount * 100);

    if (
        !paymentDetails ||
        paymentDetails.amount !== expectedAmountInPaise ||
        paymentDetails.status !== "captured" ||
        paymentDetails.order_id !== razorpayOrderId
    ) {
        console.warn(`[Payment Security] Payment verification mismatch: amount expected ${expectedAmountInPaise}, received ${paymentDetails?.amount}; status: ${paymentDetails?.status}; order_id: ${paymentDetails?.order_id}`);
        const failedOrder = await Order.findByIdAndUpdate(
            orderId,
            { paymentStatus: "failed" },
            { new: true }
        );

        const payment = new Payment({
            order: orderId,
            user: userId || order?.user,
            amount: order ? order.totalAmount : 0,
            method: "CARD",
            status: "failed",
            transactionId: razorpayPaymentId
        });
        await payment.save();

        return { success: false, order: failedOrder };
    }

    // 4. Update Order to paid
    const paidOrder = await Order.findByIdAndUpdate(
        orderId,
        { paymentStatus: "paid" },
        { new: true }
    );

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

    return { success: true, order: paidOrder };
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
