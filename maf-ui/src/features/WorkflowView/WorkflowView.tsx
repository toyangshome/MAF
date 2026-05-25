import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Connection,
  NodeProps,
  OnConnect,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '../../stores/useAppStore';
import type { AgentStatus, WorkflowNode } from '../../types';
import { AGENT_TYPES } from '../../types';
import EditableAgentNode, { type EditableAgentNodeData } from './EditableAgentNode';
import NodeEditPanel from './NodeEditPanel';
import AddNodeDialog from './AddNodeDialog';
import { STATUS_CONFIG } from './constants';
import { wouldCreateCycle } from './cycleUtils';
import { CursorOverlay } from '../../components/Presence/CursorOverlay';
import { WorkflowAdvisor } from '../AIAssistant';
import { useTranslation } from '../../i18n';

// ── Default dependency graph (fallback when no workflow data from backend) ──
const DEFAULT_WORKFLOW_DEPS: Record<string, string[]> = {
  'agent-orchestrator': [],
  'agent-decomposer': ['agent-orchestrator'],
  'agent-coder': ['agent-decomposer'],
  'agent-reviewer': ['agent-coder'],
  'agent-tester': ['agent-coder', 'agent-reviewer'],
};

// ── Build deps map from workflow nodes ────────────────────────────
function buildDepsMap(workflowNodes: WorkflowNode[]): Record<string, string[]> {
  if (workflowNodes.length === 0) return DEFAULT_WORKFLOW_DEPS;
  const map: Record<string, string[]> = {};
  workflowNodes.forEach((node) => {
    map[node.id] = node.dependencies;
  });
  return map;
}

// ── Dagre-like auto-layout ────────────────────────────────────────
function calculateLayout(agents: Array<{ id: string }>, depsMap: Record<string, string[]>) {
  const NODE_W = 220;
  const NODE_H = 100;
  const H_GAP = 300;
  const V_GAP = 150;

  const depthMap = new Map<string, number>();
  const adj = new Map<string, string[]>();

  agents.forEach((a) => {
    const deps = depsMap[a.id] || [];
    deps.forEach((depId) => {
      if (!adj.has(depId)) adj.set(depId, []);
      adj.get(depId)!.push(a.id);
    });
  });

  const roots = agents.filter((a) => (depsMap[a.id] || []).length === 0).map((a) => a.id);
  const queue: [string, number][] = roots.map((id) => [id, 0]);
  while (queue.length > 0) {
    const [id, depth] = queue.shift()!;
    if (depthMap.has(id)) continue;
    depthMap.set(id, depth);
    (adj.get(id) || []).forEach((child) => {
      if (!depthMap.has(child)) queue.push([child, depth + 1]);
    });
  }

  agents.forEach((a) => {
    if (!depthMap.has(a.id)) depthMap.set(a.id, 0);
  });

  const layers = new Map<number, string[]>();
  depthMap.forEach((depth, id) => {
    if (!layers.has(depth)) layers.set(depth, []);
    layers.get(depth)!.push(id);
  });

  const positions = new Map<string, { x: number; y: number }>();
  const maxLayer = Math.max(...layers.keys());

  for (let layer = 0; layer <= maxLayer; layer++) {
    const ids = layers.get(layer) || [];
    const totalHeight = ids.length * NODE_H + (ids.length - 1) * V_GAP;
    const startY = -totalHeight / 2;
    ids.forEach((id, idx) => {
      positions.set(id, {
        x: layer * (NODE_W + H_GAP),
        y: startY + idx * (NODE_H + V_GAP),
      });
    });
  }

  return positions;
}

// ── Custom node type wrapper ──────────────────────────────────────
function createNodeComponent(
  nodes: WorkflowNode[],
  selectedId: string | null,
) {
  return function NodeWrapper(props: NodeProps) {
    const wfNode = nodes.find((n) => n.id === props.id);
    const data: EditableAgentNodeData = {
      label: wfNode?.label ?? props.id,
      agentType: wfNode?.agentType ?? 'orchestrator',
      status: wfNode?.status ?? 'idle',
      isSelected: props.id === selectedId,
      dependencyCount: wfNode?.dependencies?.length ?? 0,
    };
    return <EditableAgentNode {...props} data={data} />;
  };
}

