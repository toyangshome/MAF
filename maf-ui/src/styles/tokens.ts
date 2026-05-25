/**
 * MAF UI Design Tokens (TypeScript)
 *
 * Maps Radix Themes 1-12 scale to standard 50-950 scale.
 * Use these constants in inline styles and TypeScript code.
 */

// ── Color Scale Type ──
export type ColorScale =
  | '50' | '100' | '200' | '300' | '400'
  | '500' | '600' | '700' | '800' | '850'
  | '900' | '950';

// ── Radix Scale Type ──
export type RadixScale = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

// ── Color name union ──
export type ColorName = 'gray' | 'accent' | 'blue' | 'green' | 'red' | 'amber' | 'orange';

/**
 * Map a standard scale value (50-950) to the Radix scale (1-12).
 */
export function toRadixScale(scale: ColorScale): RadixScale {
  const map: Record<ColorScale, RadixScale> = {
    '50': 1, '100': 2, '200': 3, '300': 4, '400': 5, '500': 6,
    '600': 7, '700': 8, '800': 9, '850': 10, '900': 11, '950': 12,
  };
  return map[scale];
}

/**
 * Get a CSS variable reference for a color.
 * Uses the Radix 1-12 variable (which Radix Themes provides).
 */
export function color(name: ColorName, scale: ColorScale): string {
  const radix = toRadixScale(scale);
  return `var(--${name}-${radix})`;
}

/**
 * Get a CSS variable using the 50-950 scale alias.
 * These map to the Radix variables via design-system.css.
 */
export function colorToken(name: ColorName, scale: ColorScale): string {
  return `var(--${name}-${scale})`;
}

// ── Spacing Tokens ──
export const spacing = {
  0: 'var(--space-0)',
  px: 'var(--space-px)',
  '0.5': 'var(--space-0-5)',
  1: 'var(--space-1)',
  '1.5': 'var(--space-1-5)',
  2: 'var(--space-2)',
  3: 'var(--space-3)',
  4: 'var(--space-4)',
  5: 'var(--space-5)',
  6: 'var(--space-6)',
  8: 'var(--space-8)',
  10: 'var(--space-10)',
  12: 'var(--space-12)',
  16: 'var(--space-16)',
  20: 'var(--space-20)',
  24: 'var(--space-24)',
} as const;

// ── Radius Tokens ──
export const radius = {
  none: 'var(--radius-none)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  full: 'var(--radius-full)',
} as const;

// ── Typography Tokens ──
export const font = {
  sans: 'var(--font-sans)',
  mono: 'var(--font-mono)',
} as const;

export const fontSize = {
  xs: 'var(--text-xs)',
  sm: 'var(--text-sm)',
  base: 'var(--text-base)',
  md: 'var(--text-md)',
  lg: 'var(--text-lg)',
  xl: 'var(--text-xl)',
  '2xl': 'var(--text-2xl)',
  '3xl': 'var(--text-3xl)',
} as const;

export const fontWeight = {
  normal: 'var(--weight-normal)',
  medium: 'var(--weight-medium)',
  semibold: 'var(--weight-semibold)',
  bold: 'var(--weight-bold)',
} as const;

// ── Shadow Tokens ──
export const shadow = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
  pop: 'var(--shadow-pop)',
} as const;

// ── Transition Tokens ──
export const transition = {
  fast: 'var(--duration-fast) var(--ease-default)',
  normal: 'var(--duration-normal) var(--ease-default)',
  slow: 'var(--duration-slow) var(--ease-default)',
} as const;

// ── Z-Index Tokens ──
export const zIndex = {
  base: 'var(--z-base)',
  dropdown: 'var(--z-dropdown)',
  sticky: 'var(--z-sticky)',
  overlay: 'var(--z-overlay)',
  modal: 'var(--z-modal)',
  popover: 'var(--z-popover)',
  tooltip: 'var(--z-tooltip)',
  toast: 'var(--z-toast)',
} as const;

// ── Semantic Color Tokens ──
export const semantic = {
  bg: 'var(--color-bg)',
  bgSubtle: 'var(--color-bg-subtle)',
  surface: 'var(--color-surface)',
  surfaceHover: 'var(--color-surface-hover)',
  border: 'var(--color-border)',
  borderHover: 'var(--color-border-hover)',
  text: 'var(--color-text)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  textDisabled: 'var(--color-text-disabled)',
  focusRing: 'var(--color-focus-ring)',
  primary: 'var(--color-primary)',
  primaryHover: 'var(--color-primary-hover)',
  primaryText: 'var(--color-primary-text)',
  success: 'var(--color-success)',
  successBg: 'var(--color-success-bg)',
  successText: 'var(--color-success-text)',
  warning: 'var(--color-warning)',
  warningBg: 'var(--color-warning-bg)',
  warningText: 'var(--color-warning-text)',
  error: 'var(--color-error)',
  errorBg: 'var(--color-error-bg)',
  errorText: 'var(--color-error-text)',
  info: 'var(--color-info)',
  infoBg: 'var(--color-info-bg)',
  infoText: 'var(--color-info-text)',
} as const;

// ── Status Colors ──
export const status = {
  idle: 'var(--status-idle)',
  running: 'var(--status-running)',
  done: 'var(--status-done)',
  error: 'var(--status-error)',
  warning: 'var(--status-warning)',
} as const;
