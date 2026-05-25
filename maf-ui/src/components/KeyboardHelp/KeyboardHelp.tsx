import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { Cross2Icon } from '@radix-ui/react-icons';

interface ShortcutItem {
  keys: string[];
  description: string;
}

const SHORTCUTS: { group: string; items: ShortcutItem[] }[] = [
  {
    group: '全局',
    items: [
      { keys: ['⌘', 'K'], description: '全局搜索' },
      { keys: ['⌘', '⇧', 'P'], description: '指令面板' },
      { keys: ['⌘', 'B'], description: '切换侧边栏' },
      { keys: ['⌘', 'N'], description: '新建任务' },
      { keys: ['?'], description: '显示快捷键帮助' },
    ],
  },
  {
    group: '页面切换',
    items: [
      { keys: ['1'], description: '工作流' },
      { keys: ['2'], description: '日志' },
      { keys: ['3'], description: '任务' },
      { keys: ['4'], description: '配置' },
      { keys: ['5'], description: '监控' },
    ],
  },
];

export function useKeyboardHelpTrigger() {
  const [open, setOpen] = useState(false);

  useKeyboardShortcut({
    key: '?',
    shift: true,
    description: 'Show keyboard shortcuts',
    handler: () => setOpen(true),
  });

  return { open, setOpen };
}

export default function KeyboardHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 480,
            background: 'var(--gray-1)',
            border: '1px solid var(--gray-6)',
            borderRadius: 12,
            padding: 24,
            zIndex: 1001,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Dialog.Title style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-12)', margin: 0 }}>
              Keyboard Shortcuts
            </Dialog.Title>
            <Dialog.Close
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--gray-9)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <Cross2Icon width={18} height={18} />
            </Dialog.Close>
          </div>

          {SHORTCUTS.map((group) => (
            <div key={group.group} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--gray-9)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                }}
              >
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--gray-12)' }}>{item.description}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 24,
                            height: 24,
                            padding: '0 6px',
                            background: 'var(--gray-3)',
                            border: '1px solid var(--gray-6)',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--gray-10)',
                            fontFamily: 'inherit',
                          }}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div
            style={{
              fontSize: 11,
              color: 'var(--gray-9)',
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            Press <kbd style={{ background: 'var(--gray-3)', border: '1px solid var(--gray-6)', borderRadius: 3, padding: '1px 5px', fontSize: 11 }}>?</kbd> to toggle this panel
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
