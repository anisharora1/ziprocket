import { Request, Response } from "express";
import GroceryProduct from "../models/GroceryProduct";
import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";

const uploadToCloudinary = (buffer: Buffer): Promise<string> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "ziprocket/grocery" },
            (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "") + "-" + Math.floor(1000 + Math.random() * 9000);
};

// Create a new grocery product (Admin/Moderator)
export const createGroceryProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            name,
            description,
            category,
            subcategory,
            brand,
            price,
            discountedPrice,
            stockQuantity,
            unit,
            weightSize,
            isAvailable,
            isFeatured,
            offerBadge,
            expiryDate
        } = req.body;

        const slug = generateSlug(name);

        const imageUrls: string[] = [];
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                const url = await uploadToCloudinary(file.buffer);
                imageUrls.push(url);
            }
        }

        const newProduct = new GroceryProduct({
            name,
            slug,
            description,
            category,
            subcategory,
            brand,
            price: Number(price),
            discountedPrice: discountedPrice ? Number(discountedPrice) : undefined,
            stockQuantity: Number(stockQuantity),
            unit,
            images: imageUrls,
            weightSize,
            isAvailable: isAvailable === "true" || isAvailable === true,
            isFeatured: isFeatured === "true" || isFeatured === true,
            offerBadge,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined
        });

        await newProduct.save();

        res.status(201).json({
            success: true,
            message: "Grocery product created successfully",
            product: newProduct
        });
    } catch (error: any) {
        console.error("Failed to create grocery product:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all grocery products with advanced filters & pagination
export const getAllGroceryProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category, subcategory, search, isFeatured, limit = 12, page = 1, outOfStock, lowStock } = req.query;

        const filter: any = {};

        if (category) filter.category = category;
        if (subcategory) filter.subcategory = subcategory;
        
        if (isFeatured !== undefined) {
            filter.isFeatured = isFeatured === "true";
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { brand: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
        }

        if (outOfStock === "true") {
            filter.stockQuantity = 0;
        } else if (lowStock === "true") {
            filter.stockQuantity = { $gt: 0, $lt: 10 };
        }

        const parsedLimit = Number(limit);
        const parsedSkip = (Number(page) - 1) * parsedLimit;

        const products = await GroceryProduct.find(filter)
            .sort({ createdAt: -1 })
            .skip(parsedSkip)
            .limit(parsedLimit);

        const total = await GroceryProduct.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: products.length,
            total,
            pages: Math.ceil(total / parsedLimit),
            products
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single grocery product details by ID or Slug
export const getGroceryProductById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        let product;
        
        if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
            product = await GroceryProduct.findById(id);
        } else {
            product = await GroceryProduct.findOne({ slug: id });
        }

        if (!product) {
            res.status(404).json({ success: false, message: "Product not found" });
            return;
        }

        res.status(200).json({ success: true, product });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update grocery product details (Admin/Moderator)
export const updateGroceryProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const updateData: any = { ...req.body };

        // Cast numbers explicitly
        if (updateData.price) updateData.price = Number(updateData.price);
        if (updateData.discountedPrice !== undefined) {
            updateData.discountedPrice = updateData.discountedPrice === "" ? null : Number(updateData.discountedPrice);
        }
        if (updateData.stockQuantity !== undefined) updateData.stockQuantity = Number(updateData.stockQuantity);
        
        if (updateData.isAvailable !== undefined) {
            updateData.isAvailable = updateData.isAvailable === "true" || updateData.isAvailable === true;
        }
        if (updateData.isFeatured !== undefined) {
            updateData.isFeatured = updateData.isFeatured === "true" || updateData.isFeatured === true;
        }

        // Handle image updates (append or replace)
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            const imageUrls: string[] = [];
            for (const file of req.files) {
                const url = await uploadToCloudinary(file.buffer);
                imageUrls.push(url);
            }
            updateData.images = imageUrls;
        }

        const product = await GroceryProduct.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!product) {
            res.status(404).json({ success: false, message: "Product not found" });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Grocery product updated successfully",
            product
        });
    } catch (error: any) {
        console.error("Failed to update grocery product:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete grocery product (Admin/Moderator)
export const deleteGroceryProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const product = await GroceryProduct.findByIdAndDelete(id);

        if (!product) {
            res.status(404).json({ success: false, message: "Product not found" });
            return;
        }

        res.status(200).json({ success: true, message: "Product deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Fetch real-time Inventory Statistics (Admin/Moderator)
export const getGroceryInventoryStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const totalProducts = await GroceryProduct.countDocuments();
        const outOfStockProducts = await GroceryProduct.countDocuments({ stockQuantity: 0 });
        const lowStockProducts = await GroceryProduct.countDocuments({ stockQuantity: { $gt: 0, $lt: 10 } });
        
        // Sum total inventory valuation (price * stock)
        const valuationResult = await GroceryProduct.aggregate([
            {
                $group: {
                    _id: null,
                    totalValuation: { $sum: { $multiply: ["$price", "$stockQuantity"] } }
                }
            }
        ]);

        const totalValuation = valuationResult[0]?.totalValuation || 0;

        res.status(200).json({
            success: true,
            stats: {
                totalProducts,
                outOfStockProducts,
                lowStockProducts,
                totalValuation
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
