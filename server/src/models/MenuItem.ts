import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IMenuItemImage {
    url: string;
    publicId: string;
}

export interface IMenuItem extends BaseDocument {
    restaurant: Types.ObjectId;
    name: string;
    description: string;
    price: number;
    category: string;
    images?: IMenuItemImage[];
    isAvailable: boolean;
    isVeg: boolean;
}

const menuItemSchema = new Schema<IMenuItem>({
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant" },

    name: { type: String, required: true },

    description: { type: String, required: true },

    price: { type: Number, required: true },

    category: String,

    images: {
        type: [{
            url: { type: String, required: true },
            publicId: { type: String, required: true }
        }],
        default: []
    },

    isAvailable: { type: Boolean, default: true },

    isVeg: { type: Boolean, default: false }

}, { 
    timestamps: true,
    toJSON: {
        transform: (doc, ret: any) => {
            if (ret.images && Array.isArray(ret.images)) {
                ret.images = ret.images.map((img: any) => img.url || img);
            }
            return ret;
        }
    },
    toObject: {
        transform: (doc, ret: any) => {
            if (ret.images && Array.isArray(ret.images)) {
                ret.images = ret.images.map((img: any) => img.url || img);
            }
            return ret;
        }
    }
});

// Compound index for restaurant menu loads and recommendation lookups
menuItemSchema.index({ restaurant: 1, isAvailable: 1, category: 1 });

// Text index for food items search
menuItemSchema.index(
    { name: "text", description: "text", category: "text" },
    { weights: { name: 10, category: 3, description: 1 }, name: "MenuItemTextSearch" }
);

export default mongoose.model<IMenuItem>("MenuItem", menuItemSchema);