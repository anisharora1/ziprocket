'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
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
    isPlatformOpen: boolean;
    platformStatusMessage: string | null;
    isGroceryOpen: boolean;
    groceryStatusMessage: string | null;
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
    const [loading, setLoading] = useState(false); // Start false so consumers aren't blocked

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
        let eventSource: EventSource | null = null;

        // Delay both initial fetch and SSE connection until after page first paint
        const initialFetchTimer = setTimeout(() => {
            fetchSettings();
        }, 800); // 0.8s: fast enough for status but after first LCP paint

        // Delay SSE connection until after initial page load to ensure network idle for Lighthouse
        const sseTimer = setTimeout(() => {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
            const sseUrl = `${API_BASE_URL}/platform/settings/stream`;

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
        }, 2500); // 2.5s delay

        return () => {
            clearTimeout(initialFetchTimer);
            clearTimeout(sseTimer);
            if (eventSource) {
                eventSource.close();
            }
        };
    }, []);


    // Pre-compute platform open status as a derived state value
    const computeIsOpen = useCallback((): boolean => {
        if (!settings) return true;
        if (settings.maintenanceMode) return false;
        if (!settings.isPlatformOpen) return false;
        if (!settings.operatingHours?.open || !settings.operatingHours?.close) return true;

        try {
            const now = new Date();
            const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' } as const;
            const timeStr = new Intl.DateTimeFormat('en-US', options).format(now);
            const [currH, currM] = timeStr.split(":").map(Number);
            const [openH, openM] = settings.operatingHours.open.split(":").map(Number);
            const [closeH, closeM] = settings.operatingHours.close.split(":").map(Number);

            if (isNaN(currH) || isNaN(openH) || isNaN(closeH)) return true;

            const currVal = currH * 60 + (currM || 0);
            const openVal = openH * 60 + (openM || 0);
            const closeVal = closeH * 60 + (closeM || 0);

            if (openVal <= closeVal) {
                return currVal >= openVal && currVal < closeVal;
            } else {
                return currVal >= openVal || currVal < closeVal;
            }
        } catch (e) {
            return true;
        }
    }, [settings]);

    const [isPlatformOpen, setIsPlatformOpen] = useState(true);

    // Re-compute when settings change and on a 60-second timer
    useEffect(() => {
        setIsPlatformOpen(computeIsOpen());
        const timer = setInterval(() => {
            setIsPlatformOpen(computeIsOpen());
        }, 60_000);
        return () => clearInterval(timer);
    }, [computeIsOpen]);

    const platformStatusMessage = useMemo((): string | null => {
        if (!settings) return null;
        if (settings.maintenanceMode) {
            return "We are currently performing maintenance. Please check back soon.";
        }
        if (!settings.isPlatformOpen) {
            return "Ordering is currently unavailable. Please try again later.";
        }
        if (!isPlatformOpen) {
            const formatted = formatToAMPM(settings.operatingHours?.open || "");
            return `Orders are closed for today. We will reopen at ${formatted || "8:00 AM"}.`;
        }
        return null;
    }, [settings, isPlatformOpen]);

    const isGroceryOpen = useMemo((): boolean => {
        if (!settings) return true;
        if (!isPlatformOpen) return false;
        return settings.groceryStatus === "open";
    }, [settings, isPlatformOpen]);

    const groceryStatusMessage = useMemo((): string | null => {
        if (!settings) return null;
        if (platformStatusMessage) return platformStatusMessage;
        if (settings.groceryStatus === "disabled") {
            return "Grocery ordering is temporarily disabled.";
        }
        if (settings.groceryStatus === "closed") {
            return "Grocery operations are currently closed.";
        }
        return null;
    }, [settings, platformStatusMessage]);

    const contextValue = useMemo(() => ({
        settings,
        loading,
        isPlatformOpen,
        platformStatusMessage,
        isGroceryOpen,
        groceryStatusMessage,
        isPlatformCurrentlyOpen: () => isPlatformOpen,
        getPlatformStatusMessage: () => platformStatusMessage,
        isGroceryCurrentlyOpen: () => isGroceryOpen,
        getGroceryStatusMessage: () => groceryStatusMessage,
        refreshSettings: fetchSettings
    }), [settings, loading, isPlatformOpen, platformStatusMessage, isGroceryOpen, groceryStatusMessage]);

    return (
        <PlatformContext.Provider value={contextValue}>
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
