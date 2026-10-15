import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IDeviceToken extends BaseDocument {
    token: string;
    user?: Types.ObjectId | null;
    platform: string;
    zoneId?: Types.ObjectId | null;
    lastLocation?: {
        lat: number;
        lng: number;
    };
    appVersion?: string;
    marketingOptIn: boolean;
    lastSeenAt: Date;
    marketingDay?: string; // "YYYY-MM-DD" in Asia/Kolkata
    marketingCount: number;
}

const deviceTokenSchema = new Schema<IDeviceToken>(
    {
        token: { type: String, required: true, unique: true, index: true },
        user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
        platform: { type: String, default: "android" },
        zoneId: { type: Schema.Types.ObjectId, ref: "DeliveryZone", default: null, index: true },
        lastLocation: {
            lat: { type: Number },
            lng: { type: Number }
        },
        appVersion: { type: String },
        marketingOptIn: { type: Boolean, default: true, index: true },
        lastSeenAt: { type: Date, default: Date.now },
        marketingDay: { type: String },
        marketingCount: { type: Number, default: 0 }
    },
    { timestamps: true }
);

export default mongoose.model<IDeviceToken>("DeviceToken", deviceTokenSchema);
