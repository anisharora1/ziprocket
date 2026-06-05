import express from "express";
import { protect, authorize } from "../middleware/authMiddleware";
import {
    getSearchSuggestions,
    searchGlobal,
    searchGrocery,
    searchRestaurants,
    searchMenuItems,
    adminSearchUsers,
    adminSearchOrders
} from "../controllers/searchController";

const router = express.Router();

// Autocomplete and typeahead suggestions (Public)
router.get("/suggestions", getSearchSuggestions);

// Global customer search (Public)
router.get("/global", searchGlobal);

// Collection-specific searches (Public)
router.get("/grocery", searchGrocery);
router.get("/restaurants", searchRestaurants);
router.get("/menu-items", searchMenuItems);

// Admin / Moderator Search routes (Protected)
router.get("/admin/users", protect, authorize("admin", "grocery_moderator"), adminSearchUsers);
router.get("/admin/orders", protect, authorize("admin", "grocery_moderator"), adminSearchOrders);

export default router;
