import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IDelivery extends BaseDocument {
    order: Types.ObjectId;
    deliveryBoy: Types.ObjectId;

    status: "assigned" | "picked" | "on_the_way" | "delivered";

    earnings: number;
}

const deliverySchema = new Schema<IDelivery>({
    order: { type: Schema.Types.ObjectId, ref: "Order" },

    deliveryBoy: { type: Schema.Types.ObjectId, ref: "User" },

    status: {
        type: String,
        enum: ["assigned", "picked", "on_the_way", "delivered"],
        default: "assigned"
    },

    earnings: Number

}, { timestamps: true });

// Indexes to prevent duplicate assignments, optimize rider dashboards, and settlement checks
deliverySchema.index({ order: 1 }, { unique: true });
deliverySchema.index({ deliveryBoy: 1, status: 1, createdAt: -1 });
deliverySchema.index({ status: 1, createdAt: 1 });

export default mongoose.model<IDelivery>("Delivery", deliverySchema);