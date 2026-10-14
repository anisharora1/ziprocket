import { Request, Response } from "express";
import PlatformSettings from "../models/PlatformSettings";
import { addClient, removeClient, broadcastSettings } from "../utils/platformSse";
import * as redisService from "../services/redisService";

// Helper to get or create settings
export const getOrCreateSettings = async () => {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
        settings = await PlatformSettings.create({
            isPlatformOpen: true,
            maintenanceMode: false,
            operatingHours: { open: "08:00", close: "22:00" },
            groceryStatus: "open",
            minOrderValueFood: 0,
            minOrderValueGrocery: 0,
            notificationSettings: {
                maxPromoPerDay: 2,
                quietHoursStart: "22:00",
                quietHoursEnd: "08:00",
                inactiveDays: 14,
                newUserDays: 7,
                regularMinOrders30d: 4,
                foodLoverMinOrders60d: 2,
                foodLoverSharePct: 60
            }
        });
    } else if (!settings.notificationSettings) {
        settings.notificationSettings = {
            maxPromoPerDay: 2,
            quietHoursStart: "22:00",
            quietHoursEnd: "08:00",
            inactiveDays: 14,
            newUserDays: 7,
            regularMinOrders30d: 4,
            foodLoverMinOrders60d: 2,
            foodLoverSharePct: 60
        };
        await settings.save();
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
        console.error("[Get Settings Error]", error);
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

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// UPDATE settings (Admin only)
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            isPlatformOpen,
            maintenanceMode,
            operatingHours,
            groceryStatus,
            minOrderValueFood,
            minOrderValueGrocery,
            notificationSettings
        } = req.body;

        if (groceryStatus !== undefined && !["open", "closed", "disabled"].includes(groceryStatus)) {
            res.status(400).json({ success: false, message: "Invalid groceryStatus value." });
            return;
        }

        if (notificationSettings !== undefined) {
            if (typeof notificationSettings !== "object" || notificationSettings === null) {
                res.status(400).json({ success: false, message: "notificationSettings must be an object." });
                return;
            }
            const {
                maxPromoPerDay,
                quietHoursStart,
                quietHoursEnd,
                inactiveDays,
                newUserDays,
                regularMinOrders30d,
                foodLoverMinOrders60d,
                foodLoverSharePct
            } = notificationSettings;

            if (maxPromoPerDay !== undefined && (!Number.isInteger(maxPromoPerDay) || maxPromoPerDay < 1)) {
                res.status(400).json({ success: false, message: "maxPromoPerDay must be an integer >= 1." });
                return;
            }
            if (quietHoursStart !== undefined && !TIME_REGEX.test(quietHoursStart)) {
                res.status(400).json({ success: false, message: "quietHoursStart must be in HH:MM format (00:00 - 23:59)." });
                return;
            }
            if (quietHoursEnd !== undefined && !TIME_REGEX.test(quietHoursEnd)) {
                res.status(400).json({ success: false, message: "quietHoursEnd must be in HH:MM format (00:00 - 23:59)." });
                return;
            }
            if (inactiveDays !== undefined && (!Number.isInteger(inactiveDays) || inactiveDays < 1)) {
                res.status(400).json({ success: false, message: "inactiveDays must be an integer >= 1." });
                return;
            }
            if (newUserDays !== undefined && (!Number.isInteger(newUserDays) || newUserDays < 1)) {
                res.status(400).json({ success: false, message: "newUserDays must be an integer >= 1." });
                return;
            }
            if (regularMinOrders30d !== undefined && (!Number.isInteger(regularMinOrders30d) || regularMinOrders30d < 1)) {
                res.status(400).json({ success: false, message: "regularMinOrders30d must be an integer >= 1." });
                return;
            }
            if (foodLoverMinOrders60d !== undefined && (!Number.isInteger(foodLoverMinOrders60d) || foodLoverMinOrders60d < 1)) {
                res.status(400).json({ success: false, message: "foodLoverMinOrders60d must be an integer >= 1." });
                return;
            }
            if (foodLoverSharePct !== undefined && (typeof foodLoverSharePct !== "number" || foodLoverSharePct < 1 || foodLoverSharePct > 100)) {
                res.status(400).json({ success: false, message: "foodLoverSharePct must be a number between 1 and 100." });
                return;
            }
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
        if (minOrderValueFood !== undefined) settings.minOrderValueFood = Math.max(0, Number(minOrderValueFood) || 0);
        if (minOrderValueGrocery !== undefined) settings.minOrderValueGrocery = Math.max(0, Number(minOrderValueGrocery) || 0);

        if (notificationSettings !== undefined) {
            if (!settings.notificationSettings) {
                settings.notificationSettings = {
                    maxPromoPerDay: 2,
                    quietHoursStart: "22:00",
                    quietHoursEnd: "08:00",
                    inactiveDays: 14,
                    newUserDays: 7,
                    regularMinOrders30d: 4,
                    foodLoverMinOrders60d: 2,
                    foodLoverSharePct: 60
                };
            }
            const ns = notificationSettings;
            if (ns.maxPromoPerDay !== undefined) settings.notificationSettings.maxPromoPerDay = ns.maxPromoPerDay;
            if (ns.quietHoursStart !== undefined) settings.notificationSettings.quietHoursStart = ns.quietHoursStart;
            if (ns.quietHoursEnd !== undefined) settings.notificationSettings.quietHoursEnd = ns.quietHoursEnd;
            if (ns.inactiveDays !== undefined) settings.notificationSettings.inactiveDays = ns.inactiveDays;
            if (ns.newUserDays !== undefined) settings.notificationSettings.newUserDays = ns.newUserDays;
            if (ns.regularMinOrders30d !== undefined) settings.notificationSettings.regularMinOrders30d = ns.regularMinOrders30d;
            if (ns.foodLoverMinOrders60d !== undefined) settings.notificationSettings.foodLoverMinOrders60d = ns.foodLoverMinOrders60d;
            if (ns.foodLoverSharePct !== undefined) settings.notificationSettings.foodLoverSharePct = ns.foodLoverSharePct;
        }

        await settings.save();
        await redisService.setJson("platform:settings", settings.toObject ? settings.toObject() : settings, 60);

        // Broadcast changes in real-time
        broadcastSettings(settings);

        res.status(200).json({
            success: true,
            message: "Platform settings updated successfully",
            settings
        });
    } catch (error: any) {
        console.error("[Update Settings Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
