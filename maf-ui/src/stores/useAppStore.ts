import { create } from 'zustand';
import type { Agent, LogEntry, Task, AgentMetric, MAFConfig, ThemeMode, WorkflowNode, Comment, CustomAgent, ProviderOption } from '../types';
import { DEFAULT_PROVIDERS } from '../types';
import type { ConfigTemplate } from '../features/ConfigPanel/templates';
import { loadCustomTemplates, saveCustomTemplates } from '../features/ConfigPanel/templates';
import { generateReport, downloadReport, getReportFilename, getMimeType, type ReportOptions } from '../utils/reportGenerator';
import { DataManager } from '../storage/dataManager';
import { getOrCreateUser, type UserIdentity } from '../utils/user';
import { getCollaborationManager, type WSMessage, type ConnectionStatus } from '../communication/websocket';
import {
  getAgents as fetchAgentsApi,
  getLogs as fetchLogsApi,
  getMetrics as fetchMetricsApi,
  getConfig as fetchConfigApi,
  saveConfig as saveConfigApi,
  saveWorkflow as saveWorkflowApi,
  clearLogs as clearLogsApi,
  runTask as runTaskApi,
  getWorkflows as fetchWorkflowsApi,
  onTaskStarted,
  onTaskProgress,
  onTaskCompleted,
  onTaskFailed,
  onLogEntry,
  onMetricsUpdate,
  type TaskResult,
} from '../api/tauri';
import type { UnlistenFn } from '@tauri-apps/api/event';

// Fallback mock data for development outside Tauri
import { mockAgents, mockLogs, mockTasks, mockMetrics, mockConfig } from '../mock/data';

// 全局类型声明：Tauri 运行时标识
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

/** Detect if running inside Tauri */
function isTauri(): boolean {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
}

// 持久化偏好设置（防抖）
let _persistTimer: ReturnType<typeof setTimeout> | null = null;

// 并发请求 ID 追踪（防止旧响应覆盖新数据）
let _fetchLogsId = 0;
let _fetchMetricsId = 0;
function schedulePrefersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    const s = useAppStore.getState();
    DataManager.preferences.set({
      theme: s.theme,
      sidebarCollapsed: s.sidebarCollapsed,
      logAutoRefresh: s.logAutoRefresh,
      logMaxEntries: s.logMaxEntries,
      dashboardAutoRefresh: s.dashboardAutoRefresh,
    }).catch((err) => console.warn('[Store] persistPreferences failed:', err));
  }, 500);
}

/**
 * 将原始 workflow 数据统一转换为 WorkflowNode[]
 * 提取为辅助函数，消除 fetchWorkflows 和 fetchAll 中的重复逻辑
 */
function convertWorkflows(rawWorkflows: Record<string, unknown>[]): WorkflowNode[] {
  return rawWorkflows.map((w) => ({
    id: String(w.id ?? ''),
    label: String(w.label ?? w.name ?? ''),
    agentType: String(w.agentType ?? w.type ?? ''),
    status: (w.status as Agent['status']) ?? 'idle',
    dependencies: (w.dependencies as string[]) ?? [],
  }));
}

export type Page = 'workflow' | 'logs' | 'tasks' | 'config' | 'monitor' | 'agents' | 'performance';

export interface PanelState {
  id: string;
  page: Page;
  size: number; // 百分比
}

export type LayoutMode = 'single' | 'horizontal' | 'vertical';

export interface HistoryEntry {
  id: string;
  action: string;
  timestamp: string;
  userId: string;
  details: Record<string, unknown>;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export type Locale = 'zh-CN' | 'en-US';

interface AppState {
  // Data
  agents: Agent[];
  logs: LogEntry[];
  tasks: Task[];
  metrics: AgentMetric[];
  config: MAFConfig;
  workflowNodes: WorkflowNode[];
  providers: ProviderOption[];
  theme: ThemeMode;
  activeThemeId: string;
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  sidebarCollapsed: boolean;
  currentPage: Page;

  // i18n
  locale: Locale;
  setLocale: (locale: Locale) => void;

  // Batch selection
  selectedTaskIds: Set<string>;
  toggleTaskSelection: (id: string) => void;
  selectAllTasks: (ids: string[]) => void;
  deselectAllTasks: () => void;
  batchUpdateTasks: (ids: string[], updates: Partial<Task>) => void;
  batchDeleteTasks: (ids: string[]) => void;

  // Task dependency helpers
  getTaskDependencies: (taskId: string) => Task[];
  getTaskBlockers: (taskId: string) => Task[];
  isTaskBlocked: (taskId: string) => boolean;

  // Loading / error
  loading: boolean;
  error: string | null;

  // Global error (for ErrorBoundary)
  globalError: { message: string; stack?: string } | null;
  setGlobalError: (error: { message: string; stack?: string }) => void;
  clearGlobalError: () => void;

  // Sync actions
  setTheme: (theme: ThemeMode) => void;
  setActiveTheme: (id: string) => void;
  selectAgent: (id: string | null) => void;
  selectTask: (id: string | null) => void;
  toggleSidebar: () => void;
  addLog: (log: LogEntry) => void;
  updateAgentStatus: (id: string, status: Agent['status']) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  setConfig: (config: MAFConfig) => void;
  setPage: (page: Page) => void;

