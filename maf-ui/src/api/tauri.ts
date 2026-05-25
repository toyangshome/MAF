import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { Agent, LogEntry, Task, AgentMetric, MAFConfig } from '../types';
import { trackApiCall } from '../utils/performance';

/**
 * 包装 invoke 调用，自动记录性能数据
 */
async function trackedInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const start = performance.now();
  try {
    const result = await invoke<T>(cmd, args);
    const duration = performance.now() - start;
    trackApiCall(cmd, duration, 'success');
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    trackApiCall(cmd, duration, 'error');
    throw err;
  }
}

// ── Task types ──────────────────────────────────────────────────────

export interface TaskResult {
  task_id: string;
  status: string;
  result?: string;
  error?: string;
}

// ── Task API ────────────────────────────────────────────────────────

export async function runTask(task: string, workflow?: string, config?: Record<string, unknown>): Promise<TaskResult> {
  try {
    const result = await trackedInvoke<TaskResult>('run_task', {
      request: { task, workflow, config },
    } as unknown as Record<string, unknown>);
    return result;
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function getTaskStatus(taskId: string): Promise<TaskResult> {
  try {
    return await trackedInvoke<TaskResult>('get_task_status', { task_id: taskId });
  } catch (err) {
    throw new Error(String(err));
  }
}

// ── Config API ──────────────────────────────────────────────────────

export async function getConfig(): Promise<MAFConfig> {
  try {
    const raw = await trackedInvoke<Record<string, unknown>>('get_config');
    return raw as unknown as MAFConfig;
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function saveConfig(config: MAFConfig): Promise<void> {
  try {
    await trackedInvoke('save_config', { config });
  } catch (err) {
    throw new Error(String(err));
  }
}

// ── Agent API ───────────────────────────────────────────────────────

export async function getAgents(): Promise<Agent[]> {
  try {
    const raw = await trackedInvoke<Agent[]>('get_agents');
    return raw;
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function getWorkflows(): Promise<Record<string, unknown>[]> {
  try {
    return await trackedInvoke<Record<string, unknown>[]>('get_workflows');
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function saveWorkflow(workflow: { nodes: Record<string, unknown>[] }): Promise<void> {
  try {
    await trackedInvoke('save_workflow', { workflow });
  } catch (err) {
    throw new Error(String(err));
  }
}

// ── Log API ─────────────────────────────────────────────────────────

export async function getLogs(level?: string, source?: string, limit?: number): Promise<LogEntry[]> {
  try {
    return await trackedInvoke<LogEntry[]>('get_logs', { level, source, limit });
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function clearLogs(): Promise<void> {
  try {
    await trackedInvoke('clear_logs');
  } catch (err) {
    throw new Error(String(err));
  }
}

// ── Metrics API ─────────────────────────────────────────────────────

export async function getMetrics(): Promise<AgentMetric[]> {
  try {
    return await trackedInvoke<AgentMetric[]>('get_metrics');
  } catch (err) {
    throw new Error(String(err));
  }
}

// ── Event listeners ─────────────────────────────────────────────────

export async function onTaskStarted(callback: (data: { task_id: string; task_description: string }) => void): Promise<UnlistenFn> {
  return listen('task_started', (event) => callback(event.payload as { task_id: string; task_description: string }));
}

export async function onTaskProgress(callback: (data: { task_id: string; phase: string; detail: string }) => void): Promise<UnlistenFn> {
  return listen('task_progress', (event) => callback(event.payload as { task_id: string; phase: string; detail: string }));
}

export async function onTaskCompleted(callback: (data: { task_id: string; result: string }) => void): Promise<UnlistenFn> {
  return listen('task_completed', (event) => callback(event.payload as { task_id: string; result: string }));
}

export async function onTaskFailed(callback: (data: { task_id: string; error: string }) => void): Promise<UnlistenFn> {
  return listen('task_failed', (event) => callback(event.payload as { task_id: string; error: string }));
}

export async function onLogEntry(callback: (data: LogEntry) => void): Promise<UnlistenFn> {
  return listen('log_entry', (event) => callback(event.payload as LogEntry));
}

export async function onMetricsUpdate(callback: (data: AgentMetric[]) => void): Promise<UnlistenFn> {
  return listen('metrics_update', (event) => callback(event.payload as AgentMetric[]));
}

// ── Custom Agent API ─────────────────────────────────────────

export async function saveCustomAgent(agent: Record<string, unknown>): Promise<void> {
  try {
    await trackedInvoke('save_custom_agent', { agent });
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function deleteCustomAgent(agentId: string): Promise<void> {
  try {
    await trackedInvoke('delete_custom_agent', { agentId });
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function getCustomAgents(): Promise<Record<string, unknown>[]> {
  try {
    return await trackedInvoke<Record<string, unknown>[]>('get_custom_agents');
  } catch (err) {
    throw new Error(String(err));
  }
}
