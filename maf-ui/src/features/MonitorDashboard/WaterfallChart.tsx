import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAppStore } from '../../stores/useAppStore';
import type { AgentMetric } from '../../types';

/* ── constants ───────────────────────────────────────────────────── */
const STAGES = [
  { key: 'decompose', label: 'Decompose', color: 'var(--blue-9)' },
  { key: 'coding', label: 'Coding', color: 'var(--green-9)' },
  { key: 'review', label: 'Review', color: 'var(--purple-9)' },
  { key: 'testing', label: 'Testing', color: 'var(--amber-9)' },
] as const;

const GRID_STYLE = { stroke: 'var(--gray-7)', strokeDasharray: '3 3' };
const TICK_STYLE = { fill: 'var(--gray-11)', fontSize: 11 };
const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--gray-3)',
  border: '1px solid var(--gray-7)',
  borderRadius: 8,
  color: 'var(--gray-12)',
  fontSize: 12,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--gray-2)',
  border: '1px solid var(--gray-3)',
  borderRadius: 12,
  padding: 20,
};

/** Generate mock waterfall data from metrics */
function buildWaterfallData(metrics: AgentMetric[]) {
  return metrics.map((m) => {
    const totalMs = m.avgDuration;
    // Distribute time across stages (with seed from totalRuns for variety)
    const ratios = [0.15, 0.45, 0.2, 0.2]; // decompose, coding, review, testing
    const jitter = ((m.totalRuns * 7) % 20) / 100; // 0-19% variance
    return {
      agent: m.agentName,
      decompose: Math.round(totalMs * (ratios[0] + jitter * 0.1)),
      coding: Math.round(totalMs * (ratios[1] - jitter * 0.15)),
      review: Math.round(totalMs * (ratios[2] + jitter * 0.05)),
      testing: Math.round(totalMs * (ratios[3])),
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════
   WaterfallChart — Task Execution Timeline
   ═══════════════════════════════════════════════════════════════════ */
export default function WaterfallChart() {
  const metrics = useAppStore((s) => s.metrics);
  const data = useMemo(() => buildWaterfallData(metrics), [metrics]);

  return (
    <div style={cardStyle}>
      <div style={{ color: 'var(--gray-12)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Task Execution Timeline
      </div>
      <div style={{ color: 'var(--gray-9)', fontSize: 12, marginBottom: 16 }}>
        Time spent per execution phase (ms)
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, bottom: 5, left: 80 }}
        >
          <CartesianGrid {...GRID_STYLE} horizontal={false} />
          <XAxis type="number" tick={TICK_STYLE} tickLine={false} axisLine={false} unit="ms" />
          <YAxis type="category" dataKey="agent" tick={TICK_STYLE} tickLine={false} axisLine={false} width={70} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => {
              const stage = STAGES.find((s) => s.key === name);
              return [`${value} ms`, stage?.label ?? name];
            }}
          />
          <Legend
            wrapperStyle={{ color: 'var(--gray-11)', fontSize: 12 }}
            formatter={(value: string) => {
              const stage = STAGES.find((s) => s.key === value);
              return stage?.label ?? value;
            }}
          />
          {STAGES.map((stage) => (
            <Bar
              key={stage.key}
              dataKey={stage.key}
              stackId="waterfall"
              fill={stage.color}
              radius={stage.key === 'testing' ? [0, 6, 6, 0] : [0, 0, 0, 0]}
              cursor="pointer"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
