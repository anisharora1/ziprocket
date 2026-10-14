import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";

export interface ICampaignStats {
    targeted: number;
    sent: number;
    failed: number;
    skippedCap: number;
    skippedQuiet: number;
    opened: number;
}

export interface INotificationCampaign extends BaseDocument {
    title: string;
    body: string;
    imageUrl?: string;
    route: string;
    segment: {
        type: string;
        params?: Record<string, any>;
    };
    zoneIds: Types.ObjectId[];
    radius?: {
        lat: number;
        lng: number;
        km: number;
    };
    status: CampaignStatus;
    scheduledAt?: Date;
    sentAt?: Date;
    stats: ICampaignStats;
    openedTokens?: string[];
    failureReason?: string;
    createdBy: Types.ObjectId;
}

const notificationCampaignSchema = new Schema<INotificationCampaign>(
    {
        title: { type: String, required: true, trim: true, maxlength: 65 },
        body: { type: String, required: true, trim: true, maxlength: 180 },
        imageUrl: { type: String, trim: true },
        route: { type: String, required: true, trim: true },
        segment: {
            type: {
                type: String,
                required: true,
                enum: ["all", "new_users", "never_ordered", "food_lovers", "grocery_shoppers", "regular", "inactive"]
            },
            params: { type: Schema.Types.Mixed, default: {} }
        },
        zoneIds: [{ type: Schema.Types.ObjectId, ref: "DeliveryZone" }],
        radius: {
            lat: { type: Number },
            lng: { type: Number },
            km: { type: Number }
        },
        status: {
            type: String,
            enum: ["draft", "scheduled", "sending", "sent", "failed", "cancelled"],
            default: "draft",
            index: true
        },
        scheduledAt: { type: Date, index: true },
        sentAt: { type: Date },
        stats: {
            targeted: { type: Number, default: 0 },
            sent: { type: Number, default: 0 },
            failed: { type: Number, default: 0 },
            skippedCap: { type: Number, default: 0 },
            skippedQuiet: { type: Number, default: 0 },
            opened: { type: Number, default: 0 }
        },
        openedTokens: { type: [String], default: [] },
        failureReason: { type: String },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
    },
    { timestamps: true }
);

notificationCampaignSchema.index({ status: 1, scheduledAt: 1 });
notificationCampaignSchema.index({ createdAt: -1 });

export default mongoose.model<INotificationCampaign>("NotificationCampaign", notificationCampaignSchema);
