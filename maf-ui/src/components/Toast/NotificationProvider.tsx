import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { ToastContainer, type ToastData } from './Toast';

const MAX_VISIBLE_TOASTS = 3;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const notifications = useAppStore((s) => s.notifications);
  const [activeToasts, setActiveToasts] = useState<ToastData[]>([]);
  const processedIds = useRef(new Set<string>());

  // Watch for new notifications and show them as toasts
  useEffect(() => {
    const newNotifs = notifications.filter((n) => !processedIds.current.has(n.id));
    if (newNotifs.length === 0) return;

    newNotifs.forEach((n) => processedIds.current.add(n.id));

    setActiveToasts((prev) => {
      const incoming: ToastData[] = newNotifs.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
      }));
      // Keep at most MAX_VISIBLE_TOASTS
      return [...incoming, ...prev].slice(0, MAX_VISIBLE_TOASTS);
    });
  }, [notifications]);

  const dismissToast = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      {children}
      <ToastContainer toasts={activeToasts} onDismiss={dismissToast} />
    </>
  );
}
