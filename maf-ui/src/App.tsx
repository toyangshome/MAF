import React, { useEffect, useState, useRef, useMemo, lazy, Suspense } from 'react';
import { Theme as RadixTheme } from '@radix-ui/themes';
import { Layout } from './components/Layout/Layout';
import { useAppStore } from './stores/useAppStore';
import { applyTheme, getResolvedTheme } from './utils/theme';
import { useKeyboardShortcuts, useKeyboardShortcut } from './hooks/useKeyboardShortcut';
import KeyboardHelp from './components/KeyboardHelp/KeyboardHelp';
import CommandPalette from './components/CommandPalette/CommandPalette';
import { createCommands } from './commands/registry';
import { NotificationProvider } from './components/Toast';
import { SplitPanel } from './components/Layout/SplitPanel';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { ModuleErrorBoundary } from './components/ErrorBoundary/ModuleErrorBoundary';
import { Skeleton } from './components/ui/Skeleton';
import { collectPageLoadMetrics } from './utils/performance';
import type { Page } from './stores/useAppStore';
import { AIAssistantPanel } from './features/AIAssistant';
import './App.css';

// 懒加载页面组件
const WorkflowView = lazy(() => import('./features/WorkflowView/WorkflowView'));
const LogPanel = lazy(() => import('./features/LogPanel/LogPanel'));
const TaskPanel = lazy(() => import('./features/TaskPanel/TaskPanel'));
const ConfigPanel = lazy(() => import('./features/ConfigPanel/ConfigPanel'));
const MonitorDashboard = lazy(() => import('./features/MonitorDashboard/MonitorDashboard'));
const AgentManager = lazy(() => import('./features/AgentManager/AgentManager'));
const PerformanceMonitor = lazy(() => import('./features/PerformanceMonitor/PerformanceMonitor'));

const PageSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<div style={{ padding: 24 }}><Skeleton height={200} /></div>}>
    {children}
  </Suspense>
);

