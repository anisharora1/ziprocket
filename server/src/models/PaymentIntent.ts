import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPaymentIntent extends Document {
    razorpayOrderId: string;
    user: Types.ObjectId;
    orderPayload: Record<string, any>;
    verifiedTotal: number;
    used: boolean;
    createdAt: Date;
}

const paymentIntentSchema = new Schema<IPaymentIntent>({
    razorpayOrderId: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderPayload: { type: Schema.Types.Mixed, required: true }, // the fully-verified order data, ready to become a real Order
    verifiedTotal: { type: Number, required: true },
    used: { type: Boolean, default: false }, // set true the instant it's consumed, prevents any replay
    createdAt: { type: Date, default: Date.now, expires: 1200 } // TTL: auto-deletes 20 minutes after creation
});

export default mongoose.model<IPaymentIntent>("PaymentIntent", paymentIntentSchema);
