/**
 * 本地数据持久化层 - 数据管理器
 *
 * 统一管理用户偏好（localStorage）、任务历史（IndexedDB）、日志历史（IndexedDB）
 * 存储失败不阻塞主流程
 */

import {
  localStorageAdapter,
  indexedDBAdapter,
  type UserPreferences,
  DEFAULT_PREFERENCES,
} from './index';
import type { Task, LogEntry } from '../types';

// ── 常量 ──────────────────────────────────────────────────────────────

const PREFS_KEY = 'user_preferences';
const TASK_HISTORY_KEY = 'task_history';
const LOG_HISTORY_KEY = 'log_history';
const DEFAULT_LOG_TRIM = 500;

// ── 偏好设置（localStorage）───────────────────────────────────────────

const preferences = {
  get: async (): Promise<UserPreferences> => {
    const prefs = await localStorageAdapter.get<UserPreferences>(PREFS_KEY);
    return prefs ?? { ...DEFAULT_PREFERENCES };
  },

  set: async (prefs: UserPreferences): Promise<void> => {
    await localStorageAdapter.set(PREFS_KEY, prefs);
  },
};

// ── 任务历史（IndexedDB）───────────────────────────────────────────────

const taskHistory = {
  getAll: async (): Promise<Task[]> => {
    const tasks = await indexedDBAdapter.get<Task[]>(TASK_HISTORY_KEY);
    return tasks ?? [];
  },

  add: async (task: Task): Promise<void> => {
    try {
      const tasks = await taskHistory.getAll();
      // 如果已存在相同 id 的任务则替换
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        tasks[idx] = task;
      } else {
        tasks.push(task);
      }
      // 保留最近 500 条
      const trimmed = tasks.length > 500 ? tasks.slice(-500) : tasks;
      await indexedDBAdapter.set(TASK_HISTORY_KEY, trimmed);
    } catch (err) {
      console.warn('[DataManager] Failed to save task history:', err);
    }
  },

  clear: async (): Promise<void> => {
    await indexedDBAdapter.remove(TASK_HISTORY_KEY);
  },
};

// ── 日志历史（IndexedDB，有限容量）─────────────────────────────────────

const logHistory = {
  getAll: async (): Promise<LogEntry[]> => {
    const logs = await indexedDBAdapter.get<LogEntry[]>(LOG_HISTORY_KEY);
    return logs ?? [];
  },

  add: async (log: LogEntry): Promise<void> => {
    try {
      const logs = await logHistory.getAll();
      logs.push(log);
      // 默认保留最近 500 条
      const trimmed = logs.length > DEFAULT_LOG_TRIM ? logs.slice(-DEFAULT_LOG_TRIM) : logs;
      await indexedDBAdapter.set(LOG_HISTORY_KEY, trimmed);
    } catch (err) {
      console.warn('[DataManager] Failed to save log history:', err);
    }
  },

  trim: async (maxEntries: number): Promise<void> => {
    try {
      const logs = await logHistory.getAll();
      if (logs.length > maxEntries) {
        await indexedDBAdapter.set(LOG_HISTORY_KEY, logs.slice(-maxEntries));
      }
    } catch (err) {
      console.warn('[DataManager] Failed to trim log history:', err);
    }
  },

  clear: async (): Promise<void> => {
    await indexedDBAdapter.remove(LOG_HISTORY_KEY);
  },
};

// ── 存储空间 ──────────────────────────────────────────────────────────

function estimateLocalStorageUsage(): { used: number; total: number } {
  let used = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key);
        if (val) {
          // UTF-16: 每个字符 2 字节
          used += (key.length + val.length) * 2;
        }
      }
    }
  } catch {
    // ignore
  }
  // localStorage 通常限制 ~5MB
  return { used, total: 5 * 1024 * 1024 };
}

async function getIndexedDBUsage(): Promise<number> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return est.usage ?? 0;
    }
  } catch {
    // ignore
  }
  return 0;
}

const storage = {
  getUsage: async (): Promise<{ used: number; total: number }> => {
    const lsUsage = estimateLocalStorageUsage();
    const idbUsage = await getIndexedDBUsage();
    return {
      used: lsUsage.used + idbUsage,
      total: lsUsage.total + (500 * 1024 * 1024), // 估算 IndexedDB ~500MB
    };
  },

  cleanup: async (): Promise<void> => {
    await Promise.allSettled([
      taskHistory.clear(),
      logHistory.clear(),
    ]);
  },
};

// ── 导出 DataManager ──────────────────────────────────────────────────

export const DataManager = {
  preferences,
  taskHistory,
  logHistory,
  storage,
};

// ── 导出辅助：导出/导入所有数据 ────────────────────────────────────────

export interface ExportData {
  version: number;
  exportedAt: string;
  preferences: UserPreferences;
  taskHistory: Task[];
  logHistory: LogEntry[];
}

export async function exportAllData(): Promise<ExportData> {
  const [prefs, tasks, logs] = await Promise.all([
    preferences.get(),
    taskHistory.getAll(),
    logHistory.getAll(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    preferences: prefs,
    taskHistory: tasks,
    logHistory: logs,
  };
}

export async function importAllData(data: ExportData): Promise<void> {
  if (!data || data.version !== 1) {
    throw new Error('不支持的数据格式版本');
  }

  await Promise.all([
    preferences.set(data.preferences),
    indexedDBAdapter.set(TASK_HISTORY_KEY, data.taskHistory),
    indexedDBAdapter.set(LOG_HISTORY_KEY, data.logHistory),
  ]);
}
