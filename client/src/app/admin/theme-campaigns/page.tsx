"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/services/api";
import {
  MdAdd,
  MdArrowBack,
  MdContentCopy,
  MdDelete,
  MdEdit,
  MdErrorOutline,
  MdPalette,
  MdRefresh,
  MdSave,
  MdSync,
  MdWarningAmber,
} from "react-icons/md";
import ProductStripEditor from "./ProductStripEditor";
import ThemePreviewPhone from "./ThemePreviewPhone";
import {
  COLOR_FIELD_META,
  CONTRAST_PAIRS,
  DEFAULT_GROCERY_COLORS,
  DEFAULT_HOME_COLORS,
  DeliveryZoneOption,
  GROCERY_COLOR_FIELD_META,
  GROCERY_CONTRAST_PAIRS,
  GroceryProductOption,
  HEX_COLOR_REGEX,
  ThemeCampaignRecord,
  ThemeGroceryColors,
  ThemeHeroImage,
  ThemeHomeColors,
  ThemeHomeSection,
  WCAG_MIN_CONTRAST,
  formatIstDateTime,
  getContrastRatio,
  istInputToUtcIso,
  slugifyName,
  utcIsoToIstInput,
} from "./themeCampaignUtils";

interface ApiErrorShape {
  message?: string;
  response?: {
    data?: {
      message?: string;
      errors?: string[];
    };
  };
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape;
  return e?.response?.data?.message || e?.message || fallback;
}

function getApiErrorList(err: unknown, fallback: string): string[] {
  const e = err as ApiErrorShape;
  const errs = e?.response?.data?.errors;
  if (Array.isArray(errs) && errs.length > 0) return errs;
  return [getApiErrorMessage(err, fallback)];
}

function createDefaultFormDates() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    startsAtIst: utcIsoToIstInput(now.toISOString()),
    endsAtIst: utcIsoToIstInput(in7Days.toISOString()),
  };
}

