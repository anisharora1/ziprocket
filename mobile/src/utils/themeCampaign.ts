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

export interface ThemeHeroItem {
  imageUrl: string;
  deepLink?: string;
}

export interface ThemeCampaignProduct {
  id: string;
  name: string;
  image: string | null;
  unit: string;
  price: number;
  discountedPrice: number | null;
  discountPercent: number | null;
  inStock: boolean;
}

export interface ThemeHomeSection {
  type: 'product_strip';
  title: string;
  products: ThemeCampaignProduct[];
}

export interface ThemeCampaignImages {
  garland?: string;
  hero: ThemeHeroItem[];
}

export interface ThemeOverlay {
  url: string;
  format: 'lottie';
  placement: 'header' | 'fullscreen';
  loop: boolean;
  opacity: number;
  surfaces: ('home' | 'grocery')[];
}

export interface ThemeCampaign {
  id: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  home: {
    colors: ThemeHomeColors;
    images: ThemeCampaignImages;
    sections: ThemeHomeSection[];
  };
  overlay?: ThemeOverlay;
}

export interface ThemeGroceryCampaign {
  id: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  grocery: {
    colors: ThemeGroceryColors;
    images: ThemeCampaignImages;
    sections: ThemeHomeSection[];
  };
  overlay?: ThemeOverlay;
}

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const WCAG_AA_MIN_CONTRAST = 4.5;

const REQUIRED_COLOR_KEYS: (keyof ThemeHomeColors)[] = [
  'stageFrom',
  'stageTo',
  'headerText',
  'pageBg',
  'accent',
  'tabBg',
  'tabActive',
  'tabInactive',
];

const GROCERY_COLOR_KEYS: (keyof ThemeGroceryColors)[] = [
  'stageFrom',
  'stageTo',
  'headerText',
  'pageBg',
  'accent',
];

const CONTRAST_PAIRS: Array<[keyof ThemeHomeColors, keyof ThemeHomeColors]> = [
  ['headerText', 'stageFrom'],
  ['headerText', 'stageTo'],
  ['tabActive', 'tabBg'],
  ['tabInactive', 'tabBg'],
];

const GROCERY_CONTRAST_PAIRS: Array<[keyof ThemeGroceryColors, keyof ThemeGroceryColors]> = [
  ['headerText', 'stageFrom'],
  ['headerText', 'stageTo'],
];

export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_REGEX.test(value.trim());
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('https://')) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return /^https:\/\/\S+$/.test(trimmed);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(hexA: string, hexB: string): number | null {
  if (!isValidHexColor(hexA) || !isValidHexColor(hexB)) {
    return null;
  }
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns true if the hex color is light enough to require dark status bar content.
 */
export function isLightColor(hex: string): boolean {
  if (!isValidHexColor(hex)) return true;
  return getRelativeLuminance(hex) > 0.179;
}

export function isWithinCampaignWindow(
  startsAt: string,
  endsAt: string,
  nowMs: number = Date.now()
): boolean {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return nowMs >= start && nowMs <= end;
}

export function isLottieUrl(value: unknown): value is string {
  if (!isHttpsUrl(value)) return false;
  const trimmed = value.trim();
  try {
    const pathname = new URL(trimmed).pathname.toLowerCase();
    return pathname.endsWith('.json') || pathname.endsWith('.lottie');
  } catch {
    const cleanPath = trimmed.split('?')[0].split('#')[0].toLowerCase();
    return cleanPath.endsWith('.json') || cleanPath.endsWith('.lottie');
  }
}

/**
 * Validates an optional campaign overlay.
 * Returns undefined if invalid so the rest of the campaign still applies.
 */
export function validateThemeOverlay(
  raw: unknown,
  expectedSurface: 'home' | 'grocery' = 'home'
): ThemeOverlay | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;

  if (!isLottieUrl(obj.url)) return undefined;
  if (obj.format !== 'lottie') return undefined;
  if (obj.placement !== 'header' && obj.placement !== 'fullscreen') return undefined;

  const loop = obj.loop !== undefined ? Boolean(obj.loop) : true;

  let opacity = 1;
  if (obj.opacity !== undefined && obj.opacity !== null) {
    const parsed = Number(obj.opacity);
    if (!Number.isFinite(parsed)) return undefined;
    opacity = Math.min(1, Math.max(0.1, parsed));
  }

  let surfaces: ('home' | 'grocery')[] = ['home'];
  if (obj.surfaces !== undefined) {
    if (!Array.isArray(obj.surfaces)) return undefined;
    const validSurfaces = obj.surfaces.filter(
      (s): s is 'home' | 'grocery' => s === 'home' || s === 'grocery'
    );
    if (!validSurfaces.includes(expectedSurface)) {
      return undefined;
    }
    surfaces = validSurfaces;
  } else if (expectedSurface !== 'home') {
    return undefined;
  }

  return {
    url: obj.url.trim(),
    format: 'lottie',
    placement: obj.placement,
    loop,
    opacity,
    surfaces,
  };
}

/**
 * Validates a ThemeCampaign payload on the device.
 * Returns the sanitized ThemeCampaign or null if any color, URL, date window, or WCAG contrast check fails.
 */
