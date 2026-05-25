/**
 * MAF UI — Mock Data Factory
 *
 * Utilities for generating realistic mock data for development.
 * Use these to create consistent test data across components.
 */
import type { Agent, LogEntry, Task, AgentMetric, MAFConfig, MetricPoint } from '../types';

// ── Seeded Random ──

let _seed = 42;
function seededRandom(): number {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}

export function resetSeed(seed = 42) {
  _seed = seed;
}

// ── ID Generation ──

let _idCounter = 0;
export function mockId(prefix = 'mock'): string {
  _idCounter++;
  return `${prefix}-${String(_idCounter).padStart(3, '0')}`;
}

export function resetIdCounter() {
  _idCounter = 0;
}

// ── Timestamp Helpers ──

export function mockTimestamp(minutesAgo = 0): string {
  const d = new Date('2026-05-23T03:00:00Z');
  d.setMinutes(d.getMinutes() - minutesAgo);
  return d.toISOString();
}

export function mockElapsed(start: string, end?: string): number {
  const endTime = end ? new Date(end).getTime() : Date.now();
  return endTime - new Date(start).getTime();
}

// ── Agent Factory ──

export type AgentRole = 'orchestrator' | 'coder' | 'reviewer' | 'tester' | 'decomposer' | 'researcher' | 'writer';

const AGENT_TEMPLATES: Record<AgentRole, Omit<Agent, 'id'>> = {
  orchestrator: {
    name: 'Orchestrator',
    type: 'orchestrator',
    status: 'running',
    description: 'Coordinates task decomposition and agent assignment across the workflow',
  },
  coder: {
    name: 'Coder',
    type: 'coder',
    status: 'running',
    description: 'Generates, refactors, and optimizes source code based on requirements',
  },
  reviewer: {
    name: 'Reviewer',
    type: 'reviewer',
    status: 'waiting',
    description: 'Reviews code for quality, security, and adherence to best practices',
  },
  tester: {
    name: 'Tester',
    type: 'tester',
    status: 'idle',
    description: 'Creates and executes test suites, reports coverage and failures',
  },
  decomposer: {
    name: 'Decomposer',
    type: 'decomposer',
    status: 'done',
    description: 'Breaks complex tasks into atomic subtasks with dependency graphs',
  },
  researcher: {
    name: 'Researcher',
    type: 'researcher',
    status: 'idle',
    description: 'Gathers information and context from codebases and documentation',
  },
  writer: {
    name: 'Writer',
    type: 'writer',
    status: 'idle',
    description: 'Generates documentation, READMEs, and technical writing',
  },
};

export function createMockAgent(role: AgentRole, overrides?: Partial<Agent>): Agent {
  const template = AGENT_TEMPLATES[role];
  return {
    id: mockId('agent'),
    ...template,
    ...overrides,
  };
}

export function createMockAgents(roles: AgentRole[] = ['orchestrator', 'coder', 'reviewer', 'tester', 'decomposer']): Agent[] {
  return roles.map((role) => createMockAgent(role));
}

// ── Log Factory ──

export type LogLevel = LogEntry['level'];

export function createMockLog(overrides?: Partial<LogEntry>): LogEntry {
  return {
    id: mockId('log'),
    timestamp: mockTimestamp(),
    level: 'info',
    source: 'orchestrator',
    message: 'Mock log entry',
    ...overrides,
  };
}

export function createMockLogSequence(count: number, source = 'orchestrator'): LogEntry[] {
  const messages = [
    'Workflow started',
    'Parsing task requirements',
    'Decomposed into subtasks',
    'Dispatching to agent',
    'Agent processing...',
    'Subtask completed',
    'Running validation checks',
    'All checks passed',
    'Aggregating results',
    'Workflow finished',
  ];

  return Array.from({ length: count }, (_, i) =>
    createMockLog({
      id: mockId('log'),
      timestamp: mockTimestamp(count - i),
      level: i % 5 === 0 ? 'warn' : i % 7 === 0 ? 'error' : 'info',
      source,
      message: messages[i % messages.length],
    })
  );
}

// ── Task Factory ──

export type TaskStatus = Task['status'];

export function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: mockId('task'),
    description: 'Mock task description',
    status: 'pending',
    createdAt: mockTimestamp(),
    agents: ['agent-orchestrator'],
    ...overrides,
  };
}

