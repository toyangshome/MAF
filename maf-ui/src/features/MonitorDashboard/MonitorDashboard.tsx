import React, { useCallback, useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Select } from '@radix-ui/themes';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  ActivityLogIcon,
  BarChartIcon,
  ClockIcon,
  RocketIcon,
  ReloadIcon,
  DownloadIcon,
  CameraIcon,
  Cross2Icon,
} from '@radix-ui/react-icons';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '../../stores/useAppStore';
import HeatmapChart from './HeatmapChart';
import AgentRadarChart from './RadarChart';
import WaterfallChart from './WaterfallChart';
import HealthGauge from './HealthGauge';
import { useTranslation } from '../../i18n';

/* ── colour palette ─────────────────────────────────────────────────── */
const COLORS = ['var(--blue-9)', 'var(--green-9)', 'var(--purple-9)', 'var(--amber-9)', 'var(--red-9)'];
const GRID_STYLE = { stroke: 'var(--gray-7)', strokeDasharray: '3 3' };
const TICK_STYLE = { fill: 'var(--gray-11)', fontSize: 11 };
const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--gray-3)',
  border: '1px solid var(--gray-7)',
  borderRadius: 8,
  color: 'var(--gray-12)',
  fontSize: 12,
};

/* ── time range options ─────────────────────────────────────────────── */
type TimeRange = '1h' | '6h' | '24h' | '7d';
const TIME_RANGES: { value: TimeRange; label: string; hours: number }[] = [
  { value: '1h', label: '最近 1 小时', hours: 1 },
  { value: '6h', label: '最近 6 小时', hours: 6 },
  { value: '24h', label: '最近 24 小时', hours: 24 },
  { value: '7d', label: '最近 7 天', hours: 168 },
];

/* ── helpers ────────────────────────────────────────────────────────── */
function fmtTime(ts: string) {
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Filter MetricPoint[] by time range (hours back from now) */
function filterByRange(points: { timestamp: string; value: number }[], hours: number) {
  const cutoff = Date.now() - hours * 3600 * 1000;
  return points.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
}

/** Convert array of objects to CSV string */
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => {
      const v = row[h];
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','));
  }
  return lines.join('\n');
}

