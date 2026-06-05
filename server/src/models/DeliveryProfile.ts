import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IDeliveryProfile extends BaseDocument {
    user: Types.ObjectId;
    fullName: string;
    phone: string;
    address: string;
    vehicleType: "bike" | "scooter" | "bicycle" | "e-bike" | "other";
    vehicleNumber: string;
    idProofString: string;
    status: "pending" | "approved" | "rejected";
    isActive: boolean;
    isBlocked: boolean;

    // Additional Registration Fields
    email?: string;
    city: string;
    aadhaarNumber: string;
    licenseNumber?: string;
    panNumber: string;
    bankDetails: {
        accountNumber: string;
        ifscCode: string;
    };
    rating: number;
    deliveryZone?: Types.ObjectId;
}

const deliveryProfileSchema = new Schema<IDeliveryProfile>({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    vehicleType: { type: String, enum: ["bike", "scooter", "bicycle", "e-bike", "other"], required: true },
    vehicleNumber: { type: String, required: true },
    idProofString: { type: String, required: true },

    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },

    email: { type: String },
    city: { type: String, required: true },
    aadhaarNumber: { type: String, required: true },
    licenseNumber: { type: String },
    panNumber: { type: String, required: true },
    bankDetails: {
        accountNumber: { type: String, required: true },
        ifscCode: { type: String, required: true }
    },
    rating: { type: Number, default: 5.0 },
    deliveryZone: { type: Schema.Types.ObjectId, ref: "DeliveryZone" }
}, { timestamps: true });

// Indexes for profile lookups and admin dashboard lists
deliveryProfileSchema.index({ user: 1 }, { unique: true });
deliveryProfileSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IDeliveryProfile>("DeliveryProfile", deliveryProfileSchema);
