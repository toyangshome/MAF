import React, { useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';

/* ── constants ───────────────────────────────────────────────────── */
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Generate deterministic mock heatmap data from metrics */
function generateHeatmapData(metrics: { agentName: string; totalRuns: number }[]): number[][] {
  // 7 rows (days) x 24 cols (hours)
  const data: number[][] = DAYS.map(() => HOURS.map(() => 0));
  const seed = metrics.reduce((s, m) => s + m.totalRuns, 0) || 42;

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      // Business hours (9-18) have higher density; weekends lower
      const hourWeight = h >= 9 && h <= 18 ? 3 : h >= 7 && h <= 22 ? 1.5 : 0.3;
      const dayWeight = d < 5 ? 1 : 0.4;
      // Pseudo-random based on seed
      const hash = ((seed * 31 + d * 17 + h * 13) % 100) / 100;
      const value = Math.round(hash * hourWeight * dayWeight * metrics.length * 5);
      data[d][h] = Math.max(0, value);
    }
  }
  return data;
}

/** Get color intensity based on value */
function getHeatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'var(--gray-3)';
  const ratio = Math.min(value / max, 1);
  // Blue → Cyan → Green → Yellow → Red
  if (ratio < 0.25) return `rgba(59, 130, 246, ${0.15 + ratio * 2})`;       // blue
  if (ratio < 0.5) return `rgba(34, 197, 94, ${0.2 + (ratio - 0.25) * 2})`; // green
  if (ratio < 0.75) return `rgba(250, 204, 21, ${0.3 + (ratio - 0.5) * 2})`; // yellow
  return `rgba(239, 68, 68, ${0.4 + (ratio - 0.75) * 2})`;                   // red
}

/* ── styles ──────────────────────────────────────────────────────── */
const cardStyle: React.CSSProperties = {
  background: 'var(--gray-2)',
  border: '1px solid var(--gray-3)',
  borderRadius: 12,
  padding: 20,
};

const cellStyle: React.CSSProperties = {
  borderRadius: 3,
  cursor: 'pointer',
  transition: 'transform 0.1s',
  position: 'relative',
};

/* ═══════════════════════════════════════════════════════════════════
   HeatmapChart — Task Execution Density
   ═══════════════════════════════════════════════════════════════════ */
export default function HeatmapChart() {
  const metrics = useAppStore((s) => s.metrics);

  const data = useMemo(() => generateHeatmapData(metrics), [metrics]);
  const maxVal = useMemo(() => Math.max(...data.flat(), 1), [data]);

  const [hoveredCell, setHoveredCell] = React.useState<{
    day: string;
    hour: string;
    value: number;
  } | null>(null);

  return (
    <div style={cardStyle}>
      <div style={{ color: 'var(--gray-12)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Task Execution Density
      </div>
      <div style={{ color: 'var(--gray-9)', fontSize: 12, marginBottom: 16 }}>
        Hourly task distribution across the week
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(24, 1fr)', gap: 2, minWidth: 600 }}>
          {/* Hour headers */}
          <div />
          {HOURS.map((h) => (
            <div key={h} style={{
              textAlign: 'center',
              fontSize: 9,
              paddingBottom: 4,
              fontWeight: h % 6 === 0 ? 600 : 400,
              color: h % 6 === 0 ? 'var(--gray-11)' : 'var(--gray-8)',
            }}>
              {h % 6 === 0 ? `${h}h` : ''}
            </div>
          ))}

          {/* Rows */}
          {DAYS.map((day, d) => (
            <React.Fragment key={day}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                color: 'var(--gray-11)',
                fontSize: 11,
                fontWeight: 500,
                paddingRight: 8,
                justifyContent: 'flex-end',
              }}>
                {day}
              </div>
              {HOURS.map((h) => (
                <div
                  key={`${d}-${h}`}
                  style={{
                    ...cellStyle,
                    background: getHeatColor(data[d][h], maxVal),
                    height: 24,
                  }}
                  onMouseEnter={() => setHoveredCell({ day, hour: `${h}:00`, value: data[d][h] })}
                  onMouseLeave={() => setHoveredCell(null)}
                  title={`${day} ${h}:00 — ${data[d][h]} tasks`}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'var(--gray-3)',
          borderRadius: 8,
          color: 'var(--gray-12)',
          fontSize: 12,
          display: 'flex',
          gap: 16,
        }}>
          <span style={{ color: 'var(--gray-11)' }}>{hoveredCell.day} {hoveredCell.hour}</span>
          <span><strong>{hoveredCell.value}</strong> tasks executed</span>
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 12,
        justifyContent: 'flex-end',
      }}>
        <span style={{ color: 'var(--gray-9)', fontSize: 10, marginRight: 4 }}>Less</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
          <div key={ratio} style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: ratio === 0 ? 'var(--gray-3)' : getHeatColor(ratio * maxVal, maxVal),
          }} />
        ))}
        <span style={{ color: 'var(--gray-9)', fontSize: 10, marginLeft: 4 }}>More</span>
      </div>
    </div>
  );
}
