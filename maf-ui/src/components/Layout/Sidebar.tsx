import React, { useState, useEffect } from 'react';
import {
  DashboardIcon,
  ActivityLogIcon,
  ListBulletIcon,
  GearIcon,
  BarChartIcon,
  SunIcon,
  MoonIcon,
  ViewHorizontalIcon,
  PersonIcon,
  TimerIcon,
} from '@radix-ui/react-icons';
import { useAppStore } from '../../stores/useAppStore';
import type { Page } from '../../stores/useAppStore';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { getResolvedTheme } from '../../utils/theme';
import { ThemeSwitcher } from '../ThemeSwitcher/ThemeSwitcher';
import { useTranslation } from '../../i18n';

interface NavItem {
  id: Page;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'workflow', icon: <DashboardIcon width={18} height={18} /> },
  { id: 'logs', icon: <ActivityLogIcon width={18} height={18} /> },
  { id: 'tasks', icon: <ListBulletIcon width={18} height={18} /> },
  { id: 'config', icon: <GearIcon width={18} height={18} /> },
  { id: 'monitor', icon: <BarChartIcon width={18} height={18} /> },
  { id: 'agents', icon: <PersonIcon width={18} height={18} /> },
  { id: 'performance', icon: <TimerIcon width={18} height={18} /> },
];

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const { t } = useTranslation();
  const [showText, setShowText] = useState(!collapsed);
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);

  const isDark = getResolvedTheme(theme) === 'dark';

  // Delayed text show/hide to avoid text jump during expand/collapse animation
  useEffect(() => {
    if (!collapsed) {
      const timer = setTimeout(() => setShowText(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShowText(false);
    }
  }, [collapsed]);

  return (
    <>
      <nav
        role="navigation"
        aria-label="主导航"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: collapsed ? '60px' : '240px',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--gray-1)',
          borderRight: '1px solid var(--gray-6)',
          transition: 'width 0.2s ease',
          zIndex: 10,
          overflow: 'hidden',
        }}
      >
        {/* Logo / Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '16px 0' : '16px 16px',
            height: '56px',
            flexShrink: 0,
          }}
        >
          {showText && (
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--gray-12)',
                whiteSpace: 'nowrap',
                opacity: 1,
                transition: 'opacity 150ms ease',
              }}
            >
              MAF
            </span>
          )}
          <button
            onClick={toggleSidebar}
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
            aria-expanded={!collapsed}
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
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--gray-4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ViewHorizontalIcon width={16} height={16} />
          </button>
        </div>
        <Separator />

        {/* Navigation */}
        <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                aria-label={t(`nav.${item.id}`)}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: collapsed ? '10px 0' : '10px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: '6px',
                  border: 'none',
                  background: active ? 'var(--gray-4)' : 'transparent',
                  color: active ? 'var(--gray-12)' : 'var(--gray-11)',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.1s ease, color 0.1s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--gray-3)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
                title={collapsed ? t(`nav.${item.id}`) : undefined}
              >
                {item.icon}
                {showText && (
                  <span style={{
                    opacity: 1,
                    transition: 'opacity 150ms ease',
                    whiteSpace: 'nowrap',
                  }}>
                    {t(`nav.${item.id}`)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer - Theme switcher */}
        <Separator />
        <div
          style={{
            padding: '12px',
            flexShrink: 0,
          }}
        >
          {!showText ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setShowThemeSwitcher(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--gray-11)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                aria-label="主题设置"
                title={t('sidebar.theme')}
              >
                {isDark ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowThemeSwitcher(true)}
              aria-label="主题设置"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--gray-11)',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {isDark ? <SunIcon width={14} height={14} /> : <MoonIcon width={14} height={14} />}
              <span>{t('sidebar.theme')}</span>
            </button>
          )}
        </div>
      </nav>

      {showThemeSwitcher && (
        <ThemeSwitcher onClose={() => setShowThemeSwitcher(false)} />
      )}
    </>
  );
}
