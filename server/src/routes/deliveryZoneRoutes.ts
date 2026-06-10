import express from "express";
import {
    createDeliveryZone,
    getAllDeliveryZones,
    getDeliveryZoneById,
    updateDeliveryZone,
    deleteDeliveryZone,
    checkDeliveryFeasibilityAndFee,
    calculateBillDetails
} from "../controllers/deliveryZoneController";
import { protect, authorize } from "../middleware/authMiddleware";
import { validateObjectId } from "../middlewares/authSecurityMiddleware";

const router = express.Router();

router.post("/", protect, authorize("admin"), createDeliveryZone);
router.get("/", getAllDeliveryZones);
router.get("/:id", validateObjectId(["id"]), getDeliveryZoneById);
router.put("/:id", protect, authorize("admin"), validateObjectId(["id"]), updateDeliveryZone);
router.delete("/:id", protect, authorize("admin"), validateObjectId(["id"]), deleteDeliveryZone);

// Validation / fee endpoint for checkout
router.post("/check-feasibility", checkDeliveryFeasibilityAndFee);
router.post("/calculate-bill", calculateBillDetails);

export default router;
