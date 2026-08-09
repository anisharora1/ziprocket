import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware";
import {
    getSearchSuggestions,
    searchGlobal,
    searchGrocery,
    searchRestaurants,
    searchMenuItems,
    adminSearchUsers,
    adminSearchOrders
} from "../controllers/searchController";
import { searchLimiter } from "../middlewares/rateLimitMiddleware";

const router = express.Router();

// Autocomplete and typeahead suggestions (Public)
router.get("/suggestions", searchLimiter, getSearchSuggestions);

// Global customer search (Public)
router.get("/global", searchLimiter, searchGlobal);

// Collection-specific searches (Public)
router.get("/grocery", searchLimiter, searchGrocery);
router.get("/restaurants", searchLimiter, searchRestaurants);
router.get("/menu-items", searchLimiter, searchMenuItems);

// Admin / Moderator Search routes (Protected)
router.get("/admin/users", protect, authorize("admin", "grocery_moderator"), adminSearchUsers);
router.get("/admin/orders", protect, authorize("admin", "grocery_moderator"), adminSearchOrders);

export default router;
