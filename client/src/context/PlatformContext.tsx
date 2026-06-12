'use client';

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "@/services/api";

export interface PlatformSettings {
    isPlatformOpen: boolean;
    maintenanceMode: boolean;
    operatingHours: {
        open: string;
        close: string;
    };
    groceryStatus: "open" | "closed" | "disabled";
}

interface PlatformContextType {
    settings: PlatformSettings | null;
    loading: boolean;
    isPlatformCurrentlyOpen: () => boolean;
    getPlatformStatusMessage: () => string | null;
    isGroceryCurrentlyOpen: () => boolean;
    getGroceryStatusMessage: () => string | null;
    refreshSettings: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

const formatToAMPM = (timeStr: string): string => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM} ${ampm}`;
};

export function PlatformProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<PlatformSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const res = await apiClient.get("/platform/settings");
            if (res.data.success && res.data.settings) {
                setSettings(res.data.settings);
            }
        } catch (err) {
            console.error("Failed to fetch platform settings:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();

        // Establish SSE connection for real-time updates
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
        const sseUrl = `${API_BASE_URL}/platform/settings/stream`;
        
        let eventSource: EventSource | null = null;
        
        try {
            eventSource = new EventSource(sseUrl);
            
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && typeof data === 'object') {
                        setSettings(data);
                    }
                } catch (e) {
                    console.error("Failed to parse platform settings event:", e);
                }
            };

            eventSource.onerror = (err) => {
                console.warn("SSE connection error. Native reconnection will be attempted by the browser.", err);
            };
        } catch (e) {
            console.error("Failed to initialize SSE EventSource:", e);
        }

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, []);

    const isPlatformCurrentlyOpen = (): boolean => {
        if (!settings) return true;
        if (settings.maintenanceMode) return false;
        if (!settings.isPlatformOpen) return false;

        // Check operating hours
        const now = new Date();
        const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' } as const;
        const timeStr = new Intl.DateTimeFormat('en-US', options).format(now);
        const [currH, currM] = timeStr.split(":").map(Number);
        const [openH, openM] = settings.operatingHours.open.split(":").map(Number);
        const [closeH, closeM] = settings.operatingHours.close.split(":").map(Number);

        const currVal = currH * 60 + currM;
        const openVal = openH * 60 + openM;
        const closeVal = closeH * 60 + closeM;

        if (openVal <= closeVal) {
            return currVal >= openVal && currVal < closeVal;
        } else {
            return currVal >= openVal || currVal < closeVal;
        }
    };

    const getPlatformStatusMessage = (): string | null => {
        if (!settings) return null;
        if (settings.maintenanceMode) {
            return "We are currently performing maintenance. Please check back soon.";
        }
        if (!settings.isPlatformOpen) {
            return "Ordering is currently unavailable. Please try again later.";
        }
        if (!isPlatformCurrentlyOpen()) {
            const formatted = formatToAMPM(settings.operatingHours.open);
            return `Orders are closed for today. We will reopen at ${formatted || "8:00 AM"}.`;
        }
        return null;
    };

    const isGroceryCurrentlyOpen = (): boolean => {
        if (!settings) return true;
        if (!isPlatformCurrentlyOpen()) return false;
        return settings.groceryStatus === "open";
    };

    const getGroceryStatusMessage = (): string | null => {
        if (!settings) return null;
        const platformMsg = getPlatformStatusMessage();
        if (platformMsg) return platformMsg;

        if (settings.groceryStatus === "disabled") {
            return "Grocery ordering is temporarily disabled.";
        }
        if (settings.groceryStatus === "closed") {
            return "Grocery operations are currently closed.";
        }
        return null;
    };

    return (
        <PlatformContext.Provider value={{
            settings,
            loading,
            isPlatformCurrentlyOpen,
            getPlatformStatusMessage,
            isGroceryCurrentlyOpen,
            getGroceryStatusMessage,
            refreshSettings: fetchSettings
        }}>
            {children}
        </PlatformContext.Provider>
    );
}

export function usePlatform() {
    const context = useContext(PlatformContext);
    if (context === undefined) {
        throw new Error("usePlatform must be used within a PlatformProvider");
    }
    return context;
}
