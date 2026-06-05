import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IReview extends BaseDocument {
    user: Types.ObjectId;
    restaurant: Types.ObjectId;
    rating: number;
    comment: string;
}

const reviewSchema = new Schema<IReview>({
    user: { type: Schema.Types.ObjectId, ref: "User" },

    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant" },

    rating: { type: Number, min: 1, max: 5 },

    comment: String

}, { timestamps: true });

export default mongoose.model<IReview>("Review", reviewSchema);