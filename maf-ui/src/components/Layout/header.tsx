import React, { useState, useCallback } from 'react';
import { SunIcon, MoonIcon, DotFilledIcon, DownloadIcon, ColumnsIcon, RowsIcon, Cross2Icon, GlobeIcon } from '@radix-ui/react-icons';
import { useAppStore } from '../../stores/useAppStore';
import { getResolvedTheme } from '../../utils/theme';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { GlobalSearch } from '../GlobalSearch/GlobalSearch';
import { NotificationBell } from '../Toast/NotificationBell';
import { ExportPanel } from '../ExportPanel/ExportPanel';
import { PresenceIndicators } from '../Presence/PresenceIndicators';
import type { ReportOptions } from '../../utils/reportGenerator';
import { semantic, spacing, radius, fontSize, transition } from '../../styles';
import { useTranslation } from '../../i18n';

const statusColors: Record<string, string> = {
  idle: 'var(--status-idle)',
  running: 'var(--status-running)',
  waiting: 'var(--status-warning)',
  done: 'var(--status-done)',
  error: 'var(--status-error)',
};

const statusLabels: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  waiting: 'Waiting',
  done: 'Done',
  error: 'Error',
};

export function Header() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const agents = useAppStore((s) => s.agents);
  const currentPage = useAppStore((s) => s.currentPage);
  const exportReport = useAppStore((s) => s.exportReport);
  const layoutMode = useAppStore((s) => s.layoutMode);
  const setLayoutMode = useAppStore((s) => s.setLayoutMode);
  const { t, locale, setLocale } = useTranslation();

  const [exportOpen, setExportOpen] = useState(false);

  const isDark = getResolvedTheme(theme) === 'dark';

  // Collaboration state
  const collaborationEnabled = useAppStore((s) => s.collaborationEnabled);
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const enableCollaboration = useAppStore((s) => s.enableCollaboration);
  const disableCollaboration = useAppStore((s) => s.disableCollaboration);

  const agentSummary = {
    running: agents.filter((a) => a.status === 'running').length,
    waiting: agents.filter((a) => a.status === 'waiting').length,
    done: agents.filter((a) => a.status === 'done').length,
    error: agents.filter((a) => a.status === 'error').length,
    idle: agents.filter((a) => a.status === 'idle').length,
  };

  const pageTitle: Record<string, string> = {
    workflow: t('nav.workflow'),
    logs: t('nav.logs'),
    tasks: t('nav.tasks'),
    config: t('nav.config'),
    monitor: t('nav.monitor'),
  };

  const handleExport = useCallback(
    (options: ReportOptions) => {
      exportReport(options);
    },
    [exportReport],
  );

  return (
    <>
    <ExportPanel open={exportOpen} onOpenChange={setExportOpen} onExport={handleExport} />
    <header
      role="banner"
      aria-label="应用顶栏"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '48px',
        padding: '0 24px',
        borderBottom: '1px solid var(--gray-6)',
        background: 'var(--gray-2)',
        flexShrink: 0,
      }}
    >
      {/* Left: page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--gray-12)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {pageTitle[currentPage] ?? currentPage}
        </h2>
      </div>

      {/* Right: agent status + theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Agent status summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} aria-label="Agent 状态概要">
          {Object.entries(agentSummary).map(([status, count]) => {
            if (count === 0) return null;
            return (
              <div
                key={status}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: 'var(--gray-11)',
                }}
                role="status"
                aria-label={`${statusLabels[status]}: ${count} 个`}
                title={`${statusLabels[status]}: ${count}`}
              >
                <DotFilledIcon
                  width={10}
                  height={10}
                  style={{ color: statusColors[status] }}
                />
                <span>{count}</span>
              </div>
            );
          })}
        </div>

        <Separator orientation="vertical" style={{ height: '20px' }} />

        {/* Global search */}
        <GlobalSearch />

        <Separator orientation="vertical" style={{ height: '20px' }} />

        {/* Notification bell */}
        <NotificationBell />

        <Separator orientation="vertical" style={{ height: '20px' }} />

        {/* Export button */}
        <button
          onClick={() => setExportOpen(true)}
          aria-label="导出报告"
          title="Export Report"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid var(--gray-6)',
            background: 'transparent',
            color: 'var(--gray-11)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <DownloadIcon width={14} height={14} />
          {t('common.export')}
        </button>

        <Separator orientation="vertical" style={{ height: '20px' }} />

        {/* Split view controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} role="group" aria-label="视图布局控制">
          <button
            onClick={() => setLayoutMode('horizontal')}
            aria-label="水平分割视图"
            aria-pressed={layoutMode === 'horizontal'}
            title="水平分割视图"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '4px',
              border: layoutMode === 'horizontal' ? '1px solid var(--accent-9)' : '1px solid transparent',
              background: layoutMode === 'horizontal' ? 'var(--accent-3)' : 'transparent',
              color: layoutMode === 'horizontal' ? 'var(--accent-11)' : 'var(--gray-10)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ColumnsIcon width={14} height={14} />
          </button>
          <button
            onClick={() => setLayoutMode('vertical')}
            aria-label="垂直分割视图"
            aria-pressed={layoutMode === 'vertical'}
            title="垂直分割视图"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '4px',
              border: layoutMode === 'vertical' ? '1px solid var(--accent-9)' : '1px solid transparent',
              background: layoutMode === 'vertical' ? 'var(--accent-3)' : 'transparent',
              color: layoutMode === 'vertical' ? 'var(--accent-11)' : 'var(--gray-10)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RowsIcon width={14} height={14} />
          </button>
          {layoutMode !== 'single' && (
            <button
              onClick={() => setLayoutMode('single')}
              aria-label="合并为单面板"
              title="合并为单面板"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                border: '1px solid var(--gray-6)',
                background: 'transparent',
                color: 'var(--gray-10)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Cross2Icon width={14} height={14} />
            </button>
          )}
        </div>

        <Separator orientation="vertical" style={{ height: '20px' }} />

        {/* Theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} role="group" aria-label="主题切换">
          <SunIcon width={14} height={14} style={{ color: 'var(--gray-10)' }} aria-hidden="true" />
          <Switch
            checked={isDark}
            onCheckedChange={(checked) => {
              const mode = checked ? 'dark' : 'light';
              setTheme(mode);
              setActiveTheme(mode);
            }}
            size="sm"
            aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
          />
          <MoonIcon width={14} height={14} style={{ color: 'var(--gray-10)' }} aria-hidden="true" />
        </div>

        <Separator orientation="vertical" style={{ height: '20px' }} />

        {/* Language switcher */}
        <button
          onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
          aria-label={locale === 'zh-CN' ? 'Switch to English' : '切换到中文'}
          title={locale === 'zh-CN' ? 'Switch to English' : '切换到中文'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: radius.md,
            border: '1px solid var(--gray-6)',
            background: 'transparent',
            color: semantic.textSecondary,
            fontSize: fontSize.base,
            fontWeight: 500,
            cursor: 'pointer',
            transition: `all ${transition.normal}`,
          }}
        >
          <GlobeIcon width={14} height={14} />
          {locale === 'zh-CN' ? 'EN' : '中文'}
        </button>

        <Separator orientation="vertical" style={{ height: '20px' }} />

        {/* Collaboration connection status */}
        <button
          onClick={() => {
            if (collaborationEnabled) {
              disableCollaboration();
            } else {
              enableCollaboration();
            }
          }}
          aria-label={
            collaborationEnabled
              ? connectionStatus === 'connected'
                ? '协作已连接，点击断开'
                : '正在连接...'
              : '点击启用协作'
          }
          title={
            collaborationEnabled
              ? connectionStatus === 'connected'
                ? '协作已连接，点击断开'
                : '正在连接...'
              : '点击启用协作'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid var(--gray-6)',
            background: 'transparent',
            color: 'var(--gray-11)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: collaborationEnabled
                ? connectionStatus === 'connected'
                  ? 'var(--green-9)'
                  : connectionStatus === 'connecting'
                    ? 'var(--yellow-9)'
                    : 'var(--red-9)'
                : 'var(--gray-8)',
              display: 'inline-block',
              animation: collaborationEnabled && connectionStatus === 'connecting' ? 'spin-pulse 1s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }}
          />
          {collaborationEnabled ? t('header.collab') : t('header.collab')}
          {collaborationEnabled && <PresenceIndicators />}
        </button>
      </div>
    </header>
    </>
  );
}
