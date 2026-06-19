import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IDeliveryAddress {
    houseNumber: string;
    street?: string;
    locality: string;
    village: string;
    landmark: string;
    pincode?: string;
    instructions?: string;
}

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
    deliveryAddress: IDeliveryAddress;
    deliveryZone?: Types.ObjectId;
    isDefault: boolean;
}

const deliveryAddressSchema = new Schema({
    houseNumber: { type: String, required: true },
    street: { type: String, default: "" },
    locality: { type: String, required: true },
    village: { type: String, required: true },
    landmark: { type: String, required: true },
    pincode: { type: String, default: "" },
    instructions: { type: String, default: "" }
}, { _id: false });

const addressSchema = new Schema<IAddress>({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
    fullAddress: { type: String, required: true },
    pincode: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, default: "India" },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    deliveryAddress: { type: deliveryAddressSchema, required: true },
    deliveryZone: { type: Schema.Types.ObjectId, ref: "DeliveryZone" },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

// Pre-validate middleware to sync nested deliveryAddress values to legacy flat fields
addressSchema.pre("validate", function(this: any) {
    if (this.deliveryAddress) {
        const { houseNumber, street, locality, village, landmark, pincode } = this.deliveryAddress;
        this.fullAddress = [
            houseNumber ? `House/Flat No: ${houseNumber.trim()}` : "",
            street ? `Road: ${street.trim()}` : "",
            locality ? `${locality.trim()}` : "",
            village ? `Village: ${village.trim()}` : "",
            landmark ? `Near: ${landmark.trim()}` : ""
        ].filter(Boolean).join(", ");
        this.pincode = pincode || "";
        this.city = village || "";
        this.state = this.state || "Punjab";
    }
});

// Setup geospatial indexing on the location fields
addressSchema.index({ "location": "2dsphere" });

// Index for saved addresses lookups and default listing
addressSchema.index({ user: 1, isDefault: -1, updatedAt: -1 });

export default mongoose.model<IAddress>("Address", addressSchema);

