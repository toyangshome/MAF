import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Progress from '@radix-ui/react-progress';
import { useAppStore } from '../../stores/useAppStore';
import type { Task, Agent, LogEntry } from '../../types';
import CommentPanel from '../Comments/CommentPanel';
import {
  Cross2Icon,
  ClockIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  PlayIcon,
  PersonIcon,
  LightningBoltIcon,
  ArrowRightIcon,
  LockClosedIcon,
  Link2Icon,
  ChatBubbleIcon,
} from '@radix-ui/react-icons';

/* ─── constants ─────────────────────────────────────────────────────── */

const PANEL_WIDTH = 400;

const STATUS_CONFIG: Record<
  Task['status'],
  { color: string; bg: string; label: string; icon: React.ReactNode }
> = {
  pending:   { color: 'var(--gray-11)',   bg: 'var(--gray-4)',    label: 'Pending',   icon: <ClockIcon width={14} height={14} /> },
  running:   { color: 'var(--blue-11)',   bg: 'var(--blue-4)',    label: 'Running',   icon: <PlayIcon width={14} height={14} /> },
  completed: { color: 'var(--green-11)',  bg: 'var(--green-4)',   label: 'Completed', icon: <CheckCircledIcon width={14} height={14} /> },
  failed:    { color: 'var(--red-11)',    bg: 'var(--red-4)',     label: 'Failed',    icon: <CrossCircledIcon width={14} height={14} /> },
  blocked:   { color: 'var(--orange-11)', bg: 'var(--orange-4)',  label: 'Blocked',   icon: <LockClosedIcon width={14} height={14} /> },
};

const AGENT_STATUS_ICON: Record<Agent['status'], React.ReactNode> = {
  idle:    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gray-8)', display: 'inline-block' }} />,
  running: <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue-9)', display: 'inline-block', animation: 'maf-pulse 1.2s ease-in-out infinite' }} />,
  waiting: <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--yellow-9)', display: 'inline-block' }} />,
  done:    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-9)', display: 'inline-block' }} />,
  error:   <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red-9)', display: 'inline-block' }} />,
};

/* ─── pulse + slide keyframes ───────────────────────────────────────── */

const DETAIL_ANIM_CSS = `
@keyframes maf-slide-in-right{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes maf-progress-indeterminate{
  0%{transform:translateX(-100%)}
  100%{transform:translateX(200%)}
}
`;
if (typeof document !== 'undefined' && !document.getElementById('maf-detail-anim')) {
  const s = document.createElement('style');
  s.id = 'maf-detail-anim';
  s.textContent = DETAIL_ANIM_CSS;
  document.head.appendChild(s);
}

/* ─── helpers ───────────────────────────────────────────────────────── */

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso; }
}

