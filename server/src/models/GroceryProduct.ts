import mongoose, { Schema } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IGroceryProductImage {
    url: string;
    publicId: string;
}

export interface IGroceryProduct extends BaseDocument {
    name: string;
    slug: string;
    description: string;
    category: string;
    subcategory: string;
    brand: string;
    price: number;
    discountedPrice?: number;
    stockQuantity: number;
    unit: "kg" | "gram" | "litre" | "packet" | "piece";
    images: IGroceryProductImage[];
    weightSize: string;
    isAvailable: boolean;
    isFeatured: boolean;
    offerBadge?: string;
    expiryDate?: Date;
}

const groceryProductSchema = new Schema<IGroceryProduct>({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    subcategory: { type: String, required: true },
    brand: { type: String, required: true },
    price: { type: Number, required: true },
    discountedPrice: { type: Number },
    stockQuantity: { type: Number, required: true, default: 0 },
    unit: { 
        type: String, 
        enum: ["kg", "gram", "litre", "packet", "piece"], 
        required: true 
    },
    images: {
        type: [{
            url: { type: String, required: true },
            publicId: { type: String, required: true }
        }],
        default: []
    },
    weightSize: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    offerBadge: { type: String },
    expiryDate: { type: Date }
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

// Optimized indexes for quick-commerce catalog, search, and recommendations
// (Removed redundant slug and category indexes, as slug unique:true builds an index and category is covered by the compound prefix)
groceryProductSchema.index({ category: 1, subcategory: 1, createdAt: -1 });
groceryProductSchema.index({ isFeatured: 1, createdAt: -1 });
groceryProductSchema.index({ stockQuantity: 1, createdAt: -1 });
groceryProductSchema.index({ isAvailable: 1, category: 1 });

// Text index for high-performance search queries
groceryProductSchema.index(
    { name: "text", brand: "text", description: "text", category: "text", subcategory: "text" },
    { weights: { name: 10, brand: 5, category: 3, subcategory: 2, description: 1 }, name: "GroceryProductTextSearchV2" }
);

export default mongoose.model<IGroceryProduct>("GroceryProduct", groceryProductSchema);
