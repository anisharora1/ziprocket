// Theme constants derived from client/src/app/globals.css and web components
export const Colors = {
  // Brand
  primary: '#FF5C00',
  primaryDark: '#E05200',
  primaryLight: '#FFF0E6',
  primaryAlpha10: 'rgba(255, 92, 0, 0.1)',
  primaryAlpha20: 'rgba(255, 92, 0, 0.2)',

  // Background & Surfaces
  background: '#F9F9FC',
  surface: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  surfaceContainer: '#EEEEF0',
  surfaceContainerLow: '#F3F3F6',
  surfaceContainerHigh: '#E8E8EA',

  // Typography
  textPrimary: '#0F172A', // slate-900
  textSecondary: '#64748B', // slate-500
  textMuted: '#94A3B8', // slate-400
  textInverse: '#FFFFFF',

  // Borders & Dividers
  border: '#E2E8F0', // slate-200
  borderLight: '#F1F5F9', // slate-100
  divider: '#E2E8F0',

  // Status & Badges
  success: '#1B6D24',
  successLight: '#DCFCE7',
  error: '#BA1A1A',
  errorLight: '#FEE2E2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  ratingGold: '#F59E0B',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

export const Typography = {
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    display: 30,
  },
  lineHeight: {
    xs: 14,
    sm: 16,
    md: 20,
    base: 24,
    lg: 26,
    xl: 28,
    xxl: 32,
    display: 38,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
