import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getCollaborationManager } from '../../communication/websocket';
import type { WSMessage } from '../../communication/websocket';
import { useAppStore } from '../../stores/useAppStore';

interface RemoteCursor {
  userId: string;
  nickname: string;
  color: string;
  x: number;
  y: number;
  lastUpdate: number;
}

/**
 * 实时光标叠加层
 * 在 WorkflowView 上显示其他用户的光标位置
 * 使用 CSS 绝对定位，需要包裹在相对定位的容器中
 */
export function CursorOverlay() {
  const onlineUsers = useAppStore((s) => s.onlineUsers);
  const collaborationEnabled = useAppStore((s) => s.collaborationEnabled);
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听远程光标消息
  useEffect(() => {
    if (!collaborationEnabled) return;

    const manager = getCollaborationManager();
    const unsub = manager.on('cursor', (msg: WSMessage) => {
      const pos = msg.payload as { x: number; y: number };
      const user = onlineUsers.find((u) => u.id === msg.userId);
      if (!user) return;

      setCursors((prev) => {
        const next = new Map(prev);
        next.set(msg.userId, {
          userId: msg.userId,
          nickname: user.nickname,
          color: user.color,
          x: pos.x,
          y: pos.y,
          lastUpdate: Date.now(),
        });
        return next;
      });
    });

    return unsub;
  }, [collaborationEnabled, onlineUsers]);

  // 广播本地光标位置
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!collaborationEnabled) return;
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const manager = getCollaborationManager();
      manager.broadcastCursor({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [collaborationEnabled],
  );

  // 清理过期光标（5秒无更新则移除）
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const next = new Map(prev);
        let changed = false;
        next.forEach((cursor, key) => {
          if (now - cursor.lastUpdate > 5000) {
            next.delete(key);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!collaborationEnabled) return null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {Array.from(cursors.values()).map((cursor) => (
        <div
          key={cursor.userId}
          style={{
            position: 'absolute',
            left: cursor.x,
            top: cursor.y,
            pointerEvents: 'none',
            transition: 'left 0.1s linear, top 0.1s linear',
          }}
        >
          {/* 光标箭头 */}
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            style={{ display: 'block' }}
          >
            <path
              d="M1 1L7 18L9 11L15 9L1 1Z"
              fill={cursor.color}
              stroke="var(--gray-1)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          {/* 用户昵称标签 */}
          <div
            style={{
              position: 'absolute',
              left: 16,
              top: 14,
              background: cursor.color,
              color: 'var(--gray-1)',
              fontSize: '11px',
              fontWeight: 500,
              padding: '2px 6px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-sm)',
              lineHeight: '1.3',
            }}
          >
            {cursor.nickname}
          </div>
        </div>
      ))}
    </div>
  );
}
