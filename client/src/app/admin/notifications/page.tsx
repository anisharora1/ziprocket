"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/services/api";
import {
  MdNotificationsActive,
  MdSend,
  MdSchedule,
  MdSmartphone,
  MdCheckCircle,
  MdError,
  MdWarning,
  MdRefresh,
  MdSettings,
  MdCancel,
  MdGroup,
  MdLocationOn,
  MdStorefront,
  MdShoppingBag,
  MdClose,
  MdExpandMore,
  MdExpandLess,
  MdImage,
  MdFlashOn,
  MdContentCopy,
  MdCalendarToday,
  MdCheck,
  MdHourglassEmpty,
  MdInfo
} from "react-icons/md";

// Quick templates for fast filling (Hinglish copy as requested)
interface Template {
  label: string;
  title: string;
  body: string;
  destination: string;
  segment: string;
  icon: string;
}

const TEMPLATES: Template[] = [
  {
    label: "New users",
    title: "Pehla order? ₹50 off 🎉",
    body: "Aapke pehle order par special discount. Abhi try karein!",
    destination: "/(tabs)/home",
    segment: "new_users",
    icon: "🎉"
  },
  {
    label: "Inactive",
    title: "Aapko miss kar rahe hain 😋",
    body: "Wapas aaiye, aaj ke naye offers dekhein.",
    destination: "/(tabs)/home",
    segment: "inactive",
    icon: "😋"
  },
  {
    label: "Grocery",
    title: "Rashan ka saaman, sabse sasta 🛒",
    body: "Aata, dal, tel par aaj ke deals.",
    destination: "/grocery",
    segment: "grocery_shoppers",
    icon: "🛒"
  },
  {
    label: "Food lovers",
    title: "Garma garam khana ready hai 🍕",
    body: "Apne pasandida restaurants se abhi order karein.",
    destination: "/(tabs)/home",
    segment: "food_lovers",
    icon: "🍕"
  },
  {
    label: "Regulars",
    title: "Shukriya! Aapke liye special offer ❤️",
    body: "Regular customers ke liye aaj ka deal dekhein.",
    destination: "/(tabs)/home",
    segment: "regular",
    icon: "❤️"
  }
];

interface SegmentOption {
  key: string;
  label: string;
  description: string;
  icon: string;
}

const SEGMENT_OPTIONS: SegmentOption[] = [
  { key: "all", label: "All customers", description: "Every active device token, including guests", icon: "👥" },
  { key: "new_users", label: "New users", description: "Signed up within threshold, 0 orders placed", icon: "🌱" },
  { key: "never_ordered", label: "Never ordered", description: "Older accounts with zero delivered orders", icon: "⏳" },
  { key: "food_lovers", label: "Food lovers", description: "Frequent food delivery ordering customers", icon: "🍕" },
  { key: "grocery_shoppers", label: "Grocery shoppers", description: "Frequent grocery store ordering customers", icon: "🛒" },
  { key: "regular", label: "Regular customers", description: "High volume orders placed in past 30 days", icon: "⭐" },
  { key: "inactive", label: "Inactive customers", description: "Had orders previously, but inactive recently", icon: "💤" }
];

interface DeliveryZone {
  _id: string;
  name: string;
  center?: { lat: number; lng: number };
}

interface Restaurant {
  _id: string;
  name: string;
  location?: { lat: number; lng: number };
}

interface CampaignStats {
  targeted: number;
  sent: number;
  failed: number;
  skippedCap: number;
  skippedQuiet: number;
  opened: number;
}

interface Campaign {
  _id: string;
  title: string;
  body: string;
  imageUrl?: string;
  route: string;
  segment: { type: string; params?: any };
  zoneIds?: string[];
  radius?: { lat: number; lng: number; km: number };
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  scheduledAt?: string;
  sentAt?: string;
  stats: CampaignStats;
  failureReason?: string;
  createdAt: string;
}

interface NotificationSettings {
  maxPromoPerDay: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  inactiveDays: number;
  newUserDays: number;
  regularMinOrders30d: number;
  foodLoverMinOrders60d: number;
  foodLoverSharePct: number;
}

