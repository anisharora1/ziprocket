export interface ThemeHomeColors {
  stageFrom: string;
  stageTo: string;
  headerText: string;
  pageBg: string;
  accent: string;
  tabBg: string;
  tabActive: string;
  tabInactive: string;
}

export interface ThemeGroceryColors {
  stageFrom: string;
  stageTo: string;
  headerText: string;
  pageBg: string;
  accent: string;
}

export interface ThemeHeroImage {
  imageUrl: string;
  deepLink?: string;
}

export interface ThemeHomeSection {
  type: "product_strip";
  title: string;
  productIds: string[];
}

export interface ThemeOverlay {
  url: string;
  format: "lottie";
  placement: "header" | "fullscreen";
  loop: boolean;
  opacity: number;
  surfaces: ("home" | "grocery")[];
}

export interface ThemeCampaignRecord {
  _id?: string;
  name: string;
  slug: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  priority: number;
  zoneIds: string[];
  status?: "live" | "scheduled" | "ended";
  surfaces: {
    home: {
      colors: ThemeHomeColors;
      images: {
        garland?: string;
        hero: ThemeHeroImage[];
      };
      sections: ThemeHomeSection[];
    };
    grocery?: {
      colors: ThemeGroceryColors;
      images: {
        garland?: string;
        hero: ThemeHeroImage[];
      };
      sections: ThemeHomeSection[];
    };
  };
  overlay?: ThemeOverlay;
}

export interface DeliveryZoneOption {
  _id: string;
  name: string;
  isActive?: boolean;
}

export interface GroceryProductOption {
  _id: string;
  name: string;
  price: number;
  discountedPrice?: number;
  unit: string;
  images?: Array<string | { url: string }>;
  isAvailable?: boolean;
  stockQuantity?: number;
}

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
export const WCAG_MIN_CONTRAST = 4.5;

export const COLOR_FIELD_META: Array<{
  key: keyof ThemeHomeColors;
  label: string;
}> = [
  { key: "stageFrom", label: "Stage Gradient From" },
  { key: "stageTo", label: "Stage Gradient To" },
  { key: "headerText", label: "Header Text" },
  { key: "pageBg", label: "Page Background" },
  { key: "accent", label: "Accent Ring / Pill" },
  { key: "tabBg", label: "Tab Bar Background" },
  { key: "tabActive", label: "Tab Active Text" },
  { key: "tabInactive", label: "Tab Inactive Text" },
];

export const GROCERY_COLOR_FIELD_META: Array<{
  key: keyof ThemeGroceryColors;
  label: string;
}> = [
  { key: "stageFrom", label: "Stage Gradient From" },
  { key: "stageTo", label: "Stage Gradient To" },
  { key: "headerText", label: "Header Text" },
  { key: "pageBg", label: "Page Background" },
  { key: "accent", label: "Accent Ring / Pill" },
];

export const CONTRAST_PAIRS: Array<{
  fg: keyof ThemeHomeColors;
  bg: keyof ThemeHomeColors;
  label: string;
}> = [
  { fg: "headerText", bg: "stageFrom", label: "headerText vs stageFrom" },
  { fg: "headerText", bg: "stageTo", label: "headerText vs stageTo" },
  { fg: "tabActive", bg: "tabBg", label: "tabActive vs tabBg" },
  { fg: "tabInactive", bg: "tabBg", label: "tabInactive vs tabBg" },
];

export const GROCERY_CONTRAST_PAIRS: Array<{
  fg: keyof ThemeGroceryColors;
  bg: keyof ThemeGroceryColors;
  label: string;
}> = [
  { fg: "headerText", bg: "stageFrom", label: "headerText vs stageFrom" },
  { fg: "headerText", bg: "stageTo", label: "headerText vs stageTo" },
];

export const DEFAULT_HOME_COLORS: ThemeHomeColors = {
  stageFrom: "#1E1B4B",
  stageTo: "#312E81",
  headerText: "#FFFFFF",
  pageBg: "#F8FAFC",
  accent: "#F59E0B",
  tabBg: "#1E293B",
  tabActive: "#FFFFFF",
  tabInactive: "#CBD5E1",
};

export const DEFAULT_GROCERY_COLORS: ThemeGroceryColors = {
  stageFrom: "#064E3B",
  stageTo: "#047857",
  headerText: "#FFFFFF",
  pageBg: "#ECFDF5",
  accent: "#10B981",
};

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(hexA: string, hexB: string): number | null {
  if (!HEX_COLOR_REGEX.test(hexA) || !HEX_COLOR_REGEX.test(hexB)) {
    return null;
  }
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Converts a UTC ISO string into "YYYY-MM-DDTHH:mm" in Asia/Kolkata (+05:30)
 * for <input type="datetime-local" />.
 */
export function utcIsoToIstInput(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(
    ist.getUTCHours()
  )}:${pad(ist.getUTCMinutes())}`;
}

/**
 * Converts a "YYYY-MM-DDTHH:mm" string interpreted in Asia/Kolkata (+05:30)
 * into a UTC ISO string.
 */
export function istInputToUtcIso(istLocal: string): string {
  if (!istLocal) return "";
  const d = new Date(`${istLocal}:00+05:30`);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function formatIstDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function getProductImageUrl(product: GroceryProductOption): string | null {
  if (!product.images || product.images.length === 0) return null;
  const first = product.images[0];
  if (typeof first === "string") return first;
  return first?.url || null;
}
