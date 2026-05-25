import React, { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAppStore } from '../../stores/useAppStore';
import type { WorkflowNode, AgentStatus } from '../../types';
import { AGENT_TYPES } from '../../types';

interface AddNodeDialogProps {
  onClose: () => void;
}

export default function AddNodeDialog({ onClose }: AddNodeDialogProps) {
  const addWorkflowNode = useAppStore((s) => s.addWorkflowNode);

  const [label, setLabel] = useState('');
  const [agentType, setAgentType] = useState<string>(AGENT_TYPES[0].value);

  const handleAdd = useCallback(() => {
    const finalLabel = label.trim() || `New ${agentType}`;
    const id = `agent-${agentType}-${Date.now()}`;
    const newNode: WorkflowNode = {
      id,
      label: finalLabel,
      agentType,
      status: 'idle' as AgentStatus,
      dependencies: [],
      systemPrompt: '',
    };
    addWorkflowNode(newNode);
    onClose();
  }, [label, agentType, addWorkflowNode, onClose]);

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--gray-11)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--gray-1)',
    border: '1px solid var(--gray-6)',
    borderRadius: 6,
    color: 'var(--gray-12)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
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
            width: 400,
            background: 'var(--gray-2)',
            border: '1px solid var(--gray-6)',
            borderRadius: 12,
            padding: 24,
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Dialog.Title
              style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-12)', margin: 0 }}
            >
              Add New Agent Node
            </Dialog.Title>
            <Dialog.Close
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--gray-9)',
                fontSize: 20,
                cursor: 'pointer',
                padding: 4,
                lineHeight: 1,
              }}
            >
              x
            </Dialog.Close>
          </div>

          <Dialog.Description style={{ fontSize: 12, color: 'var(--gray-9)', margin: 0 }}>
            Select an agent type and provide a name
          </Dialog.Description>

          {/* Name */}
          <div>
            <label style={labelStyle}>Agent Name</label>
            <input
              style={inputStyle}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter agent name (optional)..."
              autoFocus
            />
          </div>

          {/* Type selection */}
          <div>
            <label style={labelStyle}>Agent Type</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
              }}
            >
              {AGENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setAgentType(t.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    background: agentType === t.value ? 'var(--gray-3)' : 'var(--gray-1)',
                    border: `1.5px solid ${agentType === t.value ? 'var(--accent-9)' : 'var(--gray-6)'}`,
                    borderRadius: 8,
                    color: 'var(--gray-12)',
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            style={{
              padding: '10px 16px',
              background: 'var(--accent-9)',
              color: 'var(--gray-1)',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-9)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent-9)')}
          >
            Add Node
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
