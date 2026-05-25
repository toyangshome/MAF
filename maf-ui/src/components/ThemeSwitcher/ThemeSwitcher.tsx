import React from 'react';
import { THEMES } from '../../themes/definitions';
import { useAppStore } from '../../stores/useAppStore';
import { useTranslation } from '../../i18n';

export function ThemeSwitcher({ onClose }: { onClose: () => void }) {
  const activeThemeId = useAppStore((s) => s.activeThemeId);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const setTheme = useAppStore((s) => s.setTheme);
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          background: 'var(--gray-2)',
          border: '1px solid var(--gray-6)',
          borderRadius: '12px',
          padding: '20px',
          minWidth: '380px',
          maxWidth: '440px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--gray-12)',
              letterSpacing: '-0.01em',
            }}
          >
            {t('header.theme')}
          </span>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--gray-11)',
              cursor: 'pointer',
              fontSize: '16px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--gray-4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            x
          </button>
        </div>

        {/* Theme Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
          }}
        >
          {THEMES.map((theme) => {
            const active = activeThemeId === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => {
                  setActiveTheme(theme.id);
                  // Sync dark/light mode based on theme id
                  if (theme.id === 'light') {
                    setTheme('light');
                  } else {
                    setTheme('dark');
                  }
                  onClose();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '14px',
                  borderRadius: '8px',
                  border: active
                    ? '2px solid var(--gray-12)'
                    : '2px solid var(--gray-6)',
                  background: active ? 'var(--gray-4)' : 'var(--gray-3)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--gray-4)';
                    e.currentTarget.style.borderColor = 'var(--gray-8)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--gray-3)';
                    e.currentTarget.style.borderColor = 'var(--gray-6)';
                  }
                }}
              >
                {/* Color preview row */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    theme.colors.background,
                    theme.colors.surface,
                    theme.colors.accent,
                    theme.colors.success,
                    theme.colors.error,
                    theme.colors.warning,
                  ].map((color, i) => (
                    <div
                      key={i}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: color,
                        border: '1px solid var(--gray-7)',
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>

                {/* Theme info */}
                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--gray-12)',
                      marginBottom: '2px',
                    }}
                  >
                    {theme.name}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--gray-11)',
                    }}
                  >
                    {theme.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
