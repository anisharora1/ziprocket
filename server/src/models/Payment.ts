import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IPayment extends BaseDocument {
    order: Types.ObjectId;
    user: Types.ObjectId;

    amount: number;

    method: "COD" | "UPI" | "CARD";

    status: "pending" | "success" | "failed";

    transactionId?: string;
}

const paymentSchema = new Schema<IPayment>({
    order: { type: Schema.Types.ObjectId, ref: "Order" },

    user: { type: Schema.Types.ObjectId, ref: "User" },

    amount: Number,

    method: {
        type: String,
        enum: ["COD", "UPI", "CARD"]
    },

    status: {
        type: String,
        enum: ["pending", "success", "failed"],
        default: "pending"
    },

    transactionId: String

}, { timestamps: true });

export default mongoose.model<IPayment>("Payment", paymentSchema);