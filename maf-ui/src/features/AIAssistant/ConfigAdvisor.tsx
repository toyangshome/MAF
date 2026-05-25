import React, { useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { analyzeConfig } from './suggestions';
import type { ConfigAdvice } from './types';
import {
  ExclamationTriangleIcon,
  InfoCircledIcon,
  CrossCircledIcon,
  CheckCircledIcon,
  GearIcon,
} from '@radix-ui/react-icons';

/** 严重级别对应的样式配置 */
const SEVERITY_CONFIG: Record<
  ConfigAdvice['severity'],
  { color: string; bg: string; icon: React.ReactNode; label: string }
> = {
  info: {
    color: 'var(--blue-11)',
    bg: 'var(--blue-3)',
    icon: <InfoCircledIcon width={14} height={14} />,
    label: '建议',
  },
  warning: {
    color: 'var(--amber-11)',
    bg: 'var(--amber-3)',
    icon: <ExclamationTriangleIcon width={14} height={14} />,
    label: '警告',
  },
  error: {
    color: 'var(--red-11)',
    bg: 'var(--red-3)',
    icon: <CrossCircledIcon width={14} height={14} />,
    label: '问题',
  },
};

/**
 * 配置推荐面板组件
 * 分析当前配置并给出优化建议，显示在 ConfigPanel 右侧
 */
export default function ConfigAdvisor() {
  const config = useAppStore((s) => s.config);

  const adviceList = useMemo(() => analyzeConfig(config), [config]);

  const grouped = useMemo(() => {
    const groups: Record<ConfigAdvice['severity'], ConfigAdvice[]> = {
      error: [],
      warning: [],
      info: [],
    };
    for (const a of adviceList) {
      groups[a.severity].push(a);
    }
    return groups;
  }, [adviceList]);

  const hasIssues = grouped.error.length > 0 || grouped.warning.length > 0;

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
        <GearIcon width={16} height={16} color="var(--accent-9)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-12)' }}>
          配置分析
        </span>
        {adviceList.length === 0 ? (
          <span
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 9999,
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--green-11)',
              background: 'var(--green-3)',
            }}
          >
            <CheckCircledIcon width={10} height={10} />
            正常
          </span>
        ) : (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '10px',
              color: 'var(--gray-9)',
              padding: '1px 6px',
              borderRadius: 9999,
              background: 'var(--gray-4)',
            }}
          >
            {adviceList.length} 条建议
          </span>
        )}
      </div>

      {/* summary */}
      {hasIssues && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--amber-6)',
            background: 'var(--amber-2)',
            marginBottom: 14,
            fontSize: '12px',
            color: 'var(--amber-11)',
            lineHeight: 1.5,
          }}
        >
          检测到 {grouped.error.length} 个问题和 {grouped.warning.length} 个警告需要关注。
        </div>
      )}

      {/* advice list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {adviceList.length === 0 ? (
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
            <CheckCircledIcon width={24} height={24} color="var(--green-9)" />
            <span style={{ fontSize: '12px', color: 'var(--gray-9)' }}>配置合理，暂无优化建议</span>
          </div>
        ) : (
          adviceList.map((advice, idx) => {
            const cfg = SEVERITY_CONFIG[advice.severity];
            return (
              <div
                key={`${advice.field}-${idx}`}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${cfg.color}33`,
                  background: cfg.bg,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: cfg.color, flexShrink: 0, display: 'flex' }}>{cfg.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--gray-9)',
                      fontFamily: 'var(--font-mono, monospace)',
                      marginLeft: 'auto',
                    }}
                  >
                    {advice.field}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--gray-12)', lineHeight: 1.5 }}>
                  {advice.message}
                </p>
                {advice.suggestedValue && (
                  <div
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ color: 'var(--gray-9)' }}>当前:</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        color: 'var(--red-11)',
                        background: 'var(--red-3)',
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {advice.currentValue}
                    </span>
                    <span style={{ color: 'var(--gray-7)' }}>&rarr;</span>
                    <span style={{ color: 'var(--gray-9)' }}>建议:</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        color: 'var(--green-11)',
                        background: 'var(--green-3)',
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {advice.suggestedValue}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
