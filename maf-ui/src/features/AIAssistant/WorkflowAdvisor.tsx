import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { analyzeWorkflow } from './suggestions';
import type { WorkflowOptimization } from './types';
import {
  RocketIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LightningBoltIcon,
  Cross2Icon,
  Link2Icon,
  TargetIcon,
} from '@radix-ui/react-icons';

/** 优化类型对应样式 */
const OPTIMIZATION_CONFIG: Record<
  WorkflowOptimization['type'],
  { color: string; bg: string; icon: React.ReactNode; label: string }
> = {
  parallel: {
    color: 'var(--blue-11)',
    bg: 'var(--blue-3)',
    icon: <RocketIcon width={14} height={14} />,
    label: '并行优化',
  },
  redundant: {
    color: 'var(--amber-11)',
    bg: 'var(--amber-3)',
    icon: <Cross2Icon width={14} height={14} />,
    label: '冗余依赖',
  },
  chain: {
    color: 'var(--orange-11)',
    bg: 'var(--orange-3)',
    icon: <Link2Icon width={14} height={14} />,
    label: '依赖链过长',
  },
  bottleneck: {
    color: 'var(--red-11)',
    bg: 'var(--red-3)',
    icon: <TargetIcon width={14} height={14} />,
    label: '瓶颈节点',
  },
};

/**
 * 工作流优化建议组件
 * 分析工作流依赖图，识别可并行执行的节点和依赖优化
 * 显示在 WorkflowView 侧边
 */
export default function WorkflowAdvisor() {
  const workflowNodes = useAppStore((s) => s.workflowNodes);

  const optimizations = useMemo(() => analyzeWorkflow(workflowNodes), [workflowNodes]);

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: 10,
        border: '1px solid var(--gray-6)',
        background: 'var(--gray-2)',
        height: 'fit-content',
        position: 'sticky',
        top: 16,
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <LightningBoltIcon width={16} height={16} color="var(--accent-9)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-12)' }}>
          工作流优化
        </span>
        {optimizations.length > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--amber-11)',
              padding: '1px 8px',
              borderRadius: 9999,
              background: 'var(--amber-3)',
            }}
          >
            {optimizations.length} 条建议
          </span>
        )}
      </div>

      {/* summary stats */}
      {workflowNodes.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <StatCard label="节点数" value={workflowNodes.length} />
          <StatCard
            label="依赖关系"
            value={workflowNodes.reduce((sum, n) => sum + n.dependencies.length, 0)}
          />
          <StatCard
            label="可并行组"
            value={
              optimizations.filter((o) => o.type === 'parallel').length
            }
          />
          <StatCard
            label="瓶颈节点"
            value={
              optimizations.filter((o) => o.type === 'bottleneck').length
            }
          />
        </div>
      )}

      {/* optimization list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {workflowNodes.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '24px 0',
              color: 'var(--gray-8)',
            }}
          >
            <RocketIcon width={24} height={24} color="var(--gray-7)" />
            <span style={{ fontSize: '12px', color: 'var(--gray-9)' }}>
              添加工作流节点后可分析优化建议
            </span>
          </div>
        ) : optimizations.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '24px 0',
              color: 'var(--gray-8)',
            }}
          >
            <RocketIcon width={24} height={24} color="var(--green-9)" />
            <span style={{ fontSize: '12px', color: 'var(--gray-9)' }}>工作流结构合理，暂无优化建议</span>
          </div>
        ) : (
          optimizations.map((opt, idx) => (
            <OptimizationCard key={idx} optimization={opt} />
          ))
        )}
      </div>
    </div>
  );
}

/** 统计卡片 */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid var(--gray-5)',
        background: 'var(--gray-3)',
      }}
    >
      <div style={{ fontSize: '10px', color: 'var(--gray-9)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-12)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

/** 单条优化建议卡片 */
function OptimizationCard({ optimization }: { optimization: WorkflowOptimization }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = OPTIMIZATION_CONFIG[optimization.type];

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${cfg.color}33`,
        background: cfg.bg,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--gray-12)',
        }}
      >
        <span style={{ color: cfg.color, flexShrink: 0, display: 'flex' }}>{cfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: cfg.color, marginBottom: 2 }}>
            {cfg.label}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gray-12)', lineHeight: 1.4 }}>
            {optimization.title}
          </div>
        </div>
        {expanded ? (
          <ChevronUpIcon width={14} height={14} color="var(--gray-8)" />
        ) : (
          <ChevronDownIcon width={14} height={14} color="var(--gray-8)" />
        )}
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--gray-5)' }}>
          <p style={{ margin: '10px 0 8px', fontSize: '12px', color: 'var(--gray-11)', lineHeight: 1.5 }}>
            {optimization.description}
          </p>
          {optimization.affectedNodes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {optimization.affectedNodes.map((nodeId) => (
                <span
                  key={nodeId}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: cfg.color,
                    background: 'var(--gray-2)',
                    border: '1px solid var(--gray-5)',
                  }}
                >
                  {nodeId}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