function formatDuration(start: string, end?: string) {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ${rem}s`;
}

function getLogLevelColor(level: LogEntry['level']) {
  switch (level) {
    case 'error': return 'var(--red-11)';
    case 'warn':  return 'var(--yellow-11)';
    case 'debug': return 'var(--gray-9)';
    default:      return 'var(--gray-11)';
  }
}

function getLogLevelBg(level: LogEntry['level']) {
  switch (level) {
    case 'error': return 'var(--red-3)';
    case 'warn':  return 'var(--yellow-3)';
    default:      return 'transparent';
  }
}

/** Extract current phase from log message (orchestrator progress logs) */
function extractPhase(logs: LogEntry[]): string | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const msg = logs[i].message;
    // Pattern: "[task-id] phase: detail"
    const match = msg.match(/\]\s*([^:]+):/);
    if (match) return match[1].trim();
    // Pattern: contains "phase" keyword
    if (msg.toLowerCase().includes('phase')) {
      const phaseMatch = msg.match(/phase[:\s]+([^.]+)/i);
      if (phaseMatch) return phaseMatch[1].trim();
    }
  }
  return null;
}

/* ─── SubComponents ─────────────────────────────────────────────────── */

function StatusBadge({ status, size = 'md' }: { status: Task['status']; size?: 'sm' | 'md' }) {
  const cfg = STATUS_CONFIG[status];
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? '11px' : '12px';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding,
        borderRadius: '9999px',
        fontSize,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        animation: status === 'running' ? 'maf-pulse 1.8s ease-in-out infinite' : undefined,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function ProgressIndicator({ task, logs }: { task: Task; logs: LogEntry[] }) {
  const phase = extractPhase(logs);

  if (task.status === 'completed') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Progress.Root
          style={{
            position: 'relative',
            height: 6,
            width: '100%',
            borderRadius: 9999,
            background: 'var(--gray-4)',
            overflow: 'hidden',
          }}
        >
          <Progress.Indicator
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--green-9)',
              borderRadius: 9999,
              transition: 'width 0.3s ease',
            }}
          />
        </Progress.Root>
        <span style={{ fontSize: '11px', color: 'var(--green-11)', fontWeight: 600, flexShrink: 0 }}>100%</span>
      </div>
    );
  }

  if (task.status === 'failed') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Progress.Root
          style={{
            position: 'relative',
            height: 6,
            width: '100%',
            borderRadius: 9999,
            background: 'var(--gray-4)',
            overflow: 'hidden',
          }}
        >
          <Progress.Indicator
            style={{
              width: '50%',
              height: '100%',
              background: 'var(--red-9)',
              borderRadius: 9999,
            }}
          />
        </Progress.Root>
        <span style={{ fontSize: '11px', color: 'var(--red-11)', fontWeight: 600, flexShrink: 0 }}>Failed</span>
      </div>
    );
  }

  if (task.status === 'pending') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Progress.Root
          style={{
            position: 'relative',
            height: 6,
            width: '100%',
            borderRadius: 9999,
            background: 'var(--gray-4)',
            overflow: 'hidden',
          }}
        >
          <Progress.Indicator
            style={{
              width: '0%',
              height: '100%',
              background: 'var(--gray-8)',
              borderRadius: 9999,
            }}
          />
        </Progress.Root>
        <span style={{ fontSize: '11px', color: 'var(--gray-10)', fontWeight: 600, flexShrink: 0 }}>Waiting</span>
      </div>
    );
  }

  // Running: indeterminate progress
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Progress.Root
          style={{
            position: 'relative',
            height: 6,
            width: '100%',
            borderRadius: 9999,
            background: 'var(--gray-4)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '40%',
              height: '100%',
              background: 'var(--blue-9)',
              borderRadius: 9999,
              animation: 'maf-progress-indeterminate 1.8s ease-in-out infinite',
            }}
          />
        </Progress.Root>
        <span style={{ fontSize: '11px', color: 'var(--blue-11)', fontWeight: 600, flexShrink: 0 }}>
          <LightningBoltIcon width={10} height={10} style={{ verticalAlign: 'middle' }} /> Running
        </span>
      </div>
      {phase && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'var(--blue-3)',
            marginTop: 4,
          }}
        >
          <ArrowRightIcon width={12} height={12} color="var(--blue-11)" />
          <span style={{ fontSize: '11px', color: 'var(--blue-11)', fontWeight: 500 }}>{phase}</span>
        </div>
      )}
    </div>
  );
}

function AgentList({ taskAgents, agents }: { taskAgents: string[]; agents: Agent[] }) {
  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    agents.forEach((a) => m.set(a.id, a));
    return m;
  }, [agents]);

  if (taskAgents.length === 0) {
    return <span style={{ fontSize: '12px', color: 'var(--gray-9)' }}>No agents assigned</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {taskAgents.map((id) => {
        const agent = agentMap.get(id);
        const name = agent?.name ?? id;
        const status = agent?.status ?? 'idle';
        return (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'var(--gray-3)',
            }}
          >
            {AGENT_STATUS_ICON[status]}
            <span style={{ fontSize: '12px', color: 'var(--gray-12)', fontWeight: 500 }}>{name}</span>
            <span style={{ fontSize: '10px', color: 'var(--gray-9)', marginLeft: 'auto', textTransform: 'capitalize' }}>
              {status}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LogList({ logs }: { logs: LogEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--gray-9)', fontSize: '12px' }}>
        No logs for this task yet.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        maxHeight: 280,
        overflowY: 'auto',
        borderRadius: 6,
        border: '1px solid var(--gray-5)',
        background: 'var(--gray-1)',
      }}
    >
      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            padding: '6px 10px',
            borderBottom: '1px solid var(--gray-4)',
            background: getLogLevelBg(log.level),
            fontSize: '11px',
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ color: 'var(--gray-8)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0, fontSize: '10px' }}>
              {new Date(log.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span
              style={{
                color: getLogLevelColor(log.level),
                fontWeight: 600,
                textTransform: 'uppercase',
                fontSize: '9px',
                flexShrink: 0,
              }}
            >
              {log.level}
            </span>
            <span style={{ color: 'var(--gray-8)', flexShrink: 0, fontSize: '10px' }}>[{log.source}]</span>
          </div>
          <div
            style={{
              color: 'var(--gray-12)',
              fontFamily: 'var(--font-mono, monospace)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginTop: 2,
              paddingLeft: 4,
            }}
          >
            {log.message}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── SectionLabel ──────────────────────────────────────────────────── */

function SectionLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--gray-10)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 8,
      }}
    >
      {icon}
      {children}
    </div>
  );
}

/* ─── Main: TaskDetailPanel ─────────────────────────────────────────── */

export default function TaskDetailPanel({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const task = useAppStore((s) => s.tasks.find((t) => t.id === taskId));
  const agents = useAppStore((s) => s.agents);
  const logs = useAppStore((s) => s.logs);

  // Live duration tick for running tasks
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (task?.status !== 'running') return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [task?.status]);

  // Filter logs related to this task
  const taskLogs = useMemo(() => {
    return logs.filter((l) => {
      if (l.metadata?.task_id === taskId) return true;
      if (l.message.includes(taskId)) return true;
      return false;
    });
  }, [logs, taskId]);

  if (!task) return null;

  const duration = formatDuration(task.createdAt, task.completedAt);

  return (
    <div
      style={{
        width: PANEL_WIDTH,
        minWidth: PANEL_WIDTH,
        height: '100%',
        borderLeft: '1px solid var(--gray-6)',
        background: 'var(--gray-2)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'maf-slide-in-right 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--gray-6)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-12)' }}>Task Details</span>
          <StatusBadge status={task.status} />
        </div>
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--gray-9)',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Cross2Icon width={16} height={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Task Info */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Task Info</SectionLabel>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--gray-12)',
              lineHeight: 1.6,
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--gray-3)',
              wordBreak: 'break-word',
            }}
          >
            {task.description}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <InfoRow label="Task ID">
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}>{task.id}</span>
            </InfoRow>
            <InfoRow label="Created">{formatTime(task.createdAt)}</InfoRow>
            {task.completedAt && <InfoRow label="Completed">{formatTime(task.completedAt)}</InfoRow>}
            <InfoRow label="Duration">{duration}</InfoRow>
            {task.lastModifiedBy && (
              <InfoRow label="Modified by">
                <span style={{ fontWeight: 500 }}>{task.lastModifiedBy}</span>
              </InfoRow>
            )}
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel icon={<LightningBoltIcon width={12} height={12} />}>Progress</SectionLabel>
          <ProgressIndicator task={task} logs={taskLogs} />
        </div>

        {/* Dependencies */}
        {task.dependsOn && task.dependsOn.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel icon={<Link2Icon width={12} height={12} />}>
              Dependencies ({task.dependsOn.length})
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {task.dependsOn.map((depId) => {
                // Look up dep task from store
                const depTask = useAppStore.getState().tasks.find((t) => t.id === depId);
                const depCfg = depTask ? STATUS_CONFIG[depTask.status] : null;
                return (
                  <div
                    key={depId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: 'var(--gray-3)',
                    }}
                  >
                    {depCfg ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: depCfg.bg,
                          color: depCfg.color,
                          flexShrink: 0,
                        }}
                      >
                        {depCfg.icon}
                      </span>
                    ) : (
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--gray-5)', flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--gray-12)' }}>
                        {depId}
                      </div>
                      {depTask && (
                        <div style={{ fontSize: '10px', color: 'var(--gray-9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {depTask.description.length > 50 ? depTask.description.slice(0, 50) + '...' : depTask.description}
                        </div>
                      )}
                    </div>
                    {depCfg && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: depCfg.color,
                          background: depCfg.bg,
                          padding: '2px 6px',
                          borderRadius: 9999,
                          flexShrink: 0,
                        }}
                      >
                        {depCfg.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Blocked indicator */}
            {task.status === 'blocked' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'var(--orange-3)',
                  border: '1px solid var(--orange-5)',
                  marginTop: 8,
                }}
              >
                <LockClosedIcon width={14} height={14} color="var(--orange-11)" />
                <span style={{ fontSize: '12px', color: 'var(--orange-11)', fontWeight: 600 }}>
                  This task is blocked by unfinished dependencies
                </span>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {task.result && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Result</SectionLabel>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: task.status === 'failed' ? 'var(--red-3)' : 'var(--green-3)',
                border: `1px solid ${task.status === 'failed' ? 'var(--red-5)' : 'var(--green-5)'}`,
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontSize: '11px',
                  color: task.status === 'failed' ? 'var(--red-11)' : 'var(--green-11)',
                  fontFamily: 'var(--font-mono, monospace)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                }}
              >
                {task.result}
              </pre>
            </div>
          </div>
        )}

        {/* Agents */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel icon={<PersonIcon width={12} height={12} />}>Assigned Agents</SectionLabel>
          <AgentList taskAgents={task.agents} agents={agents} />
        </div>

        {/* Logs */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Execution Logs ({taskLogs.length})</SectionLabel>
          <LogList logs={taskLogs} />
        </div>

        {/* Comments */}
        <div>
          <SectionLabel icon={<ChatBubbleIcon width={12} height={12} />}>Discussion</SectionLabel>
          <CommentPanel taskId={taskId} />
        </div>
      </div>
    </div>
  );
}

/* ─── InfoRow helper ────────────────────────────────────────────────── */

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px' }}>
      <span style={{ color: 'var(--gray-9)', minWidth: 70, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--gray-12)' }}>{children}</span>
    </div>
  );
}
