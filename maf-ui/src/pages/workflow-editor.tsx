import React, { useState, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  NodeTypes,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Select } from '@radix-ui/themes';
import { ChevronDownIcon, PlayIcon, PauseIcon, ResetIcon, PlusIcon } from '@radix-ui/react-icons';
import { useAppStore } from '../stores/useAppStore';

/* ── Preset agent node definitions ──────────────────────────────── */
const PRESET_NODES = [
  { type: 'decomposer', label: 'Decomposer', icon: '🧩', color: 'var(--purple-9)', desc: 'Break tasks into subtasks' },
  { type: 'coder', label: 'Coder', icon: '💻', color: 'var(--blue-9)', desc: 'Generate and refactor code' },
  { type: 'reviewer', label: 'Reviewer', icon: '🔍', color: 'var(--green-9)', desc: 'Review code quality & security' },
  { type: 'tester', label: 'Tester', icon: '🧪', color: 'var(--amber-9)', desc: 'Create and run test suites' },
  { type: 'searcher', label: 'Searcher', icon: '🔎', color: 'var(--pink-9)', desc: 'Search codebase & docs' },
];

/* ── Mock workflows (simulate invoke("get_workflows")) ─────────── */
const WORKFLOWS = [
  { id: 'wf-1', name: 'Default Pipeline' },
  { id: 'wf-2', name: 'Code Review Only' },
  { id: 'wf-3', name: 'Full Stack Build' },
  { id: 'wf-4', name: 'Quick Search' },
];

/* ── Status config ─────────────────────────────────────────────── */
type WorkflowStatus = 'idle' | 'running' | 'paused';
const STATUS_COLORS: Record<WorkflowStatus, string> = {
  idle: 'var(--status-idle)',
  running: 'var(--status-running)',
  paused: 'var(--status-warning)',
};

