import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface ICartItem {
    itemId: string;
    menuItem?: Types.ObjectId;
    groceryItem?: Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
    img?: string;
}

export interface ICart extends BaseDocument {
    user: Types.ObjectId;
    items: ICartItem[];
    vendorId: string | null;
    vendorName: string | null;
    orderType: "food" | "grocery" | null;
}

const cartSchema = new Schema<ICart>({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [
        {
            itemId: { type: String, required: true },
            menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem", required: false },
            groceryItem: { type: Schema.Types.ObjectId, ref: "GroceryProduct", required: false },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true, default: 1 },
            img: { type: String, required: false }
        }
    ],
    vendorId: { type: String, default: null },
    vendorName: { type: String, default: null },
    orderType: { type: String, enum: ["food", "grocery", null], default: null }
}, { timestamps: true });

export default mongoose.model<ICart>("Cart", cartSchema);
