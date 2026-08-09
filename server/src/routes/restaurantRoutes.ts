import express from "express";
import {
    createRestaurant,
    getAllRestaurants,
    getRestaurantById,
    updateRestaurant,
    updateRestaurantStatus,
    deleteRestaurant,
    addMenuItem,
    getRestaurantMenuItems,
    updateMenuItem,
    deleteMenuItem,
    getMyRestaurant
} from "../controllers/restaurantController";
import { uploadMenuImages, uploadRestaurantImages } from "../middlewares/uploadMiddleware";
import { protect, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

// Seller Route
router.get("/my-restaurant", protect, authorize("seller", "admin"), getMyRestaurant);

// Restaurant Routes
router.post("/", protect, authorize("admin"), createRestaurant);
router.get("/", getAllRestaurants);
router.get("/:id", getRestaurantById);
router.put("/:id", protect, authorize("seller", "admin"), uploadRestaurantImages, updateRestaurant);
router.patch("/:id/status", protect, authorize("admin"), updateRestaurantStatus);
router.delete("/:id", protect, authorize("admin"), deleteRestaurant);

// Menu Item Routes
router.post("/:restaurantId/menu", protect, authorize("seller", "admin"), uploadMenuImages, addMenuItem);
router.get("/:restaurantId/menu", getRestaurantMenuItems);
router.put("/menu/:menuItemId", protect, authorize("seller", "admin"), uploadMenuImages, updateMenuItem);
router.delete("/menu/:menuItemId", protect, authorize("seller", "admin"), deleteMenuItem);

export default router;
