import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { diagnoseError, extractErrorsFromLogs } from './suggestions';
import {
  CrossCircledIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LightningBoltIcon,
  ListBulletIcon,
} from '@radix-ui/react-icons';

/**
 * 错误诊断助手组件
 * 任务失败时显示诊断建议，分析错误消息提供修复建议
 */
export default function ErrorDiagnoser() {
  const tasks = useAppStore((s) => s.tasks);
  const logs = useAppStore((s) => s.logs);

  // 获取失败的任务
  const failedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'failed' && t.result);
  }, [tasks]);

  // 从日志中提取错误
  const errorLogs = useMemo(() => extractErrorsFromLogs(logs), [logs]);

  // 对每个失败任务进行错误诊断
  const diagnoses = useMemo(() => {
    const results: Array<{
      taskId: string;
      taskDesc: string;
      error: string;
      diagnoses: ReturnType<typeof diagnoseError>;
    }> = [];

    for (const task of failedTasks) {
      if (!task.result) continue;
      const d = diagnoseError(task.result);
      results.push({
        taskId: task.id,
        taskDesc: task.description,
        error: task.result,
        diagnoses: d,
      });
    }

    // 也分析日志中的错误
    for (const log of errorLogs) {
      const d = diagnoseError(log.message);
      // 避免重复
      if (!results.some((r) => r.error === log.message)) {
        results.push({
          taskId: log.id,
          taskDesc: log.message.slice(0, 60),
          error: log.message,
          diagnoses: d,
        });
      }
    }

    return results;
  }, [failedTasks, errorLogs]);

  if (diagnoses.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          borderRadius: 10,
          border: '1px solid var(--gray-6)',
          background: 'var(--gray-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <LightningBoltIcon width={16} height={16} color="var(--accent-9)" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-12)' }}>
            错误诊断
          </span>
        </div>
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
          <CrossCircledIcon width={24} height={24} color="var(--green-9)" />
          <span style={{ fontSize: '12px', color: 'var(--gray-9)' }}>暂无错误需要诊断</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: 10,
        border: '1px solid var(--gray-6)',
        background: 'var(--gray-2)',
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <LightningBoltIcon width={16} height={16} color="var(--accent-9)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-12)' }}>
          错误诊断
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--red-11)',
            padding: '1px 8px',
            borderRadius: 9999,
            background: 'var(--red-3)',
          }}
        >
          {diagnoses.length} 个错误
        </span>
      </div>

      {/* diagnoses list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {diagnoses.map((item) => (
          <DiagnosisCard key={item.taskId} {...item} />
        ))}
      </div>
    </div>
  );
}

/** 单个诊断卡片 */
function DiagnosisCard({
  taskId,
  taskDesc,
  error,
  diagnoses,
}: {
  taskId: string;
  taskDesc: string;
  error: string;
  diagnoses: ReturnType<typeof diagnoseError>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid var(--red-6)',
        background: 'var(--gray-1)',
        overflow: 'hidden',
      }}
    >
      {/* card header */}
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
          color: 'var(--gray-12)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <ExclamationTriangleIcon width={14} height={14} color="var(--red-9)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--gray-9)', fontFamily: 'var(--font-mono, monospace)' }}>
            {taskId}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--gray-12)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {taskDesc.length > 60 ? taskDesc.slice(0, 60) + '...' : taskDesc}
          </div>
        </div>
        {expanded ? (
          <ChevronUpIcon width={14} height={14} color="var(--gray-8)" />
        ) : (
          <ChevronDownIcon width={14} height={14} color="var(--gray-8)" />
        )}
      </button>

      {/* expanded content */}
      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--gray-5)' }}>
          {/* error message */}
          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              borderRadius: 6,
              background: 'var(--red-2)',
              border: '1px solid var(--red-5)',
              marginBottom: 10,
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: '11px',
                color: 'var(--red-11)',
                fontFamily: 'var(--font-mono, monospace)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 80,
                overflow: 'auto',
              }}
            >
              {error}
            </pre>
          </div>

          {/* diagnosis items */}
          {diagnoses.map((diag, idx) => (
            <div key={idx} style={{ marginBottom: idx < diagnoses.length - 1 ? 10 : 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: diag.severity === 'error' ? 'var(--red-11)' : 'var(--amber-11)',
                  }}
                >
                  {diag.severity === 'error' ? '错误' : '警告'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--gray-12)' }}>{diag.diagnosis}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {diag.suggestions.map((sug, sIdx) => (
                  <div
                    key={sIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: 'var(--gray-3)',
                    }}
                  >
                    <ListBulletIcon
                      width={10}
                      height={10}
                      color="var(--accent-9)"
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--gray-11)', lineHeight: 1.5 }}>{sug}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
