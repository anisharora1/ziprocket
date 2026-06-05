import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IAddress extends BaseDocument {
    user: Types.ObjectId;
    label: "Home" | "Work" | "Other";
    fullAddress: string;
    pincode: string;
    city: string;
    state: string;
    country: string;
    location: {
        lat: number;
        lng: number;
    };
    deliveryZone?: Types.ObjectId;
    isDefault: boolean;
}

const addressSchema = new Schema<IAddress>({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
    fullAddress: { type: String, required: true },
    pincode: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, default: "India" },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    deliveryZone: { type: Schema.Types.ObjectId, ref: "DeliveryZone" },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

// Setup geospatial indexing on the location fields
addressSchema.index({ "location": "2dsphere" });

// Index for saved addresses lookups and default listing
addressSchema.index({ user: 1, isDefault: -1, updatedAt: -1 });

export default mongoose.model<IAddress>("Address", addressSchema);
