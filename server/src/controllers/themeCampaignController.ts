import { Request, Response } from "express";
import mongoose from "mongoose";
import ThemeCampaign, { IThemeHomeSection } from "../models/ThemeCampaign";
import GroceryProduct from "../models/GroceryProduct";
import * as themeCacheService from "../services/themeCacheService";
import { validateThemeCampaignPayload } from "../validators/themeCampaignValidator";

type CampaignStatus = "live" | "scheduled" | "ended";

function computeStatus(startsAt: Date, endsAt: Date, now: Date): CampaignStatus {
    const nowMs = now.getTime();
    if (nowMs < new Date(startsAt).getTime()) return "scheduled";
    if (nowMs > new Date(endsAt).getTime()) return "ended";
    return "live";
}

async function findOverlapWarnings(
    startsAt: Date,
    endsAt: Date,
    priority: number,
    isActive: boolean,
    excludeId?: string
): Promise<string[]> {
    if (!isActive) return [];

    const query: Record<string, any> = {
        isActive: true,
        priority,
        startsAt: { $lte: endsAt },
        endsAt: { $gte: startsAt }
    };
    if (excludeId) {
        query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const overlapping = await ThemeCampaign.find(query)
        .select("name slug priority")
        .lean();

    return overlapping.map(
        (c) => `Overlaps with active campaign "${c.name}" (${c.slug}) at priority ${c.priority}.`
    );
}

// --- PUBLIC ENDPOINT ---

/**
 * GET /api/app-config/mobile?surface=home&zoneId=<optional>
 * Public, cached 60s in Redis, never returns 500 to the mobile app.
 */
export const getMobileAppConfig = async (req: Request, res: Response): Promise<void> => {
    const surface =
        typeof req.query.surface === "string" && req.query.surface.trim()
            ? req.query.surface.trim()
            : "home";
    const rawZoneId =
        typeof req.query.zoneId === "string" && req.query.zoneId.trim()
            ? req.query.zoneId.trim()
            : undefined;
    const validZoneId =
        rawZoneId && mongoose.Types.ObjectId.isValid(rawZoneId) ? rawZoneId : undefined;

    res.setHeader("Cache-Control", "public, max-age=60");

    try {
        if (surface !== "home" && surface !== "grocery") {
            const etag = '"null"';
            res.setHeader("ETag", etag);
            if (req.headers["if-none-match"] === etag) {
                res.status(304).end();
                return;
            }
            res.status(200).json({ campaign: null });
            return;
        }

        const cached = await themeCacheService.getCachedMobileConfig(surface, validZoneId);
        if (cached) {
            res.setHeader("ETag", cached.etag);
            if (req.headers["if-none-match"] === cached.etag) {
                res.status(304).end();
                return;
            }
            res.status(200).json(cached.payload);
            return;
        }

        const now = new Date();
        const zoneFilter = validZoneId
            ? {
                  $or: [
                      { zoneIds: { $size: 0 } },
                      { zoneIds: new mongoose.Types.ObjectId(validZoneId) }
                  ]
              }
            : { zoneIds: { $size: 0 } };

        const campaign = await ThemeCampaign.findOne({
            isActive: true,
            startsAt: { $lte: now },
            endsAt: { $gte: now },
            [`surfaces.${surface}.colors`]: { $exists: true },
            ...zoneFilter
        })
            .sort({ priority: -1, startsAt: -1 })
            .lean();

        const surfaceData = campaign ? (campaign.surfaces as any)?.[surface] : null;

        if (!campaign || !surfaceData) {
            const payload = { campaign: null };
            const etag = '"null"';
            await themeCacheService.cacheMobileConfig(surface, validZoneId, { payload, etag });
            res.setHeader("ETag", etag);
            if (req.headers["if-none-match"] === etag) {
                res.status(304).end();
                return;
            }
            res.status(200).json(payload);
            return;
        }

        // Collect all referenced GroceryProduct IDs across sections
        const sections: IThemeHomeSection[] = surfaceData.sections || [];
        const allProductIds: mongoose.Types.ObjectId[] = [];
        for (const sec of sections) {
            if (Array.isArray(sec.productIds)) {
                for (const pid of sec.productIds) {
                    allProductIds.push(new mongoose.Types.ObjectId(String(pid)));
                }
            }
        }

        const productMap = new Map<string, any>();
        if (allProductIds.length > 0) {
            const products = await GroceryProduct.find({
                _id: { $in: allProductIds },
                isAvailable: true,
                stockQuantity: { $gt: 0 }
            }).lean();

            for (const p of products) {
                productMap.set(String(p._id), p);
            }
        }

        const hydratedSections = sections.map((sec: IThemeHomeSection) => {
            const products = (sec.productIds || [])
                .map((pid) => productMap.get(String(pid)))
                .filter((p): p is NonNullable<typeof p> => Boolean(p))
                .map((p: any) => {
                    const price = Number(p.price);
                    const rawDp =
                        p.discountedPrice !== undefined && p.discountedPrice !== null
                            ? Number(p.discountedPrice)
                            : undefined;

                    let discountedPrice: number | null = null;
                    let discountPercent: number | null = null;

                    if (rawDp !== undefined && rawDp > 0 && rawDp < price) {
                        const pct = Math.floor(((price - rawDp) / price) * 100);
                        if (pct >= 1) {
                            discountedPrice = rawDp;
                            discountPercent = pct;
                        }
                    }

                    const firstImg =
                        Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
                    const image =
                        firstImg && typeof firstImg === "object"
                            ? firstImg.url || null
                            : typeof firstImg === "string"
                              ? firstImg
                              : null;

                    return {
                        id: String(p._id),
                        name: p.name,
                        image,
                        unit: p.unit,
                        price,
                        discountedPrice,
                        discountPercent,
                        inStock: p.stockQuantity > 0 && p.isAvailable
                    };
                });

            return {
                type: sec.type,
                title: sec.title,
                products
            };
        });

        const overlayIncluded =
            campaign.overlay &&
            Array.isArray(campaign.overlay.surfaces) &&
            campaign.overlay.surfaces.includes(surface as "home" | "grocery");

        const payload = {
            campaign: {
                id: String(campaign._id),
                slug: campaign.slug,
                startsAt: campaign.startsAt,
                endsAt: campaign.endsAt,
                updatedAt: campaign.updatedAt,
                [surface]: {
                    colors: surfaceData.colors,
                    images: surfaceData.images,
                    sections: hydratedSections
                },
                ...(overlayIncluded
                    ? {
                          overlay: {
                              url: campaign.overlay!.url,
                              format: campaign.overlay!.format,
                              placement: campaign.overlay!.placement,
                              loop: campaign.overlay!.loop,
                              opacity: campaign.overlay!.opacity,
                              surfaces: campaign.overlay!.surfaces
                          }
                      }
                    : {})
            }
        };

        const etag = `"${campaign._id}-${new Date(campaign.updatedAt).getTime()}"`;
        await themeCacheService.cacheMobileConfig(surface, validZoneId, { payload, etag });

        res.setHeader("ETag", etag);
        if (req.headers["if-none-match"] === etag) {
            res.status(304).end();
            return;
        }
        res.status(200).json(payload);
    } catch (error: any) {
        console.error("[ThemeCampaign] getMobileAppConfig error:", error?.message || error);
        res.status(200).json({ campaign: null });
    }
};

// --- ADMIN CRUD ENDPOINTS ---

/**
 * GET /api/admin/theme-campaigns
 */
export const listThemeCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const campaigns = await ThemeCampaign.find().sort({ createdAt: -1 }).lean();

        const enriched = campaigns.map((c) => ({
            ...c,
            status: computeStatus(c.startsAt, c.endsAt, now)
        }));

        res.status(200).json({
            success: true,
            count: enriched.length,
            campaigns: enriched
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/admin/theme-campaigns
 */
export const createThemeCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const validation = await validateThemeCampaignPayload(req.body);
        if (!validation.valid) {
            res.status(400).json({
                success: false,
                message: validation.message,
                errors: validation.errors
            });
            return;
        }

        const data = validation.data;
        const overlapWarnings = await findOverlapWarnings(
            data.startsAt,
            data.endsAt,
            data.priority,
            data.isActive
        );
        const warnings = [...overlapWarnings, ...validation.warnings];

        const campaign = new ThemeCampaign(data);
        await campaign.save();
        await themeCacheService.invalidateMobileConfigCache();

        res.status(201).json({
            success: true,
            message: "Theme campaign created successfully",
            campaign,
            warnings
        });
    } catch (error: any) {
        if (error?.code === 11000) {
            res.status(400).json({
                success: false,
                message: "A theme campaign with this slug already exists."
            });
            return;
        }
        if (error?.name === "ValidationError") {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/admin/theme-campaigns/:id
 */
export const updateThemeCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const existing = await ThemeCampaign.findById(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: "Theme campaign not found" });
            return;
        }

        const existingObj = existing.toObject();
        const incomingSurfaces = req.body?.surfaces;
        const mergedSurfaces = incomingSurfaces
            ? {
                  ...existingObj.surfaces,
                  ...incomingSurfaces,
                  home: incomingSurfaces.home
                      ? {
                            ...existingObj.surfaces?.home,
                            ...incomingSurfaces.home
                        }
                      : existingObj.surfaces?.home,
                  ...(incomingSurfaces.grocery !== undefined
                      ? {
                            grocery:
                                incomingSurfaces.grocery === null
                                    ? null
                                    : {
                                          ...(existingObj.surfaces?.grocery || {}),
                                          ...incomingSurfaces.grocery
                                      }
                        }
                      : {})
              }
            : existingObj.surfaces;

        const mergedPayload = {
            ...existingObj,
            ...req.body,
            surfaces: mergedSurfaces
        };

        const validation = await validateThemeCampaignPayload(mergedPayload);
        if (!validation.valid) {
            res.status(400).json({
                success: false,
                message: validation.message,
                errors: validation.errors
            });
            return;
        }

        const data = validation.data;
        const overlapWarnings = await findOverlapWarnings(
            data.startsAt,
            data.endsAt,
            data.priority,
            data.isActive,
            String(existing._id)
        );
        const warnings = [...overlapWarnings, ...validation.warnings];

        const updateOp: Record<string, any> = {
            $set: {
                name: data.name,
                slug: data.slug,
                isActive: data.isActive,
                startsAt: data.startsAt,
                endsAt: data.endsAt,
                priority: data.priority,
                zoneIds: data.zoneIds,
                surfaces: data.surfaces
            }
        };
        if (data.overlay) {
            updateOp.$set.overlay = data.overlay;
        } else {
            updateOp.$unset = { overlay: 1 };
        }

        const updated = await ThemeCampaign.findByIdAndUpdate(
            req.params.id,
            updateOp,
            { new: true, runValidators: true }
        );

        await themeCacheService.invalidateMobileConfigCache();

        res.status(200).json({
            success: true,
            message: "Theme campaign updated successfully",
            campaign: updated,
            warnings
        });
    } catch (error: any) {
        if (error?.code === 11000) {
            res.status(400).json({
                success: false,
                message: "A theme campaign with this slug already exists."
            });
            return;
        }
        if (error?.name === "ValidationError") {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/admin/theme-campaigns/:id/toggle
 */
export const toggleThemeCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const campaign = await ThemeCampaign.findById(req.params.id);
        if (!campaign) {
            res.status(404).json({ success: false, message: "Theme campaign not found" });
            return;
        }

        campaign.isActive = !campaign.isActive;
        await campaign.save();
        await themeCacheService.invalidateMobileConfigCache();

        res.status(200).json({
            success: true,
            message: `Theme campaign ${campaign.isActive ? "activated" : "deactivated"} successfully`,
            campaign
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /api/admin/theme-campaigns/:id
 */
export const deleteThemeCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const campaign = await ThemeCampaign.findByIdAndDelete(req.params.id);
        if (!campaign) {
            res.status(404).json({ success: false, message: "Theme campaign not found" });
            return;
        }

        await themeCacheService.invalidateMobileConfigCache();

        res.status(200).json({
            success: true,
            message: "Theme campaign deleted successfully"
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
