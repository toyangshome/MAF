import React, { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import type { Task } from '../../types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Select } from '../../components/ui/Select';
import TaskDetailPanel from './TaskDetailPanel';
import { TaskSuggester } from '../AIAssistant';
import { useTranslation } from '../../i18n';
import { pulseAnimation } from '../../styles/components';
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  PlayIcon,
  PersonIcon,
  RocketIcon,
  ReloadIcon,
  TrashIcon,
  Cross1Icon,
  UpdateIcon,
  EyeOpenIcon,
  LockClosedIcon,
  Link2Icon,
  ListBulletIcon,
} from '@radix-ui/react-icons';

/* ─── constants & helpers ─────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  Task['status'],
  { color: string; bg: string; label: string; icon: React.ReactNode }
> = {
  pending:   { color: 'var(--gray-11)', bg: 'var(--gray-4)',  label: 'Pending',   icon: <ClockIcon width={12} height={12} /> },
  running:   { color: 'var(--blue-11)', bg: 'var(--blue-4)',  label: 'Running',   icon: <PlayIcon width={12} height={12} /> },
  completed: { color: 'var(--green-11)',bg: 'var(--green-4)', label: 'Completed', icon: <CheckCircledIcon width={12} height={12} /> },
  failed:    { color: 'var(--red-11)',  bg: 'var(--red-4)',   label: 'Failed',    icon: <CrossCircledIcon width={12} height={12} /> },
  blocked:   { color: 'var(--orange-11)',bg: 'var(--orange-4)', label: 'Blocked', icon: <LockClosedIcon width={12} height={12} /> },
};

const STRATEGIES = ['sequential', 'parallel', 'hierarchical', 'adaptive'] as const;
type Strategy = (typeof STRATEGIES)[number];

const MODEL_OPTIONS = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet', 'claude-haiku', 'deepseek-v3'];

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function elapsed(start: string, end?: string) {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/* ─── StatusBadge ─────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: Task['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      role="status"
      aria-label={`状态: ${cfg.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        animation: status === 'running' ? pulseAnimation() : undefined,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

/* ─── TaskCard (with checkbox) ────────────────────────────────────── */

