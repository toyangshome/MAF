/**
 * MAF UI — i18n Module
 *
 * Simple key-value translation system with:
 * - Nested key support (e.g., 'common.save')
 * - Interpolation support (e.g., t('tasks.cancelConfirm', { count: 5 }))
 * - Reactive locale switching via Zustand store
 */
import { useAppStore } from '../stores/useAppStore';
import type { Locale } from '../stores/useAppStore';
import enUS from './en-US';
import zhCN from './zh-CN';

// ── Translation Maps ──

type TranslationMap = Record<string, unknown>;

const translations: Record<Locale, TranslationMap> = {
  'en-US': enUS as unknown as TranslationMap,
  'zh-CN': zhCN as unknown as TranslationMap,
};

// ── Nested Value Access ──

/**
 * Get a nested value from an object using dot notation.
 * e.g., getNestedValue(obj, 'common.save') => 'Save'
 */
function getNestedValue(obj: TranslationMap, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

// ── Interpolation ──

/**
 * Replace {{key}} placeholders in a string with values from a params object.
 * e.g., interpolate('Set {{count}} tasks?', { count: 5 }) => 'Set 5 tasks?'
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
}

// ── Translation Function ──

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

/**
 * Get a translation by key with optional interpolation.
 * Falls back to the key itself if no translation is found.
 */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const map = translations[locale] || translations['zh-CN'];
  const value = getNestedValue(map, key);
  if (value === undefined) {
    // Fallback to the other locale
    const fallback = locale === 'zh-CN' ? 'en-US' : 'zh-CN';
    const fallbackValue = getNestedValue(translations[fallback], key);
    if (fallbackValue !== undefined) {
      return interpolate(fallbackValue, params);
    }
    return key; // Return key as fallback
  }
  return interpolate(value, params);
}

// ── React Hook ──

/**
 * Hook to get the translation function reactive to locale changes.
 *
 * Usage:
 *   const { t, locale, setLocale } = useTranslation();
 *   <span>{t('common.save')}</span>
 *   <span>{t('tasks.cancelConfirm', { count: 5 })}</span>
 */
export function useTranslation() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const translate: TFunction = (key, params) => t(locale, key, params);

  return {
    t: translate,
    locale,
    setLocale,
  };
}

// ── Exports ──

export { translations };
export { enUS, zhCN };
