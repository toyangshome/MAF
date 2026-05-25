import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { Select } from '@radix-ui/themes';
import { useAppStore } from '../../stores/useAppStore';
import type { LogEntry } from '../../types';
import { ErrorDiagnoser } from '../AIAssistant';
import { useTranslation } from '../../i18n';

type ViewMode = 'timeline' | 'grouped';

interface LogGroup {
  taskId: string;
  logs: LogEntry[];
  startTime: string;
  endTime: string;
  maxLevel: 'info' | 'warn' | 'error' | 'debug';
}

// ── Level config ───────────────────────────────────────────────────
const LEVEL_CONFIG: Record<LogEntry['level'], { color: string; bg: string; border: string }> = {
  info:  { color: 'var(--blue-9)', bg: 'var(--blue-3)', border: 'transparent' },
  warn:  { color: 'var(--amber-9)', bg: 'var(--amber-3)', border: 'transparent' },
  error: { color: 'var(--red-9)', bg: 'var(--red-3)', border: 'transparent' },
  debug: { color: 'var(--gray-11)', bg: 'var(--gray-3)', border: 'transparent' },
};

const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace";

// ── Helpers ────────────────────────────────────────────────────────
function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

function exportLogs(logs: LogEntry[]) {
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const LEVEL_PRIORITY: Record<LogEntry['level'], number> = {
  error: 4,
  warn: 3,
  info: 2,
  debug: 1,
};

function groupLogsByTask(logs: LogEntry[]): LogGroup[] {
  const map = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const taskId = (log.metadata?.task_id as string) || 'System';
    if (!map.has(taskId)) map.set(taskId, []);
    map.get(taskId)!.push(log);
  }
  const groups: LogGroup[] = [];
  for (const [taskId, groupLogs] of map) {
    const sorted = [...groupLogs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    let maxLevel: LogGroup['maxLevel'] = 'debug';
    for (const l of sorted) {
      if (LEVEL_PRIORITY[l.level] > LEVEL_PRIORITY[maxLevel]) maxLevel = l.level;
    }
    groups.push({
      taskId,
      logs: sorted,
      startTime: sorted[0].timestamp,
      endTime: sorted[sorted.length - 1].timestamp,
      maxLevel,
    });
  }
  // Sort groups: System last, others by earliest timestamp
  groups.sort((a, b) => {
    if (a.taskId === 'System') return 1;
    if (b.taskId === 'System') return -1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });
  return groups;
}

function formatTimestampRange(start: string, end: string): string {
  const s = formatTimestamp(start);
  const e = formatTimestamp(end);
  return s === e ? s : `${s} - ${e}`;
}

function truncateTaskId(id: string, maxLen = 16): string {
  return id.length > maxLen ? id.slice(0, maxLen) + '...' : id;
}

// ── Level Filter Toggle (custom, since react-toggle-group not installed) ──
function LevelToggle({
  levels,
  activeLevels,
  onToggle,
}: {
  levels: LogEntry['level'][];
  activeLevels: Set<LogEntry['level']>;
  onToggle: (level: LogEntry['level']) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {levels.map((level) => {
        const active = activeLevels.has(level);
        const cfg = LEVEL_CONFIG[level];
        return (
          <button
            key={level}
            onClick={() => onToggle(level)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: `1px solid ${active ? cfg.color : 'var(--gray-6)'}`,
              borderRadius: 6,
              background: active ? cfg.bg : 'transparent',
              color: active ? cfg.color : 'var(--gray-9)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}

// ── Log Row ────────────────────────────────────────────────────────
function LogRow({ entry, searchTerm }: { entry: LogEntry; searchTerm: string }) {
  const cfg = LEVEL_CONFIG[entry.level];

  const highlight = (text: string) => {
    if (!searchTerm) return text;
    const parts = text.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <span key={i} style={{ background: 'var(--amber-3)', color: 'var(--amber-10)', borderRadius: 2, padding: '0 1px' }}>
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '6px 12px',
        fontFamily: MONO,
        fontSize: 12,
        lineHeight: 1.6,
        borderBottom: '1px solid var(--gray-2)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Timestamp */}
      <span style={{ color: 'var(--gray-8)', flexShrink: 0, width: 70, fontVariantNumeric: 'tabular-nums' }}>
        {formatTimestamp(entry.timestamp)}
      </span>

      {/* Level badge */}
      <span
        style={{
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 700,
          padding: '1px 7px',
          borderRadius: 4,
          color: cfg.color,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          minWidth: 44,
          textAlign: 'center',
        }}
      >
        {entry.level}
      </span>

      {/* Source */}
      <span
        style={{
          flexShrink: 0,
          color: 'var(--purple-10)',
          fontWeight: 600,
          minWidth: 80,
          maxWidth: 100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        [{entry.source}]
      </span>

      {/* Message */}
      <span style={{ color: 'var(--gray-11)', flex: 1, wordBreak: 'break-word' }}>
        {highlight(entry.message)}
      </span>
    </div>
  );
}

// ── Log Group Header ────────────────────────────────────────────────
function LogGroupHeader({
  group,
  expanded,
  onToggle,
  searchTerm,
}: {
  group: LogGroup;
  expanded: boolean;
  onToggle: () => void;
  searchTerm: string;
}) {
  const cfg = LEVEL_CONFIG[group.maxLevel];
  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          fontFamily: MONO,
          fontSize: 12,
          cursor: 'pointer',
          background: 'var(--gray-1)',
          borderBottom: `1px solid ${cfg.border}`,
          borderLeft: `3px solid ${cfg.color}`,
          userSelect: 'none',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-2)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--gray-1)')}
      >
        {/* Expand arrow */}
        <span
          style={{
            color: 'var(--gray-9)',
            fontSize: 10,
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        >
          ▶
        </span>

        {/* Task ID */}
        <span
          style={{
            color: group.taskId === 'System' ? 'var(--gray-9)' : 'var(--gray-12)',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {group.taskId === 'System' ? 'System' : truncateTaskId(group.taskId)}
        </span>

        {/* Time range */}
        <span style={{ color: 'var(--gray-8)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {formatTimestampRange(group.startTime, group.endTime)}
        </span>

        <span style={{ flex: 1 }} />

        {/* Log count */}
        <span
          style={{
            color: 'var(--gray-9)',
            fontSize: 11,
            padding: '1px 6px',
            background: 'var(--gray-3)',
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          {group.logs.length} {group.logs.length === 1 ? 'entry' : 'entries'}
        </span>

        {/* Max level badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: 4,
            color: cfg.color,
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}
        >
          {group.maxLevel}
        </span>
      </div>

      {/* Expanded log rows */}
      {expanded && (
        <div>
          {group.logs.map((entry) => (
            <LogRow key={entry.id} entry={entry} searchTerm={searchTerm} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Auto-refresh interval mapping ─────────────────────────────────────
const INTERVAL_MAP: Record<string, number> = {
  'off': 0,
  '1s': 1000,
  '5s': 5000,
  '10s': 10000,
};

// ── Main LogPanel ──────────────────────────────────────────────────
export default function LogPanel() {
  const logs = useAppStore((s) => s.logs);
  const clearLogsFromApi = useAppStore((s) => s.clearLogsFromApi);
  const fetchLogs = useAppStore((s) => s.fetchLogs);
  const trimLogs = useAppStore((s) => s.trimLogs);
  const logAutoRefresh = useAppStore((s) => s.logAutoRefresh);
  const logPaused = useAppStore((s) => s.logPaused);
  const logMaxEntries = useAppStore((s) => s.logMaxEntries);
  const setLogAutoRefresh = useAppStore((s) => s.setLogAutoRefresh);
  const toggleLogPause = useAppStore((s) => s.toggleLogPause);
  const setLogMaxEntries = useAppStore((s) => s.setLogMaxEntries);
  const { t } = useTranslation();
  const [activeLevels, setActiveLevels] = useState<Set<LogEntry['level']>>(
    new Set(['info', 'warn', 'error', 'debug']),
  );
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Unique sources
  const sources = useMemo(() => {
    const set = new Set(logs.map((l) => l.source));
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!activeLevels.has(log.level)) return false;
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
      if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [logs, activeLevels, sourceFilter, searchTerm]);

  // Grouped logs
  const groupedLogs = useMemo(() => groupLogsByTask(filteredLogs), [filteredLogs]);

  const toggleGroup = useCallback((taskId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      groupedLogs.forEach((g) => next.add(g.taskId));
      return next;
    });
  }, [groupedLogs]);

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  // Auto-refresh interval
  useEffect(() => {
    // Clear previous interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const ms = INTERVAL_MAP[logAutoRefresh] ?? 0;
    if (ms <= 0 || logPaused) return;

    intervalRef.current = setInterval(() => {
      fetchLogs();
    }, ms);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [logAutoRefresh, logPaused, fetchLogs]);

  // Trim logs when exceeding maxEntries
  useEffect(() => {
    if (logMaxEntries > 0 && logs.length > logMaxEntries) {
      trimLogs();
    }
  }, [logs.length, logMaxEntries, trimLogs]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  const jumpToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  const toggleLevel = useCallback((level: LogEntry['level']) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        if (next.size > 1) next.delete(level); // keep at least one
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 48px)' }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 4px',
          borderBottom: '1px solid var(--gray-3)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-12)', margin: 0 }}>
              {t('logs.title')}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--gray-9)', margin: '4px 0 0' }}>
              {filteredLogs.length} / {logs.length} {t('logs.entries')}
              {logMaxEntries > 0 && ` / ${t('logs.max', { max: logMaxEntries })}`}
              {logPaused && <span style={{ color: 'var(--amber-9)', marginLeft: 6 }}>{t('logs.paused')}</span>}
              {logAutoRefresh !== 'off' && !logPaused && (
                <span style={{ color: 'var(--accent-9)', marginLeft: 6 }}>({logAutoRefresh})</span>
              )}
              {viewMode === 'grouped' && ` · ${groupedLogs.length} ${t('logs.grouped')}`}
            </p>
          </div>

          {/* View mode toggle */}
          <div
            style={{
              display: 'flex',
              border: '1px solid var(--gray-6)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {(['timeline', 'grouped'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  textTransform: 'capitalize',
                  letterSpacing: '0.03em',
                  border: 'none',
                  background: viewMode === mode ? 'var(--gray-3)' : 'transparent',
                  color: viewMode === mode ? 'var(--purple-10)' : 'var(--gray-9)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Expand/Collapse all (grouped mode only) */}
          {viewMode === 'grouped' && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={expandAll}
                style={{ ...btnStyle, fontSize: 11, padding: '3px 8px' }}
                title="Expand all groups"
              >
                ▼ {t('logs.expandAll')}
              </button>
              <button
                onClick={collapseAll}
                style={{ ...btnStyle, fontSize: 11, padding: '3px 8px' }}
                title="Collapse all groups"
              >
                ▲ {t('logs.collapseAll')}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Auto-refresh interval */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--gray-9)', fontSize: 11, fontWeight: 500 }}>Refresh:</span>
            <Select.Root value={logAutoRefresh} onValueChange={(v) => setLogAutoRefresh(v as typeof logAutoRefresh)} size="1">
              <Select.Trigger variant="soft" placeholder="Refresh" />
              <Select.Content>
                <Select.Item value="off">Off</Select.Item>
                <Select.Item value="1s">1s</Select.Item>
                <Select.Item value="5s">5s</Select.Item>
                <Select.Item value="10s">10s</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          {/* Pause / Resume button */}
          <button
            onClick={toggleLogPause}
            style={{
              ...btnStyle,
              color: logPaused ? 'var(--amber-9)' : 'var(--gray-11)',
              borderColor: logPaused ? 'transparent' : 'var(--gray-6)',
              background: logPaused ? 'var(--amber-3)' : 'transparent',
            }}
            title={logPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
          >
            {logPaused ? `▶ ${t('logs.resume')}` : `⏸ ${t('logs.pause')}`}
          </button>

          {/* Max entries */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--gray-9)', fontSize: 11, fontWeight: 500 }}>Max:</span>
            <Select.Root
              value={String(logMaxEntries)}
              onValueChange={(v) => setLogMaxEntries(v === '0' ? 0 : Number(v))}
              size="1"
            >
              <Select.Trigger variant="soft" placeholder="Max" />
              <Select.Content>
                <Select.Item value="100">100</Select.Item>
                <Select.Item value="500">500</Select.Item>
                <Select.Item value="1000">1000</Select.Item>
                <Select.Item value="0">Unlimited</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--gray-6)' }} />

          {/* Clear button */}
          <button
            onClick={() => clearLogsFromApi()}
            style={btnStyle}
            title="Clear logs"
          >
            ✕ {t('logs.clear')}
          </button>
          {/* Export button */}
          <button
            onClick={() => exportLogs(filteredLogs)}
            style={btnStyle}
            title="Export logs as JSON"
          >
            ↓ {t('logs.export')}
          </button>
        </div>
      </div>

      {/* Filters toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 4px',
          borderBottom: '1px solid var(--gray-3)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {/* Level toggles */}
        <LevelToggle
          levels={['info', 'warn', 'error', 'debug']}
          activeLevels={activeLevels}
          onToggle={toggleLevel}
        />

        <div style={{ width: 1, height: 24, background: 'var(--gray-6)' }} />

        {/* Source select (Radix) */}
        <Select.Root value={sourceFilter} onValueChange={setSourceFilter} size="1">
          <Select.Trigger variant="soft" placeholder="Source" />
          <Select.Content>
            <Select.Item value="all">All sources</Select.Item>
            {sources.map((src) => (
              <Select.Item key={src} value={src}>{src}</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>

        <div style={{ width: 1, height: 24, background: 'var(--gray-6)' }} />

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 360 }}>
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--gray-8)',
              fontSize: 13,
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
          <input
            type="text"
            placeholder={t('logs.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '5px 10px 5px 28px',
              fontSize: 12,
              fontFamily: 'inherit',
              color: 'var(--gray-12)',
              background: 'var(--gray-1)',
              border: '1px solid var(--gray-6)',
              borderRadius: 6,
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent-9)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--gray-6)')}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--gray-9)',
                cursor: 'pointer',
                fontSize: 14,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            height: '100%',
            overflowY: 'auto',
            background: 'var(--gray-1)',
          }}
        >
          {filteredLogs.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--gray-8)',
                fontSize: 13,
                fontFamily: MONO,
              }}
            >
              {logs.length === 0 ? t('logs.noLogs') : t('logs.noLogsFiltered')}
            </div>
          ) : viewMode === 'timeline' ? (
            filteredLogs.map((entry) => (
              <LogRow key={entry.id} entry={entry} searchTerm={searchTerm} />
            ))
          ) : (
            groupedLogs.map((group) => (
              <LogGroupHeader
                key={group.taskId}
                group={group}
                expanded={expandedGroups.has(group.taskId)}
                onToggle={() => toggleGroup(group.taskId)}
                searchTerm={searchTerm}
              />
            ))
          )}
        </div>

        {/* Jump to bottom FAB */}
        {!autoScroll && (
          <button
            onClick={jumpToBottom}
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              padding: '6px 14px',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 600,
              color: 'var(--gray-12)',
              background: 'var(--gray-3)',
              border: '1px solid var(--accent-9)',
              borderRadius: 20,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              zIndex: 10,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--gray-3)';
            }}
          >
            ↓ Jump to bottom
          </button>
        )}
      </div>
    </div>

    {/* AI 错误诊断助手 */}
    <div style={{ width: 280, flexShrink: 0, overflow: 'auto', paddingTop: 16 }}>
      <ErrorDiagnoser />
    </div>
    </div>
  );
}

// ── Shared button style ────────────────────────────────────────────
const btnStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'inherit',
  color: 'var(--gray-11)',
  background: 'transparent',
  border: '1px solid var(--gray-6)',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'all 0.15s',
};