function TaskCard({
  task,
  agentMap,
  selected,
  onToggleSelect,
  onViewDetail,
  detailActive,
  dependencies,
  isBlocked,
  onSelectTask,
}: {
  task: Task;
  agentMap: Map<string, string>;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onViewDetail: (id: string) => void;
  detailActive: boolean;
  dependencies: Task[];
  isBlocked: boolean;
  onSelectTask: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDepTooltip, setShowDepTooltip] = useState(false);
  const agentNames = task.agents.map((id) => agentMap.get(id) ?? id).join(', ');

  return (
    <div
      role="listitem"
      aria-label={`任务: ${task.description.slice(0, 50)}, 状态: ${STATUS_CONFIG[task.status].label}`}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '14px 16px',
        borderRadius: '8px',
        border: `1px solid ${selected ? 'var(--accent-7)' : expanded ? 'var(--accent-7)' : 'var(--gray-6)'}`,
        background: selected ? 'var(--accent-3)' : isBlocked ? 'var(--gray-3)' : 'var(--gray-2)',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
        boxShadow: expanded ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
        opacity: isBlocked ? 0.7 : 1,
      }}
    >
      {/* checkbox */}
      <div
        style={{
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(task.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`选择任务: ${task.description.slice(0, 40)}`}
          style={{
            width: 16,
            height: 16,
            cursor: 'pointer',
            accentColor: 'var(--accent-9)',
          }}
        />
      </div>

      {/* card body */}
      <div
        onClick={() => setExpanded((p) => !p)}
        style={{
          flex: 1,
          minWidth: 0,
          cursor: 'pointer',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <StatusBadge status={task.status} />
              {/* dependency badge */}
              {dependencies.length > 0 && (
                <div
                  style={{ position: 'relative', display: 'inline-flex' }}
                  onMouseEnter={() => setShowDepTooltip(true)}
                  onMouseLeave={() => setShowDepTooltip(false)}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 7px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isBlocked ? 'var(--orange-11)' : 'var(--gray-11)',
                      background: isBlocked ? 'var(--orange-3)' : 'var(--gray-4)',
                      cursor: 'pointer',
                      lineHeight: '18px',
                    }}
                  >
                    <Link2Icon width={10} height={10} />
                    {dependencies.length} dep{dependencies.length > 1 ? 's' : ''}
                  </span>
                  {/* tooltip */}
                  {showDepTooltip && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: 4,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'var(--gray-1)',
                        border: '1px solid var(--gray-6)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                        zIndex: 100,
                        minWidth: 200,
                        maxWidth: 320,
                      }}
                    >
                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--gray-10)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Depends on
                      </div>
                      {dependencies.map((dep) => {
                        const depCfg = STATUS_CONFIG[dep.status];
                        return (
                          <div
                            key={dep.id}
                            onClick={(e) => { e.stopPropagation(); onSelectTask(dep.id); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '4px 6px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              marginBottom: 2,
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-3)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: depCfg.bg,
                                color: depCfg.color,
                                flexShrink: 0,
                              }}
                            >
                              {depCfg.icon}
                            </span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '11px', color: 'var(--gray-12)', fontFamily: 'var(--font-mono, monospace)' }}>
                                {dep.id}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--gray-9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {dep.description.length > 50 ? dep.description.slice(0, 50) + '...' : dep.description}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <span style={{ fontSize: '11px', color: 'var(--gray-9)', marginLeft: 'auto', flexShrink: 0 }}>
                {formatTime(task.createdAt)}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                lineHeight: 1.5,
                color: isBlocked ? 'var(--gray-10)' : 'var(--gray-12)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: expanded ? 'normal' : 'nowrap',
              }}
            >
              {task.description}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onViewDetail(task.id); }}
              aria-label={`查看任务详情: ${task.description.slice(0, 30)}`}
              title="View details"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 6,
                border: detailActive ? '1px solid var(--accent-7)' : 'none',
                background: detailActive ? 'var(--accent-3)' : 'transparent',
                color: detailActive ? 'var(--accent-11)' : 'var(--gray-9)',
                cursor: 'pointer',
                padding: 0,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!detailActive) e.currentTarget.style.background = 'var(--gray-4)'; }}
              onMouseLeave={(e) => { if (!detailActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <EyeOpenIcon width={14} height={14} />
            </button>
            <span style={{ paddingTop: 2, color: 'var(--gray-9)' }}>
              {expanded ? <ChevronUpIcon width={16} height={16} /> : <ChevronDownIcon width={16} height={16} />}
            </span>
          </div>
        </div>

        {/* expanded details */}
        {expanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--gray-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* agents */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PersonIcon width={14} height={14} color="var(--gray-9)" />
                <span style={{ fontSize: '12px', color: 'var(--gray-9)' }}>Agents:</span>
                <span style={{ fontSize: '12px', color: 'var(--gray-11)' }}>{agentNames || '—'}</span>
              </div>
              {/* duration */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClockIcon width={14} height={14} color="var(--gray-9)" />
                <span style={{ fontSize: '12px', color: 'var(--gray-9)' }}>Duration:</span>
                <span style={{ fontSize: '12px', color: 'var(--gray-11)' }}>{elapsed(task.createdAt, task.completedAt)}</span>
              </div>
              {/* dependencies expanded */}
              {dependencies.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Link2Icon width={14} height={14} color="var(--gray-9)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--gray-9)', flexShrink: 0 }}>Deps:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {dependencies.map((dep) => (
                      <span
                        key={dep.id}
                        onClick={(e) => { e.stopPropagation(); onSelectTask(dep.id); }}
                        style={{
                          fontSize: '11px',
                          color: 'var(--accent-11)',
                          fontFamily: 'var(--font-mono, monospace)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {dep.id} ({STATUS_CONFIG[dep.status].label})
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* result */}
              {task.result && (
                <div
                  style={{
                    marginTop: 4,
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: task.status === 'failed' ? 'var(--red-3)' : 'var(--green-3)',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      fontSize: '11px',
                      color: task.status === 'failed' ? 'var(--red-11)' : 'var(--green-11)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {task.result}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── SubmitForm ──────────────────────────────────────────────────── */

function SubmitForm() {
  const submitTask = useAppStore((s) => s.submitTask);
  const { t } = useTranslation();

  const [description, setDescription] = useState('');
  const [maxIterations, setMaxIterations] = useState('10');
  const [strategy, setStrategy] = useState<Strategy>('sequential');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) return;

    setSubmitting(true);
    try {
      await submitTask(description.trim(), strategy, parseInt(maxIterations) || 10);
    } catch (err) {
      console.error('Task submission failed:', err);
    } finally {
      setDescription('');
      setSubmitting(false);
    }
  }, [description, maxIterations, strategy, submitTask]);

  return (
    <div
      style={{
        padding: '18px 20px',
        borderRadius: 10,
        border: '1px solid var(--gray-6)',
        background: 'var(--gray-2)',
        marginBottom: 20,
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <RocketIcon width={18} height={18} color="var(--accent-9)" />
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gray-12)' }}>{t('tasks.submitNewTask')}</span>
      </div>

      {/* textarea */}
      <textarea
        placeholder={t('tasks.taskPlaceholder')}
        aria-label="任务描述"
        value={description}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
        style={{
          width: '100%',
          minHeight: 80,
          padding: '10px 12px',
          borderRadius: 6,
          border: '1px solid var(--gray-6)',
          background: 'var(--gray-1)',
          color: 'var(--gray-12)',
          fontSize: '13px',
          lineHeight: 1.5,
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      {/* AI 任务描述建议 */}
      <TaskSuggester input={description} onSelect={setDescription} />

      {/* controls row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginTop: 14,
          flexWrap: 'wrap',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--gray-9)' }}>
          {t('tasks.strategy')}
          <div style={{ minWidth: 130 }}>
            <Select
              value={strategy}
              onValueChange={(v) => setStrategy(v as Strategy)}
              options={STRATEGIES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
            />
          </div>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--gray-9)' }}>
          {t('tasks.maxIterations')}
          <div style={{ minWidth: 70 }}>
            <Select
              value={maxIterations}
              onValueChange={setMaxIterations}
              options={['5', '10', '20', '50', '100'].map((v) => ({ value: v, label: v }))}
            />
          </div>
        </label>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleSubmit}
          disabled={!description.trim() || submitting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 18px',
            borderRadius: 6,
            border: 'none',
            background: description.trim() && !submitting ? 'var(--accent-9)' : 'var(--gray-5)',
            color: description.trim() && !submitting ? 'white' : 'var(--gray-9)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: description.trim() && !submitting ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s ease',
            minWidth: 120,
            justifyContent: 'center',
          }}
        >
          {submitting ? (
            <>
              <span
                style={{
                  width: 12,
                  height: 12,
                  border: '2px solid var(--gray-7)',
                  borderTopColor: 'var(--gray-12)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              {t('tasks.processing')}
            </>
          ) : (
            <>
              <PlusIcon width={14} height={14} /> {t('tasks.submitTask')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── TabButton ───────────────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: '6px 14px',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent-9)' : '2px solid transparent',
        background: 'transparent',
        color: active ? 'var(--gray-12)' : 'var(--gray-9)',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'color 0.1s, border-color 0.1s',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

/* ─── BatchToolbar ────────────────────────────────────────────────── */

type BatchAction = 'cancel' | 'retry' | 'delete';

interface BatchActionConfig {
  action: BatchAction;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: (count: number) => string;
}

const BATCH_ACTIONS: BatchActionConfig[] = [
  {
    action: 'cancel',
    label: 'Batch Cancel',
    icon: <Cross1Icon width={14} height={14} />,
    color: 'var(--orange-11)',
    bgColor: 'var(--orange-3)',
    description: (n) => `Set ${n} running task(s) to failed status?`,
  },
  {
    action: 'retry',
    label: 'Batch Retry',
    icon: <UpdateIcon width={14} height={14} />,
    color: 'var(--blue-11)',
    bgColor: 'var(--blue-3)',
    description: (n) => `Reset ${n} failed task(s) to pending for retry?`,
  },
  {
    action: 'delete',
    label: 'Batch Delete',
    icon: <TrashIcon width={14} height={14} />,
    color: 'var(--red-11)',
    bgColor: 'var(--red-3)',
    description: (n) => `Permanently delete ${n} selected task(s)? This cannot be undone.`,
  },
];

function BatchToolbar({
  count,
  onAction,
  t,
}: {
  count: number;
  onAction: (action: BatchAction) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid var(--accent-7)',
        background: 'var(--accent-2)',
        marginBottom: 12,
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-11)', flexShrink: 0 }}>
        {count} {t('tasks.taskSelected')}
      </span>
      <div style={{ flex: 1 }} />
      {BATCH_ACTIONS.map((cfg) => (
        <button
          key={cfg.action}
          onClick={() => onAction(cfg.action)}
          aria-label={`${cfg.label} (${count} 个任务)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 12px',
            borderRadius: 6,
            border: `1px solid ${cfg.color}33`,
            background: cfg.bgColor,
            color: cfg.color,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {cfg.icon}
          {cfg.label}
        </button>
      ))}
    </div>
  );
}

/* ─── DependencyTreeView ──────────────────────────────────────────── */

function DependencyTreeView({
  tasks,
  onSelectTask,
}: {
  tasks: Task[];
  onSelectTask: (id: string) => void;
}) {
  const { t } = useTranslation();
  const taskMap = useMemo(() => {
    const m = new Map<string, Task>();
    tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [tasks]);

  // Find root tasks (no dependencies)
  const rootTasks = useMemo(() => {
    return tasks.filter((t) => !t.dependsOn || t.dependsOn.length === 0);
  }, [tasks]);

  // Build children map: taskId -> tasks that depend on it
  const childrenMap = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (t.dependsOn) {
        t.dependsOn.forEach((depId) => {
          const arr = m.get(depId) || [];
          arr.push(t);
          m.set(depId, arr);
        });
      }
    });
    return m;
  }, [tasks]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(tasks.map((t) => t.id)));

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function renderTask(task: Task, depth: number) {
    const children = childrenMap.get(task.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(task.id);
    const cfg = STATUS_CONFIG[task.status];

    return (
      <div key={task.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            paddingLeft: 12 + depth * 24,
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'background 0.1s',
            marginBottom: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          onClick={() => onSelectTask(task.id)}
        >
          {/* expand/collapse toggle */}
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
              aria-label={isExpanded ? '收起子任务' : '展开子任务'}
              aria-expanded={isExpanded}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: 4,
                border: 'none',
                background: 'transparent',
                color: 'var(--gray-9)',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
            >
              {isExpanded ? <ChevronDownIcon width={12} height={12} /> : <ChevronUpIcon width={12} height={12} style={{ transform: 'rotate(-90deg)' }} />}
            </button>
          ) : (
            <span style={{ width: 18, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gray-7)' }} />
            </span>
          )}

          {/* status icon */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: cfg.bg,
              color: cfg.color,
              flexShrink: 0,
            }}
          >
            {cfg.icon}
          </span>

          {/* task id */}
          <span
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--gray-11)',
              flexShrink: 0,
            }}
          >
            {task.id}
          </span>

          {/* description */}
          <span
            style={{
              fontSize: '12px',
              color: task.status === 'blocked' ? 'var(--gray-10)' : 'var(--gray-12)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {task.description.length > 60 ? task.description.slice(0, 60) + '...' : task.description}
          </span>

          {/* dep count */}
          {task.dependsOn && task.dependsOn.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                color: 'var(--gray-9)',
                padding: '1px 6px',
                borderRadius: 9999,
                background: 'var(--gray-4)',
                flexShrink: 0,
              }}
            >
              {task.dependsOn.length} dep{task.dependsOn.length > 1 ? 's' : ''}
            </span>
          )}

          {/* status badge */}
          <StatusBadge status={task.status} />
        </div>

        {/* children */}
        {hasChildren && isExpanded && (
          <div>
            {children.map((child) => renderTask(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  if (rootTasks.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 0',
          gap: 10,
          color: 'var(--gray-8)',
        }}
      >
        <ListBulletIcon width={32} height={32} />
        <span style={{ fontSize: '13px', color: 'var(--gray-9)' }}>
          {t('tasks.noDependencyChains')}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid var(--gray-6)',
        background: 'var(--gray-2)',
        overflow: 'hidden',
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid var(--gray-6)',
          background: 'var(--gray-3)',
        }}
      >
        <Link2Icon width={14} height={14} color="var(--gray-10)" />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-11)' }}>
          {t('tasks.dependencyChains')}
        </span>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--gray-9)',
            padding: '1px 6px',
            borderRadius: 9999,
            background: 'var(--gray-4)',
            marginLeft: 'auto',
          }}
        >
          {tasks.filter((tk) => tk.dependsOn && tk.dependsOn.length > 0).length} {t('tasks.tasksWithDeps')}
        </span>
      </div>

      {/* tree */}
      <div style={{ padding: '6px 4px' }}>
        {rootTasks.map((task) => renderTask(task, 0))}
      </div>
    </div>
  );
}

/* ─── TaskPanel (main export) ─────────────────────────────────────── */

export default function TaskPanel() {
  const tasks = useAppStore((s) => s.tasks);
  const agents = useAppStore((s) => s.agents);
  const selectedTaskIds = useAppStore((s) => s.selectedTaskIds);
  const toggleTaskSelection = useAppStore((s) => s.toggleTaskSelection);
  const selectAllTasks = useAppStore((s) => s.selectAllTasks);
  const deselectAllTasks = useAppStore((s) => s.deselectAllTasks);
  const batchUpdateTasks = useAppStore((s) => s.batchUpdateTasks);
  const batchDeleteTasks = useAppStore((s) => s.batchDeleteTasks);
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'all' | Task['status'] | 'dependencies'>('all');
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: BatchAction | null;
    title: string;
    description: string;
    confirmColor: string;
    confirmLabel: string;
  }>({ open: false, action: null, title: '', description: '', confirmColor: '', confirmLabel: '' });

  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    agents.forEach((a) => m.set(a.id, a.name));
    return m;
  }, [agents]);

  // Pre-compute dependency maps for all tasks
  const depMap = useMemo(() => {
    const taskMap = new Map<string, Task>();
    tasks.forEach((t) => taskMap.set(t.id, t));
    const deps = new Map<string, Task[]>();
    const blocked = new Map<string, boolean>();
    tasks.forEach((t) => {
      if (t.dependsOn && t.dependsOn.length > 0) {
        const depTasks = t.dependsOn
          .map((id) => taskMap.get(id))
          .filter((d): d is Task => d !== undefined);
        deps.set(t.id, depTasks);
        blocked.set(t.id, depTasks.some((d) => d.status === 'pending' || d.status === 'running'));
      } else {
        deps.set(t.id, []);
        blocked.set(t.id, false);
      }
    });
    return { deps, blocked };
  }, [tasks]);

  const getTaskDeps = useCallback((taskId: string) => depMap.deps.get(taskId) || [], [depMap]);
  const isBlocked = useCallback((taskId: string) => depMap.blocked.get(taskId) ?? false, [depMap]);

  const filtered = useMemo(() => {
    const sorted = [...tasks].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (activeTab === 'all' || activeTab === 'dependencies') return sorted;
    return sorted.filter((t) => t.status === activeTab);
  }, [tasks, activeTab]);

  const filteredIds = useMemo(() => filtered.map((t) => t.id), [filtered]);

  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedTaskIds.has(id));
  const someSelected = filteredIds.some((id) => selectedTaskIds.has(id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      deselectAllTasks();
    } else {
      selectAllTasks(filteredIds);
    }
  }, [allSelected, filteredIds, selectAllTasks, deselectAllTasks]);

  const selectedCount = useMemo(
    () => filtered.filter((t) => selectedTaskIds.has(t.id)).length,
    [filtered, selectedTaskIds]
  );

  const openConfirmDialog = useCallback((action: BatchAction) => {
    const cfg = BATCH_ACTIONS.find((a) => a.action === action)!;
    setConfirmDialog({
      open: true,
      action,
      title: cfg.label,
      description: cfg.description(selectedCount),
      confirmColor: action === 'delete' ? 'var(--red-9)' : action === 'cancel' ? 'var(--orange-9)' : 'var(--blue-9)',
      confirmLabel: cfg.label,
    });
  }, [selectedCount]);

  const handleConfirm = useCallback(() => {
    const { action } = confirmDialog;
    const ids = filtered.filter((t) => selectedTaskIds.has(t.id)).map((t) => t.id);

    if (action === 'cancel') {
      batchUpdateTasks(ids, { status: 'failed', completedAt: new Date().toISOString() });
    } else if (action === 'retry') {
      batchUpdateTasks(ids, { status: 'pending', result: undefined, completedAt: undefined });
    } else if (action === 'delete') {
      batchDeleteTasks(ids);
    }
  }, [confirmDialog, filtered, selectedTaskIds, batchUpdateTasks, batchDeleteTasks]);

  const handleViewDetail = useCallback((id: string) => {
    setDetailTaskId((prev) => (prev === id ? null : id));
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailTaskId(null);
  }, []);

  const handleSelectTask = useCallback((id: string) => {
    setDetailTaskId(id);
  }, []);

  const counts = useMemo(() => ({
    all: tasks.length,
    running: tasks.filter((t) => t.status === 'running').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    withDeps: tasks.filter((t) => t.dependsOn && t.dependsOn.length > 0).length,
  }), [tasks]);

  const tabs: { key: 'all' | Task['status'] | 'dependencies'; label: string; count: number; dotColor?: string }[] = [
    { key: 'all', label: t('tasks.allTasks'), count: counts.all },
    { key: 'running', label: t('tasks.running'), count: counts.running, dotColor: 'var(--blue-9)' },
    { key: 'completed', label: t('tasks.completed'), count: counts.completed, dotColor: 'var(--green-9)' },
    { key: 'failed', label: t('tasks.failed'), count: counts.failed, dotColor: 'var(--red-9)' },
    { key: 'dependencies', label: t('tasks.dependencies'), count: counts.withDeps, dotColor: 'var(--orange-9)' },
  ];

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%' }}>
    <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
      {/* page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--gray-12)' }}>{t('nav.tasks')}</h1>
        <span
          aria-live="polite"
          aria-label={`共 ${counts.all} 个任务`}
          style={{
            padding: '1px 8px',
            borderRadius: 9999,
            fontSize: '11px',
            fontWeight: 600,
            background: 'var(--gray-4)',
            color: 'var(--gray-11)',
          }}
        >
          {counts.all}
        </span>
        {counts.blocked > 0 && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 9999,
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--orange-4)',
              color: 'var(--orange-11)',
            }}
          >
            {counts.blocked} {t('tasks.blocked')}
          </span>
        )}
      </div>

      {/* submit form */}
      <SubmitForm />

      {/* tab bar */}
      <div
        role="tablist"
        aria-label="任务筛选"
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--gray-6)',
          marginBottom: 16,
        }}
      >
        {tabs.map((tab) => (
          <TabButton key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
            {tab.key === 'dependencies' && <Link2Icon width={12} height={12} />}
            {tab.label}
            {tab.count > 0 && (
              <span
                style={{
                  padding: '0 6px',
                  borderRadius: 9999,
                  fontSize: '10px',
                  fontWeight: 600,
                  lineHeight: '16px',
                  background: tab.dotColor ? `${tab.dotColor}22` : 'var(--gray-4)',
                  color: tab.dotColor ?? 'var(--gray-11)',
                  minWidth: 16,
                  textAlign: 'center',
                }}
              >
                {tab.count}
              </span>
            )}
          </TabButton>
        ))}
      </div>

      {/* Dependencies tab view */}
      {activeTab === 'dependencies' ? (
        <DependencyTreeView tasks={tasks} onSelectTask={handleSelectTask} />
      ) : /* task list */
      filtered.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 0',
            gap: 10,
            color: 'var(--gray-8)',
          }}
        >
          <ReloadIcon width={32} height={32} />
          <span style={{ fontSize: '13px', color: 'var(--gray-9)' }}>
            {t('tasks.noTasks')}{activeTab !== 'all' ? ` (${activeTab})` : ''}.
          </span>
        </div>
      ) : (
        <>
          {/* select all + batch toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 8 }}>
            {/* select all row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                marginBottom: 4,
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                onChange={handleSelectAll}
                aria-label={allSelected ? '取消全选' : '全选'}
                style={{
                  width: 16,
                  height: 16,
                  cursor: 'pointer',
                  accentColor: 'var(--accent-9)',
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--gray-11)' }}>
                {allSelected ? t('common.deselectAll') : t('common.selectAll')}
              </span>
              {selectedCount > 0 && (
                <span style={{ fontSize: '12px', color: 'var(--accent-11)', fontWeight: 600, marginLeft: 4 }}>
                  {selectedCount} {t('common.selected')}
                </span>
              )}
            </div>

            {/* batch toolbar */}
            {selectedCount > 0 && (
              <BatchToolbar count={selectedCount} onAction={openConfirmDialog} t={t} />
            )}
          </div>

          {/* task cards */}
          <div role="list" aria-label="任务列表" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                agentMap={agentMap}
                selected={selectedTaskIds.has(task.id)}
                onToggleSelect={toggleTaskSelection}
                onViewDetail={handleViewDetail}
                detailActive={detailTaskId === task.id}
                dependencies={getTaskDeps(task.id)}
                isBlocked={isBlocked(task.id)}
                onSelectTask={handleSelectTask}
              />
            ))}
          </div>
        </>
      )}

      {/* confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        confirmColor={confirmDialog.confirmColor}
        onConfirm={handleConfirm}
      />
    </div>

    {/* detail panel */}
    {detailTaskId && (
      <TaskDetailPanel taskId={detailTaskId} onClose={handleCloseDetail} />
    )}
    </div>
  );
}
