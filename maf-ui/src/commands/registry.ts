import type { Page } from '../stores/useAppStore';

export interface Command {
  id: string;
  label: string;
  category: 'navigation' | 'action' | 'config';
  shortcut?: string;
  handler: () => void;
  icon?: string;
}

/**
 * 创建命令注册表。依赖外部传入 store 方法，避免循环引用。
 */
export function createCommands(deps: {
  setPage: (page: Page) => void;
  toggleSidebar: () => void;
  fetchAll: () => Promise<void>;
  clearLogsFromApi: () => Promise<void>;
  setActiveTheme: (id: string) => void;
}): Command[] {
  const { setPage, toggleSidebar, fetchAll, clearLogsFromApi, setActiveTheme } = deps;

  return [
    // 导航命令
    { id: 'nav.workflow', label: 'Go to Workflow', category: 'navigation', shortcut: '1', icon: '◈', handler: () => setPage('workflow') },
    { id: 'nav.logs', label: 'Go to Logs', category: 'navigation', shortcut: '2', icon: '☰', handler: () => setPage('logs') },
    { id: 'nav.tasks', label: 'Go to Tasks', category: 'navigation', shortcut: '3', icon: '✓', handler: () => setPage('tasks') },
    { id: 'nav.config', label: 'Go to Config', category: 'navigation', shortcut: '4', icon: '⚙', handler: () => setPage('config') },
    { id: 'nav.monitor', label: 'Go to Monitor', category: 'navigation', shortcut: '5', icon: '◉', handler: () => setPage('monitor') },
    { id: 'nav.agents', label: 'Go to Agents', category: 'navigation', shortcut: '6', icon: '⬡', handler: () => setPage('agents') },

    // 操作命令
    { id: 'action.newTask', label: 'New Task', category: 'action', shortcut: '⌘N', icon: '+', handler: () => setPage('tasks') },
    { id: 'action.toggleSidebar', label: 'Toggle Sidebar', category: 'action', shortcut: '⌘B', icon: '◧', handler: toggleSidebar },
    { id: 'action.refreshData', label: 'Refresh All Data', category: 'action', icon: '↻', handler: () => fetchAll() },
    { id: 'action.clearLogs', label: 'Clear Logs', category: 'action', icon: '✕', handler: () => clearLogsFromApi() },

    // 配置命令
    { id: 'config.darkTheme', label: 'Switch to Dark Theme', category: 'config', icon: '●', handler: () => setActiveTheme('dark') },
    { id: 'config.lightTheme', label: 'Switch to Light Theme', category: 'config', icon: '○', handler: () => setActiveTheme('light') },
    { id: 'config.midnightTheme', label: 'Switch to Midnight Theme', category: 'config', icon: '◐', handler: () => setActiveTheme('midnight') },
  ];
}

const RECENT_KEY = 'maf-command-palette-recent';
const MAX_RECENT = 10;

export function getRecentCommandIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentCommandId(id: string): void {
  const recent = getRecentCommandIds().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}
