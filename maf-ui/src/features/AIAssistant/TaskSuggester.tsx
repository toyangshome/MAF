import React, { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { matchTaskDescriptions } from './suggestions';
import { RocketIcon, ClockIcon } from '@radix-ui/react-icons';

interface TaskSuggesterProps {
  input: string;
  onSelect: (description: string) => void;
}

/**
 * 任务描述智能建议组件
 * 基于历史任务进行模糊匹配，显示在任务输入框下方
 */
export default function TaskSuggester({ input, onSelect }: TaskSuggesterProps) {
  const tasks = useAppStore((s) => s.tasks);
  const [hoveredIdx, setHoveredIdx] = useState<number>(-1);

  // 从历史任务中提取唯一描述（排除当前活跃任务）
  const historyDescriptions = useMemo(() => {
    const seen = new Set<string>();
    return tasks
      .filter((t) => t.status === 'completed' || t.status === 'failed')
      .map((t) => t)
      .filter((t) => {
        if (seen.has(t.description)) return false;
        seen.add(t.description);
        return true;
      });
  }, [tasks]);

  // 基于输入进行模糊匹配
  const suggestions = useMemo(() => {
    return matchTaskDescriptions(input, historyDescriptions, 5);
  }, [input, historyDescriptions]);

  const handleSelect = useCallback(
    (desc: string) => {
      onSelect(desc);
    },
    [onSelect]
  );

  // 无输入或无匹配时不显示
  if (!input.trim() || suggestions.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="任务描述建议"
      style={{
        marginTop: 6,
        borderRadius: 8,
        border: '1px solid var(--gray-6)',
        background: 'var(--gray-1)',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderBottom: '1px solid var(--gray-6)',
          background: 'var(--gray-2)',
        }}
      >
        <RocketIcon width={12} height={12} color="var(--amber-9)" />
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--gray-10)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          历史任务建议
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: 'var(--gray-8)',
            padding: '0 6px',
            borderRadius: 9999,
            background: 'var(--gray-4)',
          }}
        >
          {suggestions.length}
        </span>
      </div>

      {/* suggestions list */}
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {suggestions.map((s, idx) => (
          <button
            key={`${s.description.slice(0, 50)}-${idx}`}
            role="option"
            aria-selected={hoveredIdx === idx}
            onClick={() => handleSelect(s.description)}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: hoveredIdx === idx ? 'var(--gray-3)' : 'transparent',
              color: 'var(--gray-12)',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.1s',
              borderBottom: idx < suggestions.length - 1 ? '1px solid var(--gray-5)' : 'none',
            }}
          >
            <ClockIcon width={12} height={12} color="var(--gray-7)" style={{ flexShrink: 0 }} />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.description}
            </span>
            <span
              style={{
                fontSize: '10px',
                color: 'var(--gray-8)',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(s.score * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
