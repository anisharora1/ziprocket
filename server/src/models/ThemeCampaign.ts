import mongoose, { Schema, Types } from "mongoose";
import { BaseDocument } from "../types/common";

export interface IThemeHomeColors {
    stageFrom: string;
    stageTo: string;
    headerText: string;
    pageBg: string;
    accent: string;
    tabBg: string;
    tabActive: string;
    tabInactive: string;
}

export interface IThemeHeroImage {
    imageUrl: string;
    deepLink?: string;
}

export interface IThemeHomeImages {
    garland?: string;
    hero: IThemeHeroImage[];
}

export interface IThemeHomeSection {
    type: "product_strip";
    title: string;
    productIds: Types.ObjectId[];
}

export interface IThemeHomeSurface {
    colors: IThemeHomeColors;
    images: IThemeHomeImages;
    sections: IThemeHomeSection[];
}

export interface IThemeSurfaces {
    home: IThemeHomeSurface;
    // Future surfaces (e.g., grocery, overlay) will be added here without schema changes.
    [key: string]: unknown;
}

export interface IThemeOverlay {
    url: string;
    format: "lottie";
    placement: "header" | "fullscreen";
    loop: boolean;
    opacity: number;
    surfaces: ("home")[];
}

export interface IThemeCampaign extends BaseDocument {
    name: string;
    slug: string;
    isActive: boolean;
    startsAt: Date;
    endsAt: Date;
    priority: number;
    zoneIds: Types.ObjectId[];
    surfaces: IThemeSurfaces;
    overlay?: IThemeOverlay;
}

const themeHomeColorsSchema = new Schema<IThemeHomeColors>(
    {
        stageFrom: { type: String, required: true },
        stageTo: { type: String, required: true },
        headerText: { type: String, required: true },
        pageBg: { type: String, required: true },
        accent: { type: String, required: true },
        tabBg: { type: String, required: true },
        tabActive: { type: String, required: true },
        tabInactive: { type: String, required: true }
    },
    { _id: false }
);

const themeHeroImageSchema = new Schema<IThemeHeroImage>(
    {
        imageUrl: { type: String, required: true },
        deepLink: { type: String }
    },
    { _id: false }
);

const themeHomeImagesSchema = new Schema<IThemeHomeImages>(
    {
        garland: { type: String },
        hero: { type: [themeHeroImageSchema], default: [] }
    },
    { _id: false }
);

const themeHomeSectionSchema = new Schema<IThemeHomeSection>(
    {
        type: {
            type: String,
            enum: ["product_strip"],
            required: true,
            default: "product_strip"
        },
        title: { type: String, required: true, trim: true },
        productIds: [{ type: Schema.Types.ObjectId, ref: "GroceryProduct" }]
    },
    { _id: false }
);

const themeHomeSurfaceSchema = new Schema<IThemeHomeSurface>(
    {
        colors: { type: themeHomeColorsSchema, required: true },
        images: { type: themeHomeImagesSchema, required: true, default: () => ({ hero: [] }) },
        sections: { type: [themeHomeSectionSchema], default: [] }
    },
    { _id: false }
);

// strict: false on surfaces subtree allows future surfaces (grocery, overlay) without schema migration
const themeSurfacesSchema = new Schema<IThemeSurfaces>(
    {
        home: { type: themeHomeSurfaceSchema, required: true }
        // Future surfaces: grocery, overlay
    },
    { _id: false, strict: false }
);

const themeOverlaySchema = new Schema<IThemeOverlay>(
    {
        url: { type: String, required: true, trim: true },
        format: {
            type: String,
            enum: ["lottie"],
            required: true,
            default: "lottie"
        },
        placement: {
            type: String,
            enum: ["header", "fullscreen"],
            required: true
        },
        loop: { type: Boolean, default: true },
        opacity: { type: Number, min: 0.1, max: 1, default: 1 },
        surfaces: {
            type: [{ type: String, enum: ["home"] }],
            default: ["home"]
        }
    },
    { _id: false }
);

const themeCampaignSchema = new Schema<IThemeCampaign>(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        isActive: { type: Boolean, default: true },
        startsAt: { type: Date, required: true },
        endsAt: {
            type: Date,
            required: true,
            validate: {
                validator: function (this: any, val: Date) {
                    const startsAt = this.startsAt;
                    if (!startsAt || !val) return true;
                    return new Date(val).getTime() > new Date(startsAt).getTime();
                },
                message: "endsAt must be after startsAt"
            }
        },
        priority: { type: Number, default: 0 },
        zoneIds: {
            type: [{ type: Schema.Types.ObjectId, ref: "DeliveryZone" }],
            default: []
        },
        surfaces: { type: themeSurfacesSchema, required: true },
        overlay: { type: themeOverlaySchema, required: false }
    },
    { timestamps: true }
);

themeCampaignSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

export default mongoose.model<IThemeCampaign>("ThemeCampaign", themeCampaignSchema);
