import express from "express";
import {
    getMyAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} from "../controllers/addressController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

// All address routes require user authentication
router.use(protect);

router.get("/", getMyAddresses);
router.post("/", createAddress);
router.put("/:id", updateAddress);
router.delete("/:id", deleteAddress);
router.patch("/:id/default", setDefaultAddress);

export default router;
