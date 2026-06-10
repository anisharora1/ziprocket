import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IRestaurantImage {
    url: string;
    publicId: string;
}

export interface IRestaurant extends BaseDocument {
    name: string;
    owner: Types.ObjectId;
    phone: string;

    location: {
        address: string;
        lat: number;
        lng: number;
    };

    isActive: boolean;
    isBlocked: boolean;

    status: "pending" | "approved" | "rejected";

    commission: number;
    rating: number;
    totalOrders: number;
    cancellationCount: number;

    // Additional Registration Fields
    ownerName: string;
    cuisines: string;
    fssaiNumber: string;
    panNumber: string;
    gstNumber?: string;
    bankDetails: {
        accountNumber: string;
        ifscCode: string;
    };
    deliveryZone?: Types.ObjectId;
    image?: IRestaurantImage;
    logo?: IRestaurantImage;
    gallery?: IRestaurantImage[];
}

const restaurantSchema = new Schema<IRestaurant>({
    name: { type: String, required: true },

    owner: { type: Schema.Types.ObjectId, ref: "User" },

    phone: String,

    location: {
        address: String,
        lat: Number,
        lng: Number
    },

    isActive: { type: Boolean, default: true },

    isBlocked: { type: Boolean, default: false },

    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },

    commission: { type: Number, default: 5 },

    rating: { type: Number, default: 0 },

    totalOrders: { type: Number, default: 0 },

    cancellationCount: { type: Number, default: 0 },

    ownerName: { type: String, required: true },
    cuisines: { type: String, required: true },
    fssaiNumber: { type: String, required: true },
    panNumber: { type: String, required: true },
    gstNumber: { type: String },
    bankDetails: {
        accountNumber: { type: String, required: true },
        ifscCode: { type: String, required: true }
    },
    deliveryZone: { type: Schema.Types.ObjectId, ref: "DeliveryZone" },

    image: {
        url: String,
        publicId: String
    },
    logo: {
        url: String,
        publicId: String
    },
    gallery: {
        type: [{
            url: { type: String, required: true },
            publicId: { type: String, required: true }
        }],
        default: []
    }

}, { 
    timestamps: true,
    toJSON: {
        transform: (doc, ret: any) => {
            if (ret.image) ret.image = ret.image.url || ret.image;
            if (ret.logo) ret.logo = ret.logo.url || ret.logo;
            if (ret.gallery && Array.isArray(ret.gallery)) {
                ret.gallery = ret.gallery.map((img: any) => img.url || img);
            }
            return ret;
        }
    },
    toObject: {
        transform: (doc, ret: any) => {
            if (ret.image) ret.image = ret.image.url || ret.image;
            if (ret.logo) ret.logo = ret.logo.url || ret.logo;
            if (ret.gallery && Array.isArray(ret.gallery)) {
                ret.gallery = ret.gallery.map((img: any) => img.url || img);
            }
            return ret;
        }
    }
});

// Indexes for owner lookup, delivery zone availability, and admin compliance monitoring
restaurantSchema.index({ owner: 1 }, { unique: true });
restaurantSchema.index({ deliveryZone: 1, status: 1, isActive: 1 });
restaurantSchema.index({ cancellationCount: -1 });

// Text index for restaurant search
restaurantSchema.index(
    { name: "text", ownerName: "text", cuisines: "text", "location.address": "text" },
    { weights: { name: 10, cuisines: 5, "location.address": 2, ownerName: 1 }, name: "RestaurantTextSearch" }
);

export default mongoose.model<IRestaurant>("Restaurant", restaurantSchema);