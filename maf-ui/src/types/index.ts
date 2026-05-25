export type AgentStatus = 'idle' | 'running' | 'waiting' | 'done' | 'error';
export type MessageType = 'task' | 'result' | 'error' | 'control' | 'query';

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  description: string;
}

export interface WorkflowNode {
  id: string;
  label: string;
  agentType: string;
  status: AgentStatus;
  dependencies: string[];
  systemPrompt?: string;
}

export const AGENT_TYPES = [
  { value: 'orchestrator', label: 'Orchestrator', icon: '🎯' },
  { value: 'decomposer', label: 'Decomposer', icon: '🧩' },
  { value: 'coder', label: 'Coder', icon: '💻' },
  { value: 'reviewer', label: 'Reviewer', icon: '🔍' },
  { value: 'tester', label: 'Tester', icon: '🧪' },
  { value: 'researcher', label: 'Researcher', icon: '📚' },
  { value: 'writer', label: 'Writer', icon: '✍️' },
] as const;

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface Comment {
  id: string;
  userId: string;
  nickname: string;
  color: string;
  content: string;
  timestamp: string;
}

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  result?: string;
  createdAt: string;
  completedAt?: string;
  agents: string[];
  dependsOn?: string[];  // 依赖的任务 ID 列表
  comments?: Comment[];
  lastModifiedBy?: string;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface AgentMetric {
  agentId: string;
  agentName: string;
  executionTime: MetricPoint[];
  tokenUsage: MetricPoint[];
  toolCalls: MetricPoint[];
  successRate: number;
  avgDuration: number;
  totalRuns: number;
}

export interface ConfigAgent {
  name: string;
  type: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  tools: string[];
}

export interface MAFConfig {
  defaultProvider: string;
  defaultModel: string;
  maxRetries: number;
  timeout: number;
  agents: ConfigAgent[];
}

export type ThemeMode = 'dark' | 'light' | 'system';

export interface WorkflowExport {
  version: string;
  exportedAt: string;
  nodes: WorkflowNode[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
}

// ── Custom Agent ─────────────────────────────────────────────

export interface CustomAgent {
  id: string;
  name: string;
  type: string;               // 'coder' | 'reviewer' | 'tester' | 'custom'
  description: string;
  model: string;              // 'gpt-4o' | 'claude-sonnet' | ...
  provider: string;           // 'openai' | 'anthropic' | 'deepseek'
  temperature: number;        // 0-2
  maxTokens: number;          // 256-32768
  maxSteps: number;           // ReAct 最大步数 1-50
  systemPrompt: string;       // 系统提示词
  tools: string[];            // 启用的工具列表
  createdAt: string;
  updatedAt: string;
}

export const AVAILABLE_TOOLS = [
  { id: 'read_file', name: '读取文件', icon: '📄' },
  { id: 'write_file', name: '写入文件', icon: '✏️' },
  { id: 'patch_file', name: '修改文件', icon: '📝' },
  { id: 'list_files', name: '列出文件', icon: '📁' },
  { id: 'run_command', name: '执行命令', icon: '⚡' },
  { id: 'search_code', name: '搜索代码', icon: '🔍' },
  { id: 'web_search', name: 'Web 搜索', icon: '🌐' },
  { id: 'git_status', name: 'Git 状态', icon: '📊' },
  { id: 'git_diff', name: 'Git Diff', icon: '📋' },
] as const;

// ── Provider 配置 ──────────────────────────────────────────

export interface ProviderOption {
  id: string;
  label: string;
  models: string[];
}

export const DEFAULT_PROVIDERS: ProviderOption[] = [
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'] },
  { id: 'anthropic', label: 'Anthropic', models: ['claude-sonnet', 'claude-haiku', 'claude-opus'] },
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-v3', 'deepseek-coder'] },
  { id: 'ollama', label: 'Ollama', models: ['llama3', 'codellama', 'mistral'] },
];
