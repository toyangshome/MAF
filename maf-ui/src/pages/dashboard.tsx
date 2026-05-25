import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  RocketIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  ClockIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '../stores/useAppStore';
import type { AgentStatus } from '../types';

/* ── color palette ───────────────────────────────────────────────── */
const COLORS = ['var(--blue-9)', 'var(--green-9)', 'var(--purple-9)', 'var(--amber-9)', 'var(--red-9)'];
const GRID_STYLE = { stroke: 'var(--gray-6)', strokeDasharray: '3 3' };
const TICK_STYLE = { fill: 'var(--gray-10)', fontSize: 11 };
const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--gray-2)',
  border: '1px solid var(--gray-6)',
  borderRadius: 8,
  color: 'var(--gray-12)',
  fontSize: 12,
};

/* ── Agent status config ─────────────────────────────────────────── */
const STATUS_MAP: Record<AgentStatus, { color: string; bg: string; label: string }> = {
  idle:    { color: 'var(--status-idle)',    bg: 'var(--gray-3)', label: 'Idle' },
  running: { color: 'var(--status-running)', bg: 'var(--blue-3)', label: 'Running' },
  waiting: { color: 'var(--status-warning)', bg: 'var(--amber-3)', label: 'Waiting' },
  done:    { color: 'var(--status-done)',    bg: 'var(--green-3)', label: 'Done' },
  error:   { color: 'var(--status-error)',   bg: 'var(--red-3)', label: 'Error' },
};