  // Async actions
  fetchAgents: () => Promise<void>;
  fetchLogs: (level?: string, source?: string, limit?: number) => Promise<void>;
  fetchMetrics: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  fetchWorkflows: () => Promise<void>;
  fetchAll: () => Promise<void>;
  submitTask: (description: string, strategy?: string, maxIterations?: number) => Promise<TaskResult>;
  cancelSubmitTask: () => void;
  _submitTaskTimers: ReturnType<typeof setTimeout>[];
  saveConfigToApi: (config: MAFConfig) => Promise<void>;
  clearLogsFromApi: () => Promise<void>;

  // Workflow editing actions
  addWorkflowNode: (node: WorkflowNode) => void;
  removeWorkflowNode: (id: string) => void;
  updateWorkflowNode: (id: string, updates: Partial<WorkflowNode>) => void;
  addDependency: (nodeId: string, depId: string) => void;
  removeDependency: (nodeId: string, depId: string) => void;
  saveWorkflowToApi: () => Promise<void>;

  // Event listener cleanup
  _unlistenFns: UnlistenFn[];
  registerEventListeners: () => Promise<void>;
  unregisterEventListeners: () => void;

  // Log streaming controls
  logAutoRefresh: 'off' | '1s' | '5s' | '10s';
  logPaused: boolean;
  logMaxEntries: number;
  setLogAutoRefresh: (interval: 'off' | '1s' | '5s' | '10s') => void;
  toggleLogPause: () => void;
  setLogMaxEntries: (max: number) => void;
  trimLogs: () => void;

  // Dashboard auto-refresh controls
  dashboardAutoRefresh: 'off' | '10s' | '30s' | '1min' | '5min';
  setDashboardAutoRefresh: (interval: 'off' | '10s' | '30s' | '1min' | '5min') => void;
  lastDashboardRefresh: string | null;
  setLastDashboardRefresh: (ts: string) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAllRead: () => void;
  clearNotifications: () => void;

  // Config templates
  customTemplates: ConfigTemplate[];
  applyTemplate: (template: ConfigTemplate) => void;
  saveAsTemplate: (name: string) => void;
  deleteTemplate: (id: string) => void;

  // Report export
  exportReport: (options: ReportOptions) => void;

  // Split panel layout
  layoutMode: LayoutMode;
  panels: PanelState[];
  setLayoutMode: (mode: LayoutMode) => void;
  setPanelPage: (panelId: string, page: Page) => void;
  setPanelSize: (panelId: string, size: number) => void;

