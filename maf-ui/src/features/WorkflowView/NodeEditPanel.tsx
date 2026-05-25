import React, { useState, useCallback, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAppStore } from '../../stores/useAppStore';
import type { WorkflowNode, AgentStatus } from '../../types';
import { AGENT_TYPES } from '../../types';
import { wouldCreateCycle } from './cycleUtils';
import { Select } from '../../components/ui/Select';

interface NodeEditPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onClose: () => void;
}

export default function NodeEditPanel({ node, allNodes, onClose }: NodeEditPanelProps) {
  const updateWorkflowNode = useAppStore((s) => s.updateWorkflowNode);
  const addDependency = useAppStore((s) => s.addDependency);
  const removeDependency = useAppStore((s) => s.removeDependency);

  const [label, setLabel] = useState(node.label);
  const [agentType, setAgentType] = useState(node.agentType);
  const [systemPrompt, setSystemPrompt] = useState(node.systemPrompt ?? '');
  const [status, setStatus] = useState<AgentStatus>(node.status);

  // Available dependency candidates (exclude self and circular deps)
  const availableDeps = useMemo(
    () => allNodes.filter((n) => n.id !== node.id),
    [allNodes, node.id],
  );

  const handleSave = useCallback(() => {
    updateWorkflowNode(node.id, { label, agentType, systemPrompt, status });
    onClose();
  }, [node.id, label, agentType, systemPrompt, status, updateWorkflowNode, onClose]);

  const handleToggleDep = useCallback(
    (depId: string, checked: boolean) => {
      if (checked) {
        // Build edge list from all nodes' current dependencies
        const edges: Array<{ source: string; target: string }> = [];
        allNodes.forEach((n) => {
          n.dependencies.forEach((d) => {
            edges.push({ source: d, target: n.id });
          });
        });
        // Check if adding depId -> node.id would create a cycle
        if (wouldCreateCycle(edges, depId, node.id)) {
          console.warn('Dependency rejected: would create a cycle');
          return;
        }
        addDependency(node.id, depId);
      } else {
        removeDependency(node.id, depId);
      }
    },
    [node.id, allNodes, addDependency, removeDependency],
  );

  // Styles
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
            top: 0,
            right: 0,
            bottom: 0,
            width: 380,
            background: 'var(--gray-2)',
            borderLeft: '1px solid var(--gray-6)',
            padding: '20px 16px',
            overflowY: 'auto',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Dialog.Title
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--gray-12)',
                margin: 0,
              }}
            >
              Edit Agent Node
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

          <Dialog.Description
            style={{ fontSize: 12, color: 'var(--gray-9)', margin: 0 }}
          >
            Configure agent properties and dependencies
          </Dialog.Description>

          {/* Name */}
          <div>
            <label style={labelStyle}>Agent Name</label>
            <input
              style={inputStyle}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Agent name..."
            />
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>Agent Type</label>
            <Select
              value={agentType}
              onValueChange={setAgentType}
              options={AGENT_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))}
            />
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as AgentStatus)}
              options={[
                { value: 'idle', label: 'Idle' },
                { value: 'running', label: 'Running' },
                { value: 'waiting', label: 'Waiting' },
                { value: 'done', label: 'Done' },
                { value: 'error', label: 'Error' },
              ]}
            />
          </div>

          {/* System Prompt */}
          <div>
            <label style={labelStyle}>System Prompt</label>
            <textarea
              style={{
                ...inputStyle,
                minHeight: 120,
                resize: 'vertical',
                lineHeight: 1.5,
              }}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter the system prompt for this agent..."
            />
          </div>

          {/* Dependencies */}
          <div>
            <label style={labelStyle}>Dependencies</label>
            <div
              style={{
                background: 'var(--gray-1)',
                border: '1px solid var(--gray-6)',
                borderRadius: 6,
                padding: '8px 10px',
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {availableDeps.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--gray-9)' }}>No other nodes available</div>
              ) : (
                availableDeps.map((dep) => {
                  const isChecked = node.dependencies.includes(dep.id);
                  // Check if adding this dependency would create a cycle
                  const edges: Array<{ source: string; target: string }> = [];
                  allNodes.forEach((n) => {
                    n.dependencies.forEach((d) => {
                      edges.push({ source: d, target: n.id });
                    });
                  });
                  const wouldCycle = !isChecked && wouldCreateCycle(edges, dep.id, node.id);
                  return (
                    <label
                      key={dep.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 0',
                        cursor: wouldCycle ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        color: wouldCycle ? 'var(--gray-8)' : 'var(--gray-12)',
                        opacity: wouldCycle ? 0.5 : 1,
                      }}
                      title={wouldCycle ? 'Adding this dependency would create a cycle' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={wouldCycle}
                        onChange={(e) => handleToggleDep(dep.id, e.target.checked)}
                        style={{
                          accentColor: 'var(--accent-9)',
                          width: 14,
                          height: 14,
                          cursor: 'pointer',
                        }}
                      />
                      <span style={{ color: 'var(--gray-11)', fontSize: 11 }}>
                        ({AGENT_TYPES.find((t) => t.value === dep.agentType)?.icon ?? '⚙️'})
                      </span>
                      {dep.label}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
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
            Save Changes
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
