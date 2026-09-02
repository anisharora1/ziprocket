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
    getSellerDashboardStats,
    getGroceryOrders,
    getGroceryZoneUsers,
    cancelOrder,
    rateOrder
} from "../controllers/orderController";
import { protect, authorize } from "../middlewares/authMiddleware";
import { validateObjectId } from "../middlewares/authSecurityMiddleware";
import { validateRequest } from "../middlewares/validateRequest";
import { createOrderSchema } from "../validators/schemas";

const router = express.Router();

router.post("/", protect, validateRequest({ body: createOrderSchema }), createOrder);
router.get("/", protect, authorize("admin"), getAllOrders);

// Protected Grocery Moderator Route
router.get("/grocery", protect, authorize("grocery_moderator", "admin"), getGroceryOrders);
router.get("/grocery/users", protect, authorize("grocery_moderator", "admin"), getGroceryZoneUsers);

// Protected Seller Route
router.get("/seller/stats", protect, authorize("seller", "admin"), getSellerDashboardStats);
router.get("/my-orders", protect, authorize("seller", "admin"), getMyOrders);

router.get("/:id", protect, validateObjectId(["id"]), getOrderById);

router.get("/user/:userId", protect, authorize("customer", "admin"), validateObjectId(["userId"]), getUserOrders);
router.get("/restaurant/:restaurantId", protect, authorize("seller", "admin"), validateObjectId(["restaurantId"]), getRestaurantOrders);

router.patch("/:id/status", protect, authorize("seller", "admin", "delivery", "grocery_moderator"), validateObjectId(["id"]), updateOrderStatus);
router.patch("/:id/payment", protect, authorize("admin"), validateObjectId(["id"]), updatePaymentStatus);
router.patch("/:id/cancel", protect, validateObjectId(["id"]), cancelOrder);
router.patch("/:id/rate", protect, validateObjectId(["id"]), rateOrder);

export default router;
