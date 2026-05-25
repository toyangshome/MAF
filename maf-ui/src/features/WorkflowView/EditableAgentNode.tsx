import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { AgentStatus } from '../../types';
import { AGENT_TYPES } from '../../types';
import { STATUS_CONFIG } from './constants';

const TYPE_ICONS: Record<string, string> = {};
AGENT_TYPES.forEach((t) => { TYPE_ICONS[t.value] = t.icon; });

export interface EditableAgentNodeData {
  label: string;
  agentType: string;
  status: AgentStatus;
  isSelected: boolean;
  dependencyCount: number;
}

// Status icon overlays
function StatusOverlay({ status }: { status: AgentStatus }) {
  if (status === 'done') {
    return (
      <div
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--green-3)',
          border: '2px solid var(--green-9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: 'var(--green-9)',
          fontWeight: 700,
          zIndex: 2,
          boxShadow: '0 0 8px rgba(52,211,153,0.4)',
        }}
      >
        ✓
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--red-3)',
          border: '2px solid var(--red-9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: 'var(--red-9)',
          fontWeight: 700,
          zIndex: 2,
          boxShadow: '0 0 8px rgba(248,113,113,0.4)',
        }}
      >
        ✕
      </div>
    );
  }
  if (status === 'running') {
    return (
      <div
        style={{
          position: 'absolute',
          top: -4,
          right: -4,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'var(--blue-3)',
          border: '2px solid var(--blue-9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          boxShadow: '0 0 10px rgba(96,165,250,0.5)',
          animation: 'node-spin 1.2s linear infinite',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--blue-9)',
          }}
        />
      </div>
    );
  }
  return null;
}

function EditableAgentNode({ data }: NodeProps) {
  const { label, agentType, status, isSelected, dependencyCount } = data as EditableAgentNodeData;
  const cfg = STATUS_CONFIG[status];

  const borderColor = isSelected
    ? 'var(--accent-9)'
    : status === 'running'
      ? 'var(--blue-9)'
      : status === 'done'
        ? 'var(--green-9)'
        : status === 'error'
          ? 'var(--red-9)'
          : 'var(--gray-6)';

  const boxShadow = isSelected
    ? '0 0 12px rgba(129,140,248,0.25)'
    : status === 'running'
      ? '0 0 16px rgba(96,165,250,0.3), 0 0 4px rgba(96,165,250,0.15)'
      : status === 'done'
        ? '0 0 8px rgba(52,211,153,0.2)'
        : status === 'error'
          ? '0 0 8px rgba(248,113,113,0.25)'
          : 'var(--shadow-sm)';

  return (
    <div
      className={status === 'running' ? 'wf-node-running' : undefined}
      style={{
        width: 220,
        minHeight: 90,
        background: isSelected ? 'var(--gray-3)' : 'var(--gray-2)',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        padding: '12px 14px',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: 'var(--gray-12)',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow,
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: status === 'done' ? 'var(--green-9)' : status === 'running' ? 'var(--blue-9)' : 'var(--gray-8)',
          width: 10,
          height: 10,
          border: '2px solid var(--gray-9)',
          transition: 'background 0.2s',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: status === 'done' ? 'var(--green-9)' : status === 'running' ? 'var(--blue-9)' : 'var(--gray-8)',
          width: 10,
          height: 10,
          border: '2px solid var(--gray-9)',
          transition: 'background 0.2s',
        }}
      />

      <StatusOverlay status={status} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{TYPE_ICONS[agentType] || '⚙️'}</span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 9999,
            color: cfg.color,
            background: cfg.bg,
            border: `1px solid ${cfg.color}33`,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}
        >
          {cfg.pulse && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: cfg.color,
                animation: 'pulse-ring 1.5s ease-in-out infinite',
              }}
            />
          )}
          {cfg.label}
        </span>
      </div>

      {/* Type */}
      <div style={{ fontSize: 11, color: 'var(--gray-11)', textTransform: 'capitalize', marginBottom: 4 }}>
        {agentType} agent
      </div>

      {/* Dependency count */}
      <div style={{ fontSize: 10, color: 'var(--gray-9)' }}>
        {dependencyCount > 0 ? `${dependencyCount} dependencies` : 'No dependencies'}
      </div>
    </div>
  );
}

export default memo(EditableAgentNode);
