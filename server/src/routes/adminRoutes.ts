import express from "express";
import {
    getDashboardStats,
    getHighCancellationUsers,
    getHighCancellationRestaurants,
    toggleUserBlockStatus,
    toggleRestaurantBlockStatus,
    resetUserCancellationCount,
    resetRestaurantCancellationCount,
    addDeliveryBoy,
    getPendingApplications,
    approveApplication,
    rejectApplication,
    toggleMenuItemBlockStatus,
    adminDeleteMenuItem,
    createGroceryModerator,
    updateGroceryModerator,
    getGroceryModerators,
    getAllDeliveryProfiles,
    updateDeliveryProfileStatus,
    getAllPromotions,
    createPromotion,
    togglePromotionStatus,
    deletePromotion
} from "../controllers/adminController";
import { protect, authorize } from "../middleware/authMiddleware";
import { adminLimiter } from "../middlewares/rateLimitMiddleware";
import { validateObjectId } from "../middlewares/authSecurityMiddleware";

const router = express.Router();

// Apply global protection, authorization, and rate limiting to all admin endpoints
router.use(protect);
router.use(authorize("admin"));
router.use(adminLimiter);

// Moderators
router.post("/moderators", createGroceryModerator);
router.put("/moderators/:id", validateObjectId(["id"]), updateGroceryModerator);
router.get("/moderators", getGroceryModerators);

// Dashboard
router.get("/dashboard-stats", getDashboardStats);

// Deliveries
router.get("/deliveries", getAllDeliveryProfiles);
router.patch("/deliveries/:id", validateObjectId(["id"]), updateDeliveryProfileStatus);

// Cancellations
router.get("/cancellations/users", getHighCancellationUsers);
router.get("/cancellations/restaurants", getHighCancellationRestaurants);

// User & Restaurant Management
router.patch("/users/:userId/block-status", validateObjectId(["userId"]), toggleUserBlockStatus);
router.patch("/restaurants/:restaurantId/block-status", validateObjectId(["restaurantId"]), toggleRestaurantBlockStatus);

router.patch("/users/:userId/reset-cancellations", validateObjectId(["userId"]), resetUserCancellationCount);
router.patch("/restaurants/:restaurantId/reset-cancellations", validateObjectId(["restaurantId"]), resetRestaurantCancellationCount);

// Delivery Boy addition
router.post("/delivery-boy", addDeliveryBoy);

// Applications
router.get("/applications/pending", getPendingApplications);
router.patch("/applications/:type/:id/approve", validateObjectId(["id"]), approveApplication);
router.patch("/applications/:type/:id/reject", validateObjectId(["id"]), rejectApplication);

// Menu Moderation
router.patch("/menu/:menuItemId/block-status", validateObjectId(["menuItemId"]), toggleMenuItemBlockStatus);
router.delete("/menu/:menuItemId", validateObjectId(["menuItemId"]), adminDeleteMenuItem);

// Promotions / Banner Ads Management
router.get("/promotions", getAllPromotions);
router.post("/promotions", createPromotion);
router.patch("/promotions/:id/status", validateObjectId(["id"]), togglePromotionStatus);
router.delete("/promotions/:id", validateObjectId(["id"]), deletePromotion);

export default router;
