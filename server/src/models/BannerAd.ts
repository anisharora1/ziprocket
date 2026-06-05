import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IBannerAd extends BaseDocument {
    restaurant?: Types.ObjectId;
    targetType: "restaurant" | "grocery";
    category?: string;
    image: string;
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
}

const bannerAdSchema = new Schema<IBannerAd>({
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: false },

    targetType: {
        type: String,
        enum: ["restaurant", "grocery"],
        default: "restaurant"
    },

    category: { type: String, required: false },

    image: String,

    title: String,

    description: String,

    startDate: Date,

    endDate: Date,

    isActive: { type: Boolean, default: true }

}, { timestamps: true });

export default mongoose.model<IBannerAd>("BannerAd", bannerAdSchema);