// ── Button style helper ───────────────────────────────────────────
function toolbarButtonStyle(overrides?: React.CSSProperties): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'var(--gray-3)',
    border: '1px solid var(--gray-6)',
    borderRadius: 6,
    color: 'var(--gray-12)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    ...overrides,
  };
}

// ── Main component ────────────────────────────────────────────────
export default function WorkflowView() {
  const workflowNodes = useAppStore((s) => s.workflowNodes);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const removeWorkflowNode = useAppStore((s) => s.removeWorkflowNode);
  const updateWorkflowNode = useAppStore((s) => s.updateWorkflowNode);
  const saveWorkflowToApi = useAppStore((s) => s.saveWorkflowToApi);
  const fetchWorkflows = useAppStore((s) => s.fetchWorkflows);
  const { t } = useTranslation();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // ── Execution state ──────────────────────────────────────────────
  const [isSimulating, setIsSimulating] = useState(false);
  const [execStartTime, setExecStartTime] = useState<number | null>(null);
  const [execElapsed, setExecElapsed] = useState(0);
  const [execPhase, setExecPhase] = useState('');
  const simulateTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Elapsed time ticker
  useEffect(() => {
    if (!isSimulating || !execStartTime) return;
    const interval = setInterval(() => {
      setExecElapsed(Date.now() - execStartTime);
    }, 200);
    return () => clearInterval(interval);
  }, [isSimulating, execStartTime]);

  // ── Sync agent status to workflow nodes ──────────────────────────
  const agents = useAppStore((s) => s.agents);
  const lastSyncedStatusRef = useRef<Record<string, AgentStatus>>({});

  useEffect(() => {
    if (agents.length === 0) return;
    let hasChanges = false;
    agents.forEach((agent) => {
      const wfNode = workflowNodes.find((n) => n.id === agent.id);
      if (wfNode && wfNode.status !== agent.status && lastSyncedStatusRef.current[agent.id] !== agent.status) {
        lastSyncedStatusRef.current[agent.id] = agent.status;
        updateWorkflowNode(agent.id, { status: agent.status });
        hasChanges = true;
      }
    });
    // Only depend on agents array, not workflowNodes, to avoid circular dependency
  }, [agents, updateWorkflowNode]);

  const depsMap = useMemo(() => buildDepsMap(workflowNodes), [workflowNodes]);

  // Build minimal items for layout
  const layoutItems = useMemo(
    () =>
      workflowNodes.length > 0
        ? workflowNodes.map((n) => ({ id: n.id }))
        : Object.keys(DEFAULT_WORKFLOW_DEPS).map((id) => ({ id })),
    [workflowNodes],
  );

  const positions = useMemo(() => calculateLayout(layoutItems, depsMap), [layoutItems, depsMap]);

  // Build ReactFlow nodes
  const rfNodes: Node[] = useMemo(() => {
    const nodeComponent = createNodeComponent(workflowNodes, selectedAgentId);
    return (workflowNodes.length > 0 ? workflowNodes : Object.keys(DEFAULT_WORKFLOW_DEPS).map((id) => ({
      id,
      label: id,
      agentType: id.split('-').pop() || 'orchestrator',
      status: 'idle' as AgentStatus,
      dependencies: DEFAULT_WORKFLOW_DEPS[id] ?? [],
    }))).map((wfNode) => {
      const pos = positions.get(wfNode.id) || { x: 0, y: 0 };
      return {
        id: wfNode.id,
        type: 'editableAgentNode',
        position: pos,
        data: wfNode,
      };
    });
  }, [workflowNodes, positions, selectedAgentId]);

  // Build ReactFlow edges (animated when source node is running)
  const rfEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    const nodes = workflowNodes.length > 0 ? workflowNodes : Object.keys(DEFAULT_WORKFLOW_DEPS).map((id) => ({
      id,
      dependencies: DEFAULT_WORKFLOW_DEPS[id] ?? [],
      status: 'idle' as AgentStatus,
    }));
    const statusMap = new Map<string, AgentStatus>();
    nodes.forEach((n) => statusMap.set(n.id, n.status));

    nodes.forEach((wfNode) => {
      (wfNode.dependencies || []).forEach((depId) => {
        const srcStatus = statusMap.get(depId) ?? 'idle';
        const isRunning = srcStatus === 'running';
        const isDone = srcStatus === 'done';
        const isError = srcStatus === 'error';

        const strokeColor = isRunning ? 'var(--blue-9)' : isDone ? 'var(--green-9)' : isError ? 'var(--red-9)' : 'var(--gray-8)';

        edges.push({
          id: `${depId}->${wfNode.id}`,
          source: depId,
          target: wfNode.id,
          type: 'smoothstep',
          animated: isRunning,
          style: {
            stroke: strokeColor,
            strokeWidth: isRunning ? 2 : 1.5,
            strokeDasharray: isRunning ? '6 4' : undefined,
            animation: isRunning ? 'edge-flow 0.6s linear infinite' : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
            width: 14,
            height: 14,
          },
        });
      });
    });
    return edges;
  }, [workflowNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Sync ReactFlow state when workflowNodes change
  useEffect(() => {
    setNodes(rfNodes);
  }, [rfNodes, setNodes]);

  useEffect(() => {
    setEdges(rfEdges);
  }, [rfEdges, setEdges]);

  // Update node selection visual
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === selectedAgentId },
      })),
    );
  }, [selectedAgentId, setNodes]);

  // ── Connection handler (create edge) ────────────────────────────
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Prevent self-connection
      if (connection.source === connection.target) return;

      // Check for duplicate
      const exists = edges.some(
        (e) => e.source === connection.source && e.target === connection.target,
      );
      if (exists) return;

      // Check for cycle
      const edgeList = edges.map((e) => ({ source: e.source, target: e.target }));
      if (wouldCreateCycle(edgeList, connection.source, connection.target)) {
        console.warn('Connection rejected: would create a cycle');
        return;
      }

      // Add edge visually
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: false,
            style: { stroke: 'var(--gray-8)', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--gray-9)', width: 14, height: 14 },
          },
          eds,
        ),
      );

      // Update workflow node dependencies
      updateWorkflowNode(connection.target, {
        dependencies: [
          ...(workflowNodes.find((n) => n.id === connection.target)?.dependencies ?? []),
          connection.source,
        ],
      });
    },
    [edges, setEdges, updateWorkflowNode, workflowNodes],
  );

  // ── Edge click to delete ────────────────────────────────────────
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      // Remove dependency from target node
      const targetNode = workflowNodes.find((n) => n.id === edge.target);
      if (targetNode) {
        updateWorkflowNode(edge.target, {
          dependencies: targetNode.dependencies.filter((d) => d !== edge.source),
        });
      }
    },
    [setEdges, workflowNodes, updateWorkflowNode],
  );

  // ── Node click ──────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectAgent(node.id === selectedAgentId ? null : node.id);
      setShowEditPanel(node.id !== selectedAgentId);
    },
    [selectAgent, selectedAgentId],
  );

  // ── Delete selected node ────────────────────────────────────────
  const handleDeleteNode = useCallback(() => {
    if (!selectedAgentId) return;
    // Check if other nodes depend on this one
    const dependents = workflowNodes.filter((n) =>
      n.dependencies.includes(selectedAgentId),
    );
    if (dependents.length > 0) {
      const names = dependents.map((n) => n.label).join(', ');
      console.warn(`Cannot delete: ${names} depend on this node`);
      // Still allow deletion - dependencies will be auto-cleaned by store
    }
    removeWorkflowNode(selectedAgentId);
    setShowEditPanel(false);
  }, [selectedAgentId, workflowNodes, removeWorkflowNode]);

  // ── Auto layout ─────────────────────────────────────────────────
  const handleAutoLayout = useCallback(() => {
    const newPositions = calculateLayout(layoutItems, depsMap);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: newPositions.get(n.id) || n.position,
      })),
    );
  }, [layoutItems, depsMap, setNodes]);

  // ── Save workflow ───────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await saveWorkflowToApi();
      setSaveStatus('saved');
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [saveWorkflowToApi]);

  // ── Load workflow ───────────────────────────────────────────────
  const handleLoad = useCallback(async () => {
    await fetchWorkflows();
  }, [fetchWorkflows]);

  // ── Simulate execution ──────────────────────────────────────────
  const handleSimulate = useCallback(() => {
    if (isSimulating) return;

    // Clear any previous simulate timers
    simulateTimerRef.current.forEach(clearTimeout);
    simulateTimerRef.current = [];

    // Reset all nodes to idle
    workflowNodes.forEach((n) => {
      updateWorkflowNode(n.id, { status: 'idle' });
    });

    setIsSimulating(true);
    setExecStartTime(Date.now());
    setExecElapsed(0);

    // Compute topological order
    const adj = new Map<string, string[]>();
    const inDeg = new Map<string, number>();
    workflowNodes.forEach((n) => {
      adj.set(n.id, []);
      inDeg.set(n.id, 0);
    });
    workflowNodes.forEach((n) => {
      (n.dependencies || []).forEach((dep) => {
        if (adj.has(dep)) adj.get(dep)!.push(n.id);
        inDeg.set(n.id, (inDeg.get(n.id) ?? 0) + 1);
      });
    });

    // BFS layers (wave execution)
    const layers: string[][] = [];
    let queue = workflowNodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).map((n) => n.id);
    const visited = new Set<string>();

    while (queue.length > 0) {
      layers.push([...queue]);
      queue.forEach((id) => visited.add(id));
      const next: string[] = [];
      queue.forEach((id) => {
        (adj.get(id) || []).forEach((child) => {
          inDeg.set(child, (inDeg.get(child) ?? 1) - 1);
          if ((inDeg.get(child) ?? 0) === 0 && !visited.has(child)) {
            next.push(child);
          }
        });
      });
      queue = next;
    }

    // Add any unvisited nodes
    const unvisited = workflowNodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
    if (unvisited.length > 0) layers.push(unvisited);

    // Schedule execution
    let delay = 0;
    const STEP = 1200;

    layers.forEach((layer, layerIdx) => {
      // Start running
      delay += STEP;
      const runDelay = delay;
      simulateTimerRef.current.push(setTimeout(() => {
        layer.forEach((id) => updateWorkflowNode(id, { status: 'running' }));
        setExecPhase(`Layer ${layerIdx + 1}/${layers.length} — ${layer.length} node(s) running`);
      }, runDelay));

      // Mark done
      delay += STEP;
      const doneDelay = delay;
      simulateTimerRef.current.push(setTimeout(() => {
        layer.forEach((id) => updateWorkflowNode(id, { status: 'done' }));
      }, doneDelay));
    });

    // Finish
    delay += 300;
    simulateTimerRef.current.push(setTimeout(() => {
      setIsSimulating(false);
      setExecPhase('Execution complete');
      simulateTimerRef.current.push(setTimeout(() => setExecPhase(''), 3000));
    }, delay));
  }, [isSimulating, workflowNodes, updateWorkflowNode]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      simulateTimerRef.current.forEach(clearTimeout);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Selected node for edit panel ────────────────────────────────
  const selectedNode = useMemo(
    () => workflowNodes.find((n) => n.id === selectedAgentId) ?? null,
    [workflowNodes, selectedAgentId],
  );

  // Status summary
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<AgentStatus, number>> = {};
    workflowNodes.forEach((n) => {
      counts[n.status] = (counts[n.status] || 0) + 1;
    });
    return counts;
  }, [workflowNodes]);

  // ── Node type map ───────────────────────────────────────────────
  const nodeTypes = useMemo(
    () => ({ editableAgentNode: EditableAgentNode }),
    [],
  );

  // ── Save button text ────────────────────────────────────────────
  const saveButtonText: Record<typeof saveStatus, string> = {
    idle: t('workflow.save'),
    saving: t('workflow.saving'),
    saved: t('workflow.saved'),
    error: t('common.error'),
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 48px)' }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.6); }
        }
        @keyframes node-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes edge-flow {
          to { stroke-dashoffset: -20; }
        }
        @keyframes progress-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .wf-node-running {
          animation: pulse-border 2s ease-in-out infinite;
        }
        @keyframes pulse-border {
          0%, 100% { border-color: var(--blue-9); }
          50% { border-color: var(--blue-7); }
        }
      `}</style>

      {/* Header + Toolbar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '8px 4px',
          borderBottom: '1px solid var(--gray-3)',
          flexShrink: 0,
        }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-12)', margin: 0 }}>
              {t('workflow.title')}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--gray-9)', margin: '4px 0 0' }}>
              {t('workflow.dagDescription')}
            </p>
          </div>

          {/* Status summary badges */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(Object.entries(statusCounts) as [AgentStatus, number][]).map(([status, count]) => {
              const cfg = STATUS_CONFIG[status];
              return (
                <span
                  key={status}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    color: cfg.color,
                    background: cfg.bg,
                    border: `1px solid ${cfg.color}33`,
                  }}
                >
                  <span
                    style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color }}
                  />
                  {count} {cfg.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            style={toolbarButtonStyle()}
            onClick={() => setShowAddDialog(true)}
            title="Add a new agent node to the workflow"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--gray-3)';
              e.currentTarget.style.borderColor = 'var(--accent-9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--gray-3)';
              e.currentTarget.style.borderColor = 'var(--gray-6)';
            }}
          >
            + {t('workflow.addNode')}
          </button>

          <button
            style={toolbarButtonStyle({
              opacity: selectedAgentId ? 1 : 0.4,
              cursor: selectedAgentId ? 'pointer' : 'not-allowed',
            })}
            onClick={handleDeleteNode}
            title="Delete the selected node from the workflow"
            disabled={!selectedAgentId}
            onMouseEnter={(e) => {
              if (selectedAgentId) {
                e.currentTarget.style.background = 'var(--red-3)';
                e.currentTarget.style.borderColor = 'var(--red-9)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--gray-3)';
              e.currentTarget.style.borderColor = 'var(--gray-6)';
            }}
          >
            {t('workflow.deleteNode')}
          </button>

          {selectedAgentId && (
            <button
              style={toolbarButtonStyle()}
              onClick={() => setShowEditPanel(true)}
              title="Open the edit panel for the selected node"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--gray-3)';
                e.currentTarget.style.borderColor = 'var(--accent-9)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--gray-3)';
                e.currentTarget.style.borderColor = 'var(--gray-6)';
              }}
            >
              {t('workflow.editNode')}
            </button>
          )}

          <div style={{ flex: 1 }} />

          <button
            style={toolbarButtonStyle({
              background: isSimulating ? 'var(--amber-3)' : 'var(--gray-3)',
              borderColor: isSimulating ? 'var(--amber-9)' : 'var(--gray-6)',
              cursor: isSimulating ? 'not-allowed' : 'pointer',
            })}
            onClick={handleSimulate}
            disabled={isSimulating || workflowNodes.length === 0}
            title="Simulate workflow execution in dependency order"
            onMouseEnter={(e) => {
              if (!isSimulating) {
                e.currentTarget.style.background = 'var(--gray-3)';
                e.currentTarget.style.borderColor = 'var(--accent-9)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSimulating) {
                e.currentTarget.style.background = 'var(--gray-3)';
                e.currentTarget.style.borderColor = 'var(--gray-6)';
              }
            }}
          >
            {isSimulating ? `⏳ ${t('workflow.simulating')}` : `▶ ${t('workflow.simulate')}`}
          </button>

          <button
            style={toolbarButtonStyle()}
            onClick={handleAutoLayout}
            title="Auto-arrange nodes based on dependency graph"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--gray-3)';
              e.currentTarget.style.borderColor = 'var(--accent-9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--gray-3)';
              e.currentTarget.style.borderColor = 'var(--gray-6)';
            }}
          >
            {t('workflow.autoLayout')}
          </button>

          <button
            style={toolbarButtonStyle()}
            onClick={handleLoad}
            title="Load workflow from server"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--gray-3)';
              e.currentTarget.style.borderColor = 'var(--accent-9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--gray-3)';
              e.currentTarget.style.borderColor = 'var(--gray-6)';
            }}
          >
            {t('workflow.load')}
          </button>

          <button
            style={toolbarButtonStyle({
              background: saveStatus === 'saved' ? 'var(--green-3)' : saveStatus === 'error' ? 'var(--red-3)' : 'var(--gray-3)',
              borderColor: saveStatus === 'saved' ? 'var(--green-9)' : saveStatus === 'error' ? 'var(--red-9)' : 'var(--gray-6)',
            })}
            onClick={handleSave}
            title="Save current workflow to server"
            disabled={saveStatus === 'saving'}
            onMouseEnter={(e) => {
              if (saveStatus === 'idle') {
                e.currentTarget.style.background = 'var(--gray-3)';
                e.currentTarget.style.borderColor = 'var(--accent-9)';
              }
            }}
            onMouseLeave={(e) => {
              if (saveStatus === 'idle') {
                e.currentTarget.style.background = 'var(--gray-3)';
                e.currentTarget.style.borderColor = 'var(--gray-6)';
              }
            }}
          >
            {saveButtonText[saveStatus]}
          </button>
        </div>
      </div>

      {/* Execution status panel */}
      {(isSimulating || execPhase) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '8px 16px',
            background: 'var(--gray-1)',
            borderBottom: '1px solid var(--gray-3)',
            flexShrink: 0,
            fontSize: 12,
            color: 'var(--gray-11)',
          }}
        >
          {/* Phase */}
          <span style={{ fontWeight: 600, color: 'var(--gray-12)', minWidth: 180 }}>
            {execPhase || 'Preparing...'}
          </span>

          {/* Progress */}
          <span>
            {statusCounts.done || 0} / {workflowNodes.length} nodes done
          </span>

          {/* Elapsed time */}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {(execElapsed / 1000).toFixed(1)}s elapsed
          </span>

          {/* Progress bar */}
          <div
            style={{
              flex: 1,
              height: 4,
              background: 'var(--gray-3)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${workflowNodes.length > 0 ? ((statusCounts.done || 0) / workflowNodes.length) * 100 : 0}%`,
                background: 'linear-gradient(90deg, var(--blue-9), var(--green-9))',
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          {/* Status breakdown */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['running', 'done', 'error'] as AgentStatus[]).map((s) => {
              const count = statusCounts[s] || 0;
              if (count === 0) return null;
              const cfg = STATUS_CONFIG[s];
              return (
                <span
                  key={s}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: cfg.color,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: cfg.bg,
                  }}
                >
                  {count} {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ReactFlow canvas */}
      <div style={{ flex: 1, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--gray-3)', position: 'relative' }}>
        <CursorOverlay />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--gray-1)' }}
          connectionLineStyle={{ stroke: 'var(--accent-9)', strokeWidth: 2 }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { stroke: 'var(--gray-8)', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--gray-9)', width: 14, height: 14 },
          }}
        >
          <Background color="var(--gray-3)" gap={24} size={1} />
          <Controls
            showInteractive={false}
            style={{
              background: 'var(--gray-2)',
              border: '1px solid var(--gray-6)',
              borderRadius: 8,
            }}
          />
          <MiniMap
            nodeColor={(node) => {
              const wfNode = workflowNodes.find((n) => n.id === node.id);
              if (!wfNode) return 'var(--gray-6)';
              return STATUS_CONFIG[wfNode.status].color;
            }}
            maskColor="rgba(0,0,0,0.6)"
            style={{
              background: 'var(--gray-2)',
              border: '1px solid var(--gray-6)',
              borderRadius: 8,
            }}
          />
        </ReactFlow>
      </div>

      {/* Add Node Dialog */}
      {showAddDialog && <AddNodeDialog onClose={() => setShowAddDialog(false)} />}

      {/* Node Edit Panel */}
      {showEditPanel && selectedNode && (
        <NodeEditPanel
          node={selectedNode}
          allNodes={workflowNodes}
          onClose={() => setShowEditPanel(false)}
        />
      )}
    </div>

    {/* AI 工作流优化建议 */}
    <div style={{ width: 280, flexShrink: 0, overflow: 'auto', paddingTop: 16 }}>
      <WorkflowAdvisor />
    </div>
    </div>
  );
}
