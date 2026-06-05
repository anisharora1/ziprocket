import { Request, Response } from "express";
import Cart from "../models/Cart";
import mongoose from "mongoose";

export const getCart = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?._id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized access" });
            return;
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            res.status(200).json({
                success: true,
                cart: {
                    items: [],
                    vendorId: null,
                    vendorName: null,
                    orderType: null
                }
            });
            return;
        }

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

        const { items = [], vendorId = null, vendorName = null, orderType = null } = req.body;

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

        let cart = await Cart.findOne({ user: userId });
        if (cart) {
            cart.items = parsedItems;
            cart.vendorId = vendorId;
            cart.vendorName = vendorName;
            cart.orderType = orderType;
            await cart.save();
        } else {
            cart = new Cart({
                user: userId,
                items: parsedItems,
                vendorId,
                vendorName,
                orderType
            });
            await cart.save();
        }

        res.status(200).json({
            success: true,
            message: "Cart synced successfully",
            cart
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