const pages: Record<string, React.ReactNode> = {
  workflow: <ModuleErrorBoundary moduleName="工作流"><PageSuspense><WorkflowView /></PageSuspense></ModuleErrorBoundary>,
  logs: <ModuleErrorBoundary moduleName="日志"><PageSuspense><LogPanel /></PageSuspense></ModuleErrorBoundary>,
  tasks: <ModuleErrorBoundary moduleName="任务"><PageSuspense><TaskPanel /></PageSuspense></ModuleErrorBoundary>,
  config: <ModuleErrorBoundary moduleName="配置"><PageSuspense><ConfigPanel /></PageSuspense></ModuleErrorBoundary>,
  monitor: <ModuleErrorBoundary moduleName="监控"><PageSuspense><MonitorDashboard /></PageSuspense></ModuleErrorBoundary>,
  agents: <ModuleErrorBoundary moduleName="Agent管理"><PageSuspense><AgentManager /></PageSuspense></ModuleErrorBoundary>,
  performance: <ModuleErrorBoundary moduleName="性能监控"><PageSuspense><PerformanceMonitor /></PageSuspense></ModuleErrorBoundary>,
};

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const currentPage = useAppStore((s) => s.currentPage);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const setPage = useAppStore((s) => s.setPage);
  const fetchAll = useAppStore((s) => s.fetchAll);
  const clearLogsFromApi = useAppStore((s) => s.clearLogsFromApi);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const [showHelp, setShowHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Command palette commands
  const commands = useMemo(
    () => createCommands({ setPage, toggleSidebar, fetchAll, clearLogsFromApi, setActiveTheme }),
    [setPage, toggleSidebar, fetchAll, clearLogsFromApi, setActiveTheme]
  );

  // Cmd+Shift+P to open command palette
  useKeyboardShortcut({
    key: 'p',
    meta: true,
    shift: true,
    description: 'Open command palette',
    handler: () => setShowCommandPalette((v) => !v),
  });
  const [pagePhase, setPagePhase] = useState<'enter' | 'active'>('active');
  const prevPageRef = useRef(currentPage);

  // Page transition effect
  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage;
      setPagePhase('enter');
      // Force reflow then activate
      const timer = requestAnimationFrame(() => {
        setPagePhase('active');
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [currentPage]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'b', meta: true, description: 'Toggle sidebar', handler: toggleSidebar },
    { key: '1', description: 'Go to Workflow', handler: () => setPage('workflow' as Page) },
    { key: '2', description: 'Go to Logs', handler: () => setPage('logs' as Page) },
    { key: '3', description: 'Go to Tasks', handler: () => setPage('tasks' as Page) },
    { key: '4', description: 'Go to Config', handler: () => setPage('config' as Page) },
    { key: '5', description: 'Go to Monitor', handler: () => setPage('monitor' as Page) },
    { key: '6', description: 'Go to Agents', handler: () => setPage('agents' as Page) },
    { key: '7', description: 'Go to Performance', handler: () => setPage('performance' as Page) },
    { key: 'n', meta: true, description: 'New task', handler: () => setPage('tasks' as Page) },
    { key: 'z', meta: true, description: 'Undo', handler: () => useAppStore.getState().undo() },
    { key: 'z', meta: true, shift: true, description: 'Redo', handler: () => useAppStore.getState().redo() },
  ]);

  // ? key for help (shift+/ = ?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement;
        const tag = el?.tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !(el as HTMLElement)?.isContentEditable) {
          setShowHelp((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const layoutMode = useAppStore((s) => s.layoutMode);

  // Theme handling
  const activeThemeId = useAppStore((s) => s.activeThemeId);

  // Global error handlers
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const { addLog, setGlobalError } = useAppStore.getState();
      addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: "error",
        source: "window.onerror",
        message: `${event.message} (${event.filename}:${event.lineno}:${event.colno})`,
      });
      setGlobalError({
        message: event.message,
        stack: event.error?.stack,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const { addLog, setGlobalError } = useAppStore.getState();
      const reason = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
      addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: "error",
        source: "unhandledrejection",
        message: `Unhandled Promise rejection: ${reason}`,
      });
      setGlobalError({
        message: reason,
        stack: event.reason?.stack,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);
  useEffect(() => {
    applyTheme(theme, activeThemeId);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => theme === 'system' && applyTheme('system', activeThemeId);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, activeThemeId]);

  // Initialize data fetching and event listeners on mount
  useEffect(() => {
    const { fetchAll, registerEventListeners, unregisterEventListeners } = useAppStore.getState();
    fetchAll();
    registerEventListeners();

    // Collect page load performance metrics
    if (typeof window !== 'undefined') {
      const onLoad = () => collectPageLoadMetrics();
      if (document.readyState === 'complete') {
        collectPageLoadMetrics();
      } else {
        window.addEventListener('load', onLoad);
      }
      return () => {
        window.removeEventListener('load', onLoad);
        unregisterEventListeners();
      };
    }

    return () => {
      unregisterEventListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-label="正在加载应用" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 16,
        color: 'var(--gray-11)',
        fontSize: 14,
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid var(--gray-6)',
          borderTopColor: 'var(--accent-9)',
          borderRadius: '50%',
          animation: 'maf-spin 0.8s linear infinite',
        }} />
        <span>Loading MAF...</span>
        <style>{`
          @keyframes maf-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const resolvedAppearance = getResolvedTheme(theme);

  return (
    <RadixTheme appearance={resolvedAppearance} accentColor="blue" grayColor="slate" radius="medium" scaling="100%">
    <ErrorBoundary>
    <NotificationProvider>
      <a href="#main-content" className="skip-link">跳转到主要内容</a>
      <Layout>
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              padding: '8px 16px',
              background: 'var(--red-3)',
              borderBottom: '1px solid var(--red-6)',
              color: 'var(--red-11)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{error}</span>
            <button
              aria-label="关闭错误提示"
              onClick={() => {
                useAppStore.setState({ error: null });
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--red-11)',
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 4px',
              }}
            >
              x
            </button>
          </div>
        )}
        <div id="main-content" role="main" aria-label={`当前页面: ${currentPage}`}>
          {layoutMode !== 'single' ? (
            <SplitPanel pages={pages} />
          ) : (
            <div
              key={currentPage}
              className={`page-${pagePhase}`}
              style={{ height: '100%' }}
            >
              {pages[currentPage]}
            </div>
          )}
        </div>
        </Layout>
        <KeyboardHelp open={showHelp} onOpenChange={setShowHelp} />
        <CommandPalette open={showCommandPalette} onOpenChange={setShowCommandPalette} commands={commands} />
        <AIAssistantPanel />
    </NotificationProvider>
    </ErrorBoundary>
    </RadixTheme>
  );
}
