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
    
    radiusKm: { type: Number, required: true, default: 10 },
    
    baseDeliveryFee: { type: Number, required: true, default: 20 },
    baseDistanceKm: { type: Number, required: true, default: 3 },
    extraFeePerKm: { type: Number, required: true, default: 5 },
    minDeliveryFee: { type: Number, required: true, default: 20 },
    maxDeliveryFee: { type: Number, required: true, default: 150 },
    freeDeliveryThreshold: { type: Number, required: true, default: 299 },
    
    smallOrderThreshold: { type: Number, required: true, default: 100 },
    smallOrderFee: { type: Number, required: true, default: 10 },
    smallOrderFeeActive: { type: Boolean, required: true, default: false },
    
    platformFee: { type: Number, required: true, default: 5 },
    platformFeeActive: { type: Boolean, required: true, default: true },
    gstPercentage: { type: Number, required: true, default: 5 },
    gstActive: { type: Boolean, required: true, default: true },
    packagingCharge: { type: Number, required: true, default: 10 },
    packagingChargeActive: { type: Boolean, required: true, default: false },
    convenienceFee: { type: Number, required: true, default: 2 },
    convenienceFeeActive: { type: Boolean, required: true, default: false },
    
    surgeMultiplier: { type: Number, required: true, default: 1.0 },
    surgeActive: { type: Boolean, required: true, default: false }
    
}, { timestamps: true });

// Indexes to speed up active zone lookups and pincode validation
deliveryZoneSchema.index({ isActive: 1 });
deliveryZoneSchema.index({ pincodes: 1, isActive: 1 });

export default mongoose.model<IDeliveryZone>("DeliveryZone", deliveryZoneSchema);