/** Trigger a file download */
function download(filename: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── card style helper ──────────────────────────────────────────────── */
const cardStyle: React.CSSProperties = {
  background: 'var(--gray-2)',
  border: '1px solid var(--gray-3)',
  borderRadius: 12,
  padding: 20,
  flex: 1,
  minWidth: 200,
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

/* ── button style helper ────────────────────────────────────────────── */
const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 13,
  background: 'var(--gray-3)',
  color: 'var(--gray-12)',
  border: '1px solid var(--gray-7)',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background 0.15s',
};

/* ═══════════════════════════════════════════════════════════════════════
   MonitorDashboard
   ═══════════════════════════════════════════════════════════════════════ */
export default function MonitorDashboard() {
  const metrics = useAppStore((s) => s.metrics);
  const fetchMetrics = useAppStore((s) => s.fetchMetrics);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [refreshing, setRefreshing] = useState(false);

  // Click detail panel state
  const [clickDetail, setClickDetail] = useState<{
    chart: string;
    dataKey: string;
    value: number | string;
    time?: string;
  } | null>(null);

  /* ── refresh handler ─────────────────────────────────────────────── */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMetrics();
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }, [fetchMetrics]);

  /* ── time-range hours ────────────────────────────────────────────── */
  const rangeHours = useMemo(
    () => TIME_RANGES.find((r) => r.value === timeRange)?.hours ?? 24,
    [timeRange],
  );

  /* ── derived chart data (filtered by time range) ─────────────────── */
  const agentNames = useMemo(() => metrics.map((m) => m.agentName), [metrics]);

  // Execution-time line chart
  const execTimeData = useMemo(() => {
    const allTimestamps = new Set<string>();
    metrics.forEach((m) => {
      filterByRange(m.executionTime, rangeHours).forEach((p) => allTimestamps.add(p.timestamp));
    });
    const sorted = Array.from(allTimestamps).sort();
    return sorted.map((ts) => {
      const row: Record<string, string | number> = { time: fmtTime(ts) };
      metrics.forEach((m) => {
        const pt = filterByRange(m.executionTime, rangeHours).find((p) => p.timestamp === ts);
        row[m.agentName] = Math.round(pt?.value ?? 0);
      });
      return row;
    });
  }, [metrics, rangeHours]);

  // Token-usage bar chart
  const tokenBarData = useMemo(() =>
    metrics.map((m) => ({
      agent: m.agentName,
      tokens: filterByRange(m.tokenUsage, rangeHours).reduce((s, p) => s + p.value, 0),
    })),
  [metrics, rangeHours]);

  // Tool-calls area chart
  const toolCallsData = useMemo(() => {
    const allTimestamps = new Set<string>();
    metrics.forEach((m) => {
      filterByRange(m.toolCalls, rangeHours).forEach((p) => allTimestamps.add(p.timestamp));
    });
    const sorted = Array.from(allTimestamps).sort();
    return sorted.map((ts) => {
      const row: Record<string, string | number> = { time: fmtTime(ts) };
      metrics.forEach((m) => {
        const pt = filterByRange(m.toolCalls, rangeHours).find((p) => p.timestamp === ts);
        row[m.agentName] = Math.round(pt?.value ?? 0);
      });
      return row;
    });
  }, [metrics, rangeHours]);

  // Success-rate pie data (based on time-range filtered data points)
  const successPieData = useMemo(() =>
    metrics.map((m) => {
      const pts = filterByRange(m.executionTime, rangeHours);
      if (pts.length === 0) return { name: m.agentName, value: 0 };
      // Use filtered data point count as a proxy for runs in range,
      // scale global successRate proportionally to range coverage
      const rangeRatio = pts.length / Math.max(m.executionTime.length, 1);
      const rangeSuccessRate = m.successRate * rangeRatio;
      return { name: m.agentName, value: +(rangeSuccessRate * 100).toFixed(1) };
    }),
  [metrics, rangeHours]);

  // Summary cards
  const totalRuns = useMemo(() => metrics.reduce((s, m) => s + m.totalRuns, 0), [metrics]);
  const avgDuration = useMemo(() => {
    if (metrics.length === 0) return '0.0';
    const total = metrics.reduce((s, m) => s + m.avgDuration, 0);
    return (total / metrics.length).toFixed(1);
  }, [metrics]);
  const overallSuccess = useMemo(() => {
    if (metrics.length === 0) return '0.0';
    const totalSr = metrics.reduce((s, m) => s + m.successRate, 0);
    return ((totalSr / metrics.length) * 100).toFixed(1);
  }, [metrics]);
  const activeAgents = useMemo(() => metrics.length, [metrics]);

  // Per-agent filtered data
  const filteredMetrics = useMemo(() =>
    selectedAgent === 'all' ? metrics : metrics.filter((m) => m.agentName === selectedAgent),
  [metrics, selectedAgent]);

  const filteredExecData = useMemo(() => {
    if (selectedAgent === 'all') return execTimeData;
    return execTimeData.map((row) => ({ time: row.time, [selectedAgent]: row[selectedAgent] }));
  }, [execTimeData, selectedAgent]);

  const filteredToolData = useMemo(() => {
    if (selectedAgent === 'all') return toolCallsData;
    return toolCallsData.map((row) => ({ time: row.time, [selectedAgent]: row[selectedAgent] }));
  }, [toolCallsData, selectedAgent]);

  /* ── chart click handler ─────────────────────────────────────────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = useCallback(
    (chart: string) =>
      (state: any) => {
        if (!state?.activePayload?.[0]) return;
        const payload = state.activePayload[0].payload as Record<string, unknown>;
        const keys = Object.keys(payload).filter(
          (k) => k !== 'time' && k !== 'agent' && typeof payload[k] === 'number',
        );
        if (keys.length === 0) return;
        setClickDetail({
          chart,
          dataKey: keys[0],
          value: payload[keys[0]] as number,
          time: payload.time as string | undefined,
        });
      },
    [],
  );

  /* ── CSV export ──────────────────────────────────────────────────── */
  const handleExportCSV = useCallback(() => {
    const rows: Record<string, unknown>[] = [];
    metrics.forEach((m) => {
      const pts = filterByRange(m.executionTime, rangeHours);
      pts.forEach((p) => {
        rows.push({
          agent: m.agentName,
          timestamp: p.timestamp,
          executionTime_ms: p.value,
        });
      });
    });
    if (rows.length === 0) {
      rows.push({ info: 'No data in selected time range' });
    }
    const csv = toCSV(rows);
    download(`monitor_metrics_${timeRange}.csv`, csv);
  }, [metrics, rangeHours, timeRange]);

  /* ── render helpers ───────────────────────────────────────────────── */
  const SummaryCards = () => (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      {/* Total Runs */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={iconWrap('var(--blue-9)20')}><RocketIcon width={20} height={20} color="var(--blue-9)" /></div>
          <div>
            <div style={{ color: 'var(--gray-9)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('monitor.totalRuns')}</div>
            <div style={{ color: 'var(--gray-12)', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{totalRuns}</div>
          </div>
        </div>
      </div>
      {/* Avg Duration */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={iconWrap('var(--green-9)20')}><ClockIcon width={20} height={20} color="var(--green-9)" /></div>
          <div>
            <div style={{ color: 'var(--gray-9)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('monitor.avgDuration')}</div>
            <div style={{ color: 'var(--gray-12)', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{avgDuration}<span style={{ fontSize: 14, color: 'var(--gray-9)', marginLeft: 4 }}>ms</span></div>
          </div>
        </div>
      </div>
      {/* Success Rate */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={iconWrap('var(--purple-9)20')}><ActivityLogIcon width={20} height={20} color="var(--purple-9)" /></div>
          <div>
            <div style={{ color: 'var(--gray-9)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('monitor.successRate')}</div>
            <div style={{ color: 'var(--gray-12)', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{overallSuccess}<span style={{ fontSize: 14, color: 'var(--gray-9)', marginLeft: 2 }}>%</span></div>
          </div>
        </div>
      </div>
      {/* Active Agents */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={iconWrap('var(--amber-3)')}><BarChartIcon width={20} height={20} color="var(--amber-9)" /></div>
          <div>
            <div style={{ color: 'var(--gray-9)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('monitor.activeAgents')}</div>
            <div style={{ color: 'var(--gray-12)', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{activeAgents}</div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── chart wrappers ───────────────────────────────────────────────── */
  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ ...cardStyle, padding: 20, minWidth: 0 }}>
      <div style={{ color: 'var(--gray-12)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );

  const renderLineChart = (data: Record<string, string | number>[], dataKeys: string[]) => (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
        onClick={handleChartClick('Execution Time')}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="time" tick={TICK_STYLE} tickLine={false} axisLine={false} />
        <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} unit="ms" />
        <ReTooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--gray-11)' }} />
        <Legend wrapperStyle={{ color: 'var(--gray-11)', fontSize: 12 }}
          onClick={(e) => {
            if (e.dataKey && typeof e.dataKey === 'string') setSelectedAgent(e.dataKey);
          }} />
        {dataKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]}
            strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  const renderBarChart = (data: { agent: string; tokens: number }[]) => (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
        onClick={handleChartClick('Token Usage')}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="agent" tick={TICK_STYLE} tickLine={false} axisLine={false} />
        <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
        <ReTooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--gray-11)' }}
          formatter={(v: number) => [fmtNum(v), 'Tokens']} />
        <Bar dataKey="tokens" radius={[6, 6, 0, 0]} cursor="pointer"
          onClick={(entry: { agent: string }) => {
            if (entry?.agent) setSelectedAgent(entry.agent);
          }}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const renderAreaChart = (data: Record<string, string | number>[], dataKeys: string[]) => (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
        onClick={handleChartClick('Tool Calls')}>
        <defs>
          {dataKeys.map((k, i) => (
            <linearGradient key={k} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.4} />
              <stop offset="1%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="time" tick={TICK_STYLE} tickLine={false} axisLine={false} />
        <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} />
        <ReTooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'var(--gray-11)' }} />
        <Legend wrapperStyle={{ color: 'var(--gray-11)', fontSize: 12 }}
          onClick={(e) => {
            if (e.dataKey && typeof e.dataKey === 'string') setSelectedAgent(e.dataKey);
          }} />
        {dataKeys.map((k, i) => (
          <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]}
            fill={`url(#grad-${i})`} strokeWidth={2} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );

  const renderPieChart = (data: { name: string; value: number }[]) => (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
          paddingAngle={4} dataKey="value" nameKey="name"
          label={({ name, value }) => `${name} ${value}%`}
          labelLine={false}
          onClick={(entry: { name: string }) => {
            if (entry?.name) setSelectedAgent(entry.name);
          }}
          cursor="pointer">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />)}
        </Pie>
        <ReTooltip contentStyle={TOOLTIP_STYLE}
          formatter={(v: number) => [`${v}%`, 'Success Rate']} />
        <Legend wrapperStyle={{ color: 'var(--gray-11)', fontSize: 12 }}
          onClick={(e) => {
            if (e.dataKey && typeof e.dataKey === 'string') setSelectedAgent(e.dataKey);
          }} />
      </PieChart>
    </ResponsiveContainer>
  );

  /* ── detail table ─────────────────────────────────────────────────── */
  const DetailTable = () => (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginTop: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-3)' }}>
        <span style={{ color: 'var(--gray-12)', fontSize: 14, fontWeight: 600 }}>{t('monitor.agentPerformanceDetail')}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--gray-3)' }}>
              {['Agent', 'Runs', 'Avg Duration', 'Success Rate', 'Total Tokens'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--gray-9)', fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.map((m, i) => {
              const totalTokens = filterByRange(m.tokenUsage, rangeHours).reduce((s, p) => s + p.value, 0);
              const agentIdx = metrics.findIndex((x) => x.agentId === m.agentId);
              return (
                <tr key={m.agentId} style={{ borderBottom: '1px solid var(--gray-3)', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onClick={() => setSelectedAgent(m.agentName)}>
                  <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[agentIdx % COLORS.length], flexShrink: 0 }} />
                    <span style={{
                      color: selectedAgent === m.agentName ? 'var(--blue-9)' : 'var(--gray-12)',
                      fontWeight: 500,
                      textDecoration: selectedAgent === m.agentName ? 'underline' : 'none',
                    }}>{m.agentName}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--gray-12)' }}>{m.totalRuns}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--gray-12)' }}>{m.avgDuration.toFixed(1)} ms</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: m.successRate >= 0.9 ? 'var(--green-3)' : 'var(--amber-3)',
                      color: m.successRate >= 0.9 ? 'var(--green-9)' : 'var(--amber-9)',
                    }}>
                      {(m.successRate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--gray-12)' }}>{fmtNum(totalTokens)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── Agent filter select ──────────────────────────────────────────── */
  const AgentSelect = () => (
    <Select.Root value={selectedAgent} onValueChange={setSelectedAgent}>
      <Select.Trigger placeholder="All agents" />
      <Select.Content>
        <Select.Item value="all">{t('monitor.allAgents')}</Select.Item>
        {agentNames.map((n) => (
          <Select.Item key={n} value={n}>{n}</Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );

  /* ── Time range selector ──────────────────────────────────────────── */
  const TimeRangeSelector = () => (
    <div style={{ display: 'flex', gap: 4, background: 'var(--gray-2)', padding: 4, borderRadius: 10, border: '1px solid var(--gray-3)' }}>
      {TIME_RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => setTimeRange(r.value)}
          style={{
            ...btnStyle,
            border: 'none',
            background: timeRange === r.value ? 'var(--gray-3)' : 'transparent',
            color: timeRange === r.value ? 'var(--gray-12)' : 'var(--gray-9)',
            fontWeight: timeRange === r.value ? 600 : 400,
            padding: '6px 14px',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  /* ── Click detail panel (sidebar) ─────────────────────────────────── */
  const ClickDetailPanel = () => {
    if (!clickDetail) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 340, height: '100vh',
        background: 'var(--gray-2)', borderLeft: '1px solid var(--gray-3)',
        zIndex: 100, padding: 24, boxShadow: 'var(--shadow-md)',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ color: 'var(--gray-12)', fontSize: 16, fontWeight: 700 }}>{t('monitor.dataPointDetail')}</span>
          <button
            onClick={() => setClickDetail(null)}
            style={{ ...btnStyle, padding: 4, borderRadius: 6, border: 'none', background: 'transparent' }}
          >
            <Cross2Icon width={18} height={18} color="var(--gray-11)" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DetailField label="Chart" value={clickDetail.chart} />
          <DetailField label="Series" value={clickDetail.dataKey} />
          <DetailField label="Value" value={String(clickDetail.value)} />
          {clickDetail.time && <DetailField label="Time" value={clickDetail.time} />}
          <div style={{ borderTop: '1px solid var(--gray-3)', paddingTop: 16 }}>
            <button
              onClick={() => { setSelectedAgent(clickDetail.dataKey); setClickDetail(null); }}
              style={{ ...btnStyle, width: '100%', justifyContent: 'center', background: 'var(--blue-9)', border: 'none', color: 'var(--gray-1)', fontWeight: 600 }}
            >
              {t('monitor.viewDetails', { name: clickDetail.dataKey })}
            </button>
          </div>
          <div style={{ color: 'var(--gray-9)', fontSize: 12, lineHeight: 1.6 }}>
            {t('monitor.clickHint')}
          </div>
        </div>
      </div>
    );
  };

  const DetailField = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div style={{ color: 'var(--gray-9)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--gray-12)', fontSize: 14, fontWeight: 500 }}>{value}</div>
    </div>
  );

  /* ── main render ──────────────────────────────────────────────────── */
  return (
    <Tooltip.Provider delayDuration={200}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-12)', margin: 0 }}>{t('monitor.title')}</h1>
            <p style={{ color: 'var(--gray-9)', fontSize: 13, margin: '4px 0 0' }}>{t('monitor.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TimeRangeSelector />
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ ...btnStyle, opacity: refreshing ? 0.6 : 1 }}
              title="刷新数据"
            >
              <ReloadIcon
                width={14} height={14}
                style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
              />
              {refreshing ? t('monitor.refreshing') : t('monitor.refresh')}
            </button>
            {/* Export CSV */}
            <button onClick={handleExportCSV} style={btnStyle} title="导出 CSV">
              <DownloadIcon width={14} height={14} />
              {t('monitor.exportCsv')}
            </button>
            {/* Screenshot hint */}
            <button
              onClick={() => alert(t('monitor.screenshotHint'))}
              style={btnStyle}
              title="截图说明"
            >
              <CameraIcon width={14} height={14} />
              {t('monitor.screenshot')}
            </button>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-9)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ color: 'var(--gray-9)', fontSize: 12 }}>Live</span>
          </div>
        </div>

        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <Tabs.List style={{ display: 'flex', gap: 4, background: 'var(--gray-2)', padding: 4, borderRadius: 10, border: '1px solid var(--gray-3)' }}>
              {['overview', 'per-agent', 'timeline', 'advanced'].map((tab) => (
                <Tabs.Trigger key={tab} value={tab}
                  style={{
                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                    background: activeTab === tab ? 'var(--gray-3)' : 'transparent',
                    color: activeTab === tab ? 'var(--gray-12)' : 'var(--gray-9)',
                  }}>
                  {tab === 'per-agent' ? t('monitor.perAgent') : tab === 'advanced' ? t('monitor.advanced') : tab === 'overview' ? t('monitor.overview') : t('monitor.timeline')}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <AgentSelect />
          </div>

          {/* ── Overview tab ──────────────────────────────────────── */}
          <Tabs.Content value="overview" style={{ outline: 'none' }}>
            <SummaryCards />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 24 }}>
              <ChartCard title={t('monitor.executionTimeOverTime')}>
                {renderLineChart(execTimeData, agentNames)}
              </ChartCard>
              <ChartCard title={t('monitor.tokenUsageByAgent')}>
                {renderBarChart(tokenBarData)}
              </ChartCard>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
              <ChartCard title={t('monitor.toolCallsOverTime')}>
                {renderAreaChart(toolCallsData, agentNames)}
              </ChartCard>
              <ChartCard title={t('monitor.successRateDistribution')}>
                {renderPieChart(successPieData)}
              </ChartCard>
            </div>
            <DetailTable />
          </Tabs.Content>

          {/* ── Per Agent tab ─────────────────────────────────────── */}
          <Tabs.Content value="per-agent" style={{ outline: 'none' }}>
            <SummaryCards />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 24 }}>
              <ChartCard title={selectedAgent === 'all' ? 'Execution Time — All Agents' : `Execution Time — ${selectedAgent}`}>
                {renderLineChart(filteredExecData, selectedAgent === 'all' ? agentNames : [selectedAgent])}
              </ChartCard>
              <ChartCard title="Token Usage">
                {renderBarChart(selectedAgent === 'all' ? tokenBarData : tokenBarData.filter((d) => d.agent === selectedAgent))}
              </ChartCard>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
              <ChartCard title={selectedAgent === 'all' ? 'Tool Calls — All Agents' : `Tool Calls — ${selectedAgent}`}>
                {renderAreaChart(filteredToolData, selectedAgent === 'all' ? agentNames : [selectedAgent])}
              </ChartCard>
              <ChartCard title="Success Rate">
                {renderPieChart(selectedAgent === 'all' ? successPieData : successPieData.filter((d) => d.name === selectedAgent))}
              </ChartCard>
            </div>
            <DetailTable />
          </Tabs.Content>

          {/* ── Timeline tab ──────────────────────────────────────── */}
          <Tabs.Content value="timeline" style={{ outline: 'none' }}>
            <SummaryCards />
            <ChartCard title="Execution Time — Timeline">
              {renderLineChart(execTimeData, agentNames)}
            </ChartCard>
            <div style={{ height: 16 }} />
            <ChartCard title="Tool Calls — Timeline">
              {renderAreaChart(toolCallsData, agentNames)}
            </ChartCard>
            <DetailTable />
          </Tabs.Content>

          {/* ── Advanced tab ─────────────────────────────────────── */}
          <Tabs.Content value="advanced" style={{ outline: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 16 }}>
              <HeatmapChart />
              <AgentRadarChart />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
              <WaterfallChart />
              <HealthGauge />
            </div>
          </Tabs.Content>
        </Tabs.Root>

        {/* Click detail sidebar */}
        <ClickDetailPanel />
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Tooltip.Provider>
  );
}
