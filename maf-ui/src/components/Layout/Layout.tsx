import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './header';
import { useAppStore } from '../../stores/useAppStore';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--color-background)',
    }}>
      <Sidebar />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        marginLeft: collapsed ? '60px' : '240px',
        transition: 'margin-left 0.2s ease',
        overflow: 'hidden',
      }}>
        <Header />
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
