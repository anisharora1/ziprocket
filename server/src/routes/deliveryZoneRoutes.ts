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

const router = express.Router();

router.post("/", createDeliveryZone);
router.get("/", getAllDeliveryZones);
router.get("/:id", getDeliveryZoneById);
router.put("/:id", updateDeliveryZone);
router.delete("/:id", deleteDeliveryZone);

// Validation / fee endpoint for checkout
router.post("/check-feasibility", checkDeliveryFeasibilityAndFee);
router.post("/calculate-bill", calculateBillDetails);

export default router;
