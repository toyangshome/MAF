import React from 'react';
import { useAppStore } from '../../stores/useAppStore';

/**
 * 在线用户列表指示器
 * 显示当前在线用户的头像（首字母 + 颜色）和昵称
 */
export function PresenceIndicators() {
  const onlineUsers = useAppStore((s) => s.onlineUsers);

  if (onlineUsers.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
      role="status"
      aria-label={`在线用户: ${onlineUsers.length}`}
    >
      {onlineUsers.map((user) => (
        <div
          key={user.id}
          title={user.nickname}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: user.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--gray-1)',
            border: '2px solid var(--gray-2)',
            cursor: 'default',
            flexShrink: 0,
          }}
        >
          {getInitials(user.nickname)}
        </div>
      ))}
      <span
        style={{
          fontSize: '12px',
          color: 'var(--gray-11)',
          marginLeft: '4px',
          whiteSpace: 'nowrap',
        }}
      >
        {onlineUsers.length} 在线
      </span>
    </div>
  );
}

/** 从昵称取首字母（最多2个字符） */
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.split(/[\s\-_]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
