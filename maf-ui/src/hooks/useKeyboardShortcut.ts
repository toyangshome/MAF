import { useEffect, useCallback } from 'react';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  description: string;
  handler: () => void;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
}

function matchesShortcut(e: KeyboardEvent, config: ShortcutConfig): boolean {
  if (e.key.toLowerCase() !== config.key.toLowerCase()) return false;

  const wantsMeta = config.meta ?? false;
  const wantsCtrl = config.ctrl ?? false;
  const wantsShift = config.shift ?? false;

  // On Mac, meta is Cmd; on Windows/Linux, ctrl is used
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierMatch = isMac
    ? (e.metaKey === wantsMeta || (wantsMeta && e.metaKey))
    : (e.ctrlKey === wantsCtrl || (wantsCtrl && e.ctrlKey));

  if (wantsMeta || wantsCtrl) {
    if (!(e.metaKey || e.ctrlKey)) return false;
  }

  if (wantsShift !== e.shiftKey) return false;

  return true;
}

export function useKeyboardShortcut(config: ShortcutConfig): void {
  const handler = useCallback(config.handler, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused() && config.key !== 'Escape') return;
      if (matchesShortcut(e, config)) {
        e.preventDefault();
        e.stopPropagation();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.key, config.ctrl, config.meta, config.shift, handler]);
}

export function useKeyboardShortcuts(configs: ShortcutConfig[]): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused() && !configs.some((c) => c.key === 'Escape')) return;

      for (const config of configs) {
        if (isInputFocused() && config.key !== 'Escape') continue;
        if (matchesShortcut(e, config)) {
          e.preventDefault();
          e.stopPropagation();
          config.handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [configs]);
}
