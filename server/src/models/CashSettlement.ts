import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface ICashSettlement extends BaseDocument {
    deliveryBoy: Types.ObjectId;
    type: "cash_handover" | "digital_payment";
    amount: number;
    transactionId?: string; // UTR, only for digital_payment
    paymentDate?: Date;     // only for digital_payment
    notes?: string;
    status: "pending" | "confirmed" | "rejected";
    confirmedBy?: Types.ObjectId;
    confirmedAt?: Date;
}

const cashSettlementSchema = new Schema<ICashSettlement>({
    deliveryBoy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["cash_handover", "digital_payment"], required: true },
    amount: { type: Number, required: true, min: [1, "Amount must be positive"] },
    transactionId: { type: String, trim: true },
    paymentDate: { type: Date },
    notes: { type: String, trim: true },
    status: { type: String, enum: ["pending", "confirmed", "rejected"], default: "pending" },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    confirmedAt: { type: Date },
}, { timestamps: true });

cashSettlementSchema.index({ deliveryBoy: 1, status: 1, createdAt: -1 });

export default mongoose.model<ICashSettlement>("CashSettlement", cashSettlementSchema);
