import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { Select } from '@radix-ui/themes';
import { ChevronDownIcon, TrashIcon, ArrowDownIcon, DownloadIcon } from '@radix-ui/react-icons';
import { useAppStore } from '../stores/useAppStore';
import type { LogEntry } from '../types';

/* ── Level config: DEBUG=gray, INFO=blue, WARNING=yellow, ERROR=red */
const LEVEL_CONFIG: Record<LogEntry['level'], { color: string; bg: string; border: string }> = {
  debug: { color: 'var(--gray-10)', bg: 'var(--gray-3)', border: 'var(--gray-6)' },
  info:  { color: 'var(--blue-10)', bg: 'var(--blue-3)', border: 'var(--blue-6)' },
  warn:  { color: 'var(--amber-10)', bg: 'var(--amber-3)', border: 'var(--amber-6)' },
  error: { color: 'var(--red-10)', bg: 'var(--red-3)', border: 'var(--red-6)' },
};

const LEVEL_LABELS: Record<LogEntry['level'], string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
};

const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace";

/* ── Helpers ────────────────────────────────────────────────────── */
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

/* ── Log Row with expandable metadata ──────────────────────────── */
function LogRow({ entry, searchTerm }: { entry: LogEntry; searchTerm: string }) {
  const cfg = LEVEL_CONFIG[entry.level];
  const [expanded, setExpanded] = useState(false);

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

  const hasMeta = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <div>
      <div
        onClick={() => hasMeta && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '6px 12px',
          fontFamily: MONO,
          fontSize: 12,
          lineHeight: 1.6,
          borderBottom: '1px solid var(--gray-6)',
          cursor: hasMeta ? 'pointer' : 'default',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-3)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Timestamp */}
        <span style={{ color: 'var(--gray-9)', flexShrink: 0, width: 70, fontVariantNumeric: 'tabular-nums' }}>
          {formatTimestamp(entry.timestamp)}
        </span>

        {/* Level badge */}
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700,
          padding: '1px 7px', borderRadius: 4,
          color: cfg.color, background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          minWidth: 52, textAlign: 'center',
        }}>
          {LEVEL_LABELS[entry.level]}
        </span>

        {/* Source */}
        <span style={{
          flexShrink: 0, color: 'var(--purple-10)', fontWeight: 600,
          minWidth: 80, maxWidth: 120,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          [{entry.source}]
        </span>

        {/* Message */}
        <span style={{ color: 'var(--gray-12)', flex: 1, wordBreak: 'break-word' }}>
          {highlight(entry.message)}
        </span>

        {/* Expand indicator */}
        {hasMeta && (
          <span style={{
            flexShrink: 0, fontSize: 10, color: 'var(--gray-9)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}>
            ▾
          </span>
        )}
      </div>

      {/* Expanded metadata */}
      {expanded && hasMeta && (
        <div style={{
          padding: '8px 12px 8px 92px',
          fontFamily: MONO, fontSize: 11, lineHeight: 1.5,
          color: 'var(--gray-11)', background: 'var(--gray-3)',
          borderBottom: '1px solid var(--gray-6)',
        }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LogViewer
   ═══════════════════════════════════════════════════════════════════ */
export default function LogViewer() {
  const logs = useAppStore((s) => s.logs);
  const [activeLevels, setActiveLevels] = useState<Set<LogEntry['level']>>(
    new Set(['info', 'warn', 'error', 'debug']),
  );
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Unique sources ──────────────────────────────────────── */
  const sources = useMemo(() => {
    const set = new Set(logs.map((l) => l.source));
    return Array.from(set).sort();
  }, [logs]);

  /* ── Filtered logs ───────────────────────────────────────── */
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!activeLevels.has(log.level)) return false;
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
      if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [logs, activeLevels, sourceFilter, searchTerm]);

  /* ── Auto-scroll ─────────────────────────────────────────── */
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

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

  /* ── Level toggle ────────────────────────────────────────── */
  const toggleLevel = useCallback((level: LogEntry['level']) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        if (next.size > 1) next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  const clearLogs = useCallback(() => {
    useAppStore.setState({ logs: [] });
  }, []);

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 4px', borderBottom: '1px solid var(--gray-6)', flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-12)', margin: 0 }}>
            Log Viewer
          </h1>
          <p style={{ fontSize: 12, color: 'var(--gray-10)', margin: '4px 0 0' }}>
            {filteredLogs.length} of {logs.length} entries
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={clearLogs} style={btnStyle} title="Clear all logs">
            <TrashIcon width={13} height={13} /> Clear
          </button>
          <button onClick={() => exportLogs(filteredLogs)} style={btnStyle} title="Export as JSON">
            <DownloadIcon width={13} height={13} /> Export
          </button>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 4px', borderBottom: '1px solid var(--gray-6)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Level toggles */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['debug', 'info', 'warn', 'error'] as LogEntry['level'][]).map((level) => {
            const active = activeLevels.has(level);
            const cfg = LEVEL_CONFIG[level];
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  fontFamily: 'inherit', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  border: `1px solid ${active ? cfg.color : 'var(--gray-6)'}`,
                  borderRadius: 6,
                  background: active ? cfg.bg : 'transparent',
                  color: active ? cfg.color : 'var(--gray-10)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {LEVEL_LABELS[level]}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--gray-6)' }} />

        {/* Source filter */}
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

        {/* Search box */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 360 }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--gray-8)',
            fontSize: 13, pointerEvents: 'none',
          }}>
            ⌕
          </span>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '5px 10px 5px 28px',
              fontSize: 12, fontFamily: 'inherit',
              color: 'var(--gray-12)', background: 'var(--gray-1)',
              border: '1px solid var(--gray-6)', borderRadius: 6,
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--status-running)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--gray-6)')}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{
              position: 'absolute', right: 8, top: '50%',
              transform: 'translateY(-50%)', background: 'none',
              border: 'none', color: 'var(--gray-10)', cursor: 'pointer',
              fontSize: 14, padding: 0, lineHeight: 1,
            }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Log entries ─────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ height: '100%', overflowY: 'auto', background: 'var(--gray-1)' }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--gray-8)', fontSize: 13, fontFamily: MONO,
            }}>
              {logs.length === 0 ? 'No logs — cleared' : 'No logs match current filters'}
            </div>
          ) : (
            filteredLogs.map((entry) => (
              <LogRow key={entry.id} entry={entry} searchTerm={searchTerm} />
            ))
          )}
        </div>

        {/* Auto-scroll / Jump to bottom FAB */}
        {!autoScroll && (
          <button onClick={jumpToBottom} style={{
            position: 'absolute', bottom: 16, right: 16,
            padding: '6px 14px', fontSize: 12, fontFamily: 'inherit',
            fontWeight: 600, color: 'var(--gray-12)',
            background: 'var(--gray-3)', border: '1px solid var(--status-running)',
            borderRadius: 20, cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            display: 'flex', alignItems: 'center', gap: 6,
            zIndex: 10, transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--status-running)'; e.currentTarget.style.color = 'var(--gray-1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gray-3)'; e.currentTarget.style.color = 'var(--gray-12)'; }}
          >
            <ArrowDownIcon width={12} height={12} /> Jump to bottom
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Shared button style ────────────────────────────────────────── */
const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '4px 12px', fontSize: 12, fontWeight: 500,
  fontFamily: 'inherit', color: 'var(--gray-11)',
  background: 'transparent', border: '1px solid var(--gray-6)',
  borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
};