export function validateThemeCampaign(
  raw: unknown,
  nowMs: number = Date.now()
): ThemeCampaign | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<ThemeCampaign>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.slug !== 'string' ||
    typeof candidate.startsAt !== 'string' ||
    typeof candidate.endsAt !== 'string' ||
    !candidate.home ||
    typeof candidate.home !== 'object'
  ) {
    return null;
  }

  if (!isWithinCampaignWindow(candidate.startsAt, candidate.endsAt, nowMs)) {
    return null;
  }

  const colors = candidate.home.colors;
  if (!colors || typeof colors !== 'object') return null;

  for (const key of REQUIRED_COLOR_KEYS) {
    if (!isValidHexColor(colors[key])) {
      return null;
    }
  }

  for (const [fgKey, bgKey] of CONTRAST_PAIRS) {
    const ratio = getContrastRatio(colors[fgKey], colors[bgKey]);
    if (ratio === null || ratio < WCAG_AA_MIN_CONTRAST) {
      return null;
    }
  }

  const images = candidate.home.images;
  if (!images || typeof images !== 'object') return null;

  if (images.garland !== undefined && images.garland !== null && images.garland !== '') {
    if (!isHttpsUrl(images.garland)) {
      return null;
    }
  }

  const rawHero = Array.isArray(images.hero) ? images.hero : [];
  for (const item of rawHero) {
    if (!item || !isHttpsUrl(item.imageUrl)) {
      return null;
    }
  }

  const sections = Array.isArray(candidate.home.sections) ? candidate.home.sections : [];
  const overlay = validateThemeOverlay(candidate.overlay, 'home');

  return {
    id: candidate.id,
    slug: candidate.slug,
    startsAt: candidate.startsAt,
    endsAt: candidate.endsAt,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : '',
    home: {
      colors: {
        stageFrom: colors.stageFrom.trim(),
        stageTo: colors.stageTo.trim(),
        headerText: colors.headerText.trim(),
        pageBg: colors.pageBg.trim(),
        accent: colors.accent.trim(),
        tabBg: colors.tabBg.trim(),
        tabActive: colors.tabActive.trim(),
        tabInactive: colors.tabInactive.trim(),
      },
      images: {
        ...(images.garland ? { garland: images.garland.trim() } : {}),
        hero: rawHero.map((h) => ({
          imageUrl: h.imageUrl.trim(),
          ...(typeof h.deepLink === 'string' && h.deepLink.trim()
            ? { deepLink: h.deepLink.trim() }
            : {}),
        })),
      },
      sections,
    },
    ...(overlay ? { overlay } : {}),
  };
}

/**
 * Validates a grocery-surface ThemeCampaign payload on the device.
 * Returns null if any color, URL, date window, or WCAG contrast check fails.
 */
export function validateGroceryThemeCampaign(
  raw: unknown,
  nowMs: number = Date.now()
): ThemeGroceryCampaign | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<ThemeGroceryCampaign>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.slug !== 'string' ||
    typeof candidate.startsAt !== 'string' ||
    typeof candidate.endsAt !== 'string' ||
    !candidate.grocery ||
    typeof candidate.grocery !== 'object'
  ) {
    return null;
  }

  if (!isWithinCampaignWindow(candidate.startsAt, candidate.endsAt, nowMs)) {
    return null;
  }

  const colors = candidate.grocery.colors;
  if (!colors || typeof colors !== 'object') return null;

  for (const key of GROCERY_COLOR_KEYS) {
    if (!isValidHexColor(colors[key])) {
      return null;
    }
  }

  for (const [fgKey, bgKey] of GROCERY_CONTRAST_PAIRS) {
    const ratio = getContrastRatio(colors[fgKey], colors[bgKey]);
    if (ratio === null || ratio < WCAG_AA_MIN_CONTRAST) {
      return null;
    }
  }

  const images = candidate.grocery.images;
  if (!images || typeof images !== 'object') return null;

  if (images.garland !== undefined && images.garland !== null && images.garland !== '') {
    if (!isHttpsUrl(images.garland)) {
      return null;
    }
  }

  const rawHero = Array.isArray(images.hero) ? images.hero : [];
  for (const item of rawHero) {
    if (!item || !isHttpsUrl(item.imageUrl)) {
      return null;
    }
  }

  const sections = Array.isArray(candidate.grocery.sections) ? candidate.grocery.sections : [];
  const overlay = validateThemeOverlay(candidate.overlay, 'grocery');

  return {
    id: candidate.id,
    slug: candidate.slug,
    startsAt: candidate.startsAt,
    endsAt: candidate.endsAt,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : '',
    grocery: {
      colors: {
        stageFrom: colors.stageFrom.trim(),
        stageTo: colors.stageTo.trim(),
        headerText: colors.headerText.trim(),
        pageBg: colors.pageBg.trim(),
        accent: colors.accent.trim(),
      },
      images: {
        ...(images.garland ? { garland: images.garland.trim() } : {}),
        hero: rawHero.map((h) => ({
          imageUrl: h.imageUrl.trim(),
          ...(typeof h.deepLink === 'string' && h.deepLink.trim()
            ? { deepLink: h.deepLink.trim() }
            : {}),
        })),
      },
      sections,
    },
    ...(overlay ? { overlay } : {}),
  };
}
