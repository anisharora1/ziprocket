import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export type OrderStatus =
    | "placed"
    | "accepted"
    | "preparing"
    | "accepted_by_delivery"
    | "on_the_way"
    | "delivered"
    | "cancelled";

export interface IOrder extends BaseDocument {
    user: Types.ObjectId;
    restaurant?: Types.ObjectId;
    orderType: "food" | "grocery";
    rejectedBy?: Types.ObjectId[];

    items: {
        menuItem?: Types.ObjectId;
        groceryItem?: Types.ObjectId;
        quantity: number;
        price: number;
    }[];

    totalAmount: number;
    deliveryCharge: number;

    paymentMethod: "COD" | "ONLINE";

    paymentStatus: "pending" | "paid" | "failed";

    orderStatus: OrderStatus;

    distance: number;

    address: {
        fullAddress: string;
        lat: number;
        lng: number;
    };

    whatsappOrder: boolean;
    deliveryZone?: Types.ObjectId;
    cancellationReason?: string;
    cancelledAt?: Date;
    moderator?: Types.ObjectId;
    couponCode?: string;
    discountAmount?: number;
}

const orderSchema = new Schema<IOrder>({
    user: { type: Schema.Types.ObjectId, ref: "User" },

    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: false },

    orderType: {
        type: String,
        enum: ["food", "grocery"],
        default: "food"
    },

    items: [
        {
            menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem", required: false },
            groceryItem: { type: Schema.Types.ObjectId, ref: "GroceryProduct", required: false },
            quantity: Number,
            price: Number
        }
    ],

    totalAmount: Number,

    deliveryCharge: Number,

    paymentMethod: {
        type: String,
        enum: ["COD", "ONLINE"]
    },

    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending"
    },

    orderStatus: {
        type: String,
        enum: [
            "placed",
            "accepted",
            "preparing",
            "accepted_by_delivery",
            "on_the_way",
            "delivered",
            "cancelled"
        ],
        default: "placed"
    },

    distance: Number,

    address: {
        fullAddress: String,
        lat: Number,
        lng: Number
    },

    whatsappOrder: { type: Boolean, default: false },
    cancellationReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },

    rejectedBy: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    deliveryZone: { type: Schema.Types.ObjectId, ref: "DeliveryZone" },
    moderator: { type: Schema.Types.ObjectId, ref: "User", required: false },
    couponCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 }

}, { timestamps: true });

// Indexes for history lookups, dashboard monitoring, and weekly payout batch jobs
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: 1 });
orderSchema.index({ orderType: 1, deliveryZone: 1, createdAt: -1 });
orderSchema.index({ user: 1, orderStatus: 1 });

export default mongoose.model<IOrder>("Order", orderSchema);