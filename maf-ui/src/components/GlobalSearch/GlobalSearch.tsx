import React, { useState, useMemo, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MagnifyingGlassIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useAppStore } from '../../stores/useAppStore';

interface SearchResult {
  type: 'agent' | 'task' | 'log' | 'workflow';
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  page: 'workflow' | 'logs' | 'tasks';
}

const MAX_RESULTS_PER_TYPE = 5;

function matches(haystack: string | undefined, needle: string): boolean {
  return !!haystack && haystack.toLowerCase().includes(needle);
}

function useSearchResults(query: string): SearchResult[] {
  const agents = useAppStore((s) => s.agents);
  const tasks = useAppStore((s) => s.tasks);
  const logs = useAppStore((s) => s.logs);
  const workflowNodes = useAppStore((s) => s.workflowNodes);

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: SearchResult[] = [];

    // Agents
    let agentCount = 0;
    for (const a of agents) {
      if (agentCount >= MAX_RESULTS_PER_TYPE) break;
      if (matches(a.name, q) || matches(a.type, q) || matches(a.description, q)) {
        results.push({
          type: 'agent',
          id: a.id,
          title: a.name,
          subtitle: `${a.type} · ${a.status}`,
          icon: '🎯',
          page: 'workflow',
        });
        agentCount++;
      }
    }

    // Tasks
    let taskCount = 0;
    for (const t of tasks) {
      if (taskCount >= MAX_RESULTS_PER_TYPE) break;
      if (matches(t.description, q) || (t.result ? matches(t.result, q) : false)) {
        results.push({
          type: 'task',
          id: t.id,
          title: t.description.slice(0, 80),
          subtitle: `${t.status} · ${t.createdAt?.slice(0, 16) ?? ''}`,
          icon: '📋',
          page: 'tasks',
        });
        taskCount++;
      }
    }

    // Logs
    let logCount = 0;
    for (const l of logs) {
      if (logCount >= MAX_RESULTS_PER_TYPE) break;
      if (matches(l.message, q) || matches(l.source, q)) {
        results.push({
          type: 'log',
          id: l.id,
          title: l.message.slice(0, 80),
          subtitle: `${l.source} · ${l.level} · ${l.timestamp?.slice(0, 16) ?? ''}`,
          icon: '📝',
          page: 'logs',
        });
        logCount++;
      }
    }

    // Workflows
    let wfCount = 0;
    for (const w of workflowNodes) {
      if (wfCount >= MAX_RESULTS_PER_TYPE) break;
      if (matches(w.label, q) || matches(w.agentType, q)) {
        results.push({
          type: 'workflow',
          id: w.id,
          title: w.label,
          subtitle: `${w.agentType} · ${w.status}`,
          icon: '🔄',
          page: 'workflow',
        });
        wfCount++;
      }
    }

    return results;
  }, [query, agents, tasks, logs, workflowNodes]);
}

/* ───────────────────────────────────────────────────────────────── */

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const setPage = useAppStore((s) => s.setPage);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const selectTask = useAppStore((s) => s.selectTask);

  const results = useSearchResults(query);

  // Group by type
  const grouped = useMemo(() => {
    const map: Record<string, SearchResult[]> = { agent: [], task: [], log: [], workflow: [] };
    for (const r of results) {
      map[r.type].push(r);
    }
    return map;
  }, [results]);

  const typeLabels: Record<string, string> = {
    agent: 'Agents',
    task: 'Tasks',
    log: 'Logs',
    workflow: 'Workflows',
  };

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setPage(result.page);
      if (result.type === 'agent') selectAgent(result.id);
      if (result.type === 'task') selectTask(result.id);
    },
    [setPage, selectAgent, selectTask],
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* Trigger button – used by Header */}
      <Dialog.Trigger asChild>
        <button
          aria-label="Search (Cmd+K)"
          title="Search (Cmd+K)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--gray-3)',
            border: '1px solid var(--gray-6)',
            borderRadius: '6px',
            padding: '4px 10px',
            cursor: 'pointer',
            color: 'var(--gray-10)',
            gap: '6px',
            fontSize: '12px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gray-4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--gray-3)';
          }}
        >
          <MagnifyingGlassIcon width={14} height={14} />
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '4px',
              background: 'var(--gray-5)',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--gray-11)',
            }}
          >
            K
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1000,
          }}
        />

        {/* Content */}
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '18%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '560px',
            maxWidth: '90vw',
            maxHeight: '60vh',
            background: 'var(--gray-2)',
            border: '1px solid var(--gray-6)',
            borderRadius: '12px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              gap: '10px',
              borderBottom: '1px solid var(--gray-6)',
            }}
          >
            <MagnifyingGlassIcon
              width={18}
              height={18}
              style={{ color: 'var(--gray-9)', flexShrink: 0 }}
            />
            <Dialog.Title style={{ display: 'none' }}>Global Search</Dialog.Title>
            <input
              autoFocus
              placeholder="Search agents, tasks, logs, workflows..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                color: 'var(--gray-12)',
              }}
            />
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--gray-9)',
                  padding: '2px',
                  display: 'flex',
                }}
              >
                <Cross2Icon width={16} height={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {!query.trim() && (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--gray-9)',
                  fontSize: '13px',
                }}
              >
                Type to search across all modules...
              </div>
            )}

            {query.trim() && results.length === 0 && (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--gray-9)',
                  fontSize: '13px',
                }}
              >
                No results found.
              </div>
            )}

            {(['agent', 'task', 'log', 'workflow'] as const).map((type) => {
              const items = grouped[type];
              if (!items || items.length === 0) return null;
              return (
                <div key={type} style={{ marginBottom: '4px' }}>
                  <div
                    style={{
                      padding: '6px 16px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--gray-9)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {typeLabels[type]}
                  </div>
                  {items.map((r) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => handleSelect(r)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '8px 16px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.1s',
                        color: 'var(--gray-12)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--gray-4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>{r.icon}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: 'var(--gray-12)',
                          }}
                        >
                          {r.title}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--gray-9)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.subtitle}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--gray-6)',
              fontSize: '11px',
              color: 'var(--gray-8)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              <kbd style={kbdStyle}>Esc</kbd> to close
            </span>
            <span>
              <kbd style={kbdStyle}>{navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+K</kbd> to open
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: '1px 5px',
  borderRadius: '3px',
  background: 'var(--gray-4)',
  border: '1px solid var(--gray-6)',
  fontSize: '10px',
  fontFamily: 'monospace',
};

export default GlobalSearch;