/* ── Custom Agent Node ─────────────────────────────────────────── */
function WorkflowAgentNode({ data, selected }: NodeProps) {
  const { nodeDef, status } = data as { nodeDef: typeof PRESET_NODES[0]; status: string };
  return (
    <div
      style={{
        width: 200,
        background: selected ? 'var(--gray-3)' : 'var(--gray-2)',
        border: `2px solid ${selected ? nodeDef.color : 'var(--gray-6)'}`,
        borderRadius: 12,
        padding: '12px 14px',
        color: 'var(--gray-12)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? `0 0 16px ${nodeDef.color}22` : '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <Handle type="target" position={Position.Left}
        style={{ background: nodeDef.color, width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Right}
        style={{ background: nodeDef.color, width: 8, height: 8, border: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${nodeDef.color}18`, fontSize: 16, flexShrink: 0,
        }}>
          {nodeDef.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nodeDef.label}
          </div>
          <div style={{ fontSize: 10, color: 'var(--gray-10)', textTransform: 'capitalize' }}>
            {status || 'idle'}
          </div>
        </div>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: status === 'running' ? 'var(--status-running)' : status === 'error' ? 'var(--status-error)' : 'var(--status-idle)',
          flexShrink: 0,
        }} />
      </div>
      <div style={{
        fontSize: 11, color: 'var(--gray-11)', lineHeight: 1.4,
        overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
      }}>
        {nodeDef.desc}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { agentNode: WorkflowAgentNode };

/* ═══════════════════════════════════════════════════════════════════
   WorkflowEditor
   ═══════════════════════════════════════════════════════════════════ */
export default function WorkflowEditor() {
  const [selectedWorkflow, setSelectedWorkflow] = useState('wf-1');
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('idle');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const idCounter = useRef(1);

  // Build default layout nodes from presets
  const buildDefaultNodes = useCallback((): Node[] => {
    const spacing = 260;
    return PRESET_NODES.map((def, i) => ({
      id: `node-${def.type}`,
      type: 'agentNode',
      position: { x: 100 + (i % 3) * spacing, y: 80 + Math.floor(i / 3) * 200 },
      data: { nodeDef: def, status: 'idle' },
    }));
  }, []);

  // Default edges (linear pipeline)
  const buildDefaultEdges = useCallback((): Edge[] => {
    const pairs: [string, string][] = [
      ['node-decomposer', 'node-coder'],
      ['node-coder', 'node-reviewer'],
      ['node-reviewer', 'node-tester'],
      ['node-coder', 'node-searcher'],
    ];
    return pairs.map(([src, tgt]) => ({
      id: `${src}-${tgt}`,
      source: src,
      target: tgt,
      type: 'smoothstep',
      animated: workflowStatus === 'running',
      style: { stroke: 'var(--gray-7)', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--gray-7)', width: 14, height: 14 },
    }));
  }, [workflowStatus]);

  const [nodes, setNodes, onNodesChange] = useNodesState(buildDefaultNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildDefaultEdges());

  // Connect handler
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      animated: workflowStatus === 'running',
      style: { stroke: 'var(--gray-7)', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--gray-7)', width: 14, height: 14 },
    }, eds));
  }, [setEdges, workflowStatus]);

  // Node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Add preset node from palette
  const addPresetNode = useCallback((preset: typeof PRESET_NODES[0]) => {
    const id = `custom-${preset.type}-${idCounter.current++}`;
    const newNode: Node = {
      id,
      type: 'agentNode',
      position: { x: 200 + Math.random() * 200, y: 150 + Math.random() * 100 },
      data: { nodeDef: preset, status: 'idle' },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  // Toolbar actions
  const handleRun = () => {
    setWorkflowStatus('running');
    setEdges((eds) => eds.map((e) => ({ ...e, animated: true })));
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: { ...n.data, status: 'running' },
    })));
  };

  const handlePause = () => {
    setWorkflowStatus('paused');
    setEdges((eds) => eds.map((e) => ({ ...e, animated: false })));
  };

  const handleReset = () => {
    setWorkflowStatus('idle');
    setSelectedNode(null);
    setNodes(buildDefaultNodes());
    setEdges(buildDefaultEdges());
  };

  // Selected node details
  const selectedPreset = selectedNode?.data?.nodeDef as typeof PRESET_NODES[0] | undefined;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', gap: 0 }}>
      {/* ── Main Canvas ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 4px', borderBottom: '1px solid var(--gray-6)', flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-12)', margin: 0 }}>
              Workflow Editor
            </h1>
            <p style={{ fontSize: 12, color: 'var(--gray-10)', margin: '4px 0 0' }}>
              Drag to connect agents, configure dependencies
            </p>
          </div>

          {/* Workflow selector */}
          <Select.Root value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
            <Select.Trigger placeholder="Select workflow" />
            <Select.Content>
              {WORKFLOWS.map((wf) => (
                <Select.Item key={wf.id} value={wf.id}>{wf.name}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>

        {/* ReactFlow Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            style={{ background: 'var(--gray-1)' }}
          >
            <Background color="var(--gray-5)" gap={24} size={1} />
            <Controls showInteractive={false} style={controlsStyle} />
            <MiniMap
              nodeColor={(node) => {
                const def = node.data?.nodeDef as typeof PRESET_NODES[0] | undefined;
                return def?.color ?? 'var(--gray-9)';
              }}
              maskColor="rgba(0,0,0,0.3)"
              style={minimapStyle}
            />

            {/* Node palette panel */}
            <Panel position="top-left">
              <div style={paletteStyle}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-11)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Add Node
                </div>
                {PRESET_NODES.map((p) => (
                  <button key={p.type} onClick={() => addPresetNode(p)} style={paletteBtnStyle}>
                    <span style={{ fontSize: 14 }}>{p.icon}</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-12)' }}>{p.label}</span>
                    <PlusIcon width={12} height={12} color="var(--gray-10)" />
                  </button>
                ))}
              </div>
            </Panel>
          </ReactFlow>

          {/* ── Bottom Toolbar ────────────────────────────────── */}
          <div style={toolbarStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: STATUS_COLORS[workflowStatus],
              }} />
              <span style={{ fontSize: 12, color: 'var(--gray-11)', textTransform: 'capitalize' }}>
                {workflowStatus}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleRun} disabled={workflowStatus === 'running'} style={{
                ...toolbarBtnStyle,
                opacity: workflowStatus === 'running' ? 0.5 : 1,
              }}>
                <PlayIcon width={14} height={14} /> Run
              </button>
              <button onClick={handlePause} disabled={workflowStatus !== 'running'} style={{
                ...toolbarBtnStyle,
                opacity: workflowStatus !== 'running' ? 0.5 : 1,
              }}>
                <PauseIcon width={14} height={14} /> Pause
              </button>
              <button onClick={handleReset} style={toolbarBtnStyle}>
                <ResetIcon width={14} height={14} /> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Property Panel ──────────────────────────────── */}
      <div style={{
        width: 280, flexShrink: 0,
        borderLeft: '1px solid var(--gray-6)',
        background: 'var(--gray-1)',
        overflowY: 'auto',
        padding: 20,
      }}>
        {selectedPreset ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-12)', marginBottom: 16 }}>
              Node Properties
            </div>
            <div style={propSection}>
              <div style={propLabel}>Name</div>
              <div style={propValue}>{selectedPreset.label}</div>
            </div>
            <div style={propSection}>
              <div style={propLabel}>Type</div>
              <div style={propValue}>{selectedPreset.type}</div>
            </div>
            <div style={propSection}>
              <div style={propLabel}>Description</div>
              <div style={{ ...propValue, lineHeight: 1.5 }}>{selectedPreset.desc}</div>
            </div>
            <div style={propSection}>
              <div style={propLabel}>Color</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4,
                  background: selectedPreset.color,
                }} />
                <span style={propValue}>{selectedPreset.color}</span>
              </div>
            </div>
            <div style={propSection}>
              <div style={propLabel}>Status</div>
              <div style={{ ...propValue, textTransform: 'capitalize' }}>
                {(selectedNode?.data?.status as string) || 'idle'}
              </div>
            </div>
            <div style={propSection}>
              <div style={propLabel}>Node ID</div>
              <div style={{ ...propValue, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                {selectedNode?.id}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🎯</div>
            <div style={{ color: 'var(--gray-10)', fontSize: 13 }}>
              Select a node to view its properties
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared styles ──────────────────────────────────────────────── */

const controlsStyle: React.CSSProperties = {
  background: 'var(--gray-2)', border: '1px solid var(--gray-6)', borderRadius: 8,
};

const minimapStyle: React.CSSProperties = {
  background: 'var(--gray-2)', border: '1px solid var(--gray-6)', borderRadius: 8,
};

const paletteStyle: React.CSSProperties = {
  background: 'var(--gray-2)', border: '1px solid var(--gray-6)',
  borderRadius: 10, padding: 10, width: 160,
  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
};

const paletteBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '6px 8px', borderRadius: 6, border: 'none',
  background: 'transparent', cursor: 'pointer',
  transition: 'background 0.1s',
};

const toolbarStyle: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 16px', background: 'var(--gray-2)',
  borderTop: '1px solid var(--gray-6)',
  zIndex: 10,
};

const toolbarBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', fontSize: 12, fontWeight: 500,
  color: 'var(--gray-12)', background: 'var(--gray-3)',
  border: '1px solid var(--gray-6)', borderRadius: 6,
  cursor: 'pointer', transition: 'all 0.15s',
};

const propSection: React.CSSProperties = {
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: '1px solid var(--gray-5)',
};

const propLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--gray-10)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
};

const propValue: React.CSSProperties = {
  fontSize: 13, color: 'var(--gray-12)',
};
