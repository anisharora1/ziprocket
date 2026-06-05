import { Request, Response } from "express";
import GroceryProduct from "../models/GroceryProduct";
import MenuItem from "../models/MenuItem";
import mongoose from "mongoose";

export const getCartRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderType, vendorId, cartItemIds = [] } = req.body;

        if (!orderType) {
            res.status(400).json({ success: false, message: "orderType is required (food or grocery)" });
            return;
        }

        // Exclude clean IDs to prevent recommending what's already in the cart
        const cleanCartIds = cartItemIds.map((id: string) => {
            return id.replace("groc-", "").replace("food-", "");
        }).filter((id: string) => mongoose.Types.ObjectId.isValid(id));

        if (orderType === "grocery") {
            // ── GROCERY RECOMMENDATIONS ───────────────────────────────────────
            let recommendedProducts: any[] = [];

            // 1. Fetch the actual items currently in the cart to read their names and categories
            const cartProducts = await GroceryProduct.find({ _id: { $in: cleanCartIds } });
            
            // Extract categories
            const categories = cartProducts.map(p => p.category);
            const productNames = cartProducts.map(p => p.name.toLowerCase());

            // 2. Smart dynamic keyword mapping (e.g. Soya Chunks -> Rice, Cooking Oil, Masala, Atta, Salt)
            let complementaryKeywords: string[] = [];
            const hasSoya = productNames.some(name => name.includes("soya") || name.includes("chunk"));
            const hasRice = productNames.some(name => name.includes("rice"));
            const hasMaggi = productNames.some(name => name.includes("maggi") || name.includes("noodle"));

            if (hasSoya) {
                complementaryKeywords.push("rice", "oil", "masala", "atta", "salt");
            }
            if (hasRice) {
                complementaryKeywords.push("dal", "masala", "oil", "ghee", "salt");
            }
            if (hasMaggi) {
                complementaryKeywords.push("sauce", "ketchup", "cold drink", "coke", "chips");
            }

            // Also search categories of items inside cart to suggest similar products
            const categoryQuery: any = {
                _id: { $nin: cleanCartIds },
                isAvailable: true
            };

            // If we have complementary keywords, prioritize them
            if (complementaryKeywords.length > 0) {
                const keywordRegex = new RegExp(complementaryKeywords.join("|"), "i");
                const matchedKeywordItems = await GroceryProduct.find({
                    _id: { $nin: cleanCartIds },
                    isAvailable: true,
                    $or: [
                        { name: { $regex: keywordRegex } },
                        { category: { $regex: keywordRegex } }
                    ]
                }).limit(6);
                
                recommendedProducts.push(...matchedKeywordItems);
            }

            // Next, find similar items in the same categories
            if (categories.length > 0 && recommendedProducts.length < 8) {
                const sameCategoryItems = await GroceryProduct.find({
                    _id: { $nin: [...cleanCartIds, ...recommendedProducts.map(p => p._id)] },
                    isAvailable: true,
                    category: { $in: categories }
                }).limit(6);

                recommendedProducts.push(...sameCategoryItems);
            }

            // 3. General global inventory fallbacks if not enough items
            if (recommendedProducts.length < 5) {
                const fallbackItems = await GroceryProduct.find({
                    _id: { $nin: [...cleanCartIds, ...recommendedProducts.map(p => p._id)] },
                    isAvailable: true
                }).limit(10 - recommendedProducts.length);

                recommendedProducts.push(...fallbackItems);
            }

            res.status(200).json({
                success: true,
                recommendations: recommendedProducts.slice(0, 8)
            });

        } else if (orderType === "food") {
            // ── FOOD RECOMMENDATIONS ──────────────────────────────────────────
            if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
                res.status(400).json({ success: false, message: "Valid restaurant vendorId is required for food recommendations." });
                return;
            }

            // Food recommendations MUST come only from the selected restaurant!
            let recommendedFood: any[] = [];

            // 1. Fetch menu items in the cart to check their category (e.g. Burger -> Fries, Pizza, Soda)
            const cartMenuItems = await MenuItem.find({ _id: { $in: cleanCartIds } });
            const cartCategories = cartMenuItems.map(m => m.category);

            // Determine if they ordered a Burger or Pizza
            const hasBurgerOrPizza = cartMenuItems.some(m => 
                m.name.toLowerCase().includes("burger") || 
                m.name.toLowerCase().includes("pizza") ||
                m.name.toLowerCase().includes("sandwich")
            );

            // Prioritize upsell categories like Cold Drinks, Fries, Shakes, Desserts
            let upsellRegex = /drink|beverage|cola|pepsi|fries|sides|dessert|shake|sweet/i;

            if (hasBurgerOrPizza) {
                const upsellItems = await MenuItem.find({
                    restaurant: vendorId,
                    _id: { $nin: cleanCartIds },
                    isAvailable: true,
                    $or: [
                        { category: { $regex: upsellRegex } },
                        { name: { $regex: upsellRegex } }
                    ]
                }).limit(5);

                recommendedFood.push(...upsellItems);
            }

            // Add other items in the same categories
            if (recommendedFood.length < 6) {
                const sameCategoryFood = await MenuItem.find({
                    restaurant: vendorId,
                    _id: { $nin: [...cleanCartIds, ...recommendedFood.map(f => f._id)] },
                    isAvailable: true,
                    category: { $in: cartCategories }
                }).limit(5);

                recommendedFood.push(...sameCategoryFood);
            }

            // Fallback to any general available items from that restaurant
            if (recommendedFood.length < 5) {
                const fallbackFood = await MenuItem.find({
                    restaurant: vendorId,
                    _id: { $nin: [...cleanCartIds, ...recommendedFood.map(f => f._id)] },
                    isAvailable: true
                }).limit(8 - recommendedFood.length);

                recommendedFood.push(...fallbackFood);
            }

            res.status(200).json({
                success: true,
                recommendations: recommendedFood.slice(0, 8)
            });
        }
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
