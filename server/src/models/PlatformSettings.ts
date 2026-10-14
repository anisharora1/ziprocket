import mongoose, { Schema, Document } from "mongoose";

export interface IPlatformSettings extends Document {
    isPlatformOpen: boolean;
    maintenanceMode: boolean;
    operatingHours: {
        open: string;  // "HH:MM" e.g., "08:00"
        close: string; // "HH:MM" e.g., "22:00"
    };
    groceryStatus: "open" | "closed" | "disabled";
    minOrderValueFood: number;
    minOrderValueGrocery: number;
    notificationSettings: {
        maxPromoPerDay: number;
        quietHoursStart: string; // "HH:MM" e.g., "22:00"
        quietHoursEnd: string;   // "HH:MM" e.g., "08:00"
        inactiveDays: number;
        newUserDays: number;
        regularMinOrders30d: number;
        foodLoverMinOrders60d: number;
        foodLoverSharePct: number;
    };
}

const platformSettingsSchema = new Schema<IPlatformSettings>({
    isPlatformOpen: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    operatingHours: {
        open: { type: String, default: "08:00" },
        close: { type: String, default: "22:00" }
    },
    groceryStatus: { type: String, enum: ["open", "closed", "disabled"], default: "open" },
    minOrderValueFood: { type: Number, default: 0, min: 0 },
    minOrderValueGrocery: { type: Number, default: 0, min: 0 },
    notificationSettings: {
        maxPromoPerDay: { type: Number, default: 2, min: 1 },
        quietHoursStart: { type: String, default: "22:00" },
        quietHoursEnd: { type: String, default: "08:00" },
        inactiveDays: { type: Number, default: 14, min: 1 },
        newUserDays: { type: Number, default: 7, min: 1 },
        regularMinOrders30d: { type: Number, default: 4, min: 1 },
        foodLoverMinOrders60d: { type: Number, default: 2, min: 1 },
        foodLoverSharePct: { type: Number, default: 60, min: 1, max: 100 }
    }
}, { timestamps: true });

export default mongoose.model<IPlatformSettings>("PlatformSettings", platformSettingsSchema);
