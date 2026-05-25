import type { Agent, LogEntry, Task, AgentMetric, MAFConfig } from '../types';

export const mockAgents: Agent[] = [
  {
    id: 'agent-orchestrator',
    name: 'Orchestrator',
    type: 'orchestrator',
    status: 'running',
    description: 'Coordinates task decomposition and agent assignment across the workflow',
  },
  {
    id: 'agent-coder',
    name: 'Coder',
    type: 'coder',
    status: 'running',
    description: 'Generates, refactors, and optimizes source code based on requirements',
  },
  {
    id: 'agent-reviewer',
    name: 'Reviewer',
    type: 'reviewer',
    status: 'waiting',
    description: 'Reviews code for quality, security, and adherence to best practices',
  },
  {
    id: 'agent-tester',
    name: 'Tester',
    type: 'tester',
    status: 'idle',
    description: 'Creates and executes test suites, reports coverage and failures',
  },
  {
    id: 'agent-decomposer',
    name: 'Decomposer',
    type: 'decomposer',
    status: 'done',
    description: 'Breaks complex tasks into atomic subtasks with dependency graphs',
  },
];

export const mockLogs: LogEntry[] = [
  { id: 'log-001', timestamp: '2026-05-23T03:00:01Z', level: 'info', source: 'orchestrator', message: 'Workflow started: build-auth-module' },
  { id: 'log-002', timestamp: '2026-05-23T03:00:02Z', level: 'info', source: 'decomposer', message: 'Parsing task requirements from spec file' },
  { id: 'log-003', timestamp: '2026-05-23T03:00:05Z', level: 'info', source: 'decomposer', message: 'Decomposed into 4 subtasks with 6 dependency edges' },
  { id: 'log-004', timestamp: '2026-05-23T03:00:06Z', level: 'debug', source: 'orchestrator', message: 'Dispatching subtask: implement-jwt-handler', metadata: { agentId: 'agent-coder' } },
  { id: 'log-005', timestamp: '2026-05-23T03:00:07Z', level: 'info', source: 'coder', message: 'Started generating JWT handler module' },
  { id: 'log-006', timestamp: '2026-05-23T03:01:12Z', level: 'info', source: 'coder', message: 'JWT handler generated: 142 lines across 3 files' },
  { id: 'log-007', timestamp: '2026-05-23T03:01:13Z', level: 'info', source: 'orchestrator', message: 'Dispatching subtask: implement-refresh-token' },
  { id: 'log-008', timestamp: '2026-05-23T03:01:15Z', level: 'warn', source: 'coder', message: 'Token expiry config not found, using default 15m', metadata: { field: 'TOKEN_EXPIRY' } },
  { id: 'log-009', timestamp: '2026-05-23T03:02:30Z', level: 'info', source: 'coder', message: 'Refresh token logic generated: 89 lines' },
  { id: 'log-010', timestamp: '2026-05-23T03:02:31Z', level: 'debug', source: 'orchestrator', message: 'All codegen subtasks complete, triggering review phase' },
  { id: 'log-011', timestamp: '2026-05-23T03:02:32Z', level: 'info', source: 'reviewer', message: 'Starting code review for auth module' },
  { id: 'log-012', timestamp: '2026-05-23T03:03:05Z', level: 'warn', source: 'reviewer', message: 'Potential timing attack in token comparison (line 87)' },
  { id: 'log-013', timestamp: '2026-05-23T03:03:06Z', level: 'error', source: 'reviewer', message: 'Missing input validation on /auth/callback endpoint' },
  { id: 'log-014', timestamp: '2026-05-23T03:03:08Z', level: 'info', source: 'orchestrator', message: 'Review complete: 1 error, 1 warning. Sending fixes to coder' },
  { id: 'log-015', timestamp: '2026-05-23T03:03:10Z', level: 'info', source: 'coder', message: 'Applying fix: constant-time comparison for tokens' },
  { id: 'log-016', timestamp: '2026-05-23T03:03:15Z', level: 'info', source: 'coder', message: 'Applying fix: input validation middleware added' },
  { id: 'log-017', timestamp: '2026-05-23T03:03:20Z', level: 'info', source: 'orchestrator', message: 'Fixes applied. Queuing for test phase' },
  { id: 'log-018', timestamp: '2026-05-23T03:03:22Z', level: 'info', source: 'tester', message: 'Generating test suite for auth module' },
  { id: 'log-019', timestamp: '2026-05-23T03:04:00Z', level: 'info', source: 'tester', message: 'Test suite ready: 24 tests across 4 files' },
  { id: 'log-020', timestamp: '2026-05-23T03:04:05Z', level: 'error', source: 'tester', message: 'Test failed: refresh token rotation not invalidating old tokens', metadata: { test: 'test_refresh_rotation' } },
  { id: 'log-021', timestamp: '2026-05-23T03:04:10Z', level: 'info', source: 'coder', message: 'Fixing token rotation: adding revocation check' },
  { id: 'log-022', timestamp: '2026-05-23T03:04:45Z', level: 'info', source: 'tester', message: 'Re-running tests after fix... 24/24 passing' },
  { id: 'log-023', timestamp: '2026-05-23T03:04:46Z', level: 'info', source: 'orchestrator', message: 'All tests passed. Auth module complete.' },
  { id: 'log-024', timestamp: '2026-05-23T03:04:47Z', level: 'info', source: 'orchestrator', message: 'Workflow finished: build-auth-module (elapsed: 4m46s)' },
];

