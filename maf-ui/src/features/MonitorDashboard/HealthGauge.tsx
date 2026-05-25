import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import { useAppStore } from '../../stores/useAppStore';
import type { AgentMetric } from '../../types';

/* ── constants ───────────────────────────────────────────────────── */
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

/** Compute health score (0-100) from metrics */
function computeHealthScore(metrics: AgentMetric[]): {
  score: number;
  successScore: number;
  speedScore: number;
  reliabilityScore: number;
} {
  if (metrics.length === 0) return { score: 0, successScore: 0, speedScore: 0, reliabilityScore: 0 };

  // Success rate component (weight 40%)
  const avgSuccess = metrics.reduce((s, m) => s + m.successRate, 0) / metrics.length;
  const successScore = Math.round(avgSuccess * 100);

  // Speed component (weight 30%) — lower duration = higher score
  const avgDuration = metrics.reduce((s, m) => s + m.avgDuration, 0) / metrics.length;
  const speedScore = Math.min(100, Math.round((3000 / Math.max(avgDuration, 1)) * 100));

  // Reliability component (weight 30%) — based on total runs vs errors
  const totalRuns = metrics.reduce((s, m) => s + m.totalRuns, 0);
  const reliabilityScore = Math.min(100, Math.round((totalRuns / Math.max(metrics.length, 1)) / 5));

  const score = Math.round(successScore * 0.4 + speedScore * 0.3 + reliabilityScore * 0.3);
  return { score, successScore, speedScore, reliabilityScore };
}

/** Get color based on score */
function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--green-9)'; // green
  if (score >= 60) return 'var(--amber-9)';
  return 'var(--red-9)'; // red
}

/** Get label based on score */
function getScoreLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Warning';
  return 'Critical';
}

/* ═══════════════════════════════════════════════════════════════════
   HealthGauge — System Health Dashboard
   ═══════════════════════════════════════════════════════════════════ */
export default function HealthGauge() {
  const metrics = useAppStore((s) => s.metrics);
  const { score, successScore, speedScore, reliabilityScore } = useMemo(
    () => computeHealthScore(metrics),
    [metrics],
  );

  const gaugeColor = getScoreColor(score);

  // Half-circle gauge data
  const gaugeData = useMemo(() => [
    { name: 'Score', value: score },
    { name: 'Remaining', value: 100 - score },
  ], [score]);

  return (
    <div style={cardStyle}>
      <div style={{ color: 'var(--gray-12)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        System Health
      </div>
      <div style={{ color: 'var(--gray-9)', fontSize: 12, marginBottom: 16 }}>
        Composite score based on success rate, speed, and reliability
      </div>

      <div style={{ position: 'relative', width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            {/* Background arc */}
            <Pie
              data={[{ value: 50 }]}
              cx="50%"
              cy="75%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="85%"
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill="var(--gray-3)" />
            </Pie>
            {/* Score arc */}
            <Pie
              data={gaugeData}
              cx="50%"
              cy="75%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="85%"
              dataKey="value"
              stroke="none"
              isAnimationActive={true}
              animationDuration={800}
            >
              <Cell fill={gaugeColor} />
              <Cell fill="transparent" />
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => {
                if (name === 'Remaining') return null;
                return [`${value}`, 'Health Score'];
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -30%)',
          textAlign: 'center',
        }}>
          <div style={{ color: gaugeColor, fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ color: gaugeColor, fontSize: 13, fontWeight: 600, marginTop: 4 }}>
            {getScoreLabel(score)}
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 8 }}>
        {[
          { label: 'Success', value: successScore, icon: '✓' },
          { label: 'Speed', value: speedScore, icon: '⚡' },
          { label: 'Reliability', value: reliabilityScore, icon: '◆' },
        ].map((item) => (
          <div key={item.label} style={{
            background: 'var(--gray-3)',
            borderRadius: 8,
            padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ color: 'var(--gray-9)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {item.label}
            </div>
            <div style={{
              color: getScoreColor(item.value),
              fontSize: 18,
              fontWeight: 700,
            }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
