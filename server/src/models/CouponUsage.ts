import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface ICouponUsage extends BaseDocument {
    user: Types.ObjectId;
    coupon: Types.ObjectId;
    order: Types.ObjectId;
    discountApplied: number;
}

const couponUsageSchema = new Schema<ICouponUsage>({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    discountApplied: { type: Number, required: true }
}, { timestamps: true });

// Compound index to check per-user usage limits and cascade deletes
couponUsageSchema.index({ coupon: 1, user: 1 });

export default mongoose.model<ICouponUsage>("CouponUsage", couponUsageSchema);