/* ── helpers ─────────────────────────────────────────────────────── */
function fmtTime(ts: string) {
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/* ── card style ──────────────────────────────────────────────────── */
const cardStyle: React.CSSProperties = {
  background: 'var(--gray-2)',
  border: '1px solid var(--gray-6)',
  borderRadius: 12,
  padding: 20,
  flex: 1,
  minWidth: 180,
};

const iconWrap = (bg: string): React.CSSProperties => ({
  width: 40,
  height: 40,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: bg,
  flexShrink: 0,
});

/* ═══════════════════════════════════════════════════════════════════
   Dashboard
   ═══════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const tasks = useAppStore((s) => s.tasks);
  const agents = useAppStore((s) => s.agents);
  const metrics = useAppStore((s) => s.metrics);
  const [activeTab, setActiveTab] = useState('trend');
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Auto-refresh: simulate invoke("get_metrics") every 5s ──── */
  const refreshMetrics = useCallback(() => {
    setRefreshing(true);
    // In production: await invoke("get_metrics") then update store
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 300);
  }, []);

  useEffect(() => {
    const timer = setInterval(refreshMetrics, 5000);
    return () => {
      clearInterval(timer);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [refreshMetrics]);

  /* ── Summary cards ─────────────────────────────────────────── */
  const totalTasks = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const avgDuration = useMemo(() => {
    const done = tasks.filter((t) => t.completedAt);
    if (done.length === 0) return '0.0';
    const total = done.reduce((s, t) => s + (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()), 0);
    return (total / done.length / 1000).toFixed(1);
  }, [tasks]);

  /* ── Chart data ────────────────────────────────────────────── */
  // Task execution trend (line chart)
  const trendData = useMemo(() => {
    const len = metrics[0]?.executionTime.length ?? 0;
    return Array.from({ length: len }, (_, i) => {
      const row: Record<string, string | number> = { time: fmtTime(metrics[0].executionTime[i].timestamp) };
      metrics.forEach((m) => { row[m.agentName] = Math.round(m.executionTime[i].value); });
      return row;
    });
  }, [metrics]);

  // Token usage (bar chart)
  const tokenData = useMemo(() =>
    metrics.map((m) => ({
      agent: m.agentName,
      tokens: m.tokenUsage.reduce((s, p) => s + p.value, 0),
    })),
  [metrics]);

  // Cache hit rate (pie chart)
  const cacheData = useMemo(() =>
    metrics.map((m) => ({
      name: m.agentName,
      value: +(m.successRate * 100).toFixed(1),
    })),
  [metrics]);

  const agentNames = useMemo(() => metrics.map((m) => m.agentName), [metrics]);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-12)', margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ color: 'var(--gray-11)', fontSize: 13, margin: '4px 0 0' }}>
            Real-time performance overview
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ReloadIcon
            width={14} height={14}
            color="var(--gray-11)"
            style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
          />
          <span style={{ color: 'var(--gray-10)', fontSize: 12 }}>
            Auto-refresh: 5s
          </span>
        </div>
      </div>

      {/* ── 4 Summary Cards ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={iconWrap('var(--blue-3)')}>
              <RocketIcon width={20} height={20} color="var(--blue-9)" />
            </div>
            <div>
              <div style={labelStyle}>Total Tasks</div>
              <div style={valueStyle}>{totalTasks}</div>
            </div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={iconWrap('var(--green-3)')}>
              <CheckCircledIcon width={20} height={20} color="var(--green-9)" />
            </div>
            <div>
              <div style={labelStyle}>Completed</div>
              <div style={{ ...valueStyle, color: 'var(--green-9)' }}>{completed}</div>
            </div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={iconWrap('var(--red-3)')}>
              <CrossCircledIcon width={20} height={20} color="var(--red-9)" />
            </div>
            <div>
              <div style={labelStyle}>Failed</div>
              <div style={{ ...valueStyle, color: 'var(--red-9)' }}>{failed}</div>
            </div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={iconWrap('var(--purple-3)')}>
              <ClockIcon width={20} height={20} color="var(--purple-9)" />
            </div>
            <div>
              <div style={labelStyle}>Avg Duration</div>
              <div style={valueStyle}>
                {avgDuration}<span style={{ fontSize: 14, color: 'var(--gray-11)', marginLeft: 4 }}>s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Agent Status List ─────────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-6)' }}>
          <span style={{ color: 'var(--gray-12)', fontSize: 14, fontWeight: 600 }}>Agent Status</span>
        </div>
        <div style={{ padding: '8px 12px' }}>
          {agents.map((agent) => {
            const cfg = STATUS_MAP[agent.status];
            return (
              <div
                key={agent.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 8px', borderRadius: 8,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: cfg.color, flexShrink: 0,
                }} />
                <span style={{ color: 'var(--gray-12)', fontWeight: 500, fontSize: 13, flex: '0 0 120px' }}>
                  {agent.name}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 10px',
                  borderRadius: 9999, color: cfg.color, background: cfg.bg,
                  border: `1px solid ${cfg.color}33`, textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {cfg.label}
                </span>
                <span style={{ color: 'var(--gray-10)', fontSize: 12, marginLeft: 'auto' }}>
                  {agent.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Charts with Tabs ──────────────────────────────────── */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List style={{
          display: 'flex', gap: 4,
          background: 'var(--gray-2)', padding: 4, borderRadius: 10,
          border: '1px solid var(--gray-6)', marginBottom: 20,
        }}>
          {['trend', 'tokens', 'cache'].map((t) => (
            <Tabs.Trigger key={t} value={t} style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === t ? 'var(--gray-4)' : 'transparent',
              color: activeTab === t ? 'var(--gray-12)' : 'var(--gray-11)',
            }}>
              {t === 'trend' ? 'Task Execution Trend' : t === 'tokens' ? 'Token Usage' : 'Cache Hit Rate'}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Task execution trend - line chart */}
        <Tabs.Content value="trend" style={{ outline: 'none' }}>
          <div style={chartCardStyle}>
            <div style={chartTitle}>Task Execution Trend</div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="time" tick={TICK_STYLE} tickLine={false} axisLine={false} />
                <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} unit="ms" />
                <ReTooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--gray-11)' }} />
                <Legend wrapperStyle={{ color: 'var(--gray-11)', fontSize: 12 }} />
                {agentNames.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Tabs.Content>

        {/* Token usage - bar chart */}
        <Tabs.Content value="tokens" style={{ outline: 'none' }}>
          <div style={chartCardStyle}>
            <div style={chartTitle}>Token Usage by Agent</div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={tokenData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="agent" tick={TICK_STYLE} tickLine={false} axisLine={false} />
                <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
                <ReTooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--gray-11)' }}
                  formatter={(v: number) => [fmtNum(v), 'Tokens']} />
                <Bar dataKey="tokens" radius={[6, 6, 0, 0]}>
                  {tokenData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tabs.Content>

        {/* Cache hit rate - pie chart */}
        <Tabs.Content value="cache" style={{ outline: 'none' }}>
          <div style={chartCardStyle}>
            <div style={chartTitle}>Cache Hit Rate</div>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={cacheData} cx="50%" cy="50%" innerRadius={60} outerRadius={110}
                  paddingAngle={4} dataKey="value" nameKey="name"
                  label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                  {cacheData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <ReTooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v}%`, 'Hit Rate']} />
                <Legend wrapperStyle={{ color: 'var(--gray-11)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ── shared styles ───────────────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  color: 'var(--gray-11)',
  fontSize: 12,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const valueStyle: React.CSSProperties = {
  color: 'var(--gray-12)',
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.2,
};

const chartCardStyle: React.CSSProperties = {
  background: 'var(--gray-2)',
  border: '1px solid var(--gray-6)',
  borderRadius: 12,
  padding: 20,
};

const chartTitle: React.CSSProperties = {
  color: 'var(--gray-12)',
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 16,
};
