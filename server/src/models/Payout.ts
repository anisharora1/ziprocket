import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IPayout extends BaseDocument {
    recipientType: "restaurant" | "delivery" | "grocery";
    restaurant?: Types.ObjectId; // Ref to Restaurant (if recipientType is restaurant)
    deliveryBoy?: Types.ObjectId; // Ref to User (if recipientType is delivery)
    
    // Settlement period (3-day cycle)
    periodStartDate: Date;
    periodEndDate: Date;
    periodIdentifier: string; // e.g. "2026-09-01_2026-09-03"
    
    // Financial Metrics
    totalOrders: number;
    totalRevenue: number;          // Gross item value for restaurants, delivery fee for delivery boy, total items for grocery
    platformCommission: number;    // Commission deducted by platform
    refundsAndAdjustments: number; // Deductions for refunds/disputes/adjustments
    adjustmentNotes?: string;      // Optional explanation for any refund/adjustment applied
    codCollected: number;          // Cash collected from customers
    onlinePayments: number;        // Online transaction volume
    finalPayoutAmount: number;     // Amount payable: totalRevenue - platformCommission - refundsAndAdjustments
    isEstimatedMargin?: boolean;   // True for estimated grocery margins
    
    status: "pending" | "processing" | "paid" | "failed";
    
    paymentDetails?: {
        transactionId?: string;
        paidAt?: Date;
        notes?: string;
    };
    
    auditLogs: {
        status: string;
        updatedBy: string;
        updatedAt: Date;
        notes?: string;
    }[];
}

const payoutSchema = new Schema<IPayout>({
    recipientType: {
        type: String,
        enum: ["restaurant", "delivery", "grocery"],
        required: true
    },
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: false },
    deliveryBoy: { type: Schema.Types.ObjectId, ref: "User", required: false },
    
    periodStartDate: { type: Date, required: true },
    periodEndDate: { type: Date, required: true },
    periodIdentifier: { type: String, required: true },
    
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    platformCommission: { type: Number, default: 0 },
    refundsAndAdjustments: { type: Number, default: 0 },
    adjustmentNotes: { type: String },
    codCollected: { type: Number, default: 0 },
    onlinePayments: { type: Number, default: 0 },
    finalPayoutAmount: { type: Number, default: 0 },
    isEstimatedMargin: { type: Boolean, default: false },
    
    status: {
        type: String,
        enum: ["pending", "processing", "paid", "failed"],
        default: "pending"
    },
    
    paymentDetails: {
        transactionId: { type: String },
        paidAt: { type: Date },
        notes: { type: String }
    },
    
    auditLogs: [
        {
            status: { type: String, required: true },
            updatedBy: { type: String, required: true },
            updatedAt: { type: Date, default: Date.now },
            notes: { type: String }
        }
    ]
}, { timestamps: true });

// Prevent duplicate settlements for the same recipient type, restaurant/rider, and 3-day cycle.
// Splitting the compound index avoids prefix gaps and skip scans since restaurant and deliveryBoy are mutually exclusive.
payoutSchema.index({ recipientType: 1, restaurant: 1, periodIdentifier: 1 }, { unique: true, sparse: true });
payoutSchema.index({ recipientType: 1, deliveryBoy: 1, periodIdentifier: 1 }, { unique: true, sparse: true });
payoutSchema.index({ recipientType: 1, periodIdentifier: 1 }, { unique: true, sparse: true });

export default mongoose.model<IPayout>("Payout", payoutSchema);
