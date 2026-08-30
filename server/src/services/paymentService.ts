import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order";
import Payment from "../models/Payment";
import { emitToRooms } from "../services/socketService";

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

    // Return immediately if order is already marked as paid to prevent duplicate Payment records on retries
    if (order.paymentStatus === "paid") {
        return { success: true, order };
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

    // 4. Update Order to paid and transition orderStatus from "pending" to "placed"
    const paidOrder = await Order.findByIdAndUpdate(
        orderId,
        { paymentStatus: "paid", orderStatus: "placed" },
        { new: true }
    );

    // --- Socket.IO: Notify seller/moderator that a new confirmed order is ready ---
    // This fires here instead of createOrder because ONLINE orders stay "pending" until payment is verified.
    if (paidOrder) {
        try {
            const rooms: string[] = ["admin"];
            if (paidOrder.orderType === "food" && paidOrder.restaurant) {
                rooms.push(`seller:${paidOrder.restaurant.toString()}`);
            } else if (paidOrder.orderType === "grocery" && (paidOrder as any).deliveryZone) {
                rooms.push(`grocery:${(paidOrder as any).deliveryZone.toString()}`);
            }
            rooms.push(`user:${paidOrder.user.toString()}`);
            emitToRooms(rooms, "new_order", {
                order: paidOrder,
                orderType: paidOrder.orderType,
                restaurantId: paidOrder.orderType === "food" ? paidOrder.restaurant?.toString() : undefined,
                zoneId: paidOrder.orderType === "grocery" ? (paidOrder as any).deliveryZone?.toString() : undefined,
            });
        } catch (emitErr: any) {
            console.error("[Socket] new_order emit error (post-payment):", emitErr.message);
        }
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

    return { success: true, order: paidOrder };
};

/**
 * Logs user cancellations or transactional payment failures
 */
export const logPaymentCancellation = async (orderId: string, errorDetails: any, userId: string) => {
    const order = await Order.findByIdAndUpdate(
        orderId,
        { paymentStatus: "failed", orderStatus: "cancelled" },
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
