import React, { useMemo } from 'react';
import {
  RadarChart as ReRadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { useAppStore } from '../../stores/useAppStore';
import type { AgentMetric } from '../../types';

/* ── colour palette ──────────────────────────────────────────────── */
const COLORS = ['var(--blue-9)', 'var(--green-9)', 'var(--purple-9)', 'var(--amber-9)', 'var(--red-9)'];
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

/* ── dimensions ──────────────────────────────────────────────────── */
const DIMENSIONS = [
  { key: 'execSpeed', label: 'Execution Speed', unit: '' },
  { key: 'successRate', label: 'Success Rate', unit: '%' },
  { key: 'tokenEfficiency', label: 'Token Efficiency', unit: '' },
  { key: 'toolCalls', label: 'Tool Usage', unit: '' },
  { key: 'responseTime', label: 'Response Time', unit: '' },
] as const;

/** Convert AgentMetric[] to radar chart data */
function buildRadarData(metrics: AgentMetric[]) {
  return DIMENSIONS.map((dim) => {
    const row: Record<string, string | number> = { dimension: dim.label };
    metrics.forEach((m) => {
      switch (dim.key) {
        case 'execSpeed':
          // Lower avgDuration = higher speed (invert, normalize 0-100)
          row[m.agentName] = m.avgDuration > 0 ? Math.round(Math.min(100, (3000 / m.avgDuration) * 100)) : 50;
          break;
        case 'successRate':
          row[m.agentName] = Math.round(m.successRate * 100);
          break;
        case 'tokenEfficiency': {
          const totalTokens = m.tokenUsage.reduce((s, p) => s + p.value, 0);
          row[m.agentName] = totalTokens > 0 ? Math.round(Math.min(100, (m.totalRuns / totalTokens) * 10000)) : 50;
          break;
        }
        case 'toolCalls': {
          const totalCalls = m.toolCalls.reduce((s, p) => s + p.value, 0);
          row[m.agentName] = Math.round(Math.min(100, totalCalls / Math.max(m.totalRuns, 1) * 20));
          break;
        }
        case 'responseTime':
          // Faster response = higher score
          row[m.agentName] = m.avgDuration > 0 ? Math.round(Math.min(100, (5000 / m.avgDuration) * 100)) : 50;
          break;
      }
    });
    return row;
  });
}

/* ═══════════════════════════════════════════════════════════════════
   RadarChart — Agent Comprehensive Ability
   ═══════════════════════════════════════════════════════════════════ */
export default function AgentRadarChart() {
  const metrics = useAppStore((s) => s.metrics);
  const agentNames = useMemo(() => metrics.map((m) => m.agentName), [metrics]);
  const data = useMemo(() => buildRadarData(metrics), [metrics]);

  return (
    <div style={cardStyle}>
      <div style={{ color: 'var(--gray-12)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Agent Comprehensive Ability
      </div>
      <div style={{ color: 'var(--gray-9)', fontSize: 12, marginBottom: 16 }}>
        Multi-dimensional performance comparison
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ReRadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--gray-7)" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: 'var(--gray-11)', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: 'var(--gray-9)', fontSize: 10 }}
            axisLine={false}
          />
          {agentNames.map((name, i) => (
            <Radar
              key={name}
              name={name}
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend
            wrapperStyle={{ color: 'var(--gray-11)', fontSize: 12, paddingTop: 12 }}
          />
        </ReRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
