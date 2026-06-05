import express from "express";
import {
    autocompletePlaces,
    placeDetails,
    reverseGeocode,
    geocodeAddress
} from "../controllers/locationController";

const router = express.Router();

router.get("/autocomplete", autocompletePlaces);
router.get("/place-details", placeDetails);
router.get("/reverse-geocode", reverseGeocode);
router.get("/geocode", geocodeAddress);

export default router;
