import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface ICoupon extends BaseDocument {
    code: string;
    title: string;
    description: string;
    discountType: "flat" | "percentage";
    discountValue: number;
    maxDiscountAmount?: number;
    minOrderAmount: number;
    expiryDate: Date;
    totalUsageLimit: number;
    perUserUsageLimit: number;
    isActive: boolean;
    applicableZones: Types.ObjectId[];
    applicableRestaurants: Types.ObjectId[];
    applicableFor: "food" | "grocery" | "both";
    isFirstOrderOnly: boolean;
    isNewUserOnly: boolean;
    usedCount: number;
}

const couponSchema = new Schema<ICoupon>({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    discountType: { type: String, enum: ["flat", "percentage"], required: true },
    discountValue: { type: Number, required: true },
    maxDiscountAmount: { type: Number },
    minOrderAmount: { type: Number, required: true, default: 0 },
    expiryDate: { type: Date, required: true },
    totalUsageLimit: { type: Number, required: true, default: 1000 },
    perUserUsageLimit: { type: Number, required: true, default: 1 },
    isActive: { type: Boolean, required: true, default: true },
    applicableZones: [{ type: Schema.Types.ObjectId, ref: "DeliveryZone" }],
    applicableRestaurants: [{ type: Schema.Types.ObjectId, ref: "Restaurant" }],
    applicableFor: { type: String, enum: ["food", "grocery", "both"], default: "both" },
    isFirstOrderOnly: { type: Boolean, required: true, default: false },
    isNewUserOnly: { type: Boolean, required: true, default: false },
    usedCount: { type: Number, required: true, default: 0 }
}, { timestamps: true });

// Indexes to fetch active coupons and sort by creation time
couponSchema.index({ isActive: 1, expiryDate: 1 });
couponSchema.index({ createdAt: -1 });

export default mongoose.model<ICoupon>("Coupon", couponSchema);
