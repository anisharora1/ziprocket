import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export type OrderStatus =
    | "pending"      // order submitted, server verification/payment in progress
    | "placed"       // verification complete, order confirmed and visible to restaurant/moderator
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
        deliveryAddress?: {
            houseNumber: string;
            street?: string;
            locality: string;
            village: string;
            landmark: string;
            pincode?: string;
            instructions?: string;
        };
    };

    whatsappOrder: boolean;
    deliveryZone?: Types.ObjectId;
    cancellationReason?: string;
    cancelledAt?: Date;
    moderator?: Types.ObjectId;
    couponCode?: string;
    discountAmount?: number;
    razorpayOrderId?: string;
    deliveryOtp?: string;
    rating?: number; // 1-5, set once by the customer after delivery
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
            "pending",
            "placed",
            "accepted",
            "preparing",
            "accepted_by_delivery",
            "on_the_way",
            "delivered",
            "cancelled"
        ],
        default: "pending"
    },

    distance: Number,

    address: {
        fullAddress: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        deliveryAddress: {
            houseNumber: { type: String },
            street: { type: String, default: "" },
            locality: { type: String },
            village: { type: String },
            landmark: { type: String },
            pincode: { type: String, default: "" },
            instructions: { type: String, default: "" }
        }
    },

    whatsappOrder: { type: Boolean, default: false },
    cancellationReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },

    rejectedBy: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    deliveryZone: { type: Schema.Types.ObjectId, ref: "DeliveryZone" },
    moderator: { type: Schema.Types.ObjectId, ref: "User", required: false },
    couponCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    razorpayOrderId: { type: String, default: null },
    deliveryOtp: { type: String, select: true },
    rating: { type: Number, min: 1, max: 5 }

}, { timestamps: true });

// Indexes for history lookups, dashboard monitoring, and weekly payout batch jobs
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: 1 });
orderSchema.index({ orderType: 1, deliveryZone: 1, createdAt: -1 });
orderSchema.index({ user: 1, orderStatus: 1 });

export default mongoose.model<IOrder>("Order", orderSchema);