import { z } from "zod";

export const createOrderSchema = z.object({
    orderType: z.enum(["food", "grocery"]).default("food"),
    restaurant: z.string().optional(),
    items: z.array(z.object({
        menuItem: z.string().optional(),
        groceryItem: z.string().optional(),
        quantity: z.number().int().positive("Quantity must be a positive integer"),
        price: z.number().nonnegative().optional()
    })).min(1, "Order must contain at least one item"),
    totalAmount: z.number().nonnegative("Total amount cannot be negative"),
    deliveryCharge: z.number().nonnegative().default(0),
    paymentMethod: z.enum(["COD", "ONLINE"]),
    distance: z.number().nonnegative().optional(),
    address: z.object({
        fullAddress: z.string().min(3, "Full address is required"),
        lat: z.number({ message: "Latitude coordinate is required" }),
        lng: z.number({ message: "Longitude coordinate is required" }),
        deliveryAddress: z.string().optional(),
        pincode: z.string().optional()
    }),
    whatsappOrder: z.boolean().optional().default(false),
    couponCode: z.string().optional(),
    phone: z.string().optional()
});

export const validateCouponSchema = z.object({
    code: z.string().min(1, "Coupon code is required"),
    subtotal: z.number().nonnegative("Subtotal cannot be negative"),
    userId: z.string().optional(),
    zoneId: z.string().optional(),
    restaurantId: z.string().optional(),
    orderType: z.enum(["food", "grocery"]).optional()
});

export const userLoginSchema = z.object({
    phone: z.string().min(10, "Valid phone number is required"),
    password: z.string().min(6, "Password must be at least 6 characters")
});

export const userRegisterSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().min(10, "Valid phone number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    email: z.string().email().optional().or(z.literal("")),
    role: z.enum(["customer", "seller", "delivery_boy", "grocery_moderator"]).optional().default("customer")
});