export default function AdminThemeCampaignsPage() {
  const [campaigns, setCampaigns] = useState<ThemeCampaignRecord[]>([]);
  const [zones, setZones] = useState<DeliveryZoneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [warningsNotice, setWarningsNotice] = useState<string[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"home" | "grocery">("home");

  // Basic fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [startsAtIst, setStartsAtIst] = useState("");
  const [endsAtIst, setEndsAtIst] = useState("");
  const [priority, setPriority] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [zoneIds, setZoneIds] = useState<string[]>([]);

  // Home surface fields
  const [colors, setColors] = useState<ThemeHomeColors>({ ...DEFAULT_HOME_COLORS });
  const [garland, setGarland] = useState("");
  const [hero, setHero] = useState<ThemeHeroImage[]>([]);
  const [sections, setSections] = useState<ThemeHomeSection[]>([]);

  // Grocery surface fields
  const [groceryEnabled, setGroceryEnabled] = useState(false);
  const [hadInitialGrocery, setHadInitialGrocery] = useState(false);
  const [groceryColors, setGroceryColors] = useState<ThemeGroceryColors>({
    ...DEFAULT_GROCERY_COLORS,
  });
  const [groceryGarland, setGroceryGarland] = useState("");
  const [groceryHero, setGroceryHero] = useState<ThemeHeroImage[]>([]);
  const [grocerySections, setGrocerySections] = useState<ThemeHomeSection[]>([]);

  // Overlay fields
  const [overlayUrl, setOverlayUrl] = useState("");
  const [overlayPlacement, setOverlayPlacement] = useState<"header" | "fullscreen">("header");
  const [overlayLoop, setOverlayLoop] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [overlaySurfaces, setOverlaySurfaces] = useState<("home" | "grocery")[]>(["home"]);
  const [hadInitialOverlay, setHadInitialOverlay] = useState(false);

  const [productLookup, setProductLookup] = useState<Record<string, GroceryProductOption>>({});

  const fetchAll = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [campRes, zoneRes] = await Promise.all([
        apiClient.get("/admin/theme-campaigns"),
        apiClient.get("/delivery-zones"),
      ]);
      if (campRes.data.success) {
        setCampaigns(campRes.data.campaigns || []);
      }
      if (zoneRes.data.success) {
        setZones(zoneRes.data.zones || []);
      }
    } catch (err: unknown) {
      setLoadError(getApiErrorMessage(err, "Failed to load campaigns."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchAll();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const zoneNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const z of zones) {
      map[z._id] = z.name;
    }
    return map;
  }, [zones]);

  const handleProductsLoaded = (list: GroceryProductOption[]) => {
    setProductLookup((prev) => {
      const next = { ...prev };
      for (const p of list) next[String(p._id)] = p;
      return next;
    });
  };

  const hydrateProductLookup = async (campaign: ThemeCampaignRecord) => {
    const homeIds = (campaign.surfaces?.home?.sections || []).flatMap((s) => s.productIds || []);
    const groceryIds = (campaign.surfaces?.grocery?.sections || []).flatMap(
      (s) => s.productIds || []
    );
    if (homeIds.length + groceryIds.length === 0) return;

    try {
      const res = await apiClient.get("/grocery?limit=100");
      if (res.data.success && Array.isArray(res.data.products)) {
        handleProductsLoaded(res.data.products);
      }
    } catch {
      // Non-fatal
    }
  };

  const resetFormToDefaults = () => {
    const { startsAtIst: s, endsAtIst: e } = createDefaultFormDates();
    setEditingId(null);
    setActiveTab("home");
    setName("");
    setSlug("");
    setSlugManuallyEdited(false);
    setStartsAtIst(s);
    setEndsAtIst(e);
    setPriority(0);
    setIsActive(true);
    setZoneIds([]);
    setColors({ ...DEFAULT_HOME_COLORS });
    setGarland("");
    setHero([]);
    setSections([]);
    setGroceryEnabled(false);
    setHadInitialGrocery(false);
    setGroceryColors({ ...DEFAULT_GROCERY_COLORS });
    setGroceryGarland("");
    setGroceryHero([]);
    setGrocerySections([]);
    setOverlayUrl("");
    setOverlayPlacement("header");
    setOverlayLoop(true);
    setOverlayOpacity(1);
    setOverlaySurfaces(["home"]);
    setHadInitialOverlay(false);
    setServerErrors([]);
  };

  const handleOpenCreate = () => {
    resetFormToDefaults();
    setSuccessNotice(null);
    setWarningsNotice([]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (campaign: ThemeCampaignRecord) => {
    setEditingId(campaign._id || null);
    setActiveTab("home");
    setName(campaign.name);
    setSlug(campaign.slug);
    setSlugManuallyEdited(true);
    setStartsAtIst(utcIsoToIstInput(campaign.startsAt));
    setEndsAtIst(utcIsoToIstInput(campaign.endsAt));
    setPriority(campaign.priority ?? 0);
    setIsActive(Boolean(campaign.isActive));
    setZoneIds((campaign.zoneIds || []).map(String));

    setColors({ ...DEFAULT_HOME_COLORS, ...(campaign.surfaces?.home?.colors || {}) });
    setGarland(campaign.surfaces?.home?.images?.garland || "");
    setHero(
      (campaign.surfaces?.home?.images?.hero || []).map((h) => ({
        imageUrl: h.imageUrl,
        deepLink: h.deepLink || "",
      }))
    );
    setSections(
      (campaign.surfaces?.home?.sections || []).map((s) => ({
        type: "product_strip",
        title: s.title,
        productIds: (s.productIds || []).map(String),
      }))
    );

    const groc = campaign.surfaces?.grocery;
    if (groc && groc.colors) {
      setGroceryEnabled(true);
      setHadInitialGrocery(true);
      setGroceryColors({ ...DEFAULT_GROCERY_COLORS, ...groc.colors });
      setGroceryGarland(groc.images?.garland || "");
      setGroceryHero(
        (groc.images?.hero || []).map((h) => ({
          imageUrl: h.imageUrl,
          deepLink: h.deepLink || "",
        }))
      );
      setGrocerySections(
        (groc.sections || []).map((s) => ({
          type: "product_strip",
          title: s.title,
          productIds: (s.productIds || []).map(String),
        }))
      );
    } else {
      setGroceryEnabled(false);
      setHadInitialGrocery(false);
      setGroceryColors({ ...DEFAULT_GROCERY_COLORS });
      setGroceryGarland("");
      setGroceryHero([]);
      setGrocerySections([]);
    }

    if (campaign.overlay?.url) {
      setOverlayUrl(campaign.overlay.url);
      setOverlayPlacement(campaign.overlay.placement || "header");
      setOverlayLoop(campaign.overlay.loop ?? true);
      setOverlayOpacity(campaign.overlay.opacity ?? 1);
      setOverlaySurfaces(
        campaign.overlay.surfaces?.length ? campaign.overlay.surfaces : ["home"]
      );
      setHadInitialOverlay(true);
    } else {
      setOverlayUrl("");
      setOverlayPlacement("header");
      setOverlayLoop(true);
      setOverlayOpacity(1);
      setOverlaySurfaces(["home"]);
      setHadInitialOverlay(false);
    }

    setServerErrors([]);
    setSuccessNotice(null);
    setWarningsNotice([]);
    setIsFormOpen(true);
    hydrateProductLookup(campaign);
  };

  const handleDuplicate = (campaign: ThemeCampaignRecord) => {
    handleOpenEdit(campaign);
    setEditingId(null);
    setHadInitialGrocery(false);
    setHadInitialOverlay(false);
    setName(`${campaign.name} (Copy)`);
    setSlug(`${campaign.slug}-copy-${Date.now().toString().slice(-4)}`);
    setSlugManuallyEdited(true);
  };

  const handleToggleKillSwitch = async (campaign: ThemeCampaignRecord) => {
    if (!campaign._id) return;
    if (campaign.isActive && campaign.status === "live") {
      const ok = window.confirm(
        `Campaign "${campaign.name}" is currently LIVE. Are you sure you want to turn it off?`
      );
      if (!ok) return;
    }

    try {
      const res = await apiClient.patch(`/admin/theme-campaigns/${campaign._id}/toggle`);
      if (res.data.success) {
        setSuccessNotice(res.data.message || "Campaign status updated.");
        await fetchAll();
      }
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, "Failed to toggle campaign status."));
    }
  };

  const handleDelete = async (campaign: ThemeCampaignRecord) => {
    if (!campaign._id) return;
    const ok = window.confirm(
      `Delete theme campaign "${campaign.name}"? This action cannot be undone.`
    );
    if (!ok) return;

    try {
      const res = await apiClient.delete(`/admin/theme-campaigns/${campaign._id}`);
      if (res.data.success) {
        setSuccessNotice("Theme campaign deleted.");
        setCampaigns((prev) => prev.filter((c) => c._id !== campaign._id));
      }
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, "Failed to delete campaign."));
    }
  };

  // Client-side WCAG contrast validation
  const hasHomeContrastFailure = useMemo(() => {
    return CONTRAST_PAIRS.some((pair) => {
      const ratio = getContrastRatio(colors[pair.fg], colors[pair.bg]);
      return ratio === null || ratio < WCAG_MIN_CONTRAST;
    });
  }, [colors]);

  const hasGroceryContrastFailure = useMemo(() => {
    if (!groceryEnabled) return false;
    return GROCERY_CONTRAST_PAIRS.some((pair) => {
      const ratio = getContrastRatio(groceryColors[pair.fg], groceryColors[pair.bg]);
      return ratio === null || ratio < WCAG_MIN_CONTRAST;
    });
  }, [groceryEnabled, groceryColors]);

  const overlayMissingSurfaces = overlayUrl.trim().length > 0 && overlaySurfaces.length === 0;
  const isSaveDisabled =
    saving || hasHomeContrastFailure || hasGroceryContrastFailure || overlayMissingSurfaces;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(slugifyName(val));
    }
  };

  const handleCopyFromHome = () => {
    setGroceryEnabled(true);
    setGroceryColors({
      stageFrom: colors.stageFrom,
      stageTo: colors.stageTo,
      headerText: colors.headerText,
      pageBg: colors.pageBg,
      accent: colors.accent,
    });
    setGroceryGarland(garland);
    setGrocerySections(
      sections.map((s) => ({
        type: "product_strip",
        title: s.title,
        productIds: [...s.productIds],
      }))
    );
  };

  const handleOverlaySurfaceToggle = (surface: "home" | "grocery") => {
    setOverlaySurfaces((prev) =>
      prev.includes(surface) ? prev.filter((s) => s !== surface) : [...prev, surface]
    );
  };

  const errorsMatching = (keywords: string[]) =>
    serverErrors.filter((err) =>
      keywords.some((kw) => err.toLowerCase().includes(kw.toLowerCase()))
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerErrors([]);
    setWarningsNotice([]);
    setSuccessNotice(null);

    const surfacesPayload: Record<string, unknown> = {
      home: {
        colors,
        images: {
          ...(garland.trim() ? { garland: garland.trim() } : {}),
          hero: hero.map((h) => ({
            imageUrl: h.imageUrl.trim(),
            ...(h.deepLink?.trim() ? { deepLink: h.deepLink.trim() } : {}),
          })),
        },
        sections: sections.map((s) => ({
          type: "product_strip" as const,
          title: s.title.trim(),
          productIds: s.productIds,
        })),
      },
    };

    if (groceryEnabled) {
      surfacesPayload.grocery = {
        colors: groceryColors,
        images: {
          ...(groceryGarland.trim() ? { garland: groceryGarland.trim() } : {}),
          hero: groceryHero.map((h) => ({
            imageUrl: h.imageUrl.trim(),
            ...(h.deepLink?.trim() ? { deepLink: h.deepLink.trim() } : {}),
          })),
        },
        sections: grocerySections.map((s) => ({
          type: "product_strip" as const,
          title: s.title.trim(),
          productIds: s.productIds,
        })),
      };
    } else if (editingId && hadInitialGrocery) {
      surfacesPayload.grocery = null;
    }

    const trimmedOverlayUrl = overlayUrl.trim();
    const payload: Record<string, unknown> = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      isActive,
      startsAt: istInputToUtcIso(startsAtIst),
      endsAt: istInputToUtcIso(endsAtIst),
      priority: Number(priority) || 0,
      zoneIds,
      surfaces: surfacesPayload,
    };

    if (trimmedOverlayUrl) {
      payload.overlay = {
        url: trimmedOverlayUrl,
        format: "lottie",
        placement: overlayPlacement,
        loop: overlayLoop,
        opacity: overlayOpacity,
        surfaces: overlaySurfaces,
      };
    } else if (editingId && hadInitialOverlay) {
      payload.overlay = null;
    }

    try {
      setSaving(true);
      const res = editingId
        ? await apiClient.put(`/admin/theme-campaigns/${editingId}`, payload)
        : await apiClient.post("/admin/theme-campaigns", payload);

      if (res.data.success) {
        setSuccessNotice(
          editingId ? "Theme campaign updated successfully." : "Theme campaign created successfully."
        );
        if (Array.isArray(res.data.warnings) && res.data.warnings.length > 0) {
          setWarningsNotice(res.data.warnings);
        }
        setIsFormOpen(false);
        await fetchAll();
      }
    } catch (err: unknown) {
      setServerErrors(getApiErrorList(err, "Failed to save campaign."));
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (campaign: ThemeCampaignRecord) => {
    if (!campaign.isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-200 text-slate-700">
          Off
        </span>
      );
    }
    if (campaign.status === "live") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800">
          Live
        </span>
      );
    }
    if (campaign.status === "scheduled") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800">
          Scheduled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800">
        Ended
      </span>
    );
  };

  const renderHeroEditor = (
    idPrefix: string,
    heroList: ThemeHeroImage[],
    setHeroList: React.Dispatch<React.SetStateAction<ThemeHeroImage[]>>
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">
          Hero Banners ({heroList.length}/5)
        </span>
        <button
          type="button"
          disabled={heroList.length >= 5}
          onClick={() => setHeroList((prev) => [...prev, { imageUrl: "", deepLink: "" }])}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
        >
          <MdAdd />
          Add Hero Image
        </button>
      </div>

      {heroList.map((h, idx) => (
        <div
          key={idx}
          className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
        >
          <div className="flex items-center gap-3">
            {h.imageUrl.trim().startsWith("https://") ? (
              <img
                src={h.imageUrl.trim()}
                alt={`Hero ${idx + 1}`}
                className="w-16 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-16 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                Preview
              </div>
            )}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor={`${idPrefix}-hero-url-${idx}`}
                  className="block text-[11px] font-bold text-slate-600 mb-0.5"
                >
                  Image URL (https) *
                </label>
                <input
                  id={`${idPrefix}-hero-url-${idx}`}
                  type="url"
                  required
                  value={h.imageUrl}
                  onChange={(e) =>
                    setHeroList((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, imageUrl: e.target.value } : item
                      )
                    )
                  }
                  placeholder="https://res.cloudinary.com/..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
              </div>
              <div>
                <label
                  htmlFor={`${idPrefix}-hero-link-${idx}`}
                  className="block text-[11px] font-bold text-slate-600 mb-0.5"
                >
                  Deep Link (optional)
                </label>
                <input
                  id={`${idPrefix}-hero-link-${idx}`}
                  type="text"
                  value={h.deepLink || ""}
                  onChange={(e) =>
                    setHeroList((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, deepLink: e.target.value } : item
                      )
                    )
                  }
                  placeholder="ziprocket://grocery"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHeroList((prev) => prev.filter((_, i) => i !== idx))}
              aria-label={`Remove hero image ${idx + 1}`}
              className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
            >
              <MdDelete className="text-base" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <MdSync className="text-[40px] text-[#FF5C00] animate-spin" />
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">
          Loading theme campaigns...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6 max-w-[1440px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MdPalette className="text-[#FF5C00]" />
            Theme Campaigns
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Configure festival &amp; event themes for Home and Grocery screens (all times in IST).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isFormOpen ? (
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              <MdArrowBack className="text-base" />
              Back to List
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={fetchAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                <MdRefresh className="text-base" />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF5C00] text-white font-bold text-xs hover:bg-[#e05200] shadow-sm transition-colors"
              >
                <MdAdd className="text-base" />
                New campaign
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notices */}
      {successNotice && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between"
        >
          <span>{successNotice}</span>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {warningsNotice.length > 0 && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl text-xs space-y-1"
        >
          <div className="flex items-center gap-1.5 font-extrabold">
            <MdWarningAmber className="text-base text-amber-600 shrink-0" />
            <span>Warnings</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 font-medium">
            {warningsNotice.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {loadError && !isFormOpen && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <MdErrorOutline className="text-3xl text-rose-500 mx-auto" />
          <p className="text-sm font-bold text-rose-800">{loadError}</p>
          <button
            type="button"
            onClick={fetchAll}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* LIST VIEW */}
      {!isFormOpen && !loadError && (
        <>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <MdPalette className="text-4xl text-slate-300 mx-auto" />
              <h2 className="text-base font-extrabold text-slate-700">No campaigns yet</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Create your first festival or event theme campaign to customize the mobile app.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF5C00] text-white font-bold text-xs hover:bg-[#e05200]"
              >
                <MdAdd className="text-base" />
                New campaign
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Campaign</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Start (IST)</th>
                      <th className="py-3.5 px-4">End (IST)</th>
                      <th className="py-3.5 px-4">Priority</th>
                      <th className="py-3.5 px-4">Towns</th>
                      <th className="py-3.5 px-4">Kill Switch</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {campaigns.map((c) => (
                      <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{c.slug}</div>
                        </td>
                        <td className="py-3.5 px-4">{renderStatusBadge(c)}</td>
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                          {formatIstDateTime(c.startsAt)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                          {formatIstDateTime(c.endsAt)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{c.priority}</td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {!c.zoneIds || c.zoneIds.length === 0
                            ? "All towns"
                            : c.zoneIds.map((id) => zoneNameMap[String(id)] || String(id)).join(", ")}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={c.isActive}
                            aria-label={`Kill switch for ${c.name}`}
                            onClick={() => handleToggleKillSwitch(c)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF5C00] focus:ring-offset-1 ${
                              c.isActive ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                c.isActive ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(c)}
                              aria-label={`Edit ${c.name}`}
                              className="p-2 rounded-lg text-slate-600 hover:text-[#FF5C00] hover:bg-orange-50 transition-colors"
                              title="Edit"
                            >
                              <MdEdit className="text-base" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(c)}
                              aria-label={`Duplicate ${c.name}`}
                              className="p-2 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Duplicate"
                            >
                              <MdContentCopy className="text-base" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              aria-label={`Delete ${c.name}`}
                              className="p-2 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete"
                            >
                              <MdDelete className="text-base" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* FORM + STICKY PREVIEW */}
      {isFormOpen && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <form
            onSubmit={handleSubmit}
            className="flex-1 min-w-0 w-full space-y-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900">
                {editingId ? "Edit Theme Campaign" : "Create Theme Campaign"}
              </h2>
            </div>

            {serverErrors.length > 0 && (
              <div
                role="alert"
                className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs space-y-1"
              >
                <p className="font-extrabold">Please fix the following errors:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {serverErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Campaign Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tc-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Campaign Name *
                </label>
                <input
                  id="tc-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Diwali Dhamaka 2026"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
              </div>

              <div>
                <label htmlFor="tc-slug" className="block text-xs font-bold text-slate-700 mb-1">
                  Slug (unique, lowercase) *
                </label>
                <input
                  id="tc-slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  placeholder="e.g. diwali-2026"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
              </div>

              <div>
                <label htmlFor="tc-startsAt" className="block text-xs font-bold text-slate-700 mb-1">
                  Starts At (India Time / IST) *
                </label>
                <input
                  id="tc-startsAt"
                  type="datetime-local"
                  required
                  value={startsAtIst}
                  onChange={(e) => setStartsAtIst(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
              </div>

              <div>
                <label htmlFor="tc-endsAt" className="block text-xs font-bold text-slate-700 mb-1">
                  Ends At (India Time / IST) *
                </label>
                <input
                  id="tc-endsAt"
                  type="datetime-local"
                  required
                  value={endsAtIst}
                  onChange={(e) => setEndsAtIst(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
              </div>

              <div>
                <label htmlFor="tc-priority" className="block text-xs font-bold text-slate-700 mb-1">
                  Priority (higher wins)
                </label>
                <input
                  id="tc-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  id="tc-isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 accent-[#FF5C00]"
                />
                <label htmlFor="tc-isActive" className="text-xs font-bold text-slate-700">
                  Campaign Active (Kill Switch ON)
                </label>
              </div>
            </div>

            {errorsMatching(["startsAt", "endsAt", "slug"]).map((err, i) => (
              <p key={i} className="text-xs font-semibold text-rose-600">
                {err}
              </p>
            ))}

            {/* Towns Multi-Select */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Target Towns / Delivery Zones
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Leave empty for all towns
                </span>
              </div>
              {zones.length === 0 ? (
                <p className="text-xs text-slate-400">No delivery zones loaded.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {zones.map((z) => {
                    const checked = zoneIds.includes(z._id);
                    return (
                      <label
                        key={z._id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                          checked
                            ? "bg-orange-50 border-[#FF5C00] text-[#FF5C00]"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setZoneIds((prev) =>
                              prev.includes(z._id)
                                ? prev.filter((id) => id !== z._id)
                                : [...prev, z._id]
                            )
                          }
                          className="accent-[#FF5C00]"
                        />
                        {z.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Surface Tabs */}
            <div className="pt-2 border-t border-slate-100">
              <div
                role="tablist"
                aria-label="Campaign surfaces"
                className="inline-flex p-1 rounded-xl bg-slate-100 gap-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "home"}
                  onClick={() => setActiveTab("home")}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-colors ${
                    activeTab === "home"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Home screen
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "grocery"}
                  onClick={() => setActiveTab("grocery")}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-colors ${
                    activeTab === "grocery"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Grocery screen {groceryEnabled ? "• On" : ""}
                </button>
              </div>
            </div>

            {/* HOME TAB */}
            {activeTab === "home" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Home Surface Colours
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {COLOR_FIELD_META.map(({ key, label }) => {
                      const val = colors[key];
                      const isValidHex = HEX_COLOR_REGEX.test(val);
                      return (
                        <div key={key} className="space-y-1">
                          <label
                            htmlFor={`tc-color-${key}`}
                            className="block text-xs font-bold text-slate-700"
                          >
                            {label}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              aria-label={`${label} color picker`}
                              value={isValidHex ? val : "#000000"}
                              onChange={(e) =>
                                setColors((prev) => ({
                                  ...prev,
                                  [key]: e.target.value.toUpperCase(),
                                }))
                              }
                              className="h-9 w-11 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                            />
                            <input
                              id={`tc-color-${key}`}
                              type="text"
                              value={val}
                              onChange={(e) =>
                                setColors((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              placeholder="#FFFFFF"
                              className={`flex-1 px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 ${
                                isValidHex
                                  ? "border-slate-200 focus:ring-[#FF5C00]"
                                  : "border-rose-400 focus:ring-rose-500"
                              }`}
                            />
                          </div>
                          {!isValidHex && (
                            <p className="text-[11px] text-rose-600 font-semibold">
                              Must match #RRGGBB
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {errorsMatching(["surfaces.home.colors", "surfaces.home.headerText"]).map(
                    (err, i) => (
                      <p key={i} className="text-xs font-semibold text-rose-600">
                        {err}
                      </p>
                    )
                  )}
                </div>

                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Home Images (HTTPS URLs)
                  </h3>
                  <div>
                    <label
                      htmlFor="tc-garland"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Garland Image URL (optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="tc-garland"
                        type="url"
                        value={garland}
                        onChange={(e) => setGarland(e.target.value)}
                        placeholder="https://res.cloudinary.com/..."
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                      />
                      {garland && (
                        <button
                          type="button"
                          onClick={() => setGarland("")}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {garland.trim().startsWith("https://") && (
                      <img
                        src={garland.trim()}
                        alt="Garland thumbnail"
                        className="mt-2 h-12 rounded-lg border border-slate-200 object-cover"
                      />
                    )}
                  </div>
                  {renderHeroEditor("tc-home", hero, setHero)}
                  {errorsMatching(["surfaces.home.images"]).map((err, i) => (
                    <p key={i} className="text-xs font-semibold text-rose-600">
                      {err}
                    </p>
                  ))}
                </div>

                <ProductStripEditor
                  idPrefix="tc-home"
                  sections={sections}
                  onChange={setSections}
                  productLookup={productLookup}
                  onProductsLoaded={handleProductsLoaded}
                  errors={errorsMatching(["surfaces.home.sections", "product"])}
                />
              </div>
            )}

            {/* GROCERY TAB */}
            {activeTab === "grocery" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      id="tc-grocery-enabled"
                      type="checkbox"
                      checked={groceryEnabled}
                      onChange={(e) => setGroceryEnabled(e.target.checked)}
                      className="h-4 w-4 accent-[#FF5C00]"
                    />
                    <span className="text-xs font-extrabold text-slate-800">
                      Enable grocery theme
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={handleCopyFromHome}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <MdContentCopy className="text-sm" />
                    Copy from Home
                  </button>
                </div>

                {groceryEnabled && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        Grocery Surface Colours
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {GROCERY_COLOR_FIELD_META.map(({ key, label }) => {
                          const val = groceryColors[key];
                          const isValidHex = HEX_COLOR_REGEX.test(val);
                          return (
                            <div key={key} className="space-y-1">
                              <label
                                htmlFor={`tc-groc-color-${key}`}
                                className="block text-xs font-bold text-slate-700"
                              >
                                {label}
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  aria-label={`Grocery ${label} color picker`}
                                  value={isValidHex ? val : "#000000"}
                                  onChange={(e) =>
                                    setGroceryColors((prev) => ({
                                      ...prev,
                                      [key]: e.target.value.toUpperCase(),
                                    }))
                                  }
                                  className="h-9 w-11 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                                />
                                <input
                                  id={`tc-groc-color-${key}`}
                                  type="text"
                                  value={val}
                                  onChange={(e) =>
                                    setGroceryColors((prev) => ({
                                      ...prev,
                                      [key]: e.target.value,
                                    }))
                                  }
                                  placeholder="#FFFFFF"
                                  className={`flex-1 px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 ${
                                    isValidHex
                                      ? "border-slate-200 focus:ring-[#FF5C00]"
                                      : "border-rose-400 focus:ring-rose-500"
                                  }`}
                                />
                              </div>
                              {!isValidHex && (
                                <p className="text-[11px] text-rose-600 font-semibold">
                                  Must match #RRGGBB
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {errorsMatching(["surfaces.grocery.colors", "surfaces.grocery.headerText"]).map(
                        (err, i) => (
                          <p key={i} className="text-xs font-semibold text-rose-600">
                            {err}
                          </p>
                        )
                      )}
                    </div>

                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        Grocery Images (HTTPS URLs)
                      </h3>
                      <div>
                        <label
                          htmlFor="tc-groc-garland"
                          className="block text-xs font-bold text-slate-700 mb-1"
                        >
                          Garland Image URL (optional)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="tc-groc-garland"
                            type="url"
                            value={groceryGarland}
                            onChange={(e) => setGroceryGarland(e.target.value)}
                            placeholder="https://res.cloudinary.com/..."
                            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                          />
                          {groceryGarland && (
                            <button
                              type="button"
                              onClick={() => setGroceryGarland("")}
                              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {groceryGarland.trim().startsWith("https://") && (
                          <img
                            src={groceryGarland.trim()}
                            alt="Grocery garland thumbnail"
                            className="mt-2 h-12 rounded-lg border border-slate-200 object-cover"
                          />
                        )}
                      </div>
                      {renderHeroEditor("tc-groc", groceryHero, setGroceryHero)}
                      {errorsMatching(["surfaces.grocery.images"]).map((err, i) => (
                        <p key={i} className="text-xs font-semibold text-rose-600">
                          {err}
                        </p>
                      ))}
                    </div>

                    <ProductStripEditor
                      idPrefix="tc-groc"
                      sections={grocerySections}
                      onChange={setGrocerySections}
                      productLookup={productLookup}
                      onProductsLoaded={handleProductsLoaded}
                      errors={errorsMatching(["surfaces.grocery.sections", "product"])}
                    />
                  </>
                )}
              </div>
            )}

            {/* Animation Overlay (optional) */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Animation overlay (optional)
                </h3>
                {overlayUrl.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setOverlayUrl("");
                      setOverlayPlacement("header");
                      setOverlayLoop(true);
                      setOverlayOpacity(1);
                      setOverlaySurfaces(["home"]);
                    }}
                    className="px-3 py-1 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
                  >
                    Remove overlay
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor="tc-overlay-url"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Lottie File URL (.json or .lottie, https)
                </label>
                <input
                  id="tc-overlay-url"
                  type="url"
                  value={overlayUrl}
                  onChange={(e) => setOverlayUrl(e.target.value)}
                  placeholder="https://assets.example.com/diwali-sparkles.lottie"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                />
                <p className="text-[11px] font-semibold text-slate-400 mt-1">
                  Keep the file under 300 KB
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <label
                    htmlFor="tc-overlay-placement"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Placement
                  </label>
                  <select
                    id="tc-overlay-placement"
                    value={overlayPlacement}
                    onChange={(e) =>
                      setOverlayPlacement(e.target.value as "header" | "fullscreen")
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                  >
                    <option value="header">Header area</option>
                    <option value="fullscreen">Whole screen</option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5 pt-4">
                  <input
                    id="tc-overlay-loop"
                    type="checkbox"
                    checked={overlayLoop}
                    onChange={(e) => setOverlayLoop(e.target.checked)}
                    className="h-4 w-4 accent-[#FF5C00]"
                  />
                  <label htmlFor="tc-overlay-loop" className="text-xs font-bold text-slate-700">
                    Loop animation
                  </label>
                </div>

                <div>
                  <label
                    htmlFor="tc-overlay-opacity"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Opacity ({overlayOpacity.toFixed(2)})
                  </label>
                  <input
                    id="tc-overlay-opacity"
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="w-full accent-[#FF5C00]"
                  />
                </div>
              </div>

              {/* Overlay Surfaces Checkboxes */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-700">
                  Overlay Surfaces (select at least one)
                </span>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlaySurfaces.includes("home")}
                      onChange={() => handleOverlaySurfaceToggle("home")}
                      className="h-4 w-4 accent-[#FF5C00]"
                    />
                    Show on Home
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlaySurfaces.includes("grocery")}
                      onChange={() => handleOverlaySurfaceToggle("grocery")}
                      className="h-4 w-4 accent-[#FF5C00]"
                    />
                    Show on Grocery
                  </label>
                </div>
                {overlayMissingSurfaces && (
                  <p className="text-xs font-semibold text-rose-600">
                    Select at least one surface (Show on Home or Show on Grocery).
                  </p>
                )}
              </div>

              {errorsMatching(["overlay"]).map((err, i) => (
                <p key={i} className="text-xs font-semibold text-rose-600">
                  {err}
                </p>
              ))}
              {warningsNotice
                .filter((w) => w.toLowerCase().includes("overlay"))
                .map((w, i) => (
                  <p key={i} className="text-xs font-semibold text-amber-700">
                    {w}
                  </p>
                ))}
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="text-xs">
                {(hasHomeContrastFailure || hasGroceryContrastFailure) && (
                  <span className="text-rose-600 font-bold">
                    Save disabled: fix WCAG contrast pairs below 4.5:1.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaveDisabled}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#FF5C00] text-white text-xs font-extrabold hover:bg-[#e05200] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <MdSave className="text-base" />
                  {saving ? "Saving..." : editingId ? "Update Campaign" : "Save Campaign"}
                </button>
              </div>
            </div>
          </form>

          {/* Right: Sticky Live Preview */}
          <div className="w-full lg:w-[420px] lg:sticky lg:top-6 shrink-0">
            <ThemePreviewPhone
              home={{ colors, garland, hero, sections }}
              grocery={{
                enabled: groceryEnabled,
                colors: groceryColors,
                garland: groceryGarland,
                hero: groceryHero,
                sections: grocerySections,
              }}
              productLookup={productLookup}
              overlay={
                overlayUrl.trim()
                  ? {
                      url: overlayUrl.trim(),
                      placement: overlayPlacement,
                      surfaces: overlaySurfaces,
                    }
                  : null
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
