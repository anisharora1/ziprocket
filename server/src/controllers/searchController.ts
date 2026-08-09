import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Restaurant from "../models/Restaurant";
import MenuItem from "../models/MenuItem";
import GroceryProduct from "../models/GroceryProduct";
import Order from "../models/Order";

// Utility: Sanitize search query input to prevent NoSQL injection and strip illegal regex chars
const sanitizeSearchQuery = (query: any): string => {
    if (typeof query !== "string") return "";
    return query.replace(/[|&;$%@"<>()+,*?^#]/g, "").trim();
};

/**
 * @desc Get Search Suggestions / Autocomplete
 * @route GET /api/search/suggestions
 * @access Public
 */
export const getSearchSuggestions = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = sanitizeSearchQuery(req.query.q);
        const type = req.query.type || "all"; // 'grocery', 'food', or 'all'

        if (!query || query.length < 2) {
            res.status(200).json({ success: true, suggestions: [] });
            return;
        }

        const limit = 5;
        const suggestions: string[] = [];

        // Anchored regex search on prefix (extremely fast because it uses the single-field indexes on name)
        const prefixFilter = { name: { $regex: `^${query}`, $options: "i" } };

        const promises: Promise<any[]>[] = [];

        if (type === "all" || type === "grocery") {
            promises.push(
                GroceryProduct.find(prefixFilter)
                    .select("name")
                    .limit(limit)
                    .lean()
                    .then(items => items.map(i => i.name))
            );
        }

        if (type === "all" || type === "food") {
            promises.push(
                MenuItem.find({ ...prefixFilter, isAvailable: true })
                    .select("name")
                    .limit(limit)
                    .lean()
                    .then(items => items.map(i => i.name))
            );
            promises.push(
                Restaurant.find({ ...prefixFilter, isActive: true, status: "approved" })
                    .select("name")
                    .limit(limit)
                    .lean()
                    .then(items => items.map(i => i.name))
            );
        }

        const results = await Promise.all(promises);
        results.forEach(list => suggestions.push(...list));

        // Deduplicate and limit total suggestions
        const uniqueSuggestions = Array.from(new Set(suggestions)).slice(0, 10);

        res.status(200).json({
            success: true,
            suggestions: uniqueSuggestions
        });
    } catch (error: any) {
        console.error("Autocomplete suggestions error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc Global Search across multiple collections (Restaurants, Grocery Products, Menu Items)
 * @route GET /api/search/global
 * @access Public
 */
export const searchGlobal = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = sanitizeSearchQuery(req.query.q);
        const zoneId = req.query.zoneId;

        if (!query) {
            res.status(200).json({
                success: true,
                query: "",
                results: { restaurants: [], groceryProducts: [], menuItems: [] }
            });
            return;
        }

        const limit = 5;

        // Perform parallel queries using MongoDB text search indexes
        const groceryPromise = GroceryProduct.find(
            { $text: { $search: query }, isAvailable: true },
            { score: { $meta: "textScore" } }
        )
            .sort({ score: { $meta: "textScore" } })
            .limit(limit)
            .lean();

        const restFilter: any = {
            $text: { $search: query },
            isActive: true,
            status: "approved"
        };
        if (zoneId && mongoose.Types.ObjectId.isValid(zoneId as string)) {
            restFilter.deliveryZone = new mongoose.Types.ObjectId(zoneId as string);
        }

        const restaurantPromise = Restaurant.find(
            restFilter,
            { score: { $meta: "textScore" } }
        )
            .sort({ score: { $meta: "textScore" } })
            .limit(limit)
            .lean();

        const menuItemPromise = MenuItem.find(
            { $text: { $search: query }, isAvailable: true },
            { score: { $meta: "textScore" } }
        )
            .populate({
                path: "restaurant",
                match: {
                    isActive: true,
                    status: "approved",
                    ...(zoneId && mongoose.Types.ObjectId.isValid(zoneId as string)
                        ? { deliveryZone: new mongoose.Types.ObjectId(zoneId as string) }
                        : {})
                },
                select: "name location phone status isActive deliveryZone"
            })
            .sort({ score: { $meta: "textScore" } })
            .limit(limit * 3) // fetch more to account for filtered out items
            .lean();

        const [groceryProducts, restaurants, rawMenuItems] = await Promise.all([
            groceryPromise,
            restaurantPromise,
            menuItemPromise
        ]);

        // Filter out menu items whose restaurants did not match active/approved/zone criteria
        let finalMenuItems = (rawMenuItems || [])
            .filter((item: any) => item.restaurant !== null && item.restaurant !== undefined)
            .slice(0, limit);

        // Fallback to partial name matching if text score returns empty results
        let finalGrocery = groceryProducts;
        if (groceryProducts.length === 0) {
            finalGrocery = await GroceryProduct.find({
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { brand: { $regex: query, $options: "i" } },
                    { category: { $regex: query, $options: "i" } },
                    { subcategory: { $regex: query, $options: "i" } },
                    { description: { $regex: query, $options: "i" } }
                ],
                isAvailable: true
            })
                .limit(limit)
                .lean();
        }

        let finalRestaurants = restaurants;
        if (restaurants.length === 0) {
            const fallbackFilter: any = {
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { cuisines: { $regex: query, $options: "i" } },
                    { "location.address": { $regex: query, $options: "i" } }
                ],
                isActive: true,
                status: "approved"
            };
            if (zoneId && mongoose.Types.ObjectId.isValid(zoneId as string)) {
                fallbackFilter.deliveryZone = new mongoose.Types.ObjectId(zoneId as string);
            }
            finalRestaurants = await Restaurant.find(fallbackFilter)
                .limit(limit)
                .lean();
        }

        if (finalMenuItems.length === 0) {
            const fallbackMenuItems = await MenuItem.find({
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { category: { $regex: query, $options: "i" } },
                    { description: { $regex: query, $options: "i" } }
                ],
                isAvailable: true
            })
                .populate({
                    path: "restaurant",
                    match: {
                        isActive: true,
                        status: "approved",
                        ...(zoneId && mongoose.Types.ObjectId.isValid(zoneId as string)
                            ? { deliveryZone: new mongoose.Types.ObjectId(zoneId as string) }
                            : {})
                    },
                    select: "name location phone status isActive deliveryZone"
                })
                .limit(limit * 3)
                .lean();

            finalMenuItems = (fallbackMenuItems || [])
                .filter((item: any) => item.restaurant !== null && item.restaurant !== undefined)
                .slice(0, limit);
        }

        res.status(200).json({
            success: true,
            query,
            results: {
                restaurants: finalRestaurants,
                groceryProducts: finalGrocery,
                menuItems: finalMenuItems
            }
        });
    } catch (error: any) {
        console.error("Global search error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc Search Grocery Products Catalog
 * @route GET /api/search/grocery
 * @access Public
 */
export const searchGrocery = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = sanitizeSearchQuery(req.query.q);
        const { category, subcategory, isAvailable, isFeatured, minPrice, maxPrice } = req.query;
        
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 12));
        const skip = (page - 1) * limit;

        const filter: any = {};

        // 1. Text Query or Fallback
        let isTextSearch = false;
        if (query) {
            filter.$text = { $search: query };
            isTextSearch = true;
        }

        // 2. Filters
        if (category) filter.category = category;
        if (subcategory) filter.subcategory = subcategory;
        
        if (isAvailable !== undefined) {
            filter.isAvailable = isAvailable === "true";
        }
        if (isFeatured !== undefined) {
            filter.isFeatured = isFeatured === "true";
        }

        // Price constraints
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        // 3. Sorting logic
        let sortOption: any = { createdAt: -1 };
        if (isTextSearch) {
            sortOption = { score: { $meta: "textScore" } };
        }
        if (req.query.sort === "priceAsc") sortOption = { price: 1 };
        if (req.query.sort === "priceDesc") sortOption = { price: -1 };

        let products = await GroceryProduct.find(
            filter,
            isTextSearch ? { score: { $meta: "textScore" } } : {}
        )
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await GroceryProduct.countDocuments(filter);

        // Fallback for partial keyword search if text index yields no results
        if (query && products.length === 0) {
            delete filter.$text;
            filter.name = { $regex: query, $options: "i" };
            
            products = await GroceryProduct.find(filter)
                .sort(req.query.sort === "priceAsc" ? { price: 1 } : req.query.sort === "priceDesc" ? { price: -1 } : { createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            total = await GroceryProduct.countDocuments(filter);
            isTextSearch = false;
        }

        res.status(200).json({
            success: true,
            query,
            meta: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            },
            results: products
        });
    } catch (error: any) {
        console.error("Search grocery error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc Search Restaurants
 * @route GET /api/search/restaurants
 * @access Public
 */
export const searchRestaurants = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = sanitizeSearchQuery(req.query.q);
        const { deliveryZone, status, isActive } = req.query;

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 12));
        const skip = (page - 1) * limit;

        const filter: any = {};

        let isTextSearch = false;
        if (query) {
            filter.$text = { $search: query };
            isTextSearch = true;
        }

        if (deliveryZone && mongoose.Types.ObjectId.isValid(deliveryZone as string)) {
            filter.deliveryZone = new mongoose.Types.ObjectId(deliveryZone as string);
        }
        if (status) filter.status = status;
        if (isActive !== undefined) {
            filter.isActive = isActive === "true";
        }

        let sortOption: any = { createdAt: -1 };
        if (isTextSearch) {
            sortOption = { score: { $meta: "textScore" } };
        }
        if (req.query.sort === "ratingDesc") sortOption = { rating: -1 };

        let restaurants = await Restaurant.find(
            filter,
            isTextSearch ? { score: { $meta: "textScore" } } : {}
        )
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await Restaurant.countDocuments(filter);

        // Fallback for partial matching
        if (query && restaurants.length === 0) {
            delete filter.$text;
            filter.name = { $regex: query, $options: "i" };

            restaurants = await Restaurant.find(filter)
                .sort(req.query.sort === "ratingDesc" ? { rating: -1 } : { createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            total = await Restaurant.countDocuments(filter);
        }

        res.status(200).json({
            success: true,
            query,
            meta: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            },
            results: restaurants
        });
    } catch (error: any) {
        console.error("Search restaurants error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc Search Menu Items
 * @route GET /api/search/menu-items
 * @access Public
 */
export const searchMenuItems = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = sanitizeSearchQuery(req.query.q);
        const { restaurant, isAvailable, category, isVeg } = req.query;

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 12));
        const skip = (page - 1) * limit;

        const filter: any = {};

        let isTextSearch = false;
        if (query) {
            filter.$text = { $search: query };
            isTextSearch = true;
        }

        if (restaurant && mongoose.Types.ObjectId.isValid(restaurant as string)) {
            filter.restaurant = new mongoose.Types.ObjectId(restaurant as string);
        }
        if (isAvailable !== undefined) {
            filter.isAvailable = isAvailable === "true";
        }
        if (category) filter.category = category;
        if (isVeg !== undefined) {
            filter.isVeg = isVeg === "true";
        }

        let sortOption: any = { createdAt: -1 };
        if (isTextSearch) {
            sortOption = { score: { $meta: "textScore" } };
        }
        if (req.query.sort === "priceAsc") sortOption = { price: 1 };
        if (req.query.sort === "priceDesc") sortOption = { price: -1 };

        let menuItems = await MenuItem.find(
            filter,
            isTextSearch ? { score: { $meta: "textScore" } } : {}
        )
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .populate("restaurant", "name location phone")
            .lean();

        let total = await MenuItem.countDocuments(filter);

        // Fallback for partial matching
        if (query && menuItems.length === 0) {
            delete filter.$text;
            filter.name = { $regex: query, $options: "i" };

            menuItems = await MenuItem.find(filter)
                .sort(req.query.sort === "priceAsc" ? { price: 1 } : req.query.sort === "priceDesc" ? { price: -1 } : { createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("restaurant", "name location phone")
                .lean();

            total = await MenuItem.countDocuments(filter);
        }

        res.status(200).json({
            success: true,
            query,
            meta: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            },
            results: menuItems
        });
    } catch (error: any) {
        console.error("Search menu items error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc Admin Search Users (Customers, Sellers, Riders)
 * @route GET /api/search/admin/users
 * @access Private (Admin/Moderator)
 */
export const adminSearchUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = sanitizeSearchQuery(req.query.q);
        const { role, isBlocked, approvalStatus } = req.query;

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 15));
        const skip = (page - 1) * limit;

        const filter: any = {};

        let isTextSearch = false;
        if (query) {
            // Check if it's an exact phone query or general text search
            const cleanPhoneQuery = query.replace(/\D/g, "");
            if (cleanPhoneQuery.length >= 8) {
                filter.phone = { $regex: cleanPhoneQuery };
            } else {
                filter.$text = { $search: query };
                isTextSearch = true;
            }
        }

        if (role) filter.role = role;
        if (isBlocked !== undefined) {
            filter.isBlocked = isBlocked === "true";
        }
        if (approvalStatus) filter.approvalStatus = approvalStatus;

        let sortOption: any = { createdAt: -1 };
        if (isTextSearch) {
            sortOption = { score: { $meta: "textScore" } };
        }

        let users = await User.find(
            filter,
            isTextSearch ? { score: { $meta: "textScore" } } : {}
        )
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await User.countDocuments(filter);

        // Fallback for partial matching
        if (query && users.length === 0 && !filter.phone) {
            delete filter.$text;
            filter.name = { $regex: query, $options: "i" };

            users = await User.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            total = await User.countDocuments(filter);
        }

        res.status(200).json({
            success: true,
            query,
            meta: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            },
            results: users
        });
    } catch (error: any) {
        console.error("Admin search users error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc Admin Search Orders
 * @route GET /api/search/admin/orders
 * @access Private (Admin/Moderator)
 */
export const adminSearchOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = sanitizeSearchQuery(req.query.q);
        const { orderStatus, orderType, paymentStatus } = req.query;

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 15));
        const skip = (page - 1) * limit;

        const filter: any = {};

        // Admin can search by couponCode, user phone/name, or restaurant name
        if (query) {
            // 1. Check if the query is an ObjectId
            if (mongoose.Types.ObjectId.isValid(query)) {
                filter.$or = [
                    { _id: new mongoose.Types.ObjectId(query) },
                    { user: new mongoose.Types.ObjectId(query) },
                    { restaurant: new mongoose.Types.ObjectId(query) },
                    { deliveryZone: new mongoose.Types.ObjectId(query) }
                ];
            } else {
                // 2. Resolve matching User/Restaurant references by searching their text indexes first
                const userIdsPromise = User.find({ $text: { $search: query } }).select("_id").lean().then(users => users.map(u => u._id));
                const restaurantIdsPromise = Restaurant.find({ $text: { $search: query } }).select("_id").lean().then(rests => rests.map(r => r._id));
                
                const [userIds, restaurantIds] = await Promise.all([userIdsPromise, restaurantIdsPromise]);

                filter.$or = [
                    { couponCode: { $regex: query, $options: "i" } },
                    { paymentMethod: { $regex: query, $options: "i" } }
                ];

                if (userIds.length > 0) {
                    filter.$or.push({ user: { $in: userIds } });
                }
                if (restaurantIds.length > 0) {
                    filter.$or.push({ restaurant: { $in: restaurantIds } });
                }
            }
        }

        if (orderStatus) filter.orderStatus = orderStatus;
        if (orderType) filter.orderType = orderType;
        if (paymentStatus) filter.paymentStatus = paymentStatus;

        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("user", "name phone email")
            .populate("restaurant", "name owner phone location")
            .lean();

        const total = await Order.countDocuments(filter);

        res.status(200).json({
            success: true,
            query,
            meta: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            },
            results: orders
        });
    } catch (error: any) {
        console.error("Admin search orders error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
