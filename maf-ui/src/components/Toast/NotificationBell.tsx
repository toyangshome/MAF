import React, { useState, useRef, useEffect } from 'react';
import { BellIcon, CheckIcon, TrashIcon } from '@radix-ui/react-icons';
import { useAppStore } from '../../stores/useAppStore';

export function NotificationBell() {
  const notifications = useAppStore((s) => s.notifications);
  const markAllRead = useAppStore((s) => s.markAllRead);
  const clearNotifications = useAppStore((s) => s.clearNotifications);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const typeColor: Record<string, string> = {
    success: 'var(--green-10, #22c55e)',
    error: 'var(--red-10, #ef4444)',
    warning: 'var(--amber-10, #f59e0b)',
    info: 'var(--blue-10, #3b82f6)',
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          color: 'var(--gray-10)',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          borderRadius: '4px',
        }}
        title="通知"
      >
        <BellIcon width={16} height={16} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-4px',
              background: 'var(--red-10, #ef4444)',
              color: 'var(--gray-1)',
              fontSize: '10px',
              fontWeight: 700,
              minWidth: '16px',
              height: '16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '360px',
            maxHeight: '400px',
            background: 'var(--gray-2, #1c1c1e)',
            border: '1px solid var(--gray-6, #3a3a3c)',
            borderRadius: '8px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid var(--gray-6, #3a3a3c)',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-12, #e4e4e7)' }}>
              通知 {unreadCount > 0 && `(${unreadCount} 未读)`}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: 'var(--gray-9, #71717a)',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '4px',
                  }}
                  title="全部已读"
                >
                  <CheckIcon width={14} height={14} />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: 'var(--gray-9, #71717a)',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '4px',
                  }}
                  title="清空通知"
                >
                  <TrashIcon width={14} height={14} />
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div style={{ overflow: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--gray-9, #71717a)',
                  fontSize: '13px',
                }}
              >
                暂无通知
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--gray-5, #2e2e30)',
                    opacity: n.read ? 0.6 : 1,
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: typeColor[n.type],
                      flexShrink: 0,
                      marginTop: '5px',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--gray-12, #e4e4e7)',
                        marginBottom: '2px',
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--gray-11, #a1a1aa)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.message}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'var(--gray-9, #71717a)',
                        marginTop: '4px',
                      }}
                    >
                      {new Date(n.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
