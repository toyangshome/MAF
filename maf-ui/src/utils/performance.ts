/**
 * 性能数据收集器
 * 使用 performance.now() 测量时间，环形缓冲区保存最近 100 条记录
 */

// ── Types ─────────────────────────────────────────────────────────────

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'MB' | 'count' | 'percent';
  timestamp: string;
}

export interface ApiCallRecord {
  endpoint: string;
  duration: number;
  status: 'success' | 'error';
  timestamp: string;
}

export interface PerformanceSnapshot {
  pageLoadTime: number;
  apiCalls: ApiCallRecord[];
  renderCount: number;
  memoryUsage?: { used: number; total: number };
}

// ── Ring Buffer ───────────────────────────────────────────────────────

const MAX_RECORDS = 100;

class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getAll(): T[] {
    const result: T[] = [];
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) result.push(item);
    }
    return result;
  }

  size(): number {
    return this.count;
  }
}

// ── Storage ───────────────────────────────────────────────────────────

const apiCallBuffer = new RingBuffer<ApiCallRecord>(MAX_RECORDS);
const metricBuffer = new RingBuffer<PerformanceMetric>(MAX_RECORDS);
let renderCount = 0;

// ── Page Load Metrics ─────────────────────────────────────────────────

export function collectPageLoadMetrics(): PerformanceMetric[] {
  const metrics: PerformanceMetric[] = [];
  const now = new Date().toISOString();

  if (typeof performance !== 'undefined' && performance.timing) {
    const t = performance.timing;
    const navigationStart = t.navigationStart;

    if (t.loadEventEnd > 0) {
      metrics.push({
        name: 'page_total_load',
        value: t.loadEventEnd - navigationStart,
        unit: 'ms',
        timestamp: now,
      });
    }

    if (t.domContentLoadedEventEnd > 0) {
      metrics.push({
        name: 'dom_content_loaded',
        value: t.domContentLoadedEventEnd - navigationStart,
        unit: 'ms',
        timestamp: now,
      });
    }

    if (t.domInteractive > 0) {
      metrics.push({
        name: 'dom_interactive',
        value: t.domInteractive - navigationStart,
        unit: 'ms',
        timestamp: now,
      });
    }

    if (t.responseEnd > 0 && t.requestStart > 0) {
      metrics.push({
        name: 'network_latency',
        value: t.responseEnd - t.requestStart,
        unit: 'ms',
        timestamp: now,
      });
    }
  }

  // Use performance.getEntriesByType for modern browsers
  if (typeof performance !== 'undefined' && performance.getEntriesByType) {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0];
      metrics.push({
        name: 'ttfb',
        value: nav.responseStart,
        unit: 'ms',
        timestamp: now,
      });
    }
  }

  metrics.forEach((m) => metricBuffer.push(m));
  return metrics;
}

// ── API Call Tracking ─────────────────────────────────────────────────

export function trackApiCall(endpoint: string, duration: number, status: string): void {
  const record: ApiCallRecord = {
    endpoint,
    duration,
    status: status === 'success' ? 'success' : 'error',
    timestamp: new Date().toISOString(),
  };
  apiCallBuffer.push(record);

  metricBuffer.push({
    name: `api_${endpoint}`,
    value: duration,
    unit: 'ms',
    timestamp: record.timestamp,
  });
}

// ── Render Count ──────────────────────────────────────────────────────

export function incrementRenderCount(): void {
  renderCount++;
}

export function getRenderCount(): number {
  return renderCount;
}

export function resetRenderCount(): void {
  renderCount = 0;
}

// ── Memory Usage ──────────────────────────────────────────────────────

export function getMemoryUsage(): { used: number; total: number } | undefined {
  // Chrome-specific performance.memory API
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } };
  if (perf.memory) {
    return {
      used: Math.round(perf.memory.usedJSHeapSize / (1024 * 1024)),
      total: Math.round(perf.memory.totalJSHeapSize / (1024 * 1024)),
    };
  }
  return undefined;
}

// ── Snapshot ──────────────────────────────────────────────────────────

export function getPerformanceSnapshot(): PerformanceSnapshot {
  const apiCalls = apiCallBuffer.getAll();

  // Compute page load time from timing API
  let pageLoadTime = 0;
  if (typeof performance !== 'undefined' && performance.timing) {
    const t = performance.timing;
    if (t.loadEventEnd > 0 && t.navigationStart > 0) {
      pageLoadTime = t.loadEventEnd - t.navigationStart;
    }
  }

  return {
    pageLoadTime,
    apiCalls,
    renderCount,
    memoryUsage: getMemoryUsage(),
  };
}

// ── Stats Helpers ─────────────────────────────────────────────────────

export function getApiStats(): {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
} {
  const calls = apiCallBuffer.getAll();
  if (calls.length === 0) {
    return { totalCalls: 0, successCalls: 0, errorCalls: 0, avgDuration: 0, maxDuration: 0, minDuration: 0 };
  }

  const durations = calls.map((c) => c.duration);
  return {
    totalCalls: calls.length,
    successCalls: calls.filter((c) => c.status === 'success').length,
    errorCalls: calls.filter((c) => c.status === 'error').length,
    avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    maxDuration: Math.round(Math.max(...durations)),
    minDuration: Math.round(Math.min(...durations)),
  };
}

export function getApiTrendData(): { time: string; duration: number; endpoint: string }[] {
  return apiCallBuffer.getAll().map((c) => ({
    time: new Date(c.timestamp).toLocaleTimeString(),
    duration: Math.round(c.duration),
    endpoint: c.endpoint,
  }));
}

export function getAllMetrics(): PerformanceMetric[] {
  return metricBuffer.getAll();
}

// ── Invoke Wrapper (for Tauri) ────────────────────────────────────────

export async function trackedInvoke<T>(
  endpoint: string,
  args?: Record<string, unknown>,
  invokeFn?: (cmd: string, args?: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    // Dynamic import of tauri invoke if not provided
    const invoke = invokeFn ?? ((await import('@tauri-apps/api/core')).invoke as (cmd: string, args?: Record<string, unknown>) => Promise<T>);
    const result = await invoke(endpoint, args);
    const duration = performance.now() - start;
    trackApiCall(endpoint, duration, 'success');
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    trackApiCall(endpoint, duration, 'error');
    throw err;
  }
}