  // History (Undo/Redo)
  history: HistoryEntry[];
  historyIndex: number;
  pushHistory: (entry: Omit<HistoryEntry, 'id' | 'timestamp' | 'userId'>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Comments
  addComment: (taskId: string, content: string) => void;
  deleteComment: (taskId: string, commentId: string) => void;

  // Collaboration
  collaborationEnabled: boolean;
  connectionStatus: ConnectionStatus;
  onlineUsers: UserIdentity[];
  enableCollaboration: () => void;
  disableCollaboration: () => void;
  handleRemoteAction: (action: WSMessage) => void;

  // Custom Agents
  customAgents: CustomAgent[];
  addCustomAgent: (agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCustomAgent: (id: string, updates: Partial<CustomAgent>) => void;
  deleteCustomAgent: (id: string) => void;
  duplicateCustomAgent: (id: string) => void;

  // Providers
  addProvider: () => void;
  updateProvider: (id: string, updates: Partial<ProviderOption>) => void;
  deleteProvider: (id: string) => void;
}

// ── Custom Agent localStorage helpers ────────────────────────

const CUSTOM_AGENTS_KEY = 'maf-custom-agents';

function loadCustomAgents(): CustomAgent[] {
  try {
    const raw = localStorage.getItem(CUSTOM_AGENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomAgentsToStorage(agents: CustomAgent[]) {
  try {
    localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(agents));
  } catch (e) {
    console.warn('[Store] Failed to persist custom agents:', e);
  }
}

// ── Provider localStorage helpers ──────────────────────────

const PROVIDERS_KEY = 'maf-providers';

function loadProviders(): ProviderOption[] {
  try {
    const raw = localStorage.getItem(PROVIDERS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_PROVIDERS;
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

function saveProvidersToStorage(providers: ProviderOption[]) {
  try {
    localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers));
  } catch (e) {
    console.warn('[Store] Failed to persist providers:', e);
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  // Data (start empty, will be populated by API calls)
  agents: [],
  logs: [],
  tasks: [],
  metrics: [],
  workflowNodes: [],
  config: {
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o',
    maxRetries: 3,
    timeout: 120000,
    agents: [],
  },
  theme: 'system',
  activeThemeId: localStorage.getItem('maf-active-theme-id') || 'dark',
  selectedAgentId: null,
  selectedTaskId: null,
  sidebarCollapsed: false,
  currentPage: 'workflow',

  // i18n
  locale: (localStorage.getItem('maf-locale') as Locale) || 'zh-CN',
  setLocale: (locale: Locale) => {
    localStorage.setItem('maf-locale', locale);
    set({ locale });
  },

  // Batch selection
  selectedTaskIds: new Set<string>(),
  toggleTaskSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedTaskIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedTaskIds: next };
    }),
  selectAllTasks: (ids) => set({ selectedTaskIds: new Set(ids) }),
  deselectAllTasks: () => set({ selectedTaskIds: new Set<string>() }),
  batchUpdateTasks: (ids, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (ids.includes(t.id) ? { ...t, ...updates } : t)),
      selectedTaskIds: new Set<string>(),
    })),
  batchDeleteTasks: (ids) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => !ids.includes(t.id)),
      selectedTaskIds: new Set<string>(),
    })),

  // Task dependency helpers
  getTaskDependencies: (taskId) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.dependsOn) return [];
    return task.dependsOn
      .map((depId) => tasks.find((t) => t.id === depId))
      .filter((t): t is Task => t !== undefined);
  },
  getTaskBlockers: (taskId) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.dependsOn) return [];
    return task.dependsOn
      .map((depId) => tasks.find((t) => t.id === depId))
      .filter((t): t is Task => t !== undefined && (t.status === 'pending' || t.status === 'running'));
  },
  isTaskBlocked: (taskId) => {
    const visited = new Set<string>();
    const queue = [taskId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const task = get().tasks.find((t) => t.id === id);
      if (!task) continue;
      for (const depId of (task.dependsOn || [])) {
        const dep = get().tasks.find((t) => t.id === depId);
        if (dep && (dep.status === 'pending' || dep.status === 'running' || dep.status === 'blocked')) {
          if (dep.status === 'pending' || dep.status === 'running') return true;
          queue.push(depId);
        }
      }
    }
    return false;
  },

  // Loading / error
  loading: false,
  error: null,

  // Global error (for ErrorBoundary)
  globalError: null,
  setGlobalError: (error) => set({ globalError: error }),
  clearGlobalError: () => set({ globalError: null }),

  // Sync actions
  setTheme: (theme) => { set({ theme }); schedulePrefersist(); },
  setActiveTheme: (id) => {
    localStorage.setItem('maf-active-theme-id', id);
    set({ activeThemeId: id });
  },
  selectAgent: (id) => set({ selectedAgentId: id }),
  selectTask: (id) => set({ selectedTaskId: id }),
  toggleSidebar: () => { set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })); schedulePrefersist(); },
  addLog: (log) => {
    set((s) => ({ logs: [...s.logs.slice(-999), log] }));
    // 异步持久化到 IndexedDB（不阻塞主流程）
    DataManager.logHistory.add(log).catch(() => {});
  },
  updateAgentStatus: (id, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),
  addTask: (task) => {
    set((s) => ({ tasks: [...s.tasks, task] }));
    get().pushHistory({ action: 'task-create', details: { taskId: task.id, task } });
  },
  updateTask: (id, updates) => {
    const prev = get().tasks.find((t) => t.id === id);
    const user = getOrCreateUser();
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates, lastModifiedBy: user.nickname } : t)),
    }));
    const updated = get().tasks.find((t) => t.id === id);
    if (prev && updated) {
      get().pushHistory({ action: 'task-update', details: { taskId: id, prevState: prev, newState: updated } });
    }
  },
  setConfig: (config) => {
    const prevConfig = get().config;
    const safeConfig = {
      ...config,
      agents: Array.isArray(config.agents) ? config.agents : [],
    };
    set({ config: safeConfig });
    get().pushHistory({ action: 'config-update', details: { prevConfig, newConfig: safeConfig } });
  },
  setPage: (page) => set({ currentPage: page }),

  // ── Async actions ─────────────────────────────────────────────────

  fetchAgents: async () => {
    try {
      set({ error: null });
      const agents = await fetchAgentsApi();
      set({ agents });
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      set({ error: String(err) });
    }
  },

  fetchLogs: async (level, source, limit) => {
    const id = ++_fetchLogsId;
    try {
      set({ error: null });
      const logs = await fetchLogsApi(level, source, limit);
      if (id === _fetchLogsId) set({ logs });
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      set({ error: String(err) });
    }
  },

  fetchMetrics: async () => {
    const id = ++_fetchMetricsId;
    try {
      set({ error: null });
      const metrics = await fetchMetricsApi();
      if (id === _fetchMetricsId) set({ metrics });
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      set({ error: String(err) });
    }
  },

  fetchConfig: async () => {
    try {
      set({ error: null });
      const config = await fetchConfigApi();
      set({ config });
    } catch (err) {
      console.error('Failed to fetch config:', err);
      set({ error: String(err) });
    }
  },

  fetchWorkflows: async () => {
    try {
      const rawWorkflows = await fetchWorkflowsApi();
      set({ workflowNodes: convertWorkflows(rawWorkflows) });
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
      // Don't set error for workflows - it's non-critical
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null });

    // 从本地存储加载用户偏好
    try {
      const prefs = await DataManager.preferences.get();
      set({
        theme: prefs.theme as AppState['theme'],
        sidebarCollapsed: prefs.sidebarCollapsed,
        logAutoRefresh: prefs.logAutoRefresh,
        logMaxEntries: prefs.logMaxEntries,
        dashboardAutoRefresh: prefs.dashboardAutoRefresh,
      });
    } catch {
      // 偏好加载失败不阻塞主流程
    }

    // Use mock data when not running inside Tauri
    if (!isTauri()) {
      set({
        agents: mockAgents,
        logs: mockLogs,
        tasks: mockTasks,
        metrics: mockMetrics,
        config: mockConfig,
        workflowNodes: [],
        loading: false,
      });
      return;
    }

    try {
      const [agents, logs, metrics, config, workflows] = await Promise.allSettled([
        fetchAgentsApi(),
        fetchLogsApi(),
        fetchMetricsApi(),
        fetchConfigApi(),
        fetchWorkflowsApi(),
      ]);

      const updates: Partial<AppState> = { loading: false };
      const errors: string[] = [];

      if (agents.status === 'fulfilled') updates.agents = Array.isArray(agents.value) ? agents.value : [];
      else errors.push(`Agents: ${agents.reason}`);

      if (logs.status === 'fulfilled') updates.logs = Array.isArray(logs.value) ? logs.value : [];
      else errors.push(`Logs: ${logs.reason}`);

      if (metrics.status === 'fulfilled') updates.metrics = Array.isArray(metrics.value) ? metrics.value : [];
      else errors.push(`Metrics: ${metrics.reason}`);

      if (config.status === 'fulfilled') {
        const cfg = config.value;
        if (cfg && typeof cfg === 'object') {
          updates.config = {
            ...get().config,
            ...cfg,
            agents: Array.isArray((cfg as any).agents) ? (cfg as any).agents : [],
          };
        }
      } else errors.push(`Config: ${config.reason}`);

      if (workflows.status === 'fulfilled') {
        updates.workflowNodes = convertWorkflows(workflows.value);
      }

      if (errors.length > 0) {
        updates.error = errors.join('; ');
      }

      set(updates);
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  // Track mock timers for cleanup
  _submitTaskTimers: [] as ReturnType<typeof setTimeout>[],
  cancelSubmitTask: () => {
    const timers = get()._submitTaskTimers;
    timers.forEach((t) => clearTimeout(t));
    set({ _submitTaskTimers: [] });
  },

  submitTask: async (description, strategy = 'sequential', maxIterations = 10) => {
    // Create a local pending task first
    const localId = `task-${Date.now()}`;
    const now = new Date().toISOString();

    const newTask: Task = {
      id: localId,
      description,
      status: 'pending',
      createdAt: now,
      agents: ['agent-orchestrator'],
    };

    set((s) => ({
      tasks: [...s.tasks, newTask],
      logs: [
        ...s.logs,
        {
          id: `log-${Date.now()}`,
          timestamp: now,
          level: 'info' as const,
          source: 'ui',
          message: `Task submitted: "${description.slice(0, 60)}…" (strategy=${strategy}, maxIter=${maxIterations})`,
        },
      ],
    }));

    try {
      // Simulate task lifecycle when not in Tauri
      if (!isTauri()) {
        const result: TaskResult = {
          task_id: localId,
          status: 'completed',
          result: `Task completed via ${strategy} strategy (${maxIterations} iterations)`,
        };

        // Simulate pending -> running transition
        const timer1 = setTimeout(() => {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === localId ? { ...t, status: 'running' as const, agents: ['agent-orchestrator', 'agent-coder', 'agent-decomposer'] } : t
            ),
            _submitTaskTimers: s._submitTaskTimers.filter((t) => t !== timer1),
          }));
        }, 1500);

        // Simulate completion
        const timer2 = setTimeout(() => {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === localId ? { ...t, status: 'completed' as const, result: result.result, completedAt: new Date().toISOString() } : t
            ),
            _submitTaskTimers: s._submitTaskTimers.filter((t) => t !== timer2),
          }));
          get().addNotification({
            type: 'success',
            title: '任务完成',
            message: `Task ${localId} 已完成: ${result.result}`,
          });
          // 持久化已完成的任务
          const completedTask = get().tasks.find((t) => t.id === localId);
          if (completedTask) DataManager.taskHistory.add(completedTask).catch(() => {});
        }, 4000);

        set((s) => ({ _submitTaskTimers: [...s._submitTaskTimers, timer1, timer2] }));
        return result;
      }

      const apiConfig: Record<string, unknown> = { strategy, maxIterations };
      const result = await runTaskApi(description, undefined, apiConfig);

      // Update task with result from backend
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === localId
            ? {
                ...t,
                id: result.task_id || localId,
                status: result.status === 'completed' ? 'completed' as const : 'failed' as const,
                result: result.result || result.error || '',
                completedAt: new Date().toISOString(),
              }
            : t
        ),
      }));

      // 持久化已完成的任务
      const persistedTask = get().tasks.find((t) => t.id === (result.task_id || localId));
      if (persistedTask) DataManager.taskHistory.add(persistedTask).catch(() => {});

      if (result.status === 'completed') {
        get().addNotification({
          type: 'success',
          title: '任务完成',
          message: `Task ${result.task_id || localId} 已完成: ${result.result}`,
        });
      } else {
        get().addNotification({
          type: 'error',
          title: '任务失败',
          message: `Task ${result.task_id || localId} 失败: ${result.error || result.result}`,
        });
      }

      return result;
    } catch (err) {
      // Mark task as failed on error
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === localId
            ? {
                ...t,
                status: 'failed' as const,
                result: String(err),
                completedAt: new Date().toISOString(),
              }
            : t
        ),
        logs: [
          ...s.logs,
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: 'error' as const,
            source: 'ui',
            message: `Task ${localId} failed: ${err}`,
          },
        ],
      }));
      get().addNotification({
        type: 'error',
        title: '任务失败',
        message: `Task ${localId} 失败: ${err}`,
      });
      // 持久化失败的任务
      const failedTask = get().tasks.find((t) => t.id === localId);
      if (failedTask) DataManager.taskHistory.add(failedTask).catch(() => {});

      throw err;
    }
  },

  saveConfigToApi: async (config) => {
    if (!isTauri()) {
      set({ config, error: null });
      return;
    }
    try {
      await saveConfigApi(config);
      set({ config, error: null });
    } catch (err) {
      console.error('Failed to save config:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  clearLogsFromApi: async () => {
    if (!isTauri()) {
      set({ logs: [], error: null });
      return;
    }
    try {
      await clearLogsApi();
      set({ logs: [], error: null });
    } catch (err) {
      console.error('Failed to clear logs:', err);
      set({ error: String(err) });
    }
  },

  // ── Workflow editing actions ───────────────────────────────────────

  addWorkflowNode: (node) => {
    set((s) => ({ workflowNodes: [...s.workflowNodes, node] }));
    get().pushHistory({ action: 'workflow-add-node', details: { nodeId: node.id, node } });
  },

  removeWorkflowNode: (id) => {
    const removed = get().workflowNodes.find((n) => n.id === id);
    set((s) => ({
      workflowNodes: s.workflowNodes
        .filter((n) => n.id !== id)
        .map((n) => ({
          ...n,
          dependencies: n.dependencies.filter((d) => d !== id),
        })),
      selectedAgentId: s.selectedAgentId === id ? null : s.selectedAgentId,
    }));
    if (removed) {
      get().pushHistory({ action: 'workflow-remove-node', details: { nodeId: id, node: removed } });
    }
  },

  updateWorkflowNode: (id, updates) => {
    const prev = get().workflowNodes.find((n) => n.id === id);
    set((s) => ({
      workflowNodes: s.workflowNodes.map((n) =>
        n.id === id ? { ...n, ...updates } : n,
      ),
    }));
    const updated = get().workflowNodes.find((n) => n.id === id);
    if (prev && updated) {
      get().pushHistory({ action: 'workflow-update-node', details: { nodeId: id, prevState: prev, newState: updated } });
    }
  },

  addDependency: (nodeId, depId) => {
    set((s) => ({
      workflowNodes: s.workflowNodes.map((n) =>
        n.id === nodeId && !n.dependencies.includes(depId)
          ? { ...n, dependencies: [...n.dependencies, depId] }
          : n,
      ),
    }));
    get().pushHistory({ action: 'workflow-add-dependency', details: { nodeId, depId } });
  },

  removeDependency: (nodeId, depId) => {
    set((s) => ({
      workflowNodes: s.workflowNodes.map((n) =>
        n.id === nodeId
          ? { ...n, dependencies: n.dependencies.filter((d) => d !== depId) }
          : n,
      ),
    }));
    get().pushHistory({ action: 'workflow-remove-dependency', details: { nodeId, depId } });
  },

  saveWorkflowToApi: async () => {
    const { workflowNodes } = get();
    if (!isTauri()) {
      console.log('[Mock] Workflow saved:', workflowNodes);
      return;
    }
    try {
      await saveWorkflowApi({ nodes: workflowNodes as unknown as Record<string, unknown>[] });
    } catch (err) {
      console.error('Failed to save workflow:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  // ── Log streaming controls ────────────────────────────────────────

  logAutoRefresh: 'off',
  logPaused: false,
  logMaxEntries: 1000,

  setLogAutoRefresh: (interval) => { set({ logAutoRefresh: interval }); schedulePrefersist(); },
  toggleLogPause: () => set((s) => ({ logPaused: !s.logPaused })),
  setLogMaxEntries: (max) => {
    set((s) => ({
      logMaxEntries: max,
      logs: max > 0 ? s.logs.slice(-max) : s.logs,
    }));
    schedulePrefersist();
  },
  trimLogs: () => set((s) => {
    if (s.logMaxEntries <= 0 || s.logs.length <= s.logMaxEntries) return {};
    return { logs: s.logs.slice(-s.logMaxEntries) };
  }),

  // ── Dashboard auto-refresh ──────────────────────────────────────────

  dashboardAutoRefresh: 'off' as const,
  lastDashboardRefresh: null as string | null,

  setDashboardAutoRefresh: (interval: 'off' | '10s' | '30s' | '1min' | '5min') => {
    set({ dashboardAutoRefresh: interval });
    schedulePrefersist();
  },
  setLastDashboardRefresh: (ts: string) => set({ lastDashboardRefresh: ts }),

  // ── Notifications ─────────────────────────────────────────────────

  notifications: [],

  addNotification: (n) => {
    const notification: Notification = {
      ...n,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 50),
    }));
  },

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearNotifications: () => set({ notifications: [] }),

  // ── Config templates ──────────────────────────────────────────────

  customTemplates: loadCustomTemplates(),

  applyTemplate: (template) => {
    set({ config: JSON.parse(JSON.stringify(template.config)) });
  },

  saveAsTemplate: (name) => {
    const { config, customTemplates } = get();
    const newTemplate: ConfigTemplate = {
      id: `custom-${Date.now()}`,
      name,
      description: 'Custom template',
      icon: '⚙️',
      config: JSON.parse(JSON.stringify(config)),
    };
    const updated = [...customTemplates, newTemplate];
    saveCustomTemplates(updated);
    set({ customTemplates: updated });
  },

  deleteTemplate: (id) => {
    const { customTemplates } = get();
    const updated = customTemplates.filter((t) => t.id !== id);
    saveCustomTemplates(updated);
    set({ customTemplates: updated });
  },

  // ── Report export ─────────────────────────────────────────────────

  exportReport: (options) => {
    const { agents, tasks, logs, metrics } = get();
    const content = generateReport({ agents, tasks, logs, metrics }, options);
    const filename = getReportFilename(options.format);
    const mimeType = getMimeType(options.format);
    downloadReport(content, filename, mimeType);
    get().addNotification({
      type: 'success',
      title: '报告已导出',
      message: `${filename} 已下载`,
    });
  },

  // ── Event listeners ───────────────────────────────────────────────

  _unlistenFns: [],

  registerEventListeners: async () => {
    // Skip event listeners when not in Tauri
    if (!isTauri()) return;

    // Clean up any existing listeners
    get().unregisterEventListeners();

    const unlistenFns: UnlistenFn[] = [];

    try {
      unlistenFns.push(
        await onTaskStarted((data) => {
          set((s) => {
            const exists = s.tasks.some((t) => t.id === data.task_id);
            if (exists) {
              return {
                tasks: s.tasks.map((t) =>
                  t.id === data.task_id ? { ...t, status: 'running' as const } : t
                ),
              };
            }
            return {
              tasks: [
                ...s.tasks,
                {
                  id: data.task_id,
                  description: data.task_description,
                  status: 'running' as const,
                  createdAt: new Date().toISOString(),
                  agents: ['agent-orchestrator'],
                },
              ],
            };
          });
        }),
      );

      unlistenFns.push(
        await onTaskProgress((data) => {
          set((s) => ({
            logs: [
              ...s.logs,
              {
                id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                timestamp: new Date().toISOString(),
                level: 'info' as const,
                source: 'orchestrator',
                message: `[${data.task_id}] ${data.phase}: ${data.detail}`,
              },
            ],
          }));
        }),
      );

      unlistenFns.push(
        await onTaskCompleted((data) => {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === data.task_id
                ? { ...t, status: 'completed' as const, result: data.result, completedAt: new Date().toISOString() }
                : t
            ),
            logs: [
              ...s.logs,
              {
                id: `log-${Date.now()}`,
                timestamp: new Date().toISOString(),
                level: 'info' as const,
                source: 'orchestrator',
                message: `Task ${data.task_id} completed: ${data.result}`,
              },
            ],
          }));
          get().addNotification({
            type: 'success',
            title: '任务完成',
            message: `Task ${data.task_id} 已完成: ${data.result}`,
          });
          // 持久化完成的任务
          const completedTask = get().tasks.find((t) => t.id === data.task_id);
          if (completedTask) DataManager.taskHistory.add(completedTask).catch(() => {});
        }),
      );

      unlistenFns.push(
        await onTaskFailed((data) => {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === data.task_id
                ? { ...t, status: 'failed' as const, result: data.error, completedAt: new Date().toISOString() }
                : t
            ),
            logs: [
              ...s.logs,
              {
                id: `log-${Date.now()}`,
                timestamp: new Date().toISOString(),
                level: 'error' as const,
                source: 'orchestrator',
                message: `Task ${data.task_id} failed: ${data.error}`,
              },
            ],
          }));
          get().addNotification({
            type: 'error',
            title: '任务失败',
            message: `Task ${data.task_id} 失败: ${data.error}`,
          });
          // 持久化失败的任务
          const failedTask = get().tasks.find((t) => t.id === data.task_id);
          if (failedTask) DataManager.taskHistory.add(failedTask).catch(() => {});
        }),
      );

      unlistenFns.push(
        await onLogEntry((data) => {
          set((s) => ({ logs: [...s.logs.slice(-999), data] }));
          DataManager.logHistory.add(data).catch(() => {});
        }),
      );

      unlistenFns.push(
        await onMetricsUpdate((data) => {
          set({ metrics: data });
        }),
      );

      set({ _unlistenFns: unlistenFns });
    } catch (err) {
      console.error('Failed to register event listeners:', err);
    }
  },

  unregisterEventListeners: () => {
    const { _unlistenFns } = get();
    _unlistenFns.forEach((fn) => fn());
    set({ _unlistenFns: [] });
  },

  // ── Split panel layout ─────────────────────────────────────────────

  layoutMode: 'single',
  panels: [{ id: 'panel-1', page: 'workflow', size: 100 }],

  setLayoutMode: (mode) => {
    const { currentPage, panels } = get();
    if (mode === 'single') {
      // 合并：保留第一个面板的页面
      const mainPage = panels[0]?.page ?? currentPage;
      set({
        layoutMode: 'single',
        panels: [{ id: 'panel-1', page: mainPage, size: 100 }],
        currentPage: mainPage,
      });
    } else if (mode === 'horizontal' || mode === 'vertical') {
      const existingPage = panels[0]?.page ?? currentPage;
      // 第二个面板默认显示 logs（与第一个不同）
      const secondPage: Page = existingPage === 'logs' ? 'tasks' : 'logs';
      set({
        layoutMode: mode,
        panels: [
          { id: 'panel-1', page: existingPage, size: 50 },
          { id: 'panel-2', page: secondPage, size: 50 },
        ],
      });
    }
  },

  setPanelPage: (panelId, page) =>
    set((s) => ({
      panels: s.panels.map((p) => (p.id === panelId ? { ...p, page } : p)),
    })),

  setPanelSize: (panelId, size) =>
    set((s) => {
      const panels = s.panels;
      const idx = panels.findIndex((p) => p.id === panelId);
      if (idx === -1 || panels.length < 2) return {};
      const otherIdx = idx === 0 ? 1 : 0;
      const clampedSize = Math.max(20, Math.min(80, size));
      return {
        panels: panels.map((p, i) => {
          if (i === idx) return { ...p, size: clampedSize };
          if (i === otherIdx) return { ...p, size: 100 - clampedSize };
          return p;
        }),
      };
    }),

  // ── History (Undo/Redo) ──────────────────────────────────────────────

  history: [],
  historyIndex: -1,

  canUndo: false,
  canRedo: false,

  pushHistory: (entry) => {
    const user = getOrCreateUser();
    const newEntry: HistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
    };
    set((s) => {
      // 截断 redo 历史
      const truncated = s.history.slice(0, s.historyIndex + 1);
      const newHistory = [...truncated, newEntry];
      const trimmed = newHistory.slice(-200);
      const removed = newHistory.length - trimmed.length;
      const newHistoryIndex = truncated.length - removed;
      return {
        history: trimmed,
        historyIndex: newHistoryIndex,
        canUndo: newHistoryIndex >= 0,
        canRedo: false,
      };
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < 0) return;
    const entry = history[historyIndex];
    const { details } = entry;

    // 根据 action 类型执行撤销
    switch (entry.action) {
      case 'task-create': {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== details.taskId) }));
        break;
      }
      case 'task-update': {
        if (details.taskId && details.prevState) {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === details.taskId ? (details.prevState as Task) : t
            ),
          }));
        }
        break;
      }
      case 'task-delete': {
        if (details.task) {
          set((s) => ({ tasks: [...s.tasks, details.task as Task] }));
        }
        break;
      }
      case 'config-update': {
        if (details.prevConfig) {
          set({ config: details.prevConfig as MAFConfig });
        }
        break;
      }
      case 'workflow-add-node': {
        set((s) => ({
          workflowNodes: s.workflowNodes.filter((n) => n.id !== details.nodeId),
        }));
        break;
      }
      case 'workflow-remove-node': {
        if (details.node) {
          set((s) => ({
            workflowNodes: [...s.workflowNodes, details.node as WorkflowNode],
          }));
        }
        break;
      }
      case 'workflow-update-node': {
        if (details.nodeId && details.prevState) {
          set((s) => ({
            workflowNodes: s.workflowNodes.map((n) =>
              n.id === details.nodeId ? (details.prevState as WorkflowNode) : n
            ),
          }));
        }
        break;
      }
      case 'workflow-add-dependency': {
        set((s) => ({
          workflowNodes: s.workflowNodes.map((n) =>
            n.id === details.nodeId
              ? { ...n, dependencies: n.dependencies.filter((d) => d !== details.depId) }
              : n
          ),
        }));
        break;
      }
      case 'workflow-remove-dependency': {
        set((s) => ({
          workflowNodes: s.workflowNodes.map((n) =>
            n.id === details.nodeId && !n.dependencies.includes(details.depId as string)
              ? { ...n, dependencies: [...n.dependencies, details.depId as string] }
              : n
          ),
        }));
        break;
      }
      case 'comment-add': {
        if (details.taskId && details.commentId) {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === details.taskId
                ? { ...t, comments: (t.comments || []).filter((c) => c.id !== details.commentId) }
                : t
            ),
          }));
        }
        break;
      }
      case 'comment-delete': {
        if (details.taskId && details.comment) {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === details.taskId
                ? { ...t, comments: [...(t.comments || []), details.comment as Comment] }
                : t
            ),
          }));
        }
        break;
      }
    }

    const newIndex = historyIndex - 1;
    set({ historyIndex: newIndex, canUndo: newIndex >= 0, canRedo: newIndex < history.length - 1 });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const entry = history[historyIndex + 1];
    const { details } = entry;

    // 根据 action 类型执行重做
    switch (entry.action) {
      case 'task-create': {
        if (details.task) {
          set((s) => ({ tasks: [...s.tasks, details.task as Task] }));
        }
        break;
      }
      case 'task-update': {
        if (details.taskId && details.newState) {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === details.taskId ? (details.newState as Task) : t
            ),
          }));
        }
        break;
      }
      case 'task-delete': {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== details.taskId) }));
        break;
      }
      case 'config-update': {
        if (details.newConfig) {
          set({ config: details.newConfig as MAFConfig });
        }
        break;
      }
      case 'workflow-add-node': {
        if (details.node) {
          set((s) => ({
            workflowNodes: [...s.workflowNodes, details.node as WorkflowNode],
          }));
        }
        break;
      }
      case 'workflow-remove-node': {
        set((s) => ({
          workflowNodes: s.workflowNodes.filter((n) => n.id !== details.nodeId),
        }));
        break;
      }
      case 'workflow-update-node': {
        if (details.nodeId && details.newState) {
          set((s) => ({
            workflowNodes: s.workflowNodes.map((n) =>
              n.id === details.nodeId ? (details.newState as WorkflowNode) : n
            ),
          }));
        }
        break;
      }
      case 'workflow-add-dependency': {
        set((s) => ({
          workflowNodes: s.workflowNodes.map((n) =>
            n.id === details.nodeId && !n.dependencies.includes(details.depId as string)
              ? { ...n, dependencies: [...n.dependencies, details.depId as string] }
              : n
          ),
        }));
        break;
      }
      case 'workflow-remove-dependency': {
        set((s) => ({
          workflowNodes: s.workflowNodes.map((n) =>
            n.id === details.nodeId
              ? { ...n, dependencies: n.dependencies.filter((d) => d !== details.depId) }
              : n
          ),
        }));
        break;
      }
      case 'comment-add': {
        if (details.taskId && details.comment) {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === details.taskId
                ? { ...t, comments: [...(t.comments || []), details.comment as Comment] }
                : t
            ),
          }));
        }
        break;
      }
      case 'comment-delete': {
        if (details.taskId && details.commentId) {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === details.taskId
                ? { ...t, comments: (t.comments || []).filter((c) => c.id !== details.commentId) }
                : t
            ),
          }));
        }
        break;
      }
    }

    const newIndex = historyIndex + 1;
    set({ historyIndex: newIndex, canUndo: newIndex >= 0, canRedo: newIndex < history.length - 1 });
  },

  // ── Comments ─────────────────────────────────────────────────────

  addComment: (taskId, content) => {
    const user = getOrCreateUser();
    const comment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: user.id,
      nickname: user.nickname,
      color: user.color,
      content,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, comments: [...(t.comments || []), comment], lastModifiedBy: user.nickname }
          : t
      ),
    }));

    get().pushHistory({
      action: 'comment-add',
      details: { taskId, commentId: comment.id, comment },
    });
  },

  deleteComment: (taskId, commentId) => {
    const user = getOrCreateUser();
    let deletedComment: Comment | undefined;

    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        deletedComment = (t.comments || []).find((c) => c.id === commentId);
        return { ...t, comments: (t.comments || []).filter((c) => c.id !== commentId), lastModifiedBy: user.nickname };
      }),
    }));

    if (deletedComment) {
      get().pushHistory({
        action: 'comment-delete',
        details: { taskId, commentId, comment: deletedComment },
      });
    }
  },

  // ── Collaboration ─────────────────────────────────────────────

  collaborationEnabled: false,
  connectionStatus: 'disconnected',
  onlineUsers: [],

  enableCollaboration: () => {
    const user = getOrCreateUser();
    const manager = getCollaborationManager();

    // 监听连接状态
    manager.onStatusChange((status) => {
      set({ connectionStatus: status });
    });

    // 监听所有消息
    manager.on('*', (msg: WSMessage) => {
      get().handleRemoteAction(msg);
    });

    // 连接（无 URL 则 mock 模式）
    manager.connect(undefined, user.id, { nickname: user.nickname, color: user.color });

    set({ collaborationEnabled: true });
  },

  disableCollaboration: () => {
    const manager = getCollaborationManager();
    manager.disconnect();
    set({
      collaborationEnabled: false,
      connectionStatus: 'disconnected',
      onlineUsers: [],
    });
  },

  handleRemoteAction: (msg: WSMessage) => {
    if (msg.type === 'presence') {
      const payload = msg.payload as { action: string; user?: UserIdentity; userId?: string };
      if (payload.action === 'join' && payload.user) {
        set((s) => {
          if (s.onlineUsers.some((u) => u.id === payload.user!.id)) return {};
          return { onlineUsers: [...s.onlineUsers, payload.user!] };
        });
      } else if (payload.action === 'leave' && payload.userId) {
        set((s) => ({
          onlineUsers: s.onlineUsers.filter((u) => u.id !== payload.userId),
        }));
      }
    } else if (msg.type === 'sync') {
      const payload = msg.payload as { users: UserIdentity[] };
      if (payload.users) {
        const currentUser = getOrCreateUser();
        set({
          onlineUsers: payload.users.filter((u) => u.id !== currentUser.id),
        });
      }
    }
    // cursor / selection / action 类型由各自的组件处理
  },

  // ── Custom Agents ─────────────────────────────────────────────

  customAgents: loadCustomAgents(),

  addCustomAgent: (agent) => {
    const now = new Date().toISOString();
    const newAgent: CustomAgent = {
      ...agent,
      id: `custom-agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => {
      const updated = [...s.customAgents, newAgent];
      saveCustomAgentsToStorage(updated);
      return { customAgents: updated };
    });
  },

  updateCustomAgent: (id, updates) => {
    set((s) => {
      const updated = s.customAgents.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
      );
      saveCustomAgentsToStorage(updated);
      return { customAgents: updated };
    });
  },

  deleteCustomAgent: (id) => {
    set((s) => {
      const updated = s.customAgents.filter((a) => a.id !== id);
      saveCustomAgentsToStorage(updated);
      return { customAgents: updated };
    });
  },

  duplicateCustomAgent: (id) => {
    const agent = get().customAgents.find((a) => a.id === id);
    if (!agent) return;
    const now = new Date().toISOString();
    const duplicated: CustomAgent = {
      ...agent,
      id: `custom-agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${agent.name} (副本)`,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => {
      const updated = [...s.customAgents, duplicated];
      saveCustomAgentsToStorage(updated);
      return { customAgents: updated };
    });
  },

  // ── Providers ────────────────────────────────────────────────

  providers: loadProviders(),

  addProvider: () => {
    const id = `provider-${Date.now()}`;
    const newProvider: ProviderOption = { id, label: '新 Provider', models: [] };
    set((s) => {
      const updated = [...s.providers, newProvider];
      saveProvidersToStorage(updated);
      return { providers: updated };
    });
  },

  updateProvider: (id, updates) => {
    set((s) => {
      const updated = s.providers.map((p) => (p.id === id ? { ...p, ...updates } : p));
      saveProvidersToStorage(updated);
      return { providers: updated };
    });
  },

  deleteProvider: (id) => {
    set((s) => {
      if (s.providers.length <= 1) return {};
      const updated = s.providers.filter((p) => p.id !== id);
      saveProvidersToStorage(updated);
      return { providers: updated };
    });
  },
}));
