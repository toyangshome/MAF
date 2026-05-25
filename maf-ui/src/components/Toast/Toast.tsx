import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
  Cross2Icon,
} from '@radix-ui/react-icons';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const typeStyles = {
  success: {
    bg: 'var(--green-3, rgba(34, 197, 94, 0.15))',
    border: 'var(--green-6, rgba(34, 197, 94, 0.4))',
    iconColor: 'var(--green-10, #22c55e)',
    Icon: CheckCircledIcon,
  },
  error: {
    bg: 'var(--red-3, rgba(239, 68, 68, 0.15))',
    border: 'var(--red-6, rgba(239, 68, 68, 0.4))',
    iconColor: 'var(--red-10, #ef4444)',
    Icon: CrossCircledIcon,
  },
  warning: {
    bg: 'var(--amber-3, rgba(245, 158, 11, 0.15))',
    border: 'var(--amber-6, rgba(245, 158, 11, 0.4))',
    iconColor: 'var(--amber-10, #f59e0b)',
    Icon: ExclamationTriangleIcon,
  },
  info: {
    bg: 'var(--blue-3, rgba(59, 130, 246, 0.15))',
    border: 'var(--blue-6, rgba(59, 130, 246, 0.4))',
    iconColor: 'var(--blue-10, #3b82f6)',
    Icon: InfoCircledIcon,
  },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);
  const style = typeStyles[toast.type];
  const Icon = style.Icon;

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 250);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const timer = setTimeout(handleDismiss, 5000);
    return () => clearTimeout(timer);
  }, [handleDismiss]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '8px',
        minWidth: '320px',
        maxWidth: '420px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        animation: exiting
          ? 'toast-slide-out 0.25s ease forwards'
          : 'toast-slide-in 0.3s ease',
        pointerEvents: 'auto',
      }}
      role="alert"
    >
      <Icon
        width={18}
        height={18}
        style={{ color: style.iconColor, flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--gray-12, #e4e4e7)',
            marginBottom: 2,
          }}
        >
          {toast.title}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--gray-11, #a1a1aa)',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {toast.message}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          color: 'var(--gray-9, #71717a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          flexShrink: 0,
        }}
        title="关闭"
      >
        <Cross2Icon width={14} height={14} />
      </button>
    </div>
  );
}

export interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes toast-slide-out {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(100%); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>,
    document.body,
  );
}
