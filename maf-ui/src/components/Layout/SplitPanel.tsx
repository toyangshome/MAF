import React, { useCallback, useRef, useState } from 'react';
import { useAppStore, type Page, type PanelState } from '../../stores/useAppStore';
import { Select } from '../../components/ui/Select';

// 页面选项用于下拉菜单
const pageOptions: { value: Page; label: string }[] = [
  { value: 'workflow', label: 'Workflow' },
  { value: 'logs', label: 'Logs' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'config', label: 'Config' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'agents', label: 'Agents' },
];

interface SplitPanelProps {
  pages: Record<string, React.ReactNode>;
}

export function SplitPanel({ pages: pageComponents }: SplitPanelProps) {
  const layoutMode = useAppStore((s) => s.layoutMode);
  const panels = useAppStore((s) => s.panels);
  const setPanelPage = useAppStore((s) => s.setPanelPage);
  const setPanelSize = useAppStore((s) => s.setPanelSize);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartPosRef = useRef(0);
  const dragStartSizeRef = useRef(50);

  const isHorizontal = layoutMode === 'horizontal';

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      dragStartPosRef.current = isHorizontal ? e.clientX : e.clientY;
      dragStartSizeRef.current = panels[0]?.size ?? 50;

      const handleMouseMove = (me: MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const delta = isHorizontal
          ? me.clientX - dragStartPosRef.current
          : me.clientY - dragStartPosRef.current;
        const totalSize = isHorizontal ? rect.width : rect.height;
        const deltaPercent = (delta / totalSize) * 100;
        const newSize = dragStartSizeRef.current + deltaPercent;
        setPanelSize('panel-1', newSize);
      };

      const handleMouseUp = () => {
        setDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [isHorizontal, panels, setPanelSize],
  );

  if (panels.length < 2) return null;

  const panel1 = panels[0];
  const panel2 = panels[1];

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        gap: 0,
      }}
    >
      {/* Panel 1 */}
      <div
        style={{
          flex: `0 0 ${panel1.size}%`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: isHorizontal ? '120px' : undefined,
          minHeight: !isHorizontal ? '80px' : undefined,
        }}
      >
        <PanelHeader panel={panel1} setPanelPage={setPanelPage} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          {pageComponents[panel1.page]}
        </div>
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleDividerMouseDown}
        style={{
          flex: 'none',
          width: isHorizontal ? '4px' : undefined,
          height: !isHorizontal ? '4px' : undefined,
          background: dragging ? 'var(--accent-9)' : 'var(--gray-6)',
          cursor: isHorizontal ? 'col-resize' : 'row-resize',
          transition: dragging ? 'none' : 'background 0.15s ease',
          position: 'relative',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          if (!dragging) {
            (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-8)';
          }
        }}
        onMouseLeave={(e) => {
          if (!dragging) {
            (e.currentTarget as HTMLDivElement).style.background = 'var(--gray-6)';
          }
        }}
      >
        {/* 拖拽区域扩展，增大可点击区域 */}
        <div
          style={{
            position: 'absolute',
            inset: isHorizontal ? '0 -6px' : '-6px 0',
          }}
        />
      </div>

      {/* Panel 2 */}
      <div
        style={{
          flex: `0 0 ${panel2.size}%`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: isHorizontal ? '120px' : undefined,
          minHeight: !isHorizontal ? '80px' : undefined,
        }}
      >
        <PanelHeader panel={panel2} setPanelPage={setPanelPage} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          {pageComponents[panel2.page]}
        </div>
      </div>
    </div>
  );
}

/** 单个面板顶部的页面选择器 */
function PanelHeader({
  panel,
  setPanelPage,
}: {
  panel: PanelState;
  setPanelPage: (id: string, page: Page) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '32px',
        padding: '0 12px',
        background: 'var(--gray-2)',
        borderBottom: '1px solid var(--gray-5)',
        flexShrink: 0,
        gap: '8px',
      }}
    >
      <div style={{ flex: 1 }}>
        <Select
          value={panel.page}
          onValueChange={(v) => setPanelPage(panel.id, v as Page)}
          options={pageOptions}
        />
      </div>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--gray-9)',
          whiteSpace: 'nowrap',
        }}
      >
        {Math.round(panel.size)}%
      </span>
    </div>
  );
}