export const mockTasks: Task[] = [
  {
    id: 'task-001',
    description: 'Build authentication module with JWT, refresh tokens, and OAuth2 callback',
    status: 'completed',
    result: 'Auth module delivered: 3 files, 231 lines, 24/24 tests passing',
    createdAt: '2026-05-23T03:00:00Z',
    completedAt: '2026-05-23T03:04:47Z',
    agents: ['agent-orchestrator', 'agent-coder', 'agent-reviewer', 'agent-tester', 'agent-decomposer'],
  },
  {
    id: 'task-002',
    description: 'Implement rate limiting middleware for API gateway',
    status: 'running',
    createdAt: '2026-05-23T03:05:00Z',
    agents: ['agent-orchestrator', 'agent-coder', 'agent-decomposer'],
    dependsOn: ['task-001'],
  },
  {
    id: 'task-003',
    description: 'Refactor database layer to use connection pooling',
    status: 'blocked',
    createdAt: '2026-05-23T03:06:00Z',
    agents: ['agent-orchestrator'],
    dependsOn: ['task-002'],
  },
  {
    id: 'task-004',
    description: 'Add comprehensive logging with structured JSON output',
    status: 'failed',
    result: 'Failed: OpenAI API timeout after 3 retries',
    createdAt: '2026-05-23T02:50:00Z',
    completedAt: '2026-05-23T02:55:30Z',
    agents: ['agent-orchestrator', 'agent-coder'],
  },
  {
    id: 'task-005',
    description: 'Write integration tests for payment processing pipeline',
    status: 'pending',
    createdAt: '2026-05-23T03:07:00Z',
    agents: ['agent-orchestrator', 'agent-tester'],
    dependsOn: ['task-001', 'task-002'],
  },
  {
    id: 'task-006',
    description: 'Deploy auth module to staging environment',
    status: 'pending',
    createdAt: '2026-05-23T03:08:00Z',
    agents: ['agent-orchestrator'],
    dependsOn: ['task-005'],
  },
  {
    id: 'task-007',
    description: 'Run end-to-end smoke tests on staging',
    status: 'pending',
    createdAt: '2026-05-23T03:09:00Z',
    agents: ['agent-tester'],
    dependsOn: ['task-006'],
  },
];

function generateMetricPoints(baseValue: number, variance: number, count: number): { timestamp: string; value: number }[] {
  const points: { timestamp: string; value: number }[] = [];
  const now = new Date('2026-05-23T03:05:00Z');
  for (let i = count - 1; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * 60000);
    points.push({
      timestamp: ts.toISOString(),
      value: Math.round((baseValue + (Math.random() - 0.5) * variance) * 100) / 100,
    });
  }
  return points;
}

export const mockMetrics: AgentMetric[] = [
  {
    agentId: 'agent-orchestrator',
    agentName: 'Orchestrator',
    executionTime: generateMetricPoints(120, 40, 12),
    tokenUsage: generateMetricPoints(850, 200, 12),
    toolCalls: generateMetricPoints(6, 3, 12),
    successRate: 0.95,
    avgDuration: 118.5,
    totalRuns: 47,
  },
  {
    agentId: 'agent-coder',
    agentName: 'Coder',
    executionTime: generateMetricPoints(340, 120, 12),
    tokenUsage: generateMetricPoints(2400, 800, 12),
    toolCalls: generateMetricPoints(12, 5, 12),
    successRate: 0.88,
    avgDuration: 355.2,
    totalRuns: 38,
  },
  {
    agentId: 'agent-reviewer',
    agentName: 'Reviewer',
    executionTime: generateMetricPoints(200, 60, 12),
    tokenUsage: generateMetricPoints(1200, 400, 12),
    toolCalls: generateMetricPoints(4, 2, 12),
    successRate: 0.92,
    avgDuration: 195.8,
    totalRuns: 34,
  },
  {
    agentId: 'agent-tester',
    agentName: 'Tester',
    executionTime: generateMetricPoints(280, 90, 12),
    tokenUsage: generateMetricPoints(1600, 500, 12),
    toolCalls: generateMetricPoints(8, 4, 12),
    successRate: 0.85,
    avgDuration: 290.3,
    totalRuns: 30,
  },
  {
    agentId: 'agent-decomposer',
    agentName: 'Decomposer',
    executionTime: generateMetricPoints(90, 30, 12),
    tokenUsage: generateMetricPoints(600, 150, 12),
    toolCalls: generateMetricPoints(3, 2, 12),
    successRate: 0.97,
    avgDuration: 88.1,
    totalRuns: 52,
  },
];

export const mockConfig: MAFConfig = {
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
      systemPrompt: 'You are the orchestrator agent. Coordinate task execution across specialized agents. Decompose tasks, assign work, and aggregate results.',
      tools: ['task_decompose', 'agent_assign', 'result_merge', 'status_check'],
    },
    {
      name: 'Coder',
      type: 'coder',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 8192,
      systemPrompt: 'You are a senior software engineer. Write clean, well-documented, production-quality code. Follow best practices for the target language and framework.',
      tools: ['file_read', 'file_write', 'shell_exec', 'search_code', 'browser'],
    },
    {
      name: 'Reviewer',
      type: 'reviewer',
      model: 'gpt-4o',
      temperature: 0.1,
      maxTokens: 4096,
      systemPrompt: 'You are a code reviewer. Analyze code for bugs, security issues, performance problems, and style violations. Provide actionable feedback.',
      tools: ['file_read', 'search_code', 'lint_check'],
    },
    {
      name: 'Tester',
      type: 'tester',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 6144,
      systemPrompt: 'You are a QA engineer. Write comprehensive tests including unit, integration, and edge cases. Run tests and report results.',
      tools: ['file_read', 'file_write', 'shell_exec', 'test_runner'],
    },
    {
      name: 'Decomposer',
      type: 'decomposer',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 2048,
      systemPrompt: 'You analyze complex tasks and break them into atomic, independently executable subtasks with clear dependency relationships.',
      tools: ['task_graph', 'dependency_analysis'],
    },
  ],
};
