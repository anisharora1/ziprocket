import { Request, Response } from "express";
import mongoose from "mongoose";
import "../middlewares/authMiddleware";
import NotificationCampaign from "../models/NotificationCampaign";
import {
    getAudience,
    getAllSegmentCounts,
    isQuietHours,
    adjustScheduledTimeForQuietHours,
    AudienceRadius
} from "../services/audienceService";
import { sendCampaign, sendTestPush } from "../services/pushService";
import { getOrCreateSettings } from "./platformSettingsController";

const VALID_FIXED_ROUTES = new Set([
    "/(tabs)/home",
    "/(tabs)/orders",
    "/(tabs)/search",
    "/grocery",
    "/cart",
    "/addresses"
]);

export const isValidRoute = (route: string): boolean => {
    if (!route || typeof route !== "string") return false;
    const trimmed = route.trim();
    if (VALID_FIXED_ROUTES.has(trimmed)) return true;

    // Matches /restaurants/<valid ObjectId>
    const restaurantMatch = trimmed.match(/^\/restaurants\/([a-fA-F0-9]{24})$/);
    if (restaurantMatch && mongoose.Types.ObjectId.isValid(restaurantMatch[1])) {
        return true;
    }

    // Matches /grocery/category/<name>
    const groceryCategoryMatch = trimmed.match(/^\/grocery\/category\/([a-zA-Z0-9_\-%]+)$/);
    if (groceryCategoryMatch && groceryCategoryMatch[1].length > 0) {
        return true;
    }

    return false;
};

export const isValidHttpsUrl = (url?: string): boolean => {
    if (!url || !url.trim()) return true; // optional
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === "https:";
    } catch {
        return false;
    }
};

const validateCampaignInput = (body: any): string | null => {
    const { title, body: content, imageUrl, route, segment } = body;

    if (!title || typeof title !== "string" || title.trim().length < 1 || title.trim().length > 65) {
        return "title is required and must be between 1 and 65 characters.";
    }

    if (!content || typeof content !== "string" || content.trim().length < 1 || content.trim().length > 180) {
        return "body is required and must be between 1 and 180 characters.";
    }

    if (imageUrl && !isValidHttpsUrl(imageUrl)) {
        return "imageUrl must be a valid HTTPS URL.";
    }

    if (!route || !isValidRoute(route)) {
        return (
            "route must be one of: /(tabs)/home, /(tabs)/orders, /(tabs)/search, /grocery, /cart, /addresses, " +
            "/restaurants/<valid ObjectId>, or /grocery/category/<name>"
        );
    }

    if (segment) {
        const validSegments = [
            "all",
            "new_users",
            "never_ordered",
            "food_lovers",
            "grocery_shoppers",
            "regular",
            "inactive"
        ];
        if (!segment.type || !validSegments.includes(segment.type)) {
            return `segment.type must be one of: ${validSegments.join(", ")}`;
        }
    }

    return null;
};

