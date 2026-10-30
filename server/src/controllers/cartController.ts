import { Request, Response } from "express";
import Cart from "../models/Cart";
import mongoose from "mongoose";
import * as cartCacheService from "../services/cartCacheService";

export const getCart = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?._id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized access" });
            return;
        }

        // Check Redis cache first
        const cachedCart = await cartCacheService.getCachedCart(userId.toString());
        if (cachedCart) {
            console.log(`[Cart Cache] Hit for user: ${userId}`);
            res.status(200).json({
                success: true,
                cart: cachedCart
            });
            return;
        }

        console.log(`[Cart Cache] Miss for user: ${userId}. Querying MongoDB.`);
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            res.status(200).json({
                success: true,
                cart: {
                    items: [],
                    groceryItems: [],
                    vendorId: null,
                    vendorName: null,
                    orderType: null
                }
            });
            return;
        }

        // Ensure old carts without groceryItems still load seamlessly
        if (!cart.groceryItems) {
            cart.groceryItems = [];
        }

        // Cache the found cart in Redis
        await cartCacheService.cacheCart(userId.toString(), cart);

        res.status(200).json({
            success: true,
            cart
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const syncCart = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?._id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized access" });
            return;
        }

        const {
            items = [],
            groceryItems = [],
            vendorId = null,
            vendorName = null,
            orderType = null,
            secondVendorId = null,
            secondRestaurant = null
        } = req.body;

        // Reject a second restaurant with 400 and a clear message
        if (secondVendorId || secondRestaurant) {
            res.status(400).json({
                success: false,
                message: "A cart can only contain items from exactly one restaurant. Cannot add items from a second restaurant."
            });
            return;
        }

        // Check if items array contains items from multiple restaurants
        if (items && Array.isArray(items)) {
            const hasForeignRestaurantItem = items.some((it: any) =>
                (it.restaurantId && vendorId && it.restaurantId.toString() !== vendorId.toString()) ||
                (it.vendorId && vendorId && it.vendorId.toString() !== vendorId.toString())
            );
            if (hasForeignRestaurantItem) {
                res.status(400).json({
                    success: false,
                    message: "A cart can only contain items from exactly one restaurant. Cannot mix multiple restaurants."
                });
                return;
            }
        }

        // Check if grocery items contain restaurant food items
        if (groceryItems && Array.isArray(groceryItems)) {
            const hasFoodInGrocery = groceryItems.some((it: any) =>
                it.restaurantId ||
                it.menuItem ||
                (typeof it.itemId === "string" && it.itemId.startsWith("food-")) ||
                (typeof it.id === "string" && it.id.startsWith("food-"))
            );
            if (hasFoodInGrocery) {
                res.status(400).json({
                    success: false,
                    message: "Grocery items section cannot contain restaurant items. Cannot mix multiple restaurants."
                });
                return;
            }
        }

        // Parse items and populate mongo references
        const parsedItems = items.map((item: any) => {
            const rawId = item.id || item.itemId;
            let menuItem = undefined;
            let groceryItem = undefined;

            if (orderType === "food" && rawId) {
                const cleanId = rawId.replace("food-", "");
                if (mongoose.Types.ObjectId.isValid(cleanId)) {
                    menuItem = new mongoose.Types.ObjectId(cleanId);
                }
            } else if (orderType === "grocery" && rawId) {
                const cleanId = rawId.replace("groc-", "");
                if (mongoose.Types.ObjectId.isValid(cleanId)) {
                    groceryItem = new mongoose.Types.ObjectId(cleanId);
                }
            }

            return {
                itemId: rawId,
                menuItem,
                groceryItem,
                name: item.name,
                price: Number(item.price),
                quantity: Number(item.quantity),
                img: item.img
            };
        });

        // Parse groceryItems and populate mongo references
        const parsedGroceryItems = (groceryItems || []).map((item: any) => {
            const rawId = item.id || item.itemId;
            let groceryItem = undefined;

            if (rawId) {
                const cleanId = rawId.replace("groc-", "");
                if (mongoose.Types.ObjectId.isValid(cleanId)) {
                    groceryItem = new mongoose.Types.ObjectId(cleanId);
                }
            }

            return {
                itemId: rawId,
                groceryItem,
                name: item.name,
                price: Number(item.price),
                quantity: Number(item.quantity),
                img: item.img
            };
        });

        let cart = await Cart.findOne({ user: userId });
        if (cart) {
            cart.items = parsedItems;
            cart.groceryItems = parsedGroceryItems;
            cart.vendorId = vendorId;
            cart.vendorName = vendorName;
            cart.orderType = orderType;
            await cart.save();
        } else {
            cart = new Cart({
                user: userId,
                items: parsedItems,
                groceryItems: parsedGroceryItems,
                vendorId,
                vendorName,
                orderType
            });
            await cart.save();
        }

        // Sync to Redis cache
        await cartCacheService.cacheCart(userId.toString(), cart);

        res.status(200).json({
            success: true,
            message: "Cart synced successfully",
            cart
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
