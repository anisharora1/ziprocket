import { Request, Response } from "express";
import mongoose from "mongoose";
import "../middlewares/authMiddleware";
import DeviceToken from "../models/DeviceToken";
import NotificationCampaign from "../models/NotificationCampaign";

// POST /api/notifications/register-device
export const registerDevice = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, platform, zoneId, lastLocation, appVersion } = req.body;

        if (!token || typeof token !== "string" || !token.trim()) {
            res.status(400).json({ success: false, message: "Valid device token is required." });
            return;
        }

        const cleanToken = token.trim();
        const userId = req.user ? req.user._id : null;

        const updateDoc: any = {
            user: userId,
            lastSeenAt: new Date()
        };

        if (platform && typeof platform === "string") {
            updateDoc.platform = platform.toLowerCase();
        }

        if (zoneId !== undefined) {
            if (zoneId === null || zoneId === "") {
                updateDoc.zoneId = null;
            } else if (mongoose.Types.ObjectId.isValid(zoneId)) {
                updateDoc.zoneId = new mongoose.Types.ObjectId(zoneId);
            }
        }

        if (
            lastLocation &&
            typeof lastLocation.lat === "number" &&
            !isNaN(lastLocation.lat) &&
            typeof lastLocation.lng === "number" &&
            !isNaN(lastLocation.lng)
        ) {
            updateDoc.lastLocation = {
                lat: lastLocation.lat,
                lng: lastLocation.lng
            };
        }

        if (appVersion && typeof appVersion === "string") {
            updateDoc.appVersion = appVersion;
        }

        const device = await DeviceToken.findOneAndUpdate(
            { token: cleanToken },
            {
                $set: updateDoc,
                $setOnInsert: {
                    marketingOptIn: true,
                    marketingCount: 0
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            message: "Device registered successfully",
            deviceId: device._id
        });
    } catch (error: any) {
        console.error("[Register Device Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/notifications/unlink-user
export const unlinkUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.body;

        if (!token || typeof token !== "string" || !token.trim()) {
            res.status(400).json({ success: false, message: "Valid device token is required." });
            return;
        }

        const cleanToken = token.trim();
        const result = await DeviceToken.findOneAndUpdate(
            { token: cleanToken },
            { $set: { user: null, lastSeenAt: new Date() } },
            { new: true }
        );

        if (!result) {
            res.status(404).json({ success: false, message: "Device token not found." });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Device unlinked from user successfully"
        });
    } catch (error: any) {
        console.error("[Unlink User Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/notifications/preferences (protect)
export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
    try {
        const { marketingOptIn } = req.body;

        if (typeof marketingOptIn !== "boolean") {
            res.status(400).json({ success: false, message: "marketingOptIn must be a boolean." });
            return;
        }

        const userId = req.user!._id;
        const result = await DeviceToken.updateMany(
            { user: userId },
            { $set: { marketingOptIn } }
        );

        res.status(200).json({
            success: true,
            message: "Preferences updated successfully",
            modifiedCount: result.modifiedCount
        });
    } catch (error: any) {
        console.error("[Update Preferences Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/notifications/opened
export const trackOpened = async (req: Request, res: Response): Promise<void> => {
    try {
        const { campaignId, token } = req.body;

        if (!campaignId || typeof campaignId !== "string" || !mongoose.Types.ObjectId.isValid(campaignId)) {
            res.status(400).json({ success: false, message: "Valid campaignId is required." });
            return;
        }

        if (token && typeof token === "string" && token.trim()) {
            const cleanToken = token.trim();
            // Atomically add token to openedTokens and increment stats.opened only if token not yet present
            await NotificationCampaign.updateOne(
                { _id: campaignId, openedTokens: { $ne: cleanToken } },
                {
                    $addToSet: { openedTokens: cleanToken },
                    $inc: { "stats.opened": 1 }
                }
            );
        } else {
            await NotificationCampaign.findByIdAndUpdate(campaignId, {
                $inc: { "stats.opened": 1 }
            });
        }

        res.status(200).json({
            success: true,
            message: "Open tracked"
        });
    } catch (error: any) {
        console.error("[Track Opened Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
