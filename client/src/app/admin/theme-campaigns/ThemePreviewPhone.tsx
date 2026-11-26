"use client";

import React from "react";
import {
  MdCheckCircle,
  MdError,
  MdHome,
  MdLocalGroceryStore,
  MdReceiptLong,
  MdPerson,
  MdSearch,
  MdLocationOn,
} from "react-icons/md";
import { getDiscountPercent } from "@/utils/discount";
import {
  CONTRAST_PAIRS,
  GroceryProductOption,
  HEX_COLOR_REGEX,
  ThemeHeroImage,
  ThemeHomeColors,
  ThemeHomeSection,
  WCAG_MIN_CONTRAST,
  getContrastRatio,
  getProductImageUrl,
} from "./themeCampaignUtils";

interface ThemePreviewPhoneProps {
  colors: ThemeHomeColors;
  garland?: string;
  hero: ThemeHeroImage[];
  sections: ThemeHomeSection[];
  productLookup: Record<string, GroceryProductOption>;
  overlay?: {
    url: string;
    placement: "header" | "fullscreen";
  } | null;
}

const SAMPLE_CATEGORIES = ["Atta & Dal", "Snacks", "Sweets", "Drinks", "Pooja"];

export default function ThemePreviewPhone({
  colors,
  garland,
  hero,
  sections,
  productLookup,
  overlay,
}: ThemePreviewPhoneProps) {
  const safeHex = (val: string, fallback: string) =>
    HEX_COLOR_REGEX.test(val) ? val : fallback;

  const stageFrom = safeHex(colors.stageFrom, "#1E1B4B");
  const stageTo = safeHex(colors.stageTo, "#312E81");
  const headerText = safeHex(colors.headerText, "#FFFFFF");
  const pageBg = safeHex(colors.pageBg, "#F8FAFC");
  const accent = safeHex(colors.accent, "#F59E0B");
  const tabBg = safeHex(colors.tabBg, "#1E293B");
  const tabActive = safeHex(colors.tabActive, "#FFFFFF");
  const tabInactive = safeHex(colors.tabInactive, "#CBD5E1");

  const firstHero = hero[0]?.imageUrl?.trim();
  const firstSection = sections[0];
  const previewProducts = (firstSection?.productIds || [])
    .map((id) => productLookup[id])
    .filter((p): p is GroceryProductOption => Boolean(p))
    .slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Contrast Ratio Checker */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            WCAG AA Contrast Check (Min 4.5:1)
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CONTRAST_PAIRS.map((pair) => {
            const fg = colors[pair.fg];
            const bg = colors[pair.bg];
            const ratio = getContrastRatio(fg, bg);
            const passes = ratio !== null && ratio >= WCAG_MIN_CONTRAST;

            return (
              <div
                key={pair.label}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
                  passes
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {passes ? (
                    <MdCheckCircle className="text-emerald-600 shrink-0 text-sm" />
                  ) : (
                    <MdError className="text-rose-600 shrink-0 text-sm" />
                  )}
                  <span className="font-semibold truncate">{pair.label}</span>
                </div>
                <span className="font-black ml-2 shrink-0">
                  {ratio !== null ? `${ratio.toFixed(2)}:1` : "Invalid"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 390px Phone Mock */}
      <div className="flex justify-center">
        <div
          className="w-[390px] max-w-full rounded-[36px] border-[6px] border-slate-900 shadow-2xl overflow-hidden flex flex-col"
          style={{ backgroundColor: pageBg }}
          aria-label="Mobile home screen live preview"
        >
          {/* Stage Gradient Header + Search Pill */}
          <div
            className="relative px-4 pt-4 pb-5"
            style={{
              background: `linear-gradient(180deg, ${stageFrom} 0%, ${stageTo} 100%)`,
              color: headerText,
            }}
          >
            {garland && garland.trim().startsWith("https://") && (
              <img
                src={garland.trim()}
                alt="Campaign garland decoration"
                className="w-full h-8 object-cover rounded-lg mb-2 opacity-95"
              />
            )}

            {overlay && overlay.url.trim() && (
              <div className="mb-2 flex justify-end">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-black/35 text-white border border-white/25">
                  {overlay.placement === "fullscreen"
                    ? "Animation: whole screen"
                    : "Animation: header"}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <MdLocationOn className="text-base shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 leading-none">
                    Delivering to
                  </p>
                  <p className="text-sm font-black leading-tight">Home • 15 mins</p>
                </div>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border"
                style={{ borderColor: headerText }}
              >
                ZR
              </div>
            </div>

            {/* Search Pill */}
            <div className="bg-white text-slate-500 rounded-full px-3.5 py-2 flex items-center gap-2 shadow-sm text-xs font-medium">
              <MdSearch className="text-base text-slate-400" />
              <span>Search groceries, sweets &amp; more...</span>
            </div>
          </div>

          {/* Scrollable Body Area */}
          <div className="p-3.5 space-y-4 flex-1">
            {/* Hero Banner */}
            <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200/60 bg-slate-200 h-36 flex items-center justify-center">
              {firstHero && firstHero.startsWith("https://") ? (
                <img
                  src={firstHero}
                  alt="Hero banner preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center px-4">
                  <p className="text-xs font-bold text-slate-500">Hero Banner Placeholder</p>
                  <p className="text-[10px] text-slate-400">Add a hero image URL to preview</p>
                </div>
              )}
            </div>

            {/* 5 Category Circles with Accent Ring */}
            <div className="grid grid-cols-5 gap-2">
              {SAMPLE_CATEGORIES.map((cat) => (
                <div key={cat} className="flex flex-col items-center gap-1">
                  <div
                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xs text-[10px] font-extrabold text-slate-700"
                    style={{ border: `2.5px solid ${accent}` }}
                  >
                    {cat.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700 text-center truncate w-full">
                    {cat}
                  </span>
                </div>
              ))}
            </div>

            {/* First Product Strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-900">
                  {firstSection?.title?.trim() || "Featured Product Strip"}
                </h4>
                <span className="text-[10px] font-bold" style={{ color: accent }}>
                  See all
                </span>
              </div>

              {previewProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {previewProducts.map((product) => {
                    const img = getProductImageUrl(product);
                    const pct = getDiscountPercent(product.price, product.discountedPrice);
                    const displayPrice =
                      pct > 0 && product.discountedPrice ? product.discountedPrice : product.price;

                    return (
                      <div
                        key={product._id}
                        className="bg-white rounded-xl border border-slate-200/80 p-2 shadow-xs flex flex-col gap-1.5"
                      >
                        <div className="h-20 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                          {img ? (
                            <img
                              src={img}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400">No image</span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-slate-800 line-clamp-1">
                          {product.name}
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-baseline gap-1 min-w-0">
                            <span className="text-xs font-black text-slate-900">
                              ₹{displayPrice}
                            </span>
                            {pct > 0 && (
                              <span className="text-[10px] text-slate-400 line-through">
                                ₹{product.price}
                              </span>
                            )}
                          </div>
                          {pct > 0 && (
                            <span
                              className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white shrink-0"
                              style={{ backgroundColor: accent }}
                            >
                              {pct}% OFF
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-center">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Add products to Section 1 to preview cards here
                  </p>
                </div>
              )}
            </div>

            {/* Top Picks Heading Peek */}
            <div className="pt-1 border-t border-slate-200/60">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-900">Top Picks</h4>
                <span className="text-[10px] font-semibold text-slate-400">Restaurants nearby</span>
              </div>
              <div className="mt-2 h-8 rounded-t-xl bg-white border border-b-0 border-slate-200/70 px-3 flex items-center text-[11px] text-slate-400 font-medium">
                Popular restaurants &amp; fast delivery...
              </div>
            </div>
          </div>

          {/* Bottom Tab Bar */}
          <div
            className="px-4 py-2.5 grid grid-cols-4 gap-1 border-t border-black/10"
            style={{ backgroundColor: tabBg }}
          >
            <div className="flex flex-col items-center gap-0.5" style={{ color: tabActive }}>
              <MdHome className="text-lg" />
              <span className="text-[10px] font-extrabold">Home</span>
            </div>
            <div className="flex flex-col items-center gap-0.5" style={{ color: tabInactive }}>
              <MdLocalGroceryStore className="text-lg" />
              <span className="text-[10px] font-semibold">Grocery</span>
            </div>
            <div className="flex flex-col items-center gap-0.5" style={{ color: tabInactive }}>
              <MdReceiptLong className="text-lg" />
              <span className="text-[10px] font-semibold">Orders</span>
            </div>
            <div className="flex flex-col items-center gap-0.5" style={{ color: tabInactive }}>
              <MdPerson className="text-lg" />
              <span className="text-[10px] font-semibold">Account</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