export function createMockTaskPipeline(): Task[] {
  const baseTime = mockTimestamp(30);

  const tasks: Task[] = [
    createMockTask({
      id: 'task-001',
      description: 'Build authentication module with JWT, refresh tokens, and OAuth2 callback',
      status: 'completed',
      result: 'Auth module delivered: 3 files, 231 lines, 24/24 tests passing',
      createdAt: baseTime,
      completedAt: mockTimestamp(25),
      agents: ['agent-orchestrator', 'agent-coder', 'agent-reviewer', 'agent-tester', 'agent-decomposer'],
    }),
    createMockTask({
      id: 'task-002',
      description: 'Implement rate limiting middleware for API gateway',
      status: 'running',
      createdAt: mockTimestamp(24),
      agents: ['agent-orchestrator', 'agent-coder', 'agent-decomposer'],
      dependsOn: ['task-001'],
    }),
    createMockTask({
      id: 'task-003',
      description: 'Refactor database layer to use connection pooling',
      status: 'blocked',
      createdAt: mockTimestamp(23),
      agents: ['agent-orchestrator'],
      dependsOn: ['task-002'],
    }),
    createMockTask({
      id: 'task-004',
      description: 'Add comprehensive logging with structured JSON output',
      status: 'failed',
      result: 'Failed: OpenAI API timeout after 3 retries',
      createdAt: mockTimestamp(40),
      completedAt: mockTimestamp(35),
      agents: ['agent-orchestrator', 'agent-coder'],
    }),
    createMockTask({
      id: 'task-005',
      description: 'Write integration tests for payment processing pipeline',
      status: 'pending',
      createdAt: mockTimestamp(22),
      agents: ['agent-orchestrator', 'agent-tester'],
      dependsOn: ['task-001', 'task-002'],
    }),
    createMockTask({
      id: 'task-006',
      description: 'Deploy auth module to staging environment',
      status: 'pending',
      createdAt: mockTimestamp(21),
      agents: ['agent-orchestrator'],
      dependsOn: ['task-005'],
    }),
    createMockTask({
      id: 'task-007',
      description: 'Run end-to-end smoke tests on staging',
      status: 'pending',
      createdAt: mockTimestamp(20),
      agents: ['agent-tester'],
      dependsOn: ['task-006'],
    }),
  ];

  return tasks;
}

// ── Metric Factory ──

export function generateMetricPoints(
  baseValue: number,
  variance: number,
  count: number,
  startMinutesAgo = 12
): MetricPoint[] {
  const points: MetricPoint[] = [];
  const now = new Date('2026-05-23T03:05:00Z');
  for (let i = count - 1; i >= 0; i--) {
    const ts = new Date(now.getTime() - (i + startMinutesAgo - count) * 60000);
    points.push({
      timestamp: ts.toISOString(),
      value: Math.round((baseValue + (seededRandom() - 0.5) * variance) * 100) / 100,
    });
  }
  return points;
}

export function createMockMetric(agentId: string, agentName: string, overrides?: Partial<AgentMetric>): AgentMetric {
  return {
    agentId,
    agentName,
    executionTime: generateMetricPoints(120, 40, 12),
    tokenUsage: generateMetricPoints(850, 200, 12),
    toolCalls: generateMetricPoints(6, 3, 12),
    successRate: 0.9,
    avgDuration: 120,
    totalRuns: 40,
    ...overrides,
  };
}

// ── Config Factory ──

export function createMockConfig(): MAFConfig {
  return {
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o',
    maxRetries: 3,
    timeout: 120000,
    agents: [
      {
        name: 'Orchestrator',
        type: 'orchestrator',
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 4096,
        systemPrompt: 'You are the orchestrator agent. Coordinate task execution across specialized agents.',
        tools: ['task_decompose', 'agent_assign', 'result_merge', 'status_check'],
      },
      {
        name: 'Coder',
        type: 'coder',
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 8192,
        systemPrompt: 'You are a senior software engineer. Write clean, well-documented code.',
        tools: ['file_read', 'file_write', 'shell_exec', 'search_code', 'browser'],
      },
      {
        name: 'Reviewer',
        type: 'reviewer',
        model: 'gpt-4o',
        temperature: 0.1,
        maxTokens: 4096,
        systemPrompt: 'You are a code reviewer. Analyze code for bugs and security issues.',
        tools: ['file_read', 'search_code', 'lint_check'],
      },
      {
        name: 'Tester',
        type: 'tester',
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 6144,
        systemPrompt: 'You are a QA engineer. Write comprehensive tests.',
        tools: ['file_read', 'file_write', 'shell_exec', 'test_runner'],
      },
      {
        name: 'Decomposer',
        type: 'decomposer',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        maxTokens: 2048,
        systemPrompt: 'You break complex tasks into atomic subtasks with dependencies.',
        tools: ['task_graph', 'dependency_analysis'],
      },
    ],
  };
}
