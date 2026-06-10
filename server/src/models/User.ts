import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export type UserRole = "customer" | "seller" | "delivery" | "grocery_moderator" | "admin";

export interface IUser extends BaseDocument {
    name: string;
    phone: string;
    firebaseUid?: string;
    role: UserRole;

    isPhoneVerified: boolean;

    addresses: {
        fullAddress: string;
        city: string;
        location: {
            lat: number;
            lng: number;
        };
    }[];

    isBlocked: boolean;
    approvalStatus: "pending" | "approved" | "rejected";
    walletBalance: number;
    cancellationCount: number;
    assignedZones?: Types.ObjectId[];
    profilePhoto?: {
        url: string;
        publicId: string;
    };
}

const userSchema = new Schema<IUser>({
    name: { type: String, required: true },

    phone: { type: String, required: true, unique: true, trim: true },

    firebaseUid: { type: String, unique: true, sparse: true },

    role: {
        type: String,
        enum: ["customer", "seller", "delivery", "grocery_moderator", "admin"],
        default: "customer"
    },

    isPhoneVerified: { type: Boolean, default: false },

    addresses: [
        {
            fullAddress: String,
            city: String,
            location: {
                lat: Number,
                lng: Number
            }
        }
    ],

    isBlocked: { type: Boolean, default: false },

    approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved"
    },

    walletBalance: { type: Number, default: 0 },

    cancellationCount: { type: Number, default: 0 },

    assignedZones: [{ type: Schema.Types.ObjectId, ref: "DeliveryZone", default: [] }],

    profilePhoto: {
        url: String,
        publicId: String
    }

}, { 
    timestamps: true,
    toJSON: {
        transform: (doc, ret: any) => {
            if (ret.profilePhoto) ret.profilePhoto = ret.profilePhoto.url || ret.profilePhoto;
            return ret;
        }
    },
    toObject: {
        transform: (doc, ret: any) => {
            if (ret.profilePhoto) ret.profilePhoto = ret.profilePhoto.url || ret.profilePhoto;
            return ret;
        }
    }
});

// Indexes for admin/moderator lookups and compliance monitoring
userSchema.index({ cancellationCount: -1 });
userSchema.index({ role: 1, isBlocked: 1, assignedZones: 1 });
userSchema.index({ role: 1, createdAt: -1 });

// Text index for admin user searches
userSchema.index(
    { name: "text", phone: "text" },
    { name: "UserTextSearch" }
);

export default mongoose.model<IUser>("User", userSchema);