export default function PushNotificationsAdminPage() {
  // --- Form Composer State ---
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [destinationType, setDestinationType] = useState<"home" | "grocery" | "restaurants" | "cart" | "orders" | "addresses">("home");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  // --- Audience Selection State ---
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [proximityEnabled, setProximityEnabled] = useState(false);
  const [selectedCenterKey, setSelectedCenterKey] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);

  // --- Live Data & Counts ---
  const [segmentCounts, setSegmentCounts] = useState<Record<string, { targeted: number; skippedCap: number; skippedQuiet: number }>>({});
  const [previewCounts, setPreviewCounts] = useState<{ targeted: number; skippedCap: number; skippedQuiet: number }>({
    targeted: 0,
    skippedCap: 0,
    skippedQuiet: 0
  });
  const [loadingPreview, setLoadingPreview] = useState(false);

  // --- Entities ---
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // --- Settings State ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    maxPromoPerDay: 2,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    inactiveDays: 14,
    newUserDays: 7,
    regularMinOrders30d: 4,
    foodLoverMinOrders60d: 2,
    foodLoverSharePct: 60
  });

  // --- Modals and Actions State ---
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  // Send Now Confirmation Dialog
  const [showSendModal, setShowSendModal] = useState(false);
  const [quietHoursWarning, setQuietHoursWarning] = useState<string | null>(null);

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState("");

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Derive final target route from selection
  const computedRoute = React.useMemo(() => {
    switch (destinationType) {
      case "home":
        return "/(tabs)/home";
      case "grocery":
        return "/grocery";
      case "restaurants":
        return selectedRestaurantId ? `/restaurants/${selectedRestaurantId}` : "/(tabs)/home";
      case "cart":
        return "/cart";
      case "orders":
        return "/(tabs)/orders";
      case "addresses":
        return "/addresses";
      default:
        return "/(tabs)/home";
    }
  }, [destinationType, selectedRestaurantId]);

  // Center points list for proximity filtering
  const centerLocations = React.useMemo(() => {
    const list: { key: string; name: string; lat: number; lng: number }[] = [];
    zones.forEach((z) => {
      if (z.center && typeof z.center.lat === "number" && typeof z.center.lng === "number") {
        list.push({
          key: `zone_${z._id}`,
          name: `Zone: ${z.name}`,
          lat: z.center.lat,
          lng: z.center.lng
        });
      }
    });
    restaurants.forEach((r) => {
      if (r.location && typeof r.location.lat === "number" && typeof r.location.lng === "number") {
        list.push({
          key: `rest_${r._id}`,
          name: `Restaurant: ${r.name}`,
          lat: r.location.lat,
          lng: r.location.lng
        });
      }
    });
    return list;
  }, [zones, restaurants]);

  const selectedCenterCoords = React.useMemo(() => {
    if (!selectedCenterKey) return null;
    return centerLocations.find((c) => c.key === selectedCenterKey) || null;
  }, [selectedCenterKey, centerLocations]);

  // Auto-select first center if none selected
  useEffect(() => {
    if (!selectedCenterKey && centerLocations.length > 0) {
      setSelectedCenterKey(centerLocations[0].key);
    }
  }, [centerLocations, selectedCenterKey]);

  // 1. Initial Load of Zones, Restaurants, Settings, Campaigns
  const fetchInitialData = async () => {
    try {
      const [zonesRes, restRes, settingsRes] = await Promise.allSettled([
        apiClient.get("/delivery-zones"),
        apiClient.get("/restaurants?status=approved"),
        apiClient.get("/platform/settings")
      ]);

      if (zonesRes.status === "fulfilled" && zonesRes.value.data.success) {
        setZones(zonesRes.value.data.zones || []);
      }
      if (restRes.status === "fulfilled" && restRes.value.data.success) {
        const approved = restRes.value.data.restaurants || [];
        setRestaurants(approved);
        if (approved.length > 0) {
          setSelectedRestaurantId(approved[0]._id);
        }
      }
      if (settingsRes.status === "fulfilled" && settingsRes.value.data.success) {
        const ns = settingsRes.value.data.settings?.notificationSettings;
        if (ns) {
          setNotificationSettings(ns);
        }
      }
    } catch (err) {
      console.error("Failed to load initial data:", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // 2. Fetch Segment Counts
  const fetchSegmentCounts = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedZones.length > 0) {
        params.zoneIds = selectedZones.join(",");
      }
      if (proximityEnabled && selectedCenterCoords) {
        params.radiusLat = selectedCenterCoords.lat;
        params.radiusLng = selectedCenterCoords.lng;
        params.radiusKm = radiusKm;
      }
      const res = await apiClient.get("/admin/notifications/segments", { params });
      if (res.data.success && res.data.segments) {
        setSegmentCounts(res.data.segments);
      }
    } catch (err) {
      console.error("Failed to fetch segment counts:", err);
    }
  }, [selectedZones, proximityEnabled, selectedCenterCoords, radiusKm]);

  useEffect(() => {
    fetchSegmentCounts();
  }, [fetchSegmentCounts]);

  // 3. Debounced Live Audience Preview
  const previewDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAudiencePreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const payload: any = {
        segment: { type: selectedSegment },
        zoneIds: selectedZones.length > 0 ? selectedZones : undefined
      };
      if (proximityEnabled && selectedCenterCoords) {
        payload.radius = {
          lat: selectedCenterCoords.lat,
          lng: selectedCenterCoords.lng,
          km: radiusKm
        };
      }
      const res = await apiClient.post("/admin/notifications/audience-preview", payload);
      if (res.data.success) {
        setPreviewCounts({
          targeted: res.data.targeted ?? 0,
          skippedCap: res.data.skippedCap ?? 0,
          skippedQuiet: res.data.skippedQuiet ?? 0
        });
      }
    } catch (err) {
      console.error("Audience preview error:", err);
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedSegment, selectedZones, proximityEnabled, selectedCenterCoords, radiusKm]);

  useEffect(() => {
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }
    previewDebounceRef.current = setTimeout(() => {
      fetchAudiencePreview();
    }, 400);

    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
      }
    };
  }, [fetchAudiencePreview]);

  // 4. Fetch Campaigns History
  const fetchCampaigns = useCallback(async (page = 1, showSpinner = true) => {
    if (showSpinner) setLoadingCampaigns(true);
    try {
      const res = await apiClient.get(`/admin/notifications/campaigns?page=${page}&limit=10`);
      if (res.data.success) {
        setCampaigns(res.data.campaigns || []);
        setCurrentPage(res.data.pagination?.page || page);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      if (showSpinner) setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns(currentPage);
  }, [fetchCampaigns, currentPage]);

  // Auto-refresh when any campaign has status "sending" every 5 seconds
  useEffect(() => {
    const hasSending = campaigns.some((c) => c.status === "sending");
    if (!hasSending) return;

    const interval = setInterval(() => {
      fetchCampaigns(currentPage, false);
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns, currentPage, fetchCampaigns]);

  // Apply Quick Template
  const handleApplyTemplate = (tpl: Template) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setSelectedSegment(tpl.segment);
    if (tpl.destination === "/(tabs)/home") setDestinationType("home");
    else if (tpl.destination === "/grocery") setDestinationType("grocery");
    else if (tpl.destination === "/cart") setDestinationType("cart");
    else if (tpl.destination === "/(tabs)/orders") setDestinationType("orders");
    showToast(`Template "${tpl.label}" loaded!`, "info");
  };

  // Send Test Push to Admin's Own Device
  const handleSendTest = async () => {
    if (!title.trim() || !body.trim()) {
      showToast("Please enter a title and message first.", "error");
      return;
    }

    try {
      setIsSendingTest(true);
      const res = await apiClient.post("/admin/notifications/send-test", {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || undefined,
        route: computedRoute
      });

      if (res.data.success) {
        showToast(res.data.message || "Test push notification sent successfully to your device!", "success");
      } else {
        showToast(res.data.message || "Could not send test push.", "error");
      }
    } catch (err: any) {
      console.error("Send test push failed:", err);
      showToast(err.response?.data?.message || err.message || "Failed to send test push.", "error");
    } finally {
      setIsSendingTest(false);
    }
  };

  // Send Now (Trigger Modal)
  const openSendNowModal = () => {
    if (!title.trim() || !body.trim()) {
      showToast("Title and message are required.", "error");
      return;
    }
    setQuietHoursWarning(null);
    setShowSendModal(true);
  };

  const handleConfirmSendNow = async (overrideQuietHours = false) => {
    try {
      setIsSendingNow(true);
      const payload: any = {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || undefined,
        route: computedRoute,
        segment: { type: selectedSegment },
        zoneIds: selectedZones.length > 0 ? selectedZones : undefined,
        overrideQuietHours
      };

      if (proximityEnabled && selectedCenterCoords) {
        payload.radius = {
          lat: selectedCenterCoords.lat,
          lng: selectedCenterCoords.lng,
          km: radiusKm
        };
      }

      const res = await apiClient.post("/admin/notifications/campaigns", payload);

      if (res.status === 202 || res.data.success) {
        showToast("Campaign broadcast started in background!", "success");
        setShowSendModal(false);
        setQuietHoursWarning(null);
        // Refresh campaigns
        fetchCampaigns(1);
      }
    } catch (err: any) {
      console.error("Send campaign error:", err);
      const backendMsg = err.response?.data?.message || err.message || "Failed to create campaign.";

      // If quiet hours blocked it, give option to override
      if (backendMsg.toLowerCase().includes("quiet hours")) {
        setQuietHoursWarning(backendMsg);
      } else {
        showToast(backendMsg, "error");
      }
    } finally {
      setIsSendingNow(false);
    }
  };

  // Schedule Campaign
  const openScheduleModal = () => {
    if (!title.trim() || !body.trim()) {
      showToast("Title and message are required.", "error");
      return;
    }

    // Default to 1 hour in future in local/IST string format: YYYY-MM-DDTHH:mm
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const localIso = new Date(future.getTime() - future.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduledDateTime(localIso);
    setShowScheduleModal(true);
  };

  const handleConfirmSchedule = async () => {
    if (!scheduledDateTime) {
      showToast("Please choose a date and time to schedule.", "error");
      return;
    }

    const scheduledDate = new Date(scheduledDateTime);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now()) {
      showToast("Scheduled time must be in the future.", "error");
      return;
    }

    try {
      setIsScheduling(true);
      const payload: any = {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || undefined,
        route: computedRoute,
        segment: { type: selectedSegment },
        zoneIds: selectedZones.length > 0 ? selectedZones : undefined,
        scheduledAt: scheduledDate.toISOString()
      };

      if (proximityEnabled && selectedCenterCoords) {
        payload.radius = {
          lat: selectedCenterCoords.lat,
          lng: selectedCenterCoords.lng,
          km: radiusKm
        };
      }

      const res = await apiClient.post("/admin/notifications/campaigns", payload);

      if (res.data.success) {
        showToast("Campaign scheduled successfully!", "success");
        setShowScheduleModal(false);
        fetchCampaigns(1);
      }
    } catch (err: any) {
      console.error("Schedule campaign error:", err);
      showToast(err.response?.data?.message || err.message || "Failed to schedule campaign.", "error");
    } finally {
      setIsScheduling(false);
    }
  };

  // Cancel Scheduled Campaign
  const handleCancelCampaign = async (campaignId: string) => {
    if (!window.confirm("Are you sure you want to cancel this scheduled notification campaign?")) {
      return;
    }

    try {
      const res = await apiClient.post(`/admin/notifications/campaigns/${campaignId}/cancel`);
      if (res.data.success) {
        showToast("Campaign cancelled.", "success");
        fetchCampaigns(currentPage);
      }
    } catch (err: any) {
      console.error("Cancel campaign error:", err);
      showToast(err.response?.data?.message || "Failed to cancel campaign.", "error");
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const res = await apiClient.patch("/platform/settings", {
        notificationSettings
      });
      if (res.data.success) {
        showToast("Notification settings saved successfully!", "success");
      }
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      showToast(err.response?.data?.message || "Failed to update notification settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 lg:p-8 space-y-8">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-white font-medium transition-all transform animate-in fade-in slide-in-from-top-4 ${
            toast.type === "error"
              ? "bg-rose-600 shadow-rose-500/25"
              : toast.type === "info"
              ? "bg-indigo-600 shadow-indigo-500/25"
              : "bg-emerald-600 shadow-emerald-500/25"
          }`}
        >
          {toast.type === "error" ? (
            <MdError className="text-xl shrink-0" />
          ) : toast.type === "info" ? (
            <MdInfo className="text-xl shrink-0" />
          ) : (
            <MdCheckCircle className="text-xl shrink-0" />
          )}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80">
            <MdClose />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FF5C00]/10 flex items-center justify-center text-[#FF5C00]">
              <MdNotificationsActive className="text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Push Notifications
              </h1>
              <p className="text-sm text-slate-500">
                Broadcast instant promotional updates, schedule segment campaigns, and monitor customer engagement.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchSegmentCounts();
              fetchAudiencePreview();
              fetchCampaigns(currentPage);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
          >
            <MdRefresh className="text-lg" />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Grid: Left Column (Composer & Audience) + Right Column (Preview Mock & Actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (Composer & Audience) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          {/* Card 1: Composer */}
          <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xs border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-[#FF5C00]/10 text-[#FF5C00] font-bold text-sm flex items-center justify-center">
                  1
                </span>
                <h2 className="text-lg font-bold text-slate-900">Notification Composer</h2>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#FF5C00] bg-[#FF5C00]/10 px-2.5 py-1 rounded-full">
                Step 1 of 2
              </span>
            </div>

            {/* Quick Templates */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MdFlashOn className="text-[#FF5C00]" />
                Quick Templates (Hinglish copy)
              </label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-[#FF5C00]/10 hover:text-[#FF5C00] text-slate-700 border border-slate-200/60 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>{tpl.icon}</span>
                    <span>{tpl.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title & Body Inputs */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-semibold text-slate-800">
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-xs font-mono ${
                      title.length > 65 ? "text-rose-600 font-bold" : "text-slate-400"
                    }`}
                  >
                    {title.length}/65
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={65}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Pehla order? ₹50 off 🎉"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF5C00] text-slate-900 placeholder:text-slate-400 text-sm transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-semibold text-slate-800">
                    Message Body <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-xs font-mono ${
                      body.length > 180 ? "text-rose-600 font-bold" : "text-slate-400"
                    }`}
                  >
                    {body.length}/180
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={180}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. Aapke pehle order par special discount. Abhi try karein!"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF5C00] text-slate-900 placeholder:text-slate-400 text-sm transition-all resize-none"
                />
              </div>

              {/* Image URL & Small Preview */}
              <div>
                <label className="text-sm font-semibold text-slate-800 mb-1.5 block">
                  Image Banner URL <span className="text-xs font-normal text-slate-400">(Optional, HTTPS)</span>
                </label>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF5C00] text-slate-900 placeholder:text-slate-400 text-sm transition-all"
                    />
                    {imageUrl && (
                      <button
                        onClick={() => setImageUrl("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                      >
                        <MdClose />
                      </button>
                    )}
                  </div>

                  {imageUrl && (
                    <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Destination Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-sm font-semibold text-slate-800 mb-1.5 block">
                    In-App Destination
                  </label>
                  <select
                    value={destinationType}
                    onChange={(e) => setDestinationType(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF5C00] text-slate-900 text-sm bg-white"
                  >
                    <option value="home">Home Screen</option>
                    <option value="grocery">Grocery Store</option>
                    <option value="restaurants">Specific Restaurant</option>
                    <option value="cart">Cart</option>
                    <option value="orders">Orders Screen</option>
                    <option value="addresses">Saved Addresses</option>
                  </select>
                </div>

                {destinationType === "restaurants" && (
                  <div>
                    <label className="text-sm font-semibold text-slate-800 mb-1.5 block">
                      Choose Restaurant
                    </label>
                    <select
                      value={selectedRestaurantId}
                      onChange={(e) => setSelectedRestaurantId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF5C00] text-slate-900 text-sm bg-white truncate"
                    >
                      {restaurants.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Resolved Route Pill */}
              <div className="pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60 font-mono">
                  <span className="font-sans font-bold text-slate-700">App Route:</span>
                  <span className="text-[#FF5C00]">{computedRoute}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Audience Selection */}
          <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xs border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-[#FF5C00]/10 text-[#FF5C00] font-bold text-sm flex items-center justify-center">
                  2
                </span>
                <h2 className="text-lg font-bold text-slate-900">Target Audience & Filters</h2>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#FF5C00] bg-[#FF5C00]/10 px-2.5 py-1 rounded-full">
                Step 2 of 2
              </span>
            </div>

            {/* Segments Radio Grid */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-800 block">
                Select Customer Segment
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SEGMENT_OPTIONS.map((seg) => {
                  const countObj = segmentCounts[seg.key];
                  const countNumber = countObj ? countObj.targeted : null;
                  const isSelected = selectedSegment === seg.key;

                  return (
                    <div
                      key={seg.key}
                      onClick={() => setSelectedSegment(seg.key)}
                      className={`relative p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-[#FF5C00] bg-[#FF5C00]/5 ring-2 ring-[#FF5C00]/20 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-lg">{seg.icon}</span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              isSelected
                                ? "bg-[#FF5C00] text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {countNumber !== null ? countNumber.toLocaleString() : "..."}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{seg.label}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed mt-1 line-clamp-2">
                          {seg.description}
                        </p>
                      </div>

                      <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <input
                          type="radio"
                          name="audienceSegment"
                          checked={isSelected}
                          onChange={() => setSelectedSegment(seg.key)}
                          className="accent-[#FF5C00]"
                        />
                        <span className={isSelected ? "text-[#FF5C00] font-bold" : ""}>
                          {isSelected ? "Selected" : "Select"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delivery Zones Multi-select */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <MdLocationOn className="text-[#FF5C00]" />
                  Delivery Zone Filter
                </label>
                {selectedZones.length > 0 && (
                  <button
                    onClick={() => setSelectedZones([])}
                    className="text-xs text-[#FF5C00] hover:underline font-semibold"
                  >
                    Clear Filter (All Zones)
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedZones([])}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    selectedZones.length === 0
                      ? "bg-[#FF5C00] text-white border-[#FF5C00]"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  All Zones
                </button>
                {zones.map((z) => {
                  const isChecked = selectedZones.includes(z._id);
                  return (
                    <button
                      key={z._id}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setSelectedZones(selectedZones.filter((id) => id !== z._id));
                        } else {
                          setSelectedZones([...selectedZones, z._id]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        isChecked
                          ? "bg-[#FF5C00] text-white border-[#FF5C00]"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {isChecked && <MdCheck className="text-sm" />}
                      <span>{z.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Proximity Radius Filter ("Near a location") */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <MdStorefront className="text-[#FF5C00]" />
                  Near a Location (Radius Filter)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">
                    {proximityEnabled ? "Enabled" : "Disabled"}
                  </span>
                  <input
                    type="checkbox"
                    checked={proximityEnabled}
                    onChange={(e) => setProximityEnabled(e.target.checked)}
                    className="accent-[#FF5C00] w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>

              {proximityEnabled && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 animate-in fade-in">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">
                      Location Center
                    </label>
                    <select
                      value={selectedCenterKey}
                      onChange={(e) => setSelectedCenterKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                    >
                      {centerLocations.map((loc) => (
                        <option key={loc.key} value={loc.key}>
                          {loc.name} ({loc.lat.toFixed(4)}, {loc.lng.toFixed(4)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-bold text-slate-700">Radius (km)</span>
                      <span className="font-mono text-[#FF5C00] font-bold">{radiusKm} km</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                      className="w-full accent-[#FF5C00] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>1 km</span>
                      <span>5 km</span>
                      <span>10 km</span>
                      <span>15 km</span>
                      <span>20 km</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Live Reach Line */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF5C00]/20 flex items-center justify-center text-[#FF5C00] shrink-0">
                  <MdGroup className="text-xl" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Live Audience Estimation</div>
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    {loadingPreview ? (
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <MdHourglassEmpty className="animate-spin text-amber-400" />
                        Calculating reach...
                      </span>
                    ) : (
                      <>
                        <span>This will reach</span>
                        <span className="text-[#FF5C00] font-extrabold text-base">
                          {previewCounts.targeted.toLocaleString()}
                        </span>
                        <span>customers</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!loadingPreview && (
                <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                  <span>
                    <strong className="text-slate-200">{previewCounts.skippedCap}</strong> skipped: daily limit
                  </span>
                  <span>•</span>
                  <span>
                    <strong className="text-slate-200">{previewCounts.skippedQuiet}</strong> skipped: quiet hours
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Phone Mockup Preview & Action Buttons) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-8">
          {/* Phone Notification Mock */}
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MdSmartphone className="text-lg text-[#FF5C00]" />
                Device Lockscreen Mockup
              </h3>
              <span className="text-xs text-slate-400 font-medium">Android Preview</span>
            </div>

            {/* Outer phone frame mockup */}
            <div className="bg-slate-900 rounded-[32px] p-4 text-white shadow-xl max-w-sm mx-auto border-4 border-slate-800">
              {/* Phone Status Bar */}
              <div className="flex justify-between items-center text-[11px] text-slate-400 px-2 pb-3 border-b border-slate-800/80">
                <span className="font-semibold text-slate-200">12:30</span>
                <div className="flex items-center gap-1.5 text-xs">
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Notification Banner Container */}
              <div className="mt-4 bg-slate-800/90 backdrop-blur-md rounded-2xl p-3.5 border border-slate-700/60 shadow-lg space-y-2 transition-all">
                {/* Notification Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md bg-[#FF5C00] flex items-center justify-center text-white text-[10px] font-black">
                      ZR
                    </div>
                    <span className="text-xs font-bold text-slate-200">ZipRocket</span>
                    <span className="text-[10px] text-slate-400">• now</span>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    PROMO
                  </span>
                </div>

                {/* Notification Content */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white line-clamp-2">
                    {title || "Pehla order? ₹50 off 🎉"}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-snug line-clamp-3">
                    {body || "Aapke pehle order par special discount. Abhi try karein!"}
                  </p>
                </div>

                {/* Optional Banner Image in notification */}
                {imageUrl && (
                  <div className="w-full h-32 rounded-xl overflow-hidden bg-slate-700/50 border border-slate-600/40 mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Banner"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                {/* Destination Action Hint */}
                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Tap to open:</span>
                  <span className="text-[#FF5C00] font-mono font-medium truncate max-w-[150px]">
                    {computedRoute}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Box */}
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Campaign Actions</h3>

            {/* Send Test to My Phone */}
            <button
              type="button"
              onClick={handleSendTest}
              disabled={isSendingTest || !title.trim() || !body.trim()}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-2 border border-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSendingTest ? (
                <>
                  <MdHourglassEmpty className="animate-spin text-lg" />
                  Sending Test Push...
                </>
              ) : (
                <>
                  <MdSmartphone className="text-lg text-slate-600" />
                  Send Test to My Phone
                </>
              )}
            </button>

            {/* Send Now Button */}
            <button
              type="button"
              onClick={openSendNowModal}
              disabled={isSendingNow || !title.trim() || !body.trim()}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-[#FF5C00] hover:bg-[#E05200] text-white flex items-center justify-center gap-2 shadow-md shadow-[#FF5C00]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <MdSend className="text-lg" />
              Send Now ({previewCounts.targeted.toLocaleString()} Customers)
            </button>

            {/* Schedule Button */}
            <button
              type="button"
              onClick={openScheduleModal}
              disabled={isScheduling || !title.trim() || !body.trim()}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <MdSchedule className="text-lg text-slate-300" />
              Schedule for Later (IST)
            </button>

            <p className="text-[11px] text-slate-400 text-center pt-1">
              All sends respect daily frequency caps ({notificationSettings.maxPromoPerDay}/day) and Indian quiet hours.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for "Send Now" */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 md:p-7 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF5C00]/10 flex items-center justify-center text-[#FF5C00]">
                  <MdSend className="text-2xl" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Broadcast Confirmation</h3>
                  <p className="text-xs text-slate-500">Review your notification blast details</p>
                </div>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            {/* Quiet Hours Warning Alert if triggered */}
            {quietHoursWarning && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                  <MdWarning className="text-lg text-amber-600 shrink-0" />
                  Quiet Hours Are Currently Active in India
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {quietHoursWarning}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmSendNow(true)}
                    disabled={isSendingNow}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all cursor-pointer"
                  >
                    {isSendingNow ? "Sending Broadcast..." : "Send Anyway (Override Quiet Hours)"}
                  </button>
                </div>
              </div>
            )}

            {!quietHoursWarning && (
              <>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Title:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[220px]">{title}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Segment:</span>
                    <span className="font-bold text-slate-900 capitalize">
                      {selectedSegment.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Target Reach:</span>
                    <span className="font-extrabold text-[#FF5C00]">
                      {previewCounts.targeted.toLocaleString()} Customers
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500 font-medium">Destination:</span>
                    <span className="font-mono text-xs text-slate-700">{computedRoute}</span>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSendModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmSendNow(false)}
                    disabled={isSendingNow}
                    className="px-6 py-2.5 rounded-xl bg-[#FF5C00] hover:bg-[#E05200] text-white text-sm font-bold shadow-md shadow-[#FF5C00]/20 flex items-center gap-2 cursor-pointer"
                  >
                    {isSendingNow ? (
                      <>
                        <MdHourglassEmpty className="animate-spin text-lg" />
                        Broadcasting...
                      </>
                    ) : (
                      <>
                        <MdSend />
                        Confirm & Send Now
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal for "Schedule" */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 md:p-7 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-900/10 flex items-center justify-center text-slate-900">
                  <MdSchedule className="text-2xl" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Schedule Push Notification</h3>
                  <p className="text-xs text-slate-500">Pick dispatch time in Indian Standard Time (IST)</p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                  Scheduled Date & Time (IST)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Note: If scheduled inside quiet hours ({notificationSettings.quietHoursStart} – {notificationSettings.quietHoursEnd} IST), it will automatically dispatch at {notificationSettings.quietHoursEnd} IST.
                </p>
              </div>

              {/* Quick time helpers */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Quick Adjustments</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "+30m", minutes: 30 },
                    { label: "+1h", minutes: 60 },
                    { label: "+2h", minutes: 120 },
                    { label: "Tomorrow 10 AM", customHour: 10 },
                    { label: "Tomorrow 6 PM", customHour: 18 }
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        const target = new Date();
                        if (btn.customHour !== undefined) {
                          target.setDate(target.getDate() + 1);
                          target.setHours(btn.customHour, 0, 0, 0);
                        } else {
                          target.setMinutes(target.getMinutes() + (btn.minutes || 0));
                        }
                        const isoStr = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
                          .toISOString()
                          .slice(0, 16);
                        setScheduledDateTime(isoStr);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200/80 transition-all cursor-pointer"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSchedule}
                disabled={isScheduling}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-md flex items-center gap-2 cursor-pointer"
              >
                {isScheduling ? (
                  <>
                    <MdHourglassEmpty className="animate-spin text-lg" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <MdSchedule />
                    Confirm Schedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Campaign History Table */}
      <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xs border border-slate-200/80 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Campaign History & Analytics</h2>
            <p className="text-xs text-slate-500">
              Real-time delivery statistics, open rates, and execution records.
            </p>
          </div>
          <button
            onClick={() => fetchCampaigns(currentPage)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all w-fit cursor-pointer"
          >
            <MdRefresh />
            Refresh Table
          </button>
        </div>

        {loadingCampaigns ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <MdHourglassEmpty className="text-3xl animate-spin text-[#FF5C00]" />
            <p className="text-sm font-medium">Loading notification campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <MdNotificationsActive className="text-4xl mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No campaigns launched yet</p>
            <p className="text-xs text-slate-400">
              Compose a message above and send your first promotional push!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Title & Route</th>
                  <th className="py-3 px-4">Segment / Target</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sent / Failed</th>
                  <th className="py-3 px-4">Opened (Rate)</th>
                  <th className="py-3 px-4">Date (IST)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {campaigns.map((camp) => {
                  const sentCount = camp.stats?.sent ?? 0;
                  const openedCount = camp.stats?.opened ?? 0;
                  const openRate = sentCount > 0 ? ((openedCount / sentCount) * 100).toFixed(1) : "0.0";

                  // Status Badge Formatting
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                      {camp.status}
                    </span>
                  );

                  if (camp.status === "sending") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                        Sending...
                      </span>
                    );
                  } else if (camp.status === "sent") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <MdCheckCircle className="text-xs" />
                        Sent
                      </span>
                    );
                  } else if (camp.status === "scheduled") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                        <MdSchedule className="text-xs" />
                        Scheduled
                      </span>
                    );
                  } else if (camp.status === "cancelled") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
                        Cancelled
                      </span>
                    );
                  } else if (camp.status === "failed") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                        <MdError className="text-xs" />
                        Failed
                      </span>
                    );
                  }

                  const displayDate = camp.sentAt || camp.scheduledAt || camp.createdAt;
                  const formattedDate = displayDate
                    ? new Date(displayDate).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                    : "—";

                  return (
                    <tr key={camp._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-bold text-slate-900 truncate" title={camp.title}>
                          {camp.title}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={camp.body}>
                          {camp.body}
                        </div>
                        <div className="text-[10px] text-[#FF5C00] font-mono mt-0.5 truncate">
                          {camp.route}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="capitalize font-semibold text-slate-800 block">
                          {camp.segment?.type?.replace("_", " ") || "All"}
                        </span>
                        {camp.zoneIds && camp.zoneIds.length > 0 && (
                          <span className="text-[10px] text-slate-400 block">
                            {camp.zoneIds.length} Zone(s)
                          </span>
                        )}
                        {camp.radius && (
                          <span className="text-[10px] text-slate-400 block">
                            Radius {camp.radius.km}km
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">{statusBadge}</td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {sentCount.toLocaleString()}{" "}
                          <span className="font-normal text-slate-400">/ {camp.stats?.targeted ?? 0}</span>
                        </div>
                        {camp.stats?.failed > 0 && (
                          <span className="text-[10px] text-rose-600 font-semibold block">
                            {camp.stats.failed} failed
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{openedCount.toLocaleString()}</span>
                          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                            {openRate}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formattedDate}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {camp.status === "scheduled" && (
                          <button
                            type="button"
                            onClick={() => handleCancelCampaign(camp._id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Page <strong className="text-slate-900">{currentPage}</strong> of{" "}
                  <strong className="text-slate-900">{totalPages}</strong>
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 6: Notification Settings Card (Collapsed by Default) */}
      <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xs border border-slate-200/80">
        <div
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
              <MdSettings className="text-2xl" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Notification & Anti-Fatigue Settings
              </h2>
              <p className="text-xs text-slate-500">
                Configure quiet hours, daily limits, and segment threshold rules.
              </p>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 text-2xl p-1">
            {settingsOpen ? <MdExpandLess /> : <MdExpandMore />}
          </button>
        </div>

        {settingsOpen && (
          <div className="pt-6 mt-6 border-t border-slate-100 space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Daily Limit */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Daily Cap per Customer
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={notificationSettings.maxPromoPerDay}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      maxPromoPerDay: Math.max(1, parseInt(e.target.value, 10) || 1)
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Max promo pushes per device / day
                </span>
              </div>

              {/* Quiet Hours Start */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Quiet Hours Start (IST)
                </label>
                <input
                  type="time"
                  value={notificationSettings.quietHoursStart}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      quietHoursStart: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: 22:00</span>
              </div>

              {/* Quiet Hours End */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Quiet Hours End (IST)
                </label>
                <input
                  type="time"
                  value={notificationSettings.quietHoursEnd}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      quietHoursEnd: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default: 08:00</span>
              </div>

              {/* Inactive Days */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Inactive Days Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  value={notificationSettings.inactiveDays}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      inactiveDays: Math.max(1, parseInt(e.target.value, 10) || 1)
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Days since last delivered order
                </span>
              </div>

              {/* New User Days */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New User Age Window
                </label>
                <input
                  type="number"
                  min={1}
                  value={notificationSettings.newUserDays}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      newUserDays: Math.max(1, parseInt(e.target.value, 10) || 1)
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Max account age in days (with 0 orders)
                </span>
              </div>

              {/* Regular Orders */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Regular Min Orders (30d)
                </label>
                <input
                  type="number"
                  min={1}
                  value={notificationSettings.regularMinOrders30d}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      regularMinOrders30d: Math.max(1, parseInt(e.target.value, 10) || 1)
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Delivered in last 30 days</span>
              </div>

              {/* Food Lover Min Orders */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Food Lover Min Orders (60d)
                </label>
                <input
                  type="number"
                  min={1}
                  value={notificationSettings.foodLoverMinOrders60d}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      foodLoverMinOrders60d: Math.max(1, parseInt(e.target.value, 10) || 1)
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Delivered in last 60 days</span>
              </div>

              {/* Food Lover Share % */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Food Lover Share %
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={notificationSettings.foodLoverSharePct}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      foodLoverSharePct: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1))
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Minimum food order percentage
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingSettings ? (
                  <>
                    <MdHourglassEmpty className="animate-spin text-lg" />
                    Saving Settings...
                  </>
                ) : (
                  <>
                    <MdCheckCircle className="text-lg" />
                    Save Rules
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