// GET /api/admin/notifications/segments
export const getSegments = async (req: Request, res: Response): Promise<void> => {
    try {
        let zoneIds: string[] | undefined;
        if (req.query.zoneIds) {
            if (Array.isArray(req.query.zoneIds)) {
                zoneIds = req.query.zoneIds as string[];
            } else {
                zoneIds = (req.query.zoneIds as string).split(",").map(s => s.trim()).filter(Boolean);
            }
        }

        let radius: AudienceRadius | undefined;
        if (req.query.radiusLat && req.query.radiusLng && req.query.radiusKm) {
            const lat = parseFloat(req.query.radiusLat as string);
            const lng = parseFloat(req.query.radiusLng as string);
            const km = parseFloat(req.query.radiusKm as string);
            if (!isNaN(lat) && !isNaN(lng) && !isNaN(km)) {
                radius = { lat, lng, km };
            }
        }

        const segments = await getAllSegmentCounts(zoneIds, radius);
        res.status(200).json({ success: true, segments });
    } catch (error: any) {
        console.error("[Get Segments Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/admin/notifications/audience-preview
export const previewAudience = async (req: Request, res: Response): Promise<void> => {
    try {
        const { segment, zoneIds, radius } = req.body;

        const audienceResult = await getAudience({
            segment: segment || { type: "all" },
            zoneIds,
            radius,
            overrideQuietHours: false
        });

        res.status(200).json({
            success: true,
            targeted: audienceResult.counts.targeted,
            skippedCap: audienceResult.counts.skippedCap,
            skippedQuiet: audienceResult.counts.skippedQuiet
        });
    } catch (error: any) {
        console.error("[Audience Preview Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/admin/notifications/send-test
export const sendTest = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, body, imageUrl, route } = req.body;

        if (!title || typeof title !== "string" || title.trim().length < 1 || title.trim().length > 65) {
            res.status(400).json({ success: false, message: "title must be between 1 and 65 characters." });
            return;
        }

        if (!body || typeof body !== "string" || body.trim().length < 1 || body.trim().length > 180) {
            res.status(400).json({ success: false, message: "body must be between 1 and 180 characters." });
            return;
        }

        if (imageUrl && !isValidHttpsUrl(imageUrl)) {
            res.status(400).json({ success: false, message: "imageUrl must be a valid HTTPS URL." });
            return;
        }

        if (!route || !isValidRoute(route)) {
            res.status(400).json({
                success: false,
                message:
                    "route must be one of: /(tabs)/home, /(tabs)/orders, /(tabs)/search, /grocery, /cart, /addresses, " +
                    "/restaurants/<valid ObjectId>, or /grocery/category/<name>"
            });
            return;
        }

        const adminUserId = req.user!._id.toString();
        const result = await sendTestPush(adminUserId, {
            title: title.trim(),
            body: body.trim(),
            imageUrl: imageUrl?.trim(),
            route: route.trim()
        });

        res.status(200).json(result);
    } catch (error: any) {
        console.error("[Send Test Push Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/admin/notifications/campaigns
export const createCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const validationError = validateCampaignInput(req.body);
        if (validationError) {
            res.status(400).json({ success: false, message: validationError });
            return;
        }

        const {
            title,
            body,
            imageUrl,
            route,
            segment,
            zoneIds,
            radius,
            scheduledAt,
            overrideQuietHours
        } = req.body;

        const settingsDoc = await getOrCreateSettings();
        const notificationSettings = settingsDoc.notificationSettings || {
            quietHoursStart: "22:00",
            quietHoursEnd: "08:00"
        };

        const now = new Date();
        const isQuietNow = isQuietHours(now, notificationSettings.quietHoursStart, notificationSettings.quietHoursEnd);

        // Case 1: Send Now (no scheduledAt)
        if (!scheduledAt) {
            if (isQuietNow && !overrideQuietHours) {
                res.status(400).json({
                    success: false,
                    message:
                        `Quiet hours are currently active (${notificationSettings.quietHoursStart} - ${notificationSettings.quietHoursEnd} IST). ` +
                        `Pass overrideQuietHours: true to send immediately, or set a scheduledAt time.`
                });
                return;
            }

            const campaign = new NotificationCampaign({
                title: title.trim(),
                body: body.trim(),
                imageUrl: imageUrl?.trim() || undefined,
                route: route.trim(),
                segment: segment || { type: "all" },
                zoneIds: Array.isArray(zoneIds) ? zoneIds : [],
                radius: radius && radius.lat != null ? radius : undefined,
                status: "sending",
                createdBy: req.user!._id
            });

            await campaign.save();

            // Background send - do not hold request open
            sendCampaign(campaign._id.toString(), Boolean(overrideQuietHours)).catch(err => {
                console.error("[Background Campaign Send Error]", err);
            });

            res.status(202).json({
                success: true,
                message: "Campaign accepted for sending.",
                campaign
            });
            return;
        }

        // Case 2: Scheduled Campaign
        let scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            res.status(400).json({ success: false, message: "Invalid scheduledAt timestamp." });
            return;
        }

        // Must be in the future (grace period of 30 seconds for clock drift)
        if (scheduledDate.getTime() < Date.now() - 30000) {
            res.status(400).json({ success: false, message: "scheduledAt must be in the future." });
            return;
        }

        // If scheduled date falls inside quiet hours, automatically move to quietHoursEnd
        if (isQuietHours(scheduledDate, notificationSettings.quietHoursStart, notificationSettings.quietHoursEnd)) {
            const adjusted = adjustScheduledTimeForQuietHours(
                scheduledDate,
                notificationSettings.quietHoursStart,
                notificationSettings.quietHoursEnd
            );
            console.log(
                `[Create Campaign] Scheduled time ${scheduledDate.toISOString()} falls in quiet hours. Adjusted to: ${adjusted.toISOString()}`
            );
            scheduledDate = adjusted;
        }

        const campaign = new NotificationCampaign({
            title: title.trim(),
            body: body.trim(),
            imageUrl: imageUrl?.trim() || undefined,
            route: route.trim(),
            segment: segment || { type: "all" },
            zoneIds: Array.isArray(zoneIds) ? zoneIds : [],
            radius: radius && radius.lat != null ? radius : undefined,
            status: "scheduled",
            scheduledAt: scheduledDate,
            createdBy: req.user!._id
        });

        await campaign.save();

        res.status(201).json({
            success: true,
            message: "Campaign scheduled successfully.",
            campaign
        });
    } catch (error: any) {
        console.error("[Create Campaign Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/admin/notifications/campaigns?page=
export const getCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 10));
        const skip = (page - 1) * limit;

        const [campaigns, total] = await Promise.all([
            NotificationCampaign.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("createdBy", "name phone role")
                .populate("zoneIds", "name")
                .exec(),
            NotificationCampaign.countDocuments()
        ]);

        res.status(200).json({
            success: true,
            campaigns,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        console.error("[Get Campaigns Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/admin/notifications/campaigns/:id/cancel
export const cancelCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: "Invalid campaign ID." });
            return;
        }

        const campaign = await NotificationCampaign.findById(id);

        if (!campaign) {
            res.status(404).json({ success: false, message: "Campaign not found." });
            return;
        }

        if (campaign.status !== "scheduled") {
            res.status(400).json({
                success: false,
                message: `Only campaigns with status 'scheduled' can be cancelled. Current status is '${campaign.status}'.`
            });
            return;
        }

        campaign.status = "cancelled";
        await campaign.save();

        res.status(200).json({
            success: true,
            message: "Campaign cancelled successfully.",
            campaign
        });
    } catch (error: any) {
        console.error("[Cancel Campaign Error]", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
