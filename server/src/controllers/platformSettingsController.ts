import { Request, Response } from "express";
import PlatformSettings from "../models/PlatformSettings";
import { addClient, removeClient, broadcastSettings } from "../utils/platformSse";

// Helper to get or create settings
export const getOrCreateSettings = async () => {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
        settings = await PlatformSettings.create({
            isPlatformOpen: true,
            maintenanceMode: false,
            operatingHours: { open: "08:00", close: "22:00" },
            groceryStatus: "open"
        });
    }
    return settings;
};

// GET initial settings
export const getSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const settings = await getOrCreateSettings();
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.status(200).json({ success: true, settings });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// SSE stream settings
export const streamSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        // Set headers for SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders(); // Establishes stream

        // Send initial settings state
        const settings = await getOrCreateSettings();
        res.write(`data: ${JSON.stringify(settings)}\n\n`);

        addClient(res);

        req.on("close", () => {
            removeClient(res);
        });
    } catch (error: any) {
        console.error("[Platform Settings Stream Error]", error);
        res.end();
    }
};

// UPDATE settings (Admin only)
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const { isPlatformOpen, maintenanceMode, operatingHours, groceryStatus } = req.body;

        if (groceryStatus !== undefined && !["open", "closed", "disabled"].includes(groceryStatus)) {
            res.status(400).json({ success: false, message: "Invalid groceryStatus value." });
            return;
        }

        let settings = await PlatformSettings.findOne();
        if (!settings) {
            settings = new PlatformSettings();
        }

        if (isPlatformOpen !== undefined) settings.isPlatformOpen = isPlatformOpen;
        if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
        if (operatingHours !== undefined) {
            if (operatingHours.open !== undefined) settings.operatingHours.open = operatingHours.open;
            if (operatingHours.close !== undefined) settings.operatingHours.close = operatingHours.close;
        }
        if (groceryStatus !== undefined) settings.groceryStatus = groceryStatus;

        await settings.save();

        // Broadcast changes in real-time
        broadcastSettings(settings);

        res.status(200).json({
            success: true,
            message: "Platform settings updated successfully",
            settings
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
