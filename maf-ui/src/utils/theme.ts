import type { ThemeMode } from '../types';
import type { ThemeDefinition } from '../themes/definitions';
import { THEMES } from '../themes/definitions';

export type Theme = ThemeMode;

export function getResolvedTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Apply a ThemeDefinition's colors to CSS custom properties on :root.
 */
export function applyThemeColors(definition: ThemeDefinition): void {
  const root = document.documentElement;
  const c = definition.colors;
  root.style.setProperty('--maf-bg', c.background);
  root.style.setProperty('--maf-surface', c.surface);
  root.style.setProperty('--maf-surface-hover', c.surfaceHover);
  root.style.setProperty('--maf-border', c.border);
  root.style.setProperty('--maf-text', c.text);
  root.style.setProperty('--maf-text-muted', c.textMuted);
  root.style.setProperty('--maf-accent', c.accent);
  root.style.setProperty('--maf-accent-muted', c.accentMuted);
  root.style.setProperty('--maf-success', c.success);
  root.style.setProperty('--maf-warning', c.warning);
  root.style.setProperty('--maf-error', c.error);
  root.style.setProperty('--maf-info', c.info);
}

/**
 * Resolve a theme id to its definition.
 * Falls back to 'dark' if not found.
 */
export function getThemeDefinition(themeId: string): ThemeDefinition {
  return THEMES.find((t) => t.id === themeId) ?? THEMES[0];
}

/**
 * Map legacy ThemeMode ('dark'/'light'/'system') to a theme id.
 */
export function themeModeToId(mode: ThemeMode): string {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(theme: Theme, themeId?: string): void {
  const resolved = getResolvedTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;

  // Apply custom theme colors if a themeId is provided
  if (themeId) {
    applyThemeColors(getThemeDefinition(themeId));
  }
}
