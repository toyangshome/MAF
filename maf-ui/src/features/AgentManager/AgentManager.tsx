import React, { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import type { Agent, AgentMetric, AgentStatus, Task, CustomAgent } from '../../types';
import { AGENT_TYPES } from '../../types';
import { useTranslation } from '../../i18n';
import AgentEditorDialog from './AgentEditorDialog';
import { Select } from '../../components/ui/Select';
import { pulseAnimation } from '../../styles/components';
import {
  MagnifyingGlassIcon,
  ClockIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  PlayIcon,
  PauseIcon,
  GearIcon,
  ActivityLogIcon,
  BarChartIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PersonIcon,
  PlusIcon,
  Pencil1Icon,
  TrashIcon,
  CopyIcon,
} from '@radix-ui/react-icons';

/* ─── constants ─────────────────────────────────────────────────── */

const AGENT_STATUS_CONFIG: Record<
  AgentStatus,
  { color: string; bg: string; label: string; icon: React.ReactNode }
> = {
  idle:    { color: 'var(--gray-11)', bg: 'var(--gray-4)',  label: 'Idle',    icon: <PauseIcon width={12} height={12} /> },
  running: { color: 'var(--blue-11)', bg: 'var(--blue-4)',  label: 'Running', icon: <PlayIcon width={12} height={12} /> },
  waiting: { color: 'var(--yellow-11)', bg: 'var(--yellow-4)', label: 'Waiting', icon: <ClockIcon width={12} height={12} /> },
  done:    { color: 'var(--green-11)', bg: 'var(--green-4)', label: 'Done',    icon: <CheckCircledIcon width={12} height={12} /> },
  error:   { color: 'var(--red-11)',  bg: 'var(--red-4)',   label: 'Error',   icon: <CrossCircledIcon width={12} height={12} /> },
};

type StatusFilter = 'all' | AgentStatus | 'custom';

/* ─── helpers ───────────────────────────────────────────────────── */

function getAgentTypeInfo(type: string) {
  return AGENT_TYPES.find((t) => t.value === type) ?? { value: type, label: type, icon: '🤖' };
}

/* ─── StatusBadge ───────────────────────────────────────────────── */

function StatusBadge({ status }: { status: AgentStatus }) {
  const cfg = AGENT_STATUS_CONFIG[status] ?? { color: 'var(--gray-11)', bg: 'var(--gray-4)', label: status, icon: '•' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: 11,
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

/* ─── AgentCard ──────────────────────────────────────────────────── */

function AgentCard({
  agent,
  metric,
  expanded,
  onToggle,
  configAgent,
}: {
  agent: Agent;
  metric: AgentMetric | undefined;
  expanded: boolean;
  onToggle: () => void;
  configAgent: { model: string; temperature: number; maxTokens: number; tools: string[]; systemPrompt: string } | undefined;
}) {
  const typeInfo = getAgentTypeInfo(agent.type);
  const { t } = useTranslation();

  // Get relevant tasks for this agent
  const tasks = useAppStore((s) => s.tasks);
  const agentTasks = useMemo(
    () => tasks.filter((t) => t.agents.includes(agent.id)).slice(0, 5),
    [tasks, agent.id]
  );

  const successRatePercent = metric ? Math.round(metric.successRate * 100) : null;

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${expanded ? 'var(--accent-7)' : 'var(--gray-6)'}`,
        background: expanded ? 'var(--gray-2)' : 'var(--gray-1)',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
        boxShadow: expanded ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Card Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 18px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Agent Icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'var(--gray-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {typeInfo.icon}
        </div>

        {/* Name + Type */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-12)' }}>
              {agent.name}
            </span>
            <span
              style={{
                padding: '1px 7px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                background: 'var(--gray-4)',
                color: 'var(--gray-11)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {typeInfo.label}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--gray-10)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: expanded ? 'normal' : 'nowrap',
              lineHeight: 1.4,
            }}
          >
            {agent.description}
          </p>
        </div>

        {/* Status + Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <StatusBadge status={agent.status} />

          {metric && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-12)', lineHeight: 1 }}>
                  {metric.totalRuns}
                </div>
                <div style={{ fontSize: 10, color: 'var(--gray-9)', marginTop: 2 }}>Runs</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    lineHeight: 1,
                    color:
                      successRatePercent && successRatePercent >= 90
                        ? 'var(--green-11)'
                        : successRatePercent && successRatePercent >= 70
                          ? 'var(--yellow-11)'
                          : 'var(--red-11)',
                  }}
                >
                  {successRatePercent}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--gray-9)', marginTop: 2 }}>Success</div>
              </div>
            </div>
          )}

          <span style={{ color: 'var(--gray-8)' }}>
            {expanded ? <ChevronUpIcon width={16} height={16} /> : <ChevronDownIcon width={16} height={16} />}
          </span>
        </div>
      </div>

      {/* Expanded Detail Panel */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--gray-6)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Description full */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <PersonIcon width={14} height={14} color="var(--gray-9)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-11)' }}>{t('agentsPage.description')}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-12)', lineHeight: 1.6 }}>
              {agent.description}
            </p>
          </div>

          {/* Config Info */}
          {configAgent && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <GearIcon width={14} height={14} color="var(--gray-9)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-11)' }}>{t('agentsPage.configuration')}</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 8,
                }}
              >
                <ConfigItem label="Model" value={configAgent.model} />
                <ConfigItem label="Temperature" value={String(configAgent.temperature)} />
                <ConfigItem label="Max Tokens" value={String(configAgent.maxTokens)} />
                <ConfigItem label="Tools" value={`${configAgent.tools.length} tools`} />
              </div>
              {configAgent.systemPrompt && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: 'var(--gray-3)',
                    fontSize: 11,
                    color: 'var(--gray-11)',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: 1.5,
                    maxHeight: 100,
                    overflow: 'auto',
                  }}
                >
                  {configAgent.systemPrompt}
                </div>
              )}
            </div>
          )}

          {/* Metrics Summary */}
          {metric && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <BarChartIcon width={14} height={14} color="var(--gray-9)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-11)' }}>{t('agentsPage.metrics')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                <MetricItem label="Total Runs" value={String(metric.totalRuns)} />
                <MetricItem label="Avg Duration" value={`${metric.avgDuration.toFixed(1)}s`} />
                <MetricItem label="Success Rate" value={`${successRatePercent}%`} />
                <MetricItem
                  label="Total Tokens"
                  value={metric.tokenUsage.reduce((s, p) => s + p.value, 0).toLocaleString()}
                />
              </div>
            </div>
          )}

          {/* Recent Tasks */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <ActivityLogIcon width={14} height={14} color="var(--gray-9)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-11)' }}>{t('agentsPage.recentTasks')}</span>
            </div>
            {agentTasks.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--gray-8)', padding: '8px 0' }}>
                {t('agentsPage.noTasksForAgent')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {agentTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'var(--gray-3)',
                    }}
                  >
                    <TaskStatusDot status={task.status} />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: 'var(--gray-12)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.description}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--gray-9)', flexShrink: 0 }}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <ActionButton
              icon={<ActivityLogIcon width={13} height={13} />}
              label={t('agentsPage.viewLogs')}
              onClick={() => {
                // Navigate to logs filtered by this agent
                const { setPage } = useAppStore.getState();
                setPage('logs');
              }}
            />
            <ActionButton
              icon={<GearIcon width={13} height={13} />}
              label={t('agentsPage.viewConfig')}
              onClick={() => {
                const { setPage } = useAppStore.getState();
                setPage('config');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Small helpers ──────────────────────────────────────────────── */

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 6,
        background: 'var(--gray-3)',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--gray-9)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-12)' }}>{value}</div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 6,
        background: 'var(--gray-3)',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--gray-9)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-12)' }}>{value}</div>
    </div>
  );
}

function TaskStatusDot({ status }: { status: Task['status'] }) {
  const colorMap: Record<string, string> = {
    pending: 'var(--gray-9)',
    running: 'var(--blue-9)',
    completed: 'var(--green-9)',
    failed: 'var(--red-9)',
  };
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: colorMap[status] ?? 'var(--gray-9)',
        flexShrink: 0,
      }}
    />
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 14px',
        borderRadius: 6,
        border: '1px solid var(--gray-6)',
        background: 'var(--gray-3)',
        color: 'var(--gray-11)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 0.1s ease, color 0.1s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--gray-4)';
        e.currentTarget.style.color = 'var(--gray-12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--gray-3)';
        e.currentTarget.style.color = 'var(--gray-11)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── CustomAgentCard ─────────────────────────────────────── */

function CustomAgentCard({
  agent,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  agent: CustomAgent;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const typeInfo = getAgentTypeInfo(agent.type);
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }, [confirmDelete, onDelete]);

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${expanded ? 'var(--accent-7)' : 'var(--gray-6)'}`,
        background: expanded ? 'var(--gray-2)' : 'var(--gray-1)',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
        boxShadow: expanded ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Card Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 18px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Agent Icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'var(--accent-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {typeInfo.icon}
        </div>

        {/* Name + Type */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-12)' }}>
              {agent.name}
            </span>
            <span
              style={{
                padding: '1px 7px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                background: 'var(--accent-4)',
                color: 'var(--accent-11)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              自定义
            </span>
            <span
              style={{
                padding: '1px 7px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                background: 'var(--gray-4)',
                color: 'var(--gray-11)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {typeInfo.label}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--gray-10)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: expanded ? 'normal' : 'nowrap',
              lineHeight: 1.4,
            }}
          >
            {agent.description}
          </p>
        </div>

        {/* Model + Expand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--gray-4)',
              color: 'var(--gray-11)',
            }}
          >
            {agent.model}
          </span>
          <span style={{ color: 'var(--gray-8)' }}>
            {expanded ? <ChevronUpIcon width={16} height={16} /> : <ChevronDownIcon width={16} height={16} />}
          </span>
        </div>
      </div>

      {/* Expanded Detail Panel */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--gray-6)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Config Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <GearIcon width={14} height={14} color="var(--gray-9)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-11)' }}>配置</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 8,
              }}
            >
              <ConfigItem label="Provider" value={agent.provider} />
              <ConfigItem label="Model" value={agent.model} />
              <ConfigItem label="Temperature" value={agent.temperature.toFixed(1)} />
              <ConfigItem label="Max Tokens" value={String(agent.maxTokens)} />
              <ConfigItem label="Max Steps" value={String(agent.maxSteps)} />
              <ConfigItem label="Tools" value={`${agent.tools.length} tools`} />
            </div>
          </div>

          {/* System Prompt */}
          {agent.systemPrompt && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <GearIcon width={14} height={14} color="var(--gray-9)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-11)' }}>系统提示词</span>
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: 'var(--gray-3)',
                  fontSize: 11,
                  color: 'var(--gray-11)',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.5,
                  maxHeight: 100,
                  overflow: 'auto',
                }}
              >
                {agent.systemPrompt}
              </div>
            </div>
          )}

          {/* Tools list */}
          {agent.tools.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <GearIcon width={14} height={14} color="var(--gray-9)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-11)' }}>启用工具</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {agent.tools.map((tool) => (
                  <span
                    key={tool}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      background: 'var(--gray-4)',
                      color: 'var(--gray-11)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <ActionButton
              icon={<Pencil1Icon width={13} height={13} />}
              label="编辑"
              onClick={onEdit}
            />
            <ActionButton
              icon={<CopyIcon width={13} height={13} />}
              label="复制"
              onClick={onDuplicate}
            />
            <button
              onClick={handleDelete}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                borderRadius: 6,
                border: `1px solid ${confirmDelete ? 'var(--red-7)' : 'var(--gray-6)'}`,
                background: confirmDelete ? 'var(--red-4)' : 'var(--gray-3)',
                color: confirmDelete ? 'var(--red-11)' : 'var(--gray-11)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.1s ease, color 0.1s ease',
              }}
            >
              <TrashIcon width={13} height={13} />
              {confirmDelete ? '确认删除?' : '删除'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── FilterBar ──────────────────────────────────────────────────── */

function FilterBar({
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  counts,
}: {
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  counts: Record<string, number>;
}) {
  const { t } = useTranslation();
  const filters: { key: StatusFilter; label: string; dotColor?: string }[] = [
    { key: 'all', label: t('agentsPage.all') },
    { key: 'running', label: t('agentsPage.running'), dotColor: 'var(--blue-9)' },
    { key: 'idle', label: t('agentsPage.idle'), dotColor: 'var(--gray-9)' },
    { key: 'error', label: t('agentsPage.error'), dotColor: 'var(--red-9)' },
    { key: 'waiting', label: t('agentsPage.waiting'), dotColor: 'var(--yellow-9)' },
    { key: 'done', label: t('agentsPage.done'), dotColor: 'var(--green-9)' },
    { key: 'custom', label: '自定义', dotColor: 'var(--accent-9)' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--gray-6)', flex: 1 }}>
        {filters.map((f) => {
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent-9)' : '2px solid transparent',
                background: 'transparent',
                color: active ? 'var(--gray-12)' : 'var(--gray-9)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'color 0.1s, border-color 0.1s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span
                  style={{
                    padding: '0 6px',
                    borderRadius: 9999,
                    fontSize: 10,
                    fontWeight: 600,
                    lineHeight: '16px',
                    background: f.dotColor ? `${f.dotColor}22` : 'var(--gray-4)',
                    color: f.dotColor ?? 'var(--gray-11)',
                    minWidth: 16,
                    textAlign: 'center',
                  }}
                >
                  {counts[f.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div style={{ position: 'relative', width: 220, flexShrink: 0 }}>
        <MagnifyingGlassIcon
          width={14}
          height={14}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--gray-9)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder={t('agentsPage.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px 6px 30px',
            borderRadius: 6,
            border: '1px solid var(--gray-6)',
            background: 'var(--gray-2)',
            color: 'var(--gray-12)',
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Sort select */}
      <div style={{ flexShrink: 0, width: 140 }}>
        <Select
          value={sortBy}
          onValueChange={setSortBy}
          options={[
            { value: 'name', label: t('agentsPage.byName') },
            { value: 'type', label: t('agentsPage.byType') },
            { value: 'status', label: t('agentsPage.byStatus') },
            { value: 'runs', label: t('agentsPage.byRuns') },
            { value: 'success', label: t('agentsPage.bySuccess') },
          ]}
        />
      </div>
    </div>
  );
}

/* ─── AgentManager (main export) ─────────────────────────────────── */

export default function AgentManager() {
  const agents = useAppStore((s) => s.agents);
  const metrics = useAppStore((s) => s.metrics);
  const config = useAppStore((s) => s.config);
  const customAgents = useAppStore((s) => s.customAgents);
  const addCustomAgent = useAppStore((s) => s.addCustomAgent);
  const updateCustomAgent = useAppStore((s) => s.updateCustomAgent);
  const deleteCustomAgent = useAppStore((s) => s.deleteCustomAgent);
  const duplicateCustomAgent = useAppStore((s) => s.duplicateCustomAgent);
  const { t } = useTranslation();

  // 调试日志
  console.debug('[AgentManager] agents:', agents, 'config.agents:', config.agents, 'customAgents:', customAgents);

  const safeAgents = Array.isArray(agents) ? agents : [];
  const safeMetrics = Array.isArray(metrics) ? metrics : [];
  const safeCustomAgents = Array.isArray(customAgents) ? customAgents : [];

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Editor dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);

  // Build metrics map
  const metricsMap = useMemo(() => {
    const m = new Map<string, AgentMetric>();
    safeMetrics.forEach((met) => m.set(met.agentId, met));
    return m;
  }, [safeMetrics]);

  // Build config map
  const configMap = useMemo(() => {
    const m = new Map<string, typeof config.agents[0]>();
    if (Array.isArray(config.agents)) {
      config.agents.forEach((ca) => m.set(ca.type, ca));
    }
    return m;
  }, [config]);

  // Counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: safeAgents.length + safeCustomAgents.length,
      running: 0, idle: 0, error: 0, waiting: 0, done: 0,
      custom: safeCustomAgents.length,
    };
    safeAgents.forEach((a) => {
      c[a.status] = (c[a.status] ?? 0) + 1;
    });
    return c;
  }, [safeAgents, safeCustomAgents]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    // Custom filter: only show custom agents
    if (statusFilter === 'custom') {
      let list = [...safeCustomAgents];
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.type.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q)
        );
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list.map((a) => ({ kind: 'custom' as const, data: a }));
    }

    // Built-in agents
    let list = [...safeAgents];

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'runs': {
          const ra = metricsMap.get(a.id)?.totalRuns ?? 0;
          const rb = metricsMap.get(b.id)?.totalRuns ?? 0;
          return rb - ra;
        }
        case 'success': {
          const sa = metricsMap.get(a.id)?.successRate ?? 0;
          const sb = metricsMap.get(b.id)?.successRate ?? 0;
          return sb - sa;
        }
        default:
          return 0;
      }
    });

    // In 'all' mode, append custom agents at the end
    const builtinResult = list.map((a) => ({ kind: 'builtin' as const, data: a }));
    if (statusFilter === 'all') {
      const q = searchQuery.trim().toLowerCase();
      let filteredCustom = [...safeCustomAgents];
      if (q) {
        filteredCustom = filteredCustom.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.type.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q)
        );
      }
      filteredCustom.sort((a, b) => a.name.localeCompare(b.name));
      return [
        ...builtinResult,
        ...filteredCustom.map((a) => ({ kind: 'custom' as const, data: a })),
      ];
    }

    return builtinResult;
  }, [safeAgents, safeCustomAgents, statusFilter, searchQuery, sortBy, metricsMap]);

  // Editor handlers
  const handleOpenCreate = useCallback(() => {
    setEditingAgent(null);
    setEditorOpen(true);
  }, []);

  const handleOpenEdit = useCallback((agent: CustomAgent) => {
    setEditingAgent(agent);
    setEditorOpen(true);
  }, []);

  const handleSave = useCallback(
    (agentData: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (editingAgent) {
        updateCustomAgent(editingAgent.id, agentData);
      } else {
        addCustomAgent(agentData);
      }
    },
    [editingAgent, updateCustomAgent, addCustomAgent]
  );

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--gray-12)' }}>{t('nav.agents')}</h1>
          <span
            style={{
              padding: '1px 8px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--gray-4)',
              color: 'var(--gray-11)',
            }}
          >
            {agents.length + customAgents.length}
          </span>
        </div>
        <button
          onClick={handleOpenCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent-9)',
            color: 'white',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-10)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-9)'; }}
        >
          <PlusIcon width={14} height={14} />
          创建 Agent
        </button>
      </div>

      {/* Filter bar */}
      <FilterBar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        counts={counts}
      />

      {/* Agent cards */}
      {filtered.length === 0 ? (
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
          <PersonIcon width={32} height={32} />
          <span style={{ fontSize: 13, color: 'var(--gray-9)' }}>
            {t('agentsPage.noAgents')}{statusFilter !== 'all' ? ` (${statusFilter})` : ''}.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((item) =>
            item.kind === 'builtin' ? (
              <AgentCard
                key={item.data.id}
                agent={item.data}
                metric={metricsMap.get(item.data.id)}
                expanded={expandedId === item.data.id}
                onToggle={() => setExpandedId(expandedId === item.data.id ? null : item.data.id)}
                configAgent={configMap.get(item.data.type)}
              />
            ) : (
              <CustomAgentCard
                key={item.data.id}
                agent={item.data}
                expanded={expandedId === item.data.id}
                onToggle={() => setExpandedId(expandedId === item.data.id ? null : item.data.id)}
                onEdit={() => handleOpenEdit(item.data)}
                onDelete={() => deleteCustomAgent(item.data.id)}
                onDuplicate={() => duplicateCustomAgent(item.data.id)}
              />
            )
          )}
        </div>
      )}

      {/* Agent Editor Dialog */}
      <AgentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        agent={editingAgent}
        onSave={handleSave}
      />
    </div>
  );
}
