import express from "express";
import {
    assignDelivery,
    updateDeliveryStatus,
    getDeliveryById,
    getDeliveriesByDeliveryBoy,
    getAllDeliveries,
    getMyDeliveryProfile,
    updateMyDeliveryAvailability,
    getPendingDeliveries,
    acceptDeliveryOrder,
    rejectDeliveryOrder,
    deliverOrder,
    getMyDeliveries,
    getMyRejectedOrders
} from "../controllers/deliveryController";
import { protect, authorize } from "../middleware/authMiddleware";
import { uploadSingle } from "../middleware/uploadMiddleware";
import { validateObjectId } from "../middlewares/authSecurityMiddleware";

const router = express.Router();

// Courier self-service routes
router.get("/profile/my-profile", protect, authorize("delivery", "admin"), getMyDeliveryProfile);
router.put("/profile/availability", protect, authorize("delivery", "admin"), updateMyDeliveryAvailability);

// New robust status and assignment flows
router.get("/pending", protect, authorize("delivery", "admin"), getPendingDeliveries);
router.post("/accept", protect, authorize("delivery", "admin"), acceptDeliveryOrder);
router.post("/reject", protect, authorize("delivery", "admin"), rejectDeliveryOrder);
router.post("/deliver", protect, authorize("delivery", "admin"), uploadSingle("proof"), deliverOrder);
router.get("/my-deliveries", protect, authorize("delivery", "admin"), getMyDeliveries);
router.get("/rejected", protect, authorize("delivery", "admin"), getMyRejectedOrders);

router.post("/assign", protect, authorize("admin"), assignDelivery);
router.get("/", protect, authorize("admin"), getAllDeliveries);
router.get("/:id", protect, authorize("delivery", "admin"), validateObjectId(["id"]), getDeliveryById);

router.patch("/:id/status", protect, authorize("delivery", "admin"), validateObjectId(["id"]), updateDeliveryStatus);
router.get("/delivery-boy/:deliveryBoyId", protect, authorize("delivery", "admin"), validateObjectId(["deliveryBoyId"]), getDeliveriesByDeliveryBoy);

export default router;
