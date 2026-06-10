import { Request, Response } from "express";
import Restaurant from "../models/Restaurant";
import MenuItem from "../models/MenuItem";
import { uploadToCloudinary, deleteFromCloudinary } from "../services/cloudinaryService";
import * as restaurantCacheService from "../services/restaurantCacheService";

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

        // Invalidate list caches
        await restaurantCacheService.invalidateRestaurantCache();

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
        const cacheKeySuffix = `list:${status || "any"}:${isActive !== undefined ? isActive : "any"}:${deliveryZone || "any"}`;

        const cachedList = await restaurantCacheService.getCachedRestaurantList(cacheKeySuffix);
        if (cachedList) {
            console.log(`[Restaurant Cache] Hit for list key: restaurants:${cacheKeySuffix}`);
            res.status(200).json({
                success: true,
                count: cachedList.length,
                restaurants: cachedList
            });
            return;
        }

        console.log(`[Restaurant Cache] Miss for list key: restaurants:${cacheKeySuffix}. Querying MongoDB.`);
        let filter: any = {};
        
        if (status) filter.status = status;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (deliveryZone) filter.deliveryZone = deliveryZone;

        const restaurants = await Restaurant.find(filter).populate("owner", "name email");

        // Cache lists in Redis
        await restaurantCacheService.cacheRestaurantList(cacheKeySuffix, restaurants);

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
        const id = req.params.id as string;
        const cachedDetail = await restaurantCacheService.getCachedRestaurantDetail(id);
        if (cachedDetail) {
            console.log(`[Restaurant Cache] Hit for detail key: restaurant:detail:${id}`);
            res.status(200).json({
                success: true,
                restaurant: cachedDetail
            });
            return;
        }

        console.log(`[Restaurant Cache] Miss for detail key: restaurant:detail:${id}. Querying MongoDB.`);
        const restaurant = await Restaurant.findById(id).populate("owner", "name email");

        if (!restaurant) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        // Cache detail in Redis
        await restaurantCacheService.cacheRestaurantDetail(id, restaurant);

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
        const restaurantToUpdate = await Restaurant.findById(req.params.id);
        if (!restaurantToUpdate) {
            res.status(404).json({ success: false, message: "Restaurant not found" });
            return;
        }

        const { name, phone, location, isActive } = req.body;

        const updateFields: any = {};
        if (name !== undefined) updateFields.name = name;
        if (phone !== undefined) updateFields.phone = phone;
        if (location !== undefined) updateFields.location = location;
        if (isActive !== undefined) updateFields.isActive = isActive;

        // Handle file uploads (image, logo, gallery) from multer
        if (req.files && typeof req.files === "object" && !Array.isArray(req.files)) {
            const filesObj = req.files as { [fieldname: string]: Express.Multer.File[] };
            
            const imageFile = filesObj["image"]?.[0];
            if (imageFile) {
                if (restaurantToUpdate.image?.publicId) {
                    await deleteFromCloudinary(restaurantToUpdate.image.publicId);
                }
                updateFields.image = await uploadToCloudinary(imageFile.buffer, "restaurants");
            }

            const logoFile = filesObj["logo"]?.[0];
            if (logoFile) {
                if (restaurantToUpdate.logo?.publicId) {
                    await deleteFromCloudinary(restaurantToUpdate.logo.publicId);
                }
                updateFields.logo = await uploadToCloudinary(logoFile.buffer, "restaurants");
            }

            const galleryFiles = filesObj["gallery"];
            if (galleryFiles && galleryFiles.length > 0) {
                if (restaurantToUpdate.gallery && restaurantToUpdate.gallery.length > 0) {
                    for (const img of (restaurantToUpdate.gallery as any[])) {
                        if (img.publicId) {
                            await deleteFromCloudinary(img.publicId);
                        }
                    }
                }
                const galleryUrls = [];
                for (const file of galleryFiles) {
                    const uploadResult = await uploadToCloudinary(file.buffer, "restaurants");
                    galleryUrls.push(uploadResult);
                }
                updateFields.gallery = galleryUrls;
            }
        }

        const restaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true, runValidators: true }
        );

        if (restaurant) {
            // Invalidate cache
            await restaurantCacheService.invalidateRestaurantCache(restaurant._id.toString());
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

        // Invalidate cache
        await restaurantCacheService.invalidateRestaurantCache(restaurant._id.toString());

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

        // Invalidate cache
        await restaurantCacheService.invalidateRestaurantCache(req.params.id as string);

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
        const imageUrls: any[] = [];
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                const uploadResult = await uploadToCloudinary(file.buffer, "products");
                imageUrls.push(uploadResult);
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

        // Invalidate menu and listings cache
        await restaurantCacheService.invalidateRestaurantCache(restaurantId as string);

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
        const restaurantId = req.params.restaurantId as string;

        const cachedMenu = await restaurantCacheService.getCachedRestaurantMenu(restaurantId);
        if (cachedMenu) {
            console.log(`[Restaurant Cache] Hit for menu key: restaurant:menu:${restaurantId}`);
            res.status(200).json({
                success: true,
                count: cachedMenu.length,
                menuItems: cachedMenu
            });
            return;
        }

        console.log(`[Restaurant Cache] Miss for menu key: restaurant:menu:${restaurantId}. Querying MongoDB.`);
        const menuItems = await MenuItem.find({ restaurant: restaurantId });

        // Cache the menu list
        await restaurantCacheService.cacheRestaurantMenu(restaurantId, menuItems);

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
            if (menuItemToUpdate.images && menuItemToUpdate.images.length > 0) {
                for (const img of (menuItemToUpdate.images as any[])) {
                    if (img.publicId) {
                        await deleteFromCloudinary(img.publicId);
                    }
                }
            }
            imageUrls = []; // replace existing images if new ones are uploaded
            for (const file of req.files) {
                const uploadResult = await uploadToCloudinary(file.buffer, "products");
                imageUrls.push(uploadResult);
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

        if (updatedMenuItem) {
            // Invalidate restaurant menu cache
            await restaurantCacheService.invalidateRestaurantCache(updatedMenuItem.restaurant.toString());
        }

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

        if (menuItem.images && menuItem.images.length > 0) {
            for (const img of (menuItem.images as any[])) {
                if (img.publicId) {
                    await deleteFromCloudinary(img.publicId);
                }
            }
        }
        
        const restId = menuItem.restaurant.toString();
        await MenuItem.findByIdAndDelete(req.params.menuItemId);

        // Invalidate restaurant menu cache
        await restaurantCacheService.invalidateRestaurantCache(restId);

        res.status(200).json({
            success: true,
            message: "Menu item deleted successfully"
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
