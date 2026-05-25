/**
 * MAF UI — Reusable Component Style Utilities
 *
 * Common inline style patterns used across components.
 * These return React.CSSProperties objects for use with inline styles.
 */
import type React from 'react';
import { color, radius, shadow, spacing, semantic, transition, fontSize, fontWeight, font } from './tokens';

// ── Button Variants ──

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing[1.5],
  border: 'none',
  cursor: 'pointer',
  fontFamily: font.sans,
  fontWeight: 600,
  transition: `background ${transition.normal}, border-color ${transition.normal}, color ${transition.normal}`,
  whiteSpace: 'nowrap',
  lineHeight: 1,
};

const buttonSizes: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: `${spacing[1]} ${spacing[3]}`, borderRadius: radius.md, fontSize: fontSize.sm },
  md: { padding: `${spacing[1.5]} ${spacing[4]}`, borderRadius: radius.md, fontSize: fontSize.base },
  lg: { padding: `${spacing[2]} ${spacing[5]}`, borderRadius: radius.lg, fontSize: fontSize.md },
};

const buttonVariants: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: semantic.primary,
    color: semantic.primaryText,
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: semantic.textSecondary,
    border: `1px solid ${semantic.border}`,
  },
  ghost: {
    background: 'transparent',
    color: semantic.textSecondary,
    border: 'none',
  },
  danger: {
    background: semantic.error,
    color: '#ffffff',
    border: 'none',
  },
};

export function buttonStyle(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): React.CSSProperties {
  return { ...buttonBase, ...buttonSizes[size], ...buttonVariants[variant] };
}

// ── Card ──

export function cardStyle(opts: { padding?: boolean; hover?: boolean } = {}): React.CSSProperties {
  return {
    background: semantic.surface,
    border: `1px solid ${semantic.border}`,
    borderRadius: radius.lg,
    padding: opts.padding !== false ? spacing[4] : undefined,
    transition: `border-color ${transition.normal}, background ${transition.normal}`,
  };
}

// ── Input ──

export function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: `${spacing[1.5]} ${spacing[3]}`,
    borderRadius: radius.md,
    border: `1px solid ${semantic.border}`,
    background: semantic.surface,
    color: semantic.text,
    fontSize: fontSize.md,
    lineHeight: '20px',
    outline: 'none',
    fontFamily: font.sans,
    boxSizing: 'border-box',
    transition: `border-color ${transition.normal}`,
  };
}

// ── Badge ──

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

const badgeVariants: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: color('gray', '300'), color: color('gray', '900') },
  success: { background: semantic.successBg, color: semantic.successText },
  warning: { background: semantic.warningBg, color: semantic.warningText },
  error:   { background: semantic.errorBg, color: semantic.errorText },
  info:    { background: semantic.infoBg, color: semantic.infoText },
};

export function badgeStyle(variant: BadgeVariant = 'default'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing[1],
    padding: `${spacing.px} ${spacing[2]}`,
    borderRadius: radius.full,
    fontSize: fontSize.sm,
    fontWeight: 600,
    lineHeight: '18px',
    whiteSpace: 'nowrap',
    ...badgeVariants[variant],
  };
}

// ── Surface / Panel ──

export function panelStyle(): React.CSSProperties {
  return {
    background: semantic.bgSubtle,
    border: `1px solid ${semantic.border}`,
    borderRadius: radius.xl,
    overflow: 'hidden',
  };
}

// ── Field Label ──

export function fieldLabelStyle(): React.CSSProperties {
  return {
    display: 'block',
    fontSize: fontSize.sm,
    fontWeight: 600,
    color: color('gray', '700'),
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: spacing[1.5],
    fontFamily: font.sans,
  };
}

// ── Separator ──

export function separatorStyle(orientation: 'horizontal' | 'vertical' = 'horizontal'): React.CSSProperties {
  return orientation === 'horizontal'
    ? { height: 1, background: semantic.border, margin: `${spacing[4]} 0` }
    : { width: 1, background: semantic.border, margin: `0 ${spacing[4]}`, height: '20px' };
}

// ── Nav Item ──

export function navItemStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    width: '100%',
    padding: `10px 12px`,
    borderRadius: radius.md,
    border: 'none',
    background: active ? semantic.surface : 'transparent',
    color: active ? semantic.text : semantic.textSecondary,
    fontSize: fontSize.md,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: `background ${transition.fast}, color ${transition.fast}`,
    whiteSpace: 'nowrap',
  };
}

// ── Dropdown / Menu ──

export function dropdownStyle(): React.CSSProperties {
  return {
    background: semantic.bgSubtle,
    border: `1px solid ${semantic.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.pop,
    padding: spacing[1],
    minWidth: 160,
    zIndex: 10,
  };
}

export function dropdownItemStyle(): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    width: '100%',
    padding: `${spacing[1.5]} ${spacing[2]}`,
    borderRadius: radius.sm,
    border: 'none',
    background: 'transparent',
    color: semantic.text,
    fontSize: fontSize.base,
    cursor: 'pointer',
    textAlign: 'left',
    transition: `background ${transition.fast}`,
  };
}

// ── Flex Utilities ──

export const flex = {
  row: { display: 'flex', flexDirection: 'row' } as React.CSSProperties,
  col: { display: 'flex', flexDirection: 'column' } as React.CSSProperties,
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  between: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  start: { display: 'flex', alignItems: 'center' } as React.CSSProperties,
};

// ── Text Utilities ──

export const text = {
  xs:   { fontSize: fontSize.xs,   fontWeight: 400, color: semantic.text } as React.CSSProperties,
  sm:   { fontSize: fontSize.sm,   fontWeight: 400, color: semantic.textSecondary } as React.CSSProperties,
  base: { fontSize: fontSize.base, fontWeight: 400, color: semantic.text } as React.CSSProperties,
  md:   { fontSize: fontSize.md,   fontWeight: 500, color: semantic.text } as React.CSSProperties,
  lg:   { fontSize: fontSize.lg,   fontWeight: 600, color: semantic.text } as React.CSSProperties,
  heading: { fontSize: fontSize['2xl'], fontWeight: 700, color: semantic.text, letterSpacing: '-0.02em' } as React.CSSProperties,
  mono: { fontSize: fontSize.sm, fontFamily: font.mono, color: semantic.textSecondary } as React.CSSProperties,
  muted: { fontSize: fontSize.sm, color: semantic.textMuted } as React.CSSProperties,
};

// ── Animations ──

const PULSE_STYLE_ID = 'maf-pulse-animation';
const SPIN_STYLE_ID = 'maf-spin-animation';

/**
 * Inject pulse animation keyframes into the document head (once).
 * Usage: element.style.animation = pulseAnimation();
 */
export function pulseAnimation(duration = '1.8s'): string {
  if (typeof document !== 'undefined' && !document.getElementById(PULSE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = PULSE_STYLE_ID;
    style.textContent = `@keyframes maf-pulse{0%,100%{opacity:1}50%{opacity:.5}}`;
    document.head.appendChild(style);
  }
  return `maf-pulse ${duration} ease-in-out infinite`;
}

/**
 * Inject spin animation keyframes into the document head (once).
 * Usage: element.style.animation = spinAnimation();
 */
export function spinAnimation(duration = '0.8s'): string {
  if (typeof document !== 'undefined' && !document.getElementById(SPIN_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = SPIN_STYLE_ID;
    style.textContent = `@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;
    document.head.appendChild(style);
  }
  return `spin ${duration} linear infinite`;
}
