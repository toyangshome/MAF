import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { analyzeConfig, extractErrorsFromLogs, analyzeWorkflow, diagnoseError } from './suggestions';
import type { Suggestion } from './types';
import {
  RocketIcon,
  GearIcon,
  CrossCircledIcon,
  LightningBoltIcon,
  ChevronRightIcon,
  Cross2Icon,
  InfoCircledIcon,
  ExclamationTriangleIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons';

/** Tab 定义 */
type AICategory = 'all' | 'task' | 'config' | 'error' | 'workflow';

const TABS: Array<{ key: AICategory; label: string; icon: React.ReactNode }> = [
  { key: 'all', label: '全部', icon: <RocketIcon width={12} height={12} /> },
  { key: 'task', label: '任务', icon: <RocketIcon width={12} height={12} /> },
  { key: 'config', label: '配置', icon: <GearIcon width={12} height={12} /> },
  { key: 'error', label: '错误', icon: <CrossCircledIcon width={12} height={12} /> },
  { key: 'workflow', label: '工作流', icon: <LightningBoltIcon width={12} height={12} /> },
];

/** 严重级别样式 */
const SEVERITY_STYLE: Record<Suggestion['severity'], { color: string; bg: string; icon: React.ReactNode }> = {
  info: { color: 'var(--blue-11)', bg: 'var(--blue-3)', icon: <InfoCircledIcon width={12} height={12} /> },
  warning: { color: 'var(--amber-11)', bg: 'var(--amber-3)', icon: <ExclamationTriangleIcon width={12} height={12} /> },
  error: { color: 'var(--red-11)', bg: 'var(--red-3)', icon: <CrossCircledIcon width={12} height={12} /> },
  success: { color: 'var(--green-11)', bg: 'var(--green-3)', icon: <CheckCircledIcon width={12} height={12} /> },
};

/**
 * AI 助手面板
 * 统一的 AI 助手入口，快捷键 Cmd+J / Ctrl+J 打开
 * 显示上下文相关的建议，分类：任务、配置、错误、工作流
 */
export default function AIAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AICategory>('all');

  const tasks = useAppStore((s) => s.tasks);
  const config = useAppStore((s) => s.config);
  const logs = useAppStore((s) => s.logs);
  const workflowNodes = useAppStore((s) => s.workflowNodes);
  const currentPage = useAppStore((s) => s.currentPage);

  // 快捷键 Cmd+J / Ctrl+J 打开面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // 根据当前页面自动切换 tab
  useEffect(() => {
    if (currentPage === 'config') setActiveTab('config');
    else if (currentPage === 'workflow') setActiveTab('workflow');
    else if (currentPage === 'tasks') setActiveTab('task');
    else if (currentPage === 'logs') setActiveTab('error');
  }, [currentPage]);

  // 汇总所有建议
  const suggestions = useMemo((): Suggestion[] => {
    const all: Suggestion[] = [];

    // 配置建议
    const configAdvice = analyzeConfig(config);
    for (const advice of configAdvice) {
      all.push({
        id: `config-${advice.field}`,
        type: 'config',
        severity: advice.severity === 'error' ? 'error' : advice.severity,
        title: `${advice.field}: ${advice.suggestedValue ? `${advice.currentValue} -> ${advice.suggestedValue}` : advice.currentValue}`,
        description: advice.message,
      });
    }

    // 错误建议
    const failedTasks = tasks.filter((t) => t.status === 'failed' && t.result);
    for (const task of failedTasks) {
      const diagnoses = diagnoseError(task.result || '');
      for (const d of diagnoses) {
        all.push({
          id: `error-${task.id}-${d.errorPattern}`,
          type: 'error',
          severity: d.severity,
          title: `任务 ${task.id}: ${d.diagnosis}`,
          description: d.suggestions.join('；'),
        });
      }
    }

    // 日志错误
    const errorLogs = extractErrorsFromLogs(logs);
    for (const log of errorLogs.slice(-5)) {
      const diagnoses = diagnoseError(log.message);
      for (const d of diagnoses) {
        all.push({
          id: `error-log-${log.id}-${d.errorPattern}`,
          type: 'error',
          severity: d.severity,
          title: `日志错误: ${d.diagnosis}`,
          description: d.suggestions.join('；'),
        });
      }
    }

    // 工作流建议
    const workflowOpts = analyzeWorkflow(workflowNodes);
    for (const opt of workflowOpts) {
      all.push({
        id: `workflow-${opt.type}-${opt.affectedNodes.join('-')}`,
        type: 'workflow',
        severity: opt.type === 'bottleneck' ? 'warning' : 'info',
        title: opt.title,
        description: opt.description,
      });
    }

    // 任务建议（基于当前活跃任务数量）
    const runningTasks = tasks.filter((t) => t.status === 'running');
    const blockedTasks = tasks.filter((t) => t.status === 'blocked');
    if (runningTasks.length > 5) {
      all.push({
        id: 'task-too-many-running',
        type: 'task',
        severity: 'warning',
        title: `当前有 ${runningTasks.length} 个任务在运行`,
        description: '并发任务过多可能导致资源竞争和响应变慢，建议控制在 5 个以内。',
      });
    }
    if (blockedTasks.length > 0) {
      all.push({
        id: 'task-blocked',
        type: 'task',
        severity: 'info',
        title: `${blockedTasks.length} 个任务处于阻塞状态`,
        description: '这些任务的依赖尚未完成，请检查上游任务状态。',
      });
    }

    // 成功提示
    if (failedTasks.length === 0 && errorLogs.length === 0 && tasks.length > 0) {
      all.push({
        id: 'all-good',
        type: 'task',
        severity: 'success',
        title: '系统运行正常',
        description: '所有任务执行正常，无错误记录。',
      });
    }

    return all;
  }, [tasks, config, logs, workflowNodes]);

  // 按 tab 过滤
  const filtered = useMemo(() => {
    if (activeTab === 'all') return suggestions;
    return suggestions.filter((s) => s.type === activeTab);
  }, [suggestions, activeTab]);

  // 各类别计数
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: suggestions.length };
    for (const s of suggestions) {
      c[s.type] = (c[s.type] || 0) + 1;
    }
    return c;
  }, [suggestions]);

  // 错误和警告数量（用于 badge）
  const errorCount = suggestions.filter((s) => s.severity === 'error').length;
  const warningCount = suggestions.filter((s) => s.severity === 'warning').length;

  const handleClose = useCallback(() => setOpen(false), []);

  if (!open) {
    // 浮动按钮
    return (
      <button
        onClick={() => setOpen(true)}
        title="AI 助手 (Ctrl+J)"
        aria-label="打开 AI 助手面板"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          background: 'var(--accent-9)',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-sm)',
          zIndex: 1000,
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }}
      >
        <LightningBoltIcon width={20} height={20} />
        {(errorCount > 0 || warningCount > 0) && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: errorCount > 0 ? 'var(--red-9)' : 'var(--amber-9)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {errorCount + warningCount}
          </span>
        )}
      </button>
    );
  }

  // 侧滑面板
  return (
    <>
      {/* overlay */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 1000,
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* panel */}
      <div
        role="dialog"
        aria-label="AI 助手面板"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 400,
          height: '100vh',
          background: 'var(--gray-1)',
          borderLeft: '1px solid var(--gray-6)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)',
          animation: 'slideIn 0.2s ease',
        }}
      >
        {/* panel header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 20px',
            borderBottom: '1px solid var(--gray-6)',
            background: 'var(--gray-2)',
          }}
        >
          <LightningBoltIcon width={18} height={18} color="var(--accent-9)" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-12)' }}>AI 助手</span>
          <span style={{ fontSize: '11px', color: 'var(--gray-8)' }}>Ctrl+J</span>
          <div style={{ flex: 1 }} />
          {/* summary badges */}
          {errorCount > 0 && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 9999,
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--red-11)',
                background: 'var(--red-3)',
              }}
            >
              {errorCount} 错误
            </span>
          )}
          {warningCount > 0 && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 9999,
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--amber-11)',
                background: 'var(--amber-3)',
              }}
            >
              {warningCount} 警告
            </span>
          )}
          <button
            onClick={handleClose}
            aria-label="关闭面板"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: 'var(--gray-4)',
              cursor: 'pointer',
              color: 'var(--gray-11)',
              padding: 0,
            }}
          >
            <Cross2Icon width={14} height={14} />
          </button>
        </div>

        {/* tab bar */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            padding: '0 12px',
            borderBottom: '1px solid var(--gray-6)',
            background: 'var(--gray-2)',
          }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const count = counts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 10px',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--accent-9)' : '2px solid transparent',
                  background: 'transparent',
                  color: active ? 'var(--gray-12)' : 'var(--gray-9)',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'color 0.1s, border-color 0.1s',
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    style={{
                      padding: '0 5px',
                      borderRadius: 9999,
                      fontSize: '9px',
                      fontWeight: 600,
                      background: active ? 'var(--accent-4)' : 'var(--gray-4)',
                      color: active ? 'var(--accent-11)' : 'var(--gray-9)',
                      minWidth: 14,
                      textAlign: 'center',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* suggestions list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          {filtered.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '40px 0',
                color: 'var(--gray-8)',
              }}
            >
              <CheckCircledIcon width={28} height={28} color="var(--green-9)" />
              <span style={{ fontSize: '13px', color: 'var(--gray-9)' }}>
                {activeTab === 'all' ? '暂无建议' : `暂无${TABS.find((t) => t.key === activeTab)?.label}类建议`}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--gray-6)',
            background: 'var(--gray-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: '10px', color: 'var(--gray-8)' }}>
            基于当前配置、任务、日志和工作流实时分析
          </span>
        </div>
      </div>

      {/* keyframe animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  );
}

/** 单条建议卡片 */
function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const style = SEVERITY_STYLE[suggestion.severity];

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 8,
        border: `1px solid ${style.color}22`,
        background: 'var(--gray-2)',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${style.color}55`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${style.color}22`;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 6,
            background: style.bg,
            color: style.color,
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {style.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-12)', lineHeight: 1.4, marginBottom: 4 }}>
            {suggestion.title}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--gray-10)', lineHeight: 1.5 }}>
            {suggestion.description}
          </div>
        </div>
      </div>
    </div>
  );
}
