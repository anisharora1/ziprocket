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

const router = express.Router();

router.post("/moderators", createGroceryModerator);
router.put("/moderators/:id", updateGroceryModerator);
router.get("/moderators", getGroceryModerators);

router.get("/dashboard-stats", getDashboardStats);

router.get("/deliveries", getAllDeliveryProfiles);
router.patch("/deliveries/:id", updateDeliveryProfileStatus);

router.get("/cancellations/users", getHighCancellationUsers);
router.get("/cancellations/restaurants", getHighCancellationRestaurants);

router.patch("/users/:userId/block-status", toggleUserBlockStatus);
router.patch("/restaurants/:restaurantId/block-status", toggleRestaurantBlockStatus);

router.patch("/users/:userId/reset-cancellations", resetUserCancellationCount);
router.patch("/restaurants/:restaurantId/reset-cancellations", resetRestaurantCancellationCount);

router.post("/delivery-boy", addDeliveryBoy);

// Applications
router.get("/applications/pending", getPendingApplications);
router.patch("/applications/:type/:id/approve", approveApplication);
router.patch("/applications/:type/:id/reject", rejectApplication);

// Menu Moderation
router.patch("/menu/:menuItemId/block-status", toggleMenuItemBlockStatus);
router.delete("/menu/:menuItemId", adminDeleteMenuItem);

// Promotions / Banner Ads Management
router.get("/promotions", getAllPromotions);
router.post("/promotions", createPromotion);
router.patch("/promotions/:id/status", togglePromotionStatus);
router.delete("/promotions/:id", deletePromotion);

export default router;
