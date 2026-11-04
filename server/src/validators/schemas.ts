import { z } from "zod";

export const createOrderSchema = z.object({
    orderType: z.enum(["food", "grocery"]).default("food"),
    restaurant: z.string().optional(),
    user: z.string().optional(),
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
        deliveryAddress: z.union([
            z.string(),
            z.object({
                houseNumber: z.string().optional().nullable(),
                street: z.string().optional().nullable(),
                locality: z.string().optional().nullable(),
                village: z.string().optional().nullable(),
                landmark: z.string().optional().nullable(),
                pincode: z.string().optional().nullable(),
                instructions: z.string().optional().nullable()
            }),
            z.record(z.string(), z.any())
        ]).optional().nullable(),
        pincode: z.string().optional().nullable()
    }),
    whatsappOrder: z.boolean().optional().default(false),
    couponCode: z.string().optional().nullable(),
    phone: z.string().optional().nullable()
}).passthrough();

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


/**
 * Validates and normalizes discountedPrice relative to price.
 * - An empty or 0 discountedPrice means no discount and must be stored as undefined.
 * - Otherwise, discountedPrice must be a positive number lower than price.
 */
export function validateDiscountedPrice(
    discountedPrice: any,
    price: number
): { isValid: true; value: number | undefined } | { isValid: false; message: string } {
    if (
        discountedPrice === undefined ||
        discountedPrice === null ||
        discountedPrice === "" ||
        (typeof discountedPrice === "string" && discountedPrice.trim() === "")
    ) {
        return { isValid: true, value: undefined };
    }

    const num = Number(discountedPrice);
    if (isNaN(num)) {
        return { isValid: false, message: "Discounted price must be lower than the price" };
    }

    if (num === 0) {
        return { isValid: true, value: undefined };
    }

    if (num < 0 || num >= Number(price)) {
        return { isValid: false, message: "Discounted price must be lower than the price" };
    }

    return { isValid: true, value: num };
}

export const createMenuItemSchema = z.object({
    name: z.string().min(1, "Name is required"),
    price: z.number().nonnegative("Price must be a valid non-negative number"),
    discountedPrice: z.any().optional()
}).refine(data => {
    return validateDiscountedPrice(data.discountedPrice, data.price).isValid;
}, {
    message: "Discounted price must be lower than the price",
    path: ["discountedPrice"]
});

export const updateMenuItemSchema = z.object({
    name: z.string().optional(),
    price: z.number().nonnegative("Price must be a valid non-negative number").optional(),
    discountedPrice: z.any().optional()
}).refine(data => {
    if (data.price !== undefined && data.discountedPrice !== undefined) {
        return validateDiscountedPrice(data.discountedPrice, data.price).isValid;
    }
    return true;
}, {
    message: "Discounted price must be lower than the price",
    path: ["discountedPrice"]
});

export const createGroceryProductSchema = z.object({
    name: z.string().min(1, "Name is required"),
    price: z.number().nonnegative("Price cannot be negative"),
    discountedPrice: z.any().optional()
}).refine(data => {
    return validateDiscountedPrice(data.discountedPrice, data.price).isValid;
}, {
    message: "Discounted price must be lower than the price",
    path: ["discountedPrice"]
});

export const updateGroceryProductSchema = z.object({
    name: z.string().optional(),
    price: z.number().nonnegative("Price cannot be negative").optional(),
    discountedPrice: z.any().optional()
}).refine(data => {
    if (data.price !== undefined && data.discountedPrice !== undefined) {
        return validateDiscountedPrice(data.discountedPrice, data.price).isValid;
    }
    return true;
}, {
    message: "Discounted price must be lower than the price",
    path: ["discountedPrice"]
});
