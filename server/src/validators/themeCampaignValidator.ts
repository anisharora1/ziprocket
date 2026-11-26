import mongoose from "mongoose";
import GroceryProduct from "../models/GroceryProduct";
import { IThemeHomeColors, IThemeHomeSurface, IThemeOverlay } from "../models/ThemeCampaign";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const WCAG_AA_MIN_CONTRAST = 4.5;
const OVERLAY_MAX_BYTES = 300 * 1024;
const OVERLAY_HEAD_TIMEOUT_MS = 3000;

const REQUIRED_COLOR_KEYS: (keyof IThemeHomeColors)[] = [
    "stageFrom",
    "stageTo",
    "headerText",
    "pageBg",
    "accent",
    "tabBg",
    "tabActive",
    "tabInactive"
];

const CONTRAST_PAIRS: Array<[keyof IThemeHomeColors, keyof IThemeHomeColors]> = [
    ["headerText", "stageFrom"],
    ["headerText", "stageTo"],
    ["tabActive", "tabBg"],
    ["tabInactive", "tabBg"]
];

export interface ValidatedThemeCampaignPayload {
    name: string;
    slug: string;
    isActive: boolean;
    startsAt: Date;
    endsAt: Date;
    priority: number;
    zoneIds: mongoose.Types.ObjectId[];
    surfaces: {
        home: IThemeHomeSurface;
        [key: string]: unknown;
    };
    overlay?: IThemeOverlay;
}

export type ThemeValidationResult =
    | { valid: true; data: ValidatedThemeCampaignPayload; warnings: string[] }
    | { valid: false; message: string; errors: string[] };

function isHttpsUrl(value: unknown): value is string {
    if (typeof value !== "string" || !value.trim()) return false;
    try {
        const parsed = new URL(value.trim());
        return parsed.protocol === "https:";
    } catch {
        return false;
    }
}

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.slice(1);
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
}

function relativeLuminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex).map((channel) => {
        const srgb = channel / 255;
        return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(hexA: string, hexB: string): number {
    const lumA = relativeLuminance(hexA);
    const lumB = relativeLuminance(hexB);
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Shared validator for creating and updating ThemeCampaign documents.
 */
export async function validateThemeCampaignPayload(
    payload: any
): Promise<ThemeValidationResult> {
    const errors: string[] = [];

    if (!payload || typeof payload !== "object") {
        return { valid: false, message: "Request body must be a JSON object.", errors: ["Invalid payload"] };
    }

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
        errors.push("name is required and must be a non-empty string.");
    }

    const slug = typeof payload.slug === "string" ? payload.slug.trim().toLowerCase() : "";
    if (!slug) {
        errors.push("slug is required and must be a non-empty string.");
    }

    const startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
    const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;

    if (!startsAt || isNaN(startsAt.getTime())) {
        errors.push("startsAt is required and must be a valid UTC date.");
    }
    if (!endsAt || isNaN(endsAt.getTime())) {
        errors.push("endsAt is required and must be a valid UTC date.");
    }
    if (startsAt && endsAt && !isNaN(startsAt.getTime()) && !isNaN(endsAt.getTime())) {
        if (endsAt.getTime() <= startsAt.getTime()) {
            errors.push("endsAt must be after startsAt.");
        }
    }

    const priority = payload.priority !== undefined ? Number(payload.priority) : 0;
    if (!Number.isFinite(priority)) {
        errors.push("priority must be a finite number.");
    }

    const isActive = payload.isActive !== undefined ? Boolean(payload.isActive) : true;

    // Validate zoneIds
    const rawZoneIds = payload.zoneIds !== undefined ? payload.zoneIds : [];
    const zoneIds: mongoose.Types.ObjectId[] = [];
    if (!Array.isArray(rawZoneIds)) {
        errors.push("zoneIds must be an array of DeliveryZone IDs.");
    } else {
        for (const zId of rawZoneIds) {
            const zStr = String(zId);
            if (!mongoose.Types.ObjectId.isValid(zStr)) {
                errors.push(`Invalid DeliveryZone ObjectId in zoneIds: "${zStr}".`);
            } else {
                zoneIds.push(new mongoose.Types.ObjectId(zStr));
            }
        }
    }

    // Validate surfaces.home
    const home = payload.surfaces?.home;
    if (!home || typeof home !== "object") {
        errors.push("surfaces.home is required.");
        return { valid: false, message: errors[0], errors };
    }

    // 1. Colors validation
    const colors = home.colors;
    const validatedColors: Partial<IThemeHomeColors> = {};
    if (!colors || typeof colors !== "object") {
        errors.push("surfaces.home.colors is required.");
    } else {
        for (const key of REQUIRED_COLOR_KEYS) {
            const val = colors[key];
            if (typeof val !== "string" || !HEX_COLOR_REGEX.test(val.trim())) {
                errors.push(`surfaces.home.colors.${key} must be a valid 6-digit hex color matching /^#[0-9A-Fa-f]{6}$/ (got "${val}").`);
            } else {
                validatedColors[key] = val.trim();
            }
        }

        // WCAG contrast checks (only if all colors in the pair are valid hex)
        for (const [fgKey, bgKey] of CONTRAST_PAIRS) {
            const fg = validatedColors[fgKey];
            const bg = validatedColors[bgKey];
            if (fg && bg) {
                const ratio = getContrastRatio(fg, bg);
                if (ratio < WCAG_AA_MIN_CONTRAST) {
                    errors.push(
                        `Contrast check failed for ${fgKey} (${fg}) vs ${bgKey} (${bg}): ratio is ${ratio.toFixed(2)}:1, minimum required is ${WCAG_AA_MIN_CONTRAST}:1.`
                    );
                }
            }
        }
    }

    // 2. Images validation
    const images = home.images || { hero: [] };
    let validatedGarland: string | undefined = undefined;
    const validatedHero: Array<{ imageUrl: string; deepLink?: string }> = [];

    if (typeof images !== "object") {
        errors.push("surfaces.home.images must be an object.");
    } else {
        if (images.garland !== undefined && images.garland !== null && images.garland !== "") {
            if (!isHttpsUrl(images.garland)) {
                errors.push(`surfaces.home.images.garland must be an https URL (got "${images.garland}").`);
            } else {
                validatedGarland = images.garland.trim();
            }
        }

        const hero = images.hero !== undefined ? images.hero : [];
        if (!Array.isArray(hero)) {
            errors.push("surfaces.home.images.hero must be an array.");
        } else {
            if (hero.length > 5) {
                errors.push(`surfaces.home.images.hero can have at most 5 items (got ${hero.length}).`);
            }
            hero.forEach((item: any, idx: number) => {
                if (!item || typeof item !== "object" || !isHttpsUrl(item.imageUrl)) {
                    errors.push(`surfaces.home.images.hero[${idx}].imageUrl must be a valid https URL.`);
                } else {
                    const entry: { imageUrl: string; deepLink?: string } = {
                        imageUrl: item.imageUrl.trim()
                    };
                    if (typeof item.deepLink === "string" && item.deepLink.trim()) {
                        entry.deepLink = item.deepLink.trim();
                    }
                    validatedHero.push(entry);
                }
            });
        }
    }

    // 3. Sections validation
    const rawSections = home.sections !== undefined ? home.sections : [];
    const validatedSections: Array<{
        type: "product_strip";
        title: string;
        productIds: mongoose.Types.ObjectId[];
    }> = [];
    const allProductIdStrings: string[] = [];

    if (!Array.isArray(rawSections)) {
        errors.push("surfaces.home.sections must be an array.");
    } else {
        if (rawSections.length > 3) {
            errors.push(`surfaces.home.sections can have at most 3 items (got ${rawSections.length}).`);
        }
        rawSections.forEach((sec: any, idx: number) => {
            if (!sec || typeof sec !== "object") {
                errors.push(`surfaces.home.sections[${idx}] must be an object.`);
                return;
            }
            if (sec.type !== "product_strip") {
                errors.push(`surfaces.home.sections[${idx}].type must be "product_strip" (got "${sec.type}").`);
            }
            const title = typeof sec.title === "string" ? sec.title.trim() : "";
            if (!title) {
                errors.push(`surfaces.home.sections[${idx}].title is required.`);
            }
            const pIds = sec.productIds !== undefined ? sec.productIds : [];
            if (!Array.isArray(pIds)) {
                errors.push(`surfaces.home.sections[${idx}].productIds must be an array.`);
                return;
            }
            if (pIds.length > 12) {
                errors.push(`surfaces.home.sections[${idx}].productIds can have at most 12 items (got ${pIds.length}).`);
            }
            const sectionObjectIds: mongoose.Types.ObjectId[] = [];
            for (const pId of pIds) {
                const pStr = String(pId);
                if (!mongoose.Types.ObjectId.isValid(pStr)) {
                    errors.push(`Invalid GroceryProduct ObjectId in sections[${idx}].productIds: "${pStr}".`);
                } else {
                    sectionObjectIds.push(new mongoose.Types.ObjectId(pStr));
                    allProductIdStrings.push(pStr);
                }
            }
            validatedSections.push({
                type: "product_strip",
                title,
                productIds: sectionObjectIds
            });
        });
    }

    // 4. Verify productIds exist in GroceryProduct
    if (allProductIdStrings.length > 0) {
        const uniqueIds = Array.from(new Set(allProductIdStrings));
        const existingProducts = await GroceryProduct.find({
            _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) }
        })
            .select("_id")
            .lean();
        const existingSet = new Set(existingProducts.map((p) => String(p._id)));
        const missingIds = uniqueIds.filter((id) => !existingSet.has(id));
        if (missingIds.length > 0) {
            errors.push(`Unknown GroceryProduct ID(s): ${missingIds.join(", ")}.`);
        }
    }

    // 5. Optional overlay validation (strips unknown fields)
    let validatedOverlay: IThemeOverlay | undefined = undefined;
    const overlayWarnings: string[] = [];

    if (payload.overlay !== undefined && payload.overlay !== null) {
        const rawOverlay = payload.overlay;
        if (typeof rawOverlay !== "object" || Array.isArray(rawOverlay)) {
            errors.push("overlay must be an object.");
        } else {
            const url = typeof rawOverlay.url === "string" ? rawOverlay.url.trim() : "";
            if (!isHttpsUrl(url)) {
                errors.push(`overlay.url must be an https URL (got "${rawOverlay.url}").`);
            } else {
                const pathname = new URL(url).pathname.toLowerCase();
                if (!pathname.endsWith(".json") && !pathname.endsWith(".lottie")) {
                    errors.push(
                        `overlay.url must end with .json or .lottie (got "${rawOverlay.url}").`
                    );
                }
            }

            const format = rawOverlay.format !== undefined ? rawOverlay.format : "lottie";
            if (format !== "lottie") {
                errors.push(`overlay.format must be "lottie" (got "${rawOverlay.format}").`);
            }

            const placement = rawOverlay.placement;
            if (placement !== "header" && placement !== "fullscreen") {
                errors.push(
                    `overlay.placement must be "header" or "fullscreen" (got "${rawOverlay.placement}").`
                );
            }

            const loop = rawOverlay.loop !== undefined ? Boolean(rawOverlay.loop) : true;

            let opacity = 1;
            if (rawOverlay.opacity !== undefined && rawOverlay.opacity !== null) {
                const parsedOpacity = Number(rawOverlay.opacity);
                if (!Number.isFinite(parsedOpacity)) {
                    errors.push("overlay.opacity must be a finite number.");
                } else {
                    opacity = Math.min(1, Math.max(0.1, parsedOpacity));
                }
            }

            const rawSurfaces =
                rawOverlay.surfaces !== undefined ? rawOverlay.surfaces : ["home"];
            const overlaySurfaces: ("home")[] = [];
            if (!Array.isArray(rawSurfaces) || rawSurfaces.length === 0) {
                errors.push('overlay.surfaces must be a non-empty array (e.g. ["home"]).');
            } else {
                for (const s of rawSurfaces) {
                    if (s !== "home") {
                        errors.push(`overlay.surfaces contains unsupported surface "${s}".`);
                    } else if (!overlaySurfaces.includes("home")) {
                        overlaySurfaces.push("home");
                    }
                }
            }

            if (errors.length === 0) {
                validatedOverlay = {
                    url,
                    format: "lottie",
                    placement: placement as "header" | "fullscreen",
                    loop,
                    opacity,
                    surfaces: overlaySurfaces
                };
            }
        }
    }

    if (errors.length > 0) {
        return {
            valid: false,
            message: errors[0],
            errors
        };
    }

    // Perform HEAD check for overlay size/reachability at save time (non-blocking warning)
    if (validatedOverlay) {
        try {
            const headRes = await fetch(validatedOverlay.url, {
                method: "HEAD",
                signal: AbortSignal.timeout(OVERLAY_HEAD_TIMEOUT_MS)
            });
            if (!headRes.ok) {
                overlayWarnings.push(
                    `overlay URL returned HTTP ${headRes.status} on HEAD check; saved anyway.`
                );
            } else {
                const contentLength = headRes.headers.get("content-length");
                if (contentLength) {
                    const bytes = Number(contentLength);
                    if (Number.isFinite(bytes) && bytes > OVERLAY_MAX_BYTES) {
                        const kb = Math.round(bytes / 1024);
                        overlayWarnings.push(
                            `overlay is ${kb} KB, keep it under 300 KB.`
                        );
                    }
                }
            }
        } catch (err: any) {
            overlayWarnings.push(
                `overlay URL could not be reached (${err?.message || "timeout"}); saved anyway.`
            );
        }
    }

    const validatedHome: IThemeHomeSurface = {
        colors: validatedColors as IThemeHomeColors,
        images: {
            ...(validatedGarland ? { garland: validatedGarland } : {}),
            hero: validatedHero
        },
        sections: validatedSections
    };

    return {
        valid: true,
        warnings: overlayWarnings,
        data: {
            name,
            slug,
            isActive,
            startsAt: startsAt!,
            endsAt: endsAt!,
            priority,
            zoneIds,
            surfaces: {
                ...(payload.surfaces || {}),
                home: validatedHome
            },
            ...(validatedOverlay ? { overlay: validatedOverlay } : {})
        }
    };
}
