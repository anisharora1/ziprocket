import express from "express";
import {
    createGroceryProduct,
    getAllGroceryProducts,
    getGroceryProductById,
    updateGroceryProduct,
    deleteGroceryProduct,
    getGroceryInventoryStats
} from "../controllers/groceryController";
import { protect, authorize } from "../middlewares/authMiddleware";
import { uploadMenuImages } from "../middlewares/uploadMiddleware";

const router = express.Router();

// Public Catalog Access
router.get("/", getAllGroceryProducts);

// Protected Moderator Stats View (must be defined BEFORE parametric /:id route)
router.get("/stats", protect, authorize("grocery_moderator", "admin"), getGroceryInventoryStats);

// Public Details View
router.get("/:id", getGroceryProductById);

// Protected Moderator CRUD Management
router.post("/", protect, authorize("grocery_moderator", "admin"), uploadMenuImages, createGroceryProduct);
router.put("/:id", protect, authorize("grocery_moderator", "admin"), uploadMenuImages, updateGroceryProduct);
router.delete("/:id", protect, authorize("grocery_moderator", "admin"), deleteGroceryProduct);

export default router;
