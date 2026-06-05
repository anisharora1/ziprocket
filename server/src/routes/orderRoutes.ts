import express from "express";
import {
    createOrder,
    getOrderById,
    getUserOrders,
    getRestaurantOrders,
    updateOrderStatus,
    updatePaymentStatus,
    getAllOrders,
    getMyOrders,
    getGroceryOrders,
    getGroceryZoneUsers,
    cancelOrder
} from "../controllers/orderController";
import { protect, authorize } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/", createOrder);
router.get("/", protect, authorize("admin"), getAllOrders);

// Protected Grocery Moderator Route
router.get("/grocery", protect, authorize("grocery_moderator", "admin"), getGroceryOrders);
router.get("/grocery/users", protect, authorize("grocery_moderator", "admin"), getGroceryZoneUsers);

// Protected Seller Route
router.get("/my-orders", protect, authorize("seller", "admin"), getMyOrders);

router.get("/:id", getOrderById);

router.get("/user/:userId", protect, authorize("customer", "admin"), getUserOrders);
router.get("/restaurant/:restaurantId", getRestaurantOrders);

router.patch("/:id/status", protect, authorize("seller", "admin", "delivery", "grocery_moderator"), updateOrderStatus);
router.patch("/:id/payment", updatePaymentStatus);
router.patch("/:id/cancel", protect, cancelOrder);

export default router;
