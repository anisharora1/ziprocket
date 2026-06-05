import { Request, Response } from "express";
import {
    validateCoordinates,
    fetchAutocompleteSuggestions,
    fetchPlaceDetails,
    fetchReverseGeocode,
    geocodeAddressText
} from "../services/locationService";

// Autocomplete Places
export const autocompletePlaces = async (req: Request, res: Response): Promise<void> => {
    try {
        const { input } = req.query;
        if (!input || typeof input !== "string") {
            res.status(400).json({ success: false, message: "Input search term is required" });
            return;
        }

        const suggestions = await fetchAutocompleteSuggestions(input);
        res.status(200).json({ success: true, suggestions });
    } catch (error: any) {
        console.error("Location Autocomplete API Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Place Details from Place ID
export const placeDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const { placeId } = req.query;
        if (!placeId || typeof placeId !== "string") {
            res.status(400).json({ success: false, message: "Place ID is required" });
            return;
        }

        const details = await fetchPlaceDetails(placeId);
        res.status(200).json({ success: true, details });
    } catch (error: any) {
        console.error("Location Details API Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Reverse Geocode Coordinates
export const reverseGeocode = async (req: Request, res: Response): Promise<void> => {
    try {
        const { lat, lng } = req.query;
        const validation = validateCoordinates(lat, lng);

        if (!validation.isValid || validation.latNum === undefined || validation.lngNum === undefined) {
            res.status(400).json({ success: false, message: "Latitude and Longitude are required and must be valid numbers" });
            return;
        }

        const details = await fetchReverseGeocode(validation.latNum, validation.lngNum);
        res.status(200).json({ success: true, details });
    } catch (error: any) {
        console.error("Reverse Geocoding API Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Text-based Geocoding (resolves raw address text to coordinates)
export const geocodeAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.query;
        if (!address || typeof address !== "string") {
            res.status(400).json({ success: false, message: "Address text is required" });
            return;
        }

        const details = await geocodeAddressText(address);

        if (!details) {
            res.status(404).json({ success: false, message: "Could not find coordinates for this address. Please be more specific." });
            return;
        }

        res.status(200).json({
            success: true,
            details
        });
    } catch (error: any) {
        console.error("Geocoding Address API Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
