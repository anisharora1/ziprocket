import mongoose, { Schema, Document } from "mongoose";

export interface IPlatformSettings extends Document {
    isPlatformOpen: boolean;
    maintenanceMode: boolean;
    operatingHours: {
        open: string;  // "HH:MM" e.g., "08:00"
        close: string; // "HH:MM" e.g., "22:00"
    };
    groceryStatus: "open" | "closed" | "disabled";
}

const platformSettingsSchema = new Schema<IPlatformSettings>({
    isPlatformOpen: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    operatingHours: {
        open: { type: String, default: "08:00" },
        close: { type: String, default: "22:00" }
    },
    groceryStatus: { type: String, enum: ["open", "closed", "disabled"], default: "open" }
}, { timestamps: true });

export default mongoose.model<IPlatformSettings>("PlatformSettings", platformSettingsSchema);
