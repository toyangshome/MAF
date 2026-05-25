import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MagnifyingGlassIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { Command } from '../../commands/registry';
import { getRecentCommandIds, addRecentCommandId } from '../../commands/registry';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
}

const CATEGORY_LABELS: Record<string, string> = {
  recent: 'Recent',
  navigation: 'Navigation',
  action: 'Actions',
  config: 'Configuration',
};

function fuzzyMatch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

export default function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Filter and group commands
  const groupedResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const recentIds = getRecentCommandIds();

    let filtered: Command[];
    if (!q) {
      filtered = commands;
    } else {
      filtered = commands.filter(
        (cmd) => fuzzyMatch(cmd.label, q) || fuzzyMatch(cmd.category, q) || fuzzyMatch(cmd.id, q)
      );
    }

    // Build groups
    const groups: { label: string; commands: Command[] }[] = [];

    // Recent group (only when no query or query is short)
    if (recentIds.length > 0) {
      const recentCommands = recentIds
        .map((id) => filtered.find((c) => c.id === id))
        .filter((c): c is Command => !!c);
      if (recentCommands.length > 0) {
        groups.push({ label: 'recent', commands: recentCommands });
      }
    }

    // Category groups
    const categories: Array<'navigation' | 'action' | 'config'> = ['navigation', 'action', 'config'];
    for (const cat of categories) {
      const catCommands = filtered.filter(
        (c) => c.category === cat && !recentIds.includes(c.id)
      );
      if (catCommands.length > 0) {
        groups.push({ label: cat, commands: catCommands });
      }
    }

    return groups;
  }, [query, commands]);

  // Flat list for keyboard navigation
  const flatCommands = useMemo(() => {
    return groupedResults.flatMap((g) => g.commands);
  }, [groupedResults]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= flatCommands.length) {
      setSelectedIndex(Math.max(0, flatCommands.length - 1));
    }
  }, [flatCommands.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector('[data-selected="true"]');
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (cmd: Command) => {
      addRecentCommandId(cmd.id);
      cmd.handler();
      onOpenChange(false);
    },
    [onOpenChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(1, flatCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + flatCommands.length) % Math.max(1, flatCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flatCommands[selectedIndex];
        if (cmd) executeCommand(cmd);
      }
    },
    [flatCommands, selectedIndex, executeCommand]
  );

  // Track global index for rendering
  let globalIndex = 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1100,
            backdropFilter: 'blur(4px)',
          }}
        />
        <Dialog.Content
          onKeyDown={handleKeyDown}
          style={{
            position: 'fixed',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 560,
            maxHeight: 440,
            background: 'var(--gray-1)',
            border: '1px solid var(--gray-6)',
            borderRadius: 12,
            zIndex: 1101,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
          }}
        >
          {/* Search input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid var(--gray-6)',
            }}
          >
            <MagnifyingGlassIcon width={18} height={18} style={{ color: 'var(--gray-9)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Type a command..."
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--gray-12)',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            <Dialog.Close
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--gray-9)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
              }}
            >
              <Cross2Icon width={16} height={16} />
            </Dialog.Close>
          </div>

          {/* Results list */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '6px 0',
            }}
          >
            {groupedResults.length === 0 && (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--gray-9)',
                  fontSize: 13,
                }}
              >
                No commands found
              </div>
            )}

            {groupedResults.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <div
                  style={{
                    padding: '8px 16px 4px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--gray-9)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {CATEGORY_LABELS[group.label] || group.label}
                </div>

                {/* Group items */}
                {group.commands.map((cmd) => {
                  const idx = globalIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={cmd.id}
                      data-selected={isSelected}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 16px',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--gray-3)' : 'transparent',
                        borderRadius: 0,
                        transition: 'background 0.1s',
                      }}
                    >
                      {/* Icon */}
                      <span
                        style={{
                          width: 20,
                          textAlign: 'center',
                          fontSize: 14,
                          color: isSelected ? 'var(--gray-12)' : 'var(--gray-10)',
                          flexShrink: 0,
                        }}
                      >
                        {cmd.icon || '›'}
                      </span>

                      {/* Label */}
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: isSelected ? 'var(--gray-12)' : 'var(--gray-11)',
                          fontWeight: isSelected ? 500 : 400,
                        }}
                      >
                        {cmd.label}
                      </span>

                      {/* Shortcut badge */}
                      {cmd.shortcut && (
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--gray-9)',
                            background: 'var(--gray-3)',
                            border: '1px solid var(--gray-6)',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            flexShrink: 0,
                          }}
                        >
                          {cmd.shortcut}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--gray-6)',
              display: 'flex',
              gap: 16,
              fontSize: 11,
              color: 'var(--gray-9)',
            }}
          >
            <span>
              <kbd style={kbdStyle}>↑↓</kbd> navigate
            </span>
            <span>
              <kbd style={kbdStyle}>↵</kbd> execute
            </span>
            <span>
              <kbd style={kbdStyle}>esc</kbd> close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--gray-3)',
  border: '1px solid var(--gray-6)',
  borderRadius: 3,
  padding: '1px 5px',
  fontSize: 10,
  color: 'var(--gray-10)',
  fontFamily: 'inherit',
  marginRight: 4,
};
