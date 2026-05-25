import React, { useEffect, useState, useCallback } from 'react';
import {
  TimerIcon,
  StopwatchIcon,
  ActivityLogIcon,
  ReloadIcon,
  LapTimerIcon,
} from '@radix-ui/react-icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import {
  collectPageLoadMetrics,
  getPerformanceSnapshot,
  getApiStats,
  getApiTrendData,
  getMemoryUsage,
  getRenderCount,
  type ApiCallRecord,
  type PerformanceSnapshot,
} from '../../utils/performance';
import { Separator } from '../../components/ui/separator';
import { useTranslation } from '../../i18n';

// ── Styles ────────────────────────────────────────────────────────────

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
  border: '1px solid var(--gray-6)',
  borderRadius: 10,
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 180,
  flex: 1,
};

const cardLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--gray-10)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const cardValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: 'var(--gray-12)',
  letterSpacing: '-0.02em',
};

const cardSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--gray-10)',
};

// ── Status badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'success' | 'error' }) {
  const bg = status === 'success' ? 'var(--green-3)' : 'var(--red-3)';
  const color = status === 'success' ? 'var(--green-11)' : 'var(--red-11)';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: bg,
      color,
    }}>
      {status === 'success' ? 'OK' : 'ERR'}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function PerformanceMonitor() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [stats, setStats] = useState(getApiStats());
  const [trendData, setTrendData] = useState<{ time: string; duration: number; endpoint: string }[]>([]);
  const [memory, setMemory] = useState(getMemoryUsage());
  const [renders, setRenders] = useState(getRenderCount());

  const refresh = useCallback(() => {
    collectPageLoadMetrics();
    setSnapshot(getPerformanceSnapshot());
    setStats(getApiStats());
    setTrendData(getApiTrendData());
    setMemory(getMemoryUsage());
    setRenders(getRenderCount());
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const pageLoadTime = snapshot?.pageLoadTime ?? 0;
  const apiCalls = snapshot?.apiCalls ?? [];

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TimerIcon width={20} height={20} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--gray-12)' }}>
            {t('performance.title')}
          </h2>
        </div>
        <button
          onClick={refresh}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 6,
            border: '1px solid var(--gray-6)', background: 'var(--gray-3)',
            color: 'var(--gray-11)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gray-3)'; }}
        >
          <ReloadIcon width={12} height={12} /> {t('performance.refresh')}
        </button>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={cardStyle}>
          <span style={cardLabelStyle}><LapTimerIcon width={14} height={14} /> {t('performance.pageLoad')}</span>
          <span style={cardValueStyle}>{pageLoadTime > 0 ? `${pageLoadTime}ms` : 'N/A'}</span>
          <span style={cardSubStyle}>{t('performance.fullPageLoadTime')}</span>
        </div>
        <div style={cardStyle}>
          <span style={cardLabelStyle}><StopwatchIcon width={14} height={14} /> {t('performance.avgResponse')}</span>
          <span style={cardValueStyle}>{stats.avgDuration > 0 ? `${stats.avgDuration}ms` : 'N/A'}</span>
          <span style={cardSubStyle}>{t('performance.avgApiResponseTime')}</span>
        </div>
        <div style={cardStyle}>
          <span style={cardLabelStyle}><ActivityLogIcon width={14} height={14} /> {t('performance.totalRequests')}</span>
          <span style={cardValueStyle}>{stats.totalCalls}</span>
          <span style={cardSubStyle}>
            <span style={{ color: 'var(--green-11)' }}>{stats.successCalls} OK</span>
            {' / '}
            <span style={{ color: 'var(--red-11)' }}>{stats.errorCalls} Err</span>
          </span>
        </div>
        {memory && (
          <div style={cardStyle}>
            <span style={cardLabelStyle}><TimerIcon width={14} height={14} /> {t('performance.memory')}</span>
            <span style={cardValueStyle}>{memory.used}MB</span>
            <span style={cardSubStyle}>of {memory.total}MB used ({Math.round(memory.used / memory.total * 100)}%)</span>
          </div>
        )}
        <div style={cardStyle}>
          <span style={cardLabelStyle}><TimerIcon width={14} height={14} /> {t('performance.renders')}</span>
          <span style={cardValueStyle}>{renders}</span>
          <span style={cardSubStyle}>{t('performance.componentRenderCount')}</span>
        </div>
      </div>

      {/* Min / Max duration */}
      {stats.totalCalls > 0 && (
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ ...cardStyle, flex: 1 }}>
            <span style={cardLabelStyle}>{t('performance.minDuration')}</span>
            <span style={{ ...cardValueStyle, fontSize: 20 }}>{stats.minDuration}ms</span>
          </div>
          <div style={{ ...cardStyle, flex: 1 }}>
            <span style={cardLabelStyle}>{t('performance.maxDuration')}</span>
            <span style={{ ...cardValueStyle, fontSize: 20 }}>{stats.maxDuration}ms</span>
          </div>
        </div>
      )}

      {/* API Response Time Trend */}
      <div style={{
        background: 'var(--gray-2)', border: '1px solid var(--gray-6)', borderRadius: 10,
        padding: '16px 20px', minHeight: 280,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-12)', margin: '0 0 12px 0' }}>
          {t('performance.apiResponseTimeTrend')}
        </h3>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="time" tick={TICK_STYLE} />
              <YAxis tick={TICK_STYLE} unit="ms" />
              <ReTooltip contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="duration"
                stroke="var(--blue-9)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--blue-9)' }}
                activeDot={{ r: 5 }}
                name="Duration"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 220, color: 'var(--gray-10)', fontSize: 13,
          }}>
            {t('performance.noApiCalls')}
          </div>
        )}
      </div>

      {/* Recent API Calls List */}
      <div style={{
        background: 'var(--gray-2)', border: '1px solid var(--gray-6)', borderRadius: 10,
        padding: '16px 20px', flex: 1, minHeight: 200,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-12)', margin: '0 0 12px 0' }}>
          {t('performance.recentApiCalls')}
        </h3>
        {apiCalls.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 80px 160px',
              padding: '8px 12px', fontSize: 11, fontWeight: 600,
              color: 'var(--gray-10)', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <span>Endpoint</span>
              <span>Duration</span>
              <span>Status</span>
              <span>Time</span>
            </div>
            <Separator />
            {/* Data rows - show last 20 */}
            {apiCalls.slice(-20).reverse().map((call, i) => (
              <div
                key={`${call.timestamp}-${i}`}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 80px 160px',
                  padding: '8px 12px', fontSize: 13, color: 'var(--gray-12)',
                  background: i % 2 === 0 ? 'transparent' : 'var(--gray-1)',
                  borderRadius: 4,
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {call.endpoint}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(call.duration)}ms</span>
                <StatusBadge status={call.status} />
                <span style={{ color: 'var(--gray-10)', fontSize: 12 }}>
                  {new Date(call.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 120, color: 'var(--gray-10)', fontSize: 13,
          }}>
            {t('performance.noApiCallsHint')}
          </div>
        )}
      </div>
    </div>
  );
}
