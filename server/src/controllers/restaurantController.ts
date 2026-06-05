import { Request, Response } from "express";
import Restaurant from "../models/Restaurant";
import MenuItem from "../models/MenuItem";
import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";

const uploadToCloudinary = (buffer: Buffer): Promise<string> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "ziprocket/menu" },
            (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

// --- RESTAURANT OPERATIONS ---

// Create a new restaurant
export const createRestaurant = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, owner, phone, location } = req.body;

        const newRestaurant = new Restaurant({
            name,
            owner,
            phone,
            location
        });

        await newRestaurant.save();

        res.status(201).json({
            success: true,
            message: "Restaurant created successfully",
            restaurant: newRestaurant
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all restaurants (can filter by status, isActive, deliveryZone)
export const getAllRestaurants = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status, isActive, deliveryZone } = req.query;
        let filter: any = {};
        
        if (status) filter.status = status;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (deliveryZone) filter.deliveryZone = deliveryZone;

        const restaurants = await Restaurant.find(filter).populate("owner", "name email");

        res.status(200).json({
            success: true,
            count: restaurants.length,
            restaurants
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get the authenticated seller's restaurant
export const getMyRestaurant = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user?._id }).populate("owner", "name email");

        if (!restaurant) {
            res.status(404).json({ success: false, message: "No restaurant found for this seller" });
            return;
        }

        res.status(200).json({
            success: true,
            restaurant
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get a single restaurant by ID
export const getRestaurantById = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findById(req.params.id).populate("owner", "name email");

        if (!restaurant) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        res.status(200).json({
            success: true,
            restaurant
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update restaurant details
export const updateRestaurant = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, phone, location, isActive } = req.body;

        const updateFields: any = {};
        if (name !== undefined) updateFields.name = name;
        if (phone !== undefined) updateFields.phone = phone;
        if (location !== undefined) updateFields.location = location;
        if (isActive !== undefined) updateFields.isActive = isActive;

        const restaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true, runValidators: true }
        );

        if (!restaurant) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Restaurant updated successfully",
            restaurant
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateRestaurantStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status, isBlocked, commission } = req.body;

        const updateFields: any = {};
        if (status !== undefined) updateFields.status = status;
        if (isBlocked !== undefined) updateFields.isBlocked = isBlocked;
        if (commission !== undefined) updateFields.commission = commission;

        const restaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true, runValidators: true }
        ).populate("owner", "name email");

        if (!restaurant) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Restaurant status updated successfully",
            restaurant
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a restaurant
export const deleteRestaurant = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findByIdAndDelete(req.params.id);

        if (!restaurant) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        // Optional: Delete associated menu items when a restaurant is deleted
        await MenuItem.deleteMany({ restaurant: req.params.id });

        res.status(200).json({
            success: true,
            message: "Restaurant and associated menu items deleted successfully"
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- MENU ITEM OPERATIONS ---

// Add a menu item to a restaurant
export const addMenuItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, price, category, isAvailable, isVeg } = req.body;
        const restaurantId = req.params.restaurantId;

        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        // Ownership check
        if (req.user?.role !== "admin" && restaurant.owner?.toString() !== req.user?._id?.toString()) {
            res.status(403).json({ success: false, message: "Unauthorized to modify this restaurant's menu" });
            return;
        }

        // Handle image uploads
        const imageUrls: string[] = [];
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                const url = await uploadToCloudinary(file.buffer);
                imageUrls.push(url);
            }
        }

        const newMenuItem = new MenuItem({
            restaurant: restaurantId,
            name,
            description,
            price: Number(price),
            category,
            images: imageUrls,
            isAvailable: isAvailable === 'true' || isAvailable === true,
            isVeg: isVeg === 'true' || isVeg === true
        });

        await newMenuItem.save();

        res.status(201).json({
            success: true,
            message: "Menu item added successfully",
            menuItem: newMenuItem
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all menu items for a specific restaurant
export const getRestaurantMenuItems = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurantId = req.params.restaurantId;

        const menuItems = await MenuItem.find({ restaurant: restaurantId });

        res.status(200).json({
            success: true,
            count: menuItems.length,
            menuItems
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update a menu item
export const updateMenuItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, price, category, isAvailable, isVeg } = req.body;

        const menuItemToUpdate = await MenuItem.findById(req.params.menuItemId);
        if (!menuItemToUpdate) {
            res.status(404).json({ success: false, message: "Menu item not found" });
            return;
        }

        const restaurant = await Restaurant.findById(menuItemToUpdate.restaurant);
        if (req.user?.role !== "admin" && (!restaurant || restaurant.owner?.toString() !== req.user?._id?.toString())) {
            res.status(403).json({ success: false, message: "Unauthorized to modify this menu item" });
            return;
        }

        // Handle image uploads (add to existing images or replace depending on logic)
        // We will just append them for now, or replace them. Let's replace if new images provided.
        let imageUrls = menuItemToUpdate.images || [];
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            imageUrls = []; // replace existing images if new ones are uploaded
            for (const file of req.files) {
                const url = await uploadToCloudinary(file.buffer);
                imageUrls.push(url);
            }
        }

        const updatedMenuItem = await MenuItem.findByIdAndUpdate(
            req.params.menuItemId,
            { 
                name, 
                description, 
                price: price ? Number(price) : undefined, 
                category, 
                images: imageUrls, 
                isAvailable: isAvailable !== undefined ? (isAvailable === 'true' || isAvailable === true) : undefined,
                isVeg: isVeg !== undefined ? (isVeg === 'true' || isVeg === true) : undefined
            },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Menu item updated successfully",
            menuItem: updatedMenuItem
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a menu item
export const deleteMenuItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const menuItem = await MenuItem.findById(req.params.menuItemId);

        if (!menuItem) {
            res.status(404).json({ success: false, message: "Menu item not found" });
            return;
        }

        const restaurant = await Restaurant.findById(menuItem.restaurant);
        if (req.user?.role !== "admin" && (!restaurant || restaurant.owner?.toString() !== req.user?._id?.toString())) {
            res.status(403).json({ success: false, message: "Unauthorized to delete this menu item" });
            return;
        }

        await MenuItem.findByIdAndDelete(req.params.menuItemId);

        res.status(200).json({
            success: true,
            message: "Menu item deleted successfully"
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
