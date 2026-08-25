import mongoose, { Schema } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IDeliveryZone extends BaseDocument {
    name: string;
    isActive: boolean;
    pincodes: string[];
    
    // The center point of the delivery zone (e.g., your main hub or city center)
    center: {
        lat: number;
        lng: number;
    };
    
    // The max radius allowed for this zone (in kilometers) - e.g., initially 10km
    radiusKm: number;
    
    // Core pricing configuration
    baseDeliveryFee: number; // Flat fee for the base distance
    baseDistanceKm: number;  // Distance covered by the base fee (e.g., first 3km)
    extraFeePerKm: number;   // Additional cost per km beyond the baseDistanceKm
    minDeliveryFee: number;
    maxDeliveryFee: number;
    freeDeliveryThreshold: number;
    
    // Small order fee
    smallOrderThreshold: number;
    smallOrderFee: number;
    smallOrderFeeActive: boolean;
    
    // Taxes & Platform fees
    platformFee: number;
    platformFeeActive: boolean;
    gstPercentage: number;
    gstActive: boolean;
    packagingCharge: number;
    packagingChargeActive: boolean;
    convenienceFee: number;
    convenienceFeeActive: boolean;
    
    // Surge pricing rules
    surgeMultiplier: number;
    surgeActive: boolean;
}

const deliveryZoneSchema = new Schema<IDeliveryZone>({
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    pincodes: { type: [String], default: [] },
    
    center: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    
    radiusKm: { type: Number, required: true, default: 10, min: [0.1, "Radius must be positive"] },
    
    baseDeliveryFee: { type: Number, required: true, default: 20, min: [0, "Cannot be negative"] },
    baseDistanceKm: { type: Number, required: true, default: 3, min: [0, "Cannot be negative"] },
    extraFeePerKm: { type: Number, required: true, default: 5, min: [0, "Cannot be negative"] },
    minDeliveryFee: { type: Number, required: true, default: 20, min: [0, "Cannot be negative"] },
    maxDeliveryFee: { type: Number, required: true, default: 150, min: [0, "Cannot be negative"] },
    freeDeliveryThreshold: { type: Number, required: true, default: 299, min: [0, "Cannot be negative"] },
    
    smallOrderThreshold: { type: Number, required: true, default: 100, min: [0, "Cannot be negative"] },
    smallOrderFee: { type: Number, required: true, default: 10, min: [0, "Cannot be negative"] },
    smallOrderFeeActive: { type: Boolean, required: true, default: false },
    
    platformFee: { type: Number, required: true, default: 5, min: [0, "Cannot be negative"] },
    platformFeeActive: { type: Boolean, required: true, default: true },
    gstPercentage: { type: Number, required: true, default: 5, min: [0, "Cannot be negative"], max: [100, "Cannot exceed 100%"] },
    gstActive: { type: Boolean, required: true, default: true },
    packagingCharge: { type: Number, required: true, default: 10, min: [0, "Cannot be negative"] },
    packagingChargeActive: { type: Boolean, required: true, default: false },
    convenienceFee: { type: Number, required: true, default: 2, min: [0, "Cannot be negative"] },
    convenienceFeeActive: { type: Boolean, required: true, default: false },
    
    surgeMultiplier: { type: Number, required: true, default: 1.0, min: [0.1, "Must be positive"] },
    surgeActive: { type: Boolean, required: true, default: false }
    
}, { timestamps: true });

// Indexes to speed up active zone lookups and pincode validation
deliveryZoneSchema.index({ isActive: 1 });
deliveryZoneSchema.index({ pincodes: 1, isActive: 1 });

export default mongoose.model<IDeliveryZone>("DeliveryZone", deliveryZoneSchema);
