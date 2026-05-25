import type { MAFConfig } from '../../types';

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: MAFConfig;
}

export const PRESET_TEMPLATES: ConfigTemplate[] = [
  {
    id: 'python-dev',
    name: 'Python Development',
    description: 'Optimized for Python projects with code review and testing',
    icon: '🐍',
    config: {
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
      maxRetries: 3,
      timeout: 120000,
      agents: [
        {
          name: 'Python Coder',
          type: 'coder',
          model: 'gpt-4o',
          temperature: 0.2,
          maxTokens: 4096,
          systemPrompt: 'You are an expert Python developer. Write clean, well-documented Python code following PEP 8 conventions.',
          tools: ['file_read', 'file_write', 'shell_exec', 'lint_check', 'test_runner'],
        },
        {
          name: 'Code Reviewer',
          type: 'reviewer',
          model: 'gpt-4o',
          temperature: 0.1,
          maxTokens: 4096,
          systemPrompt: 'You are a senior code reviewer. Focus on correctness, performance, and security issues in Python code.',
          tools: ['file_read', 'search_code', 'lint_check'],
        },
      ],
    },
  },
  {
    id: 'frontend-dev',
    name: 'Frontend Development',
    description: 'React/Vue focused with component review',
    icon: '⚛️',
    config: {
      defaultProvider: 'anthropic',
      defaultModel: 'claude-sonnet',
      maxRetries: 3,
      timeout: 120000,
      agents: [
        {
          name: 'Frontend Coder',
          type: 'coder',
          model: 'claude-sonnet',
          temperature: 0.3,
          maxTokens: 4096,
          systemPrompt: 'You are an expert frontend developer specializing in React, Vue, and TypeScript. Build responsive, accessible UI components.',
          tools: ['file_read', 'file_write', 'shell_exec', 'browser', 'lint_check'],
        },
        {
          name: 'Component Reviewer',
          type: 'reviewer',
          model: 'claude-haiku',
          temperature: 0.1,
          maxTokens: 2048,
          systemPrompt: 'You review frontend components for accessibility, performance, and best practices.',
          tools: ['file_read', 'search_code', 'browser', 'lint_check'],
        },
      ],
    },
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Focus on code quality and security analysis',
    icon: '🔍',
    config: {
      defaultProvider: 'anthropic',
      defaultModel: 'claude-opus',
      maxRetries: 2,
      timeout: 180000,
      agents: [
        {
          name: 'Security Reviewer',
          type: 'reviewer',
          model: 'claude-opus',
          temperature: 0.0,
          maxTokens: 8192,
          systemPrompt: 'You are a security-focused code reviewer. Identify vulnerabilities, injection risks, and security anti-patterns.',
          tools: ['file_read', 'search_code', 'lint_check'],
        },
        {
          name: 'Quality Reviewer',
          type: 'reviewer',
          model: 'claude-sonnet',
          temperature: 0.1,
          maxTokens: 4096,
          systemPrompt: 'You are a code quality reviewer. Focus on maintainability, readability, and adherence to design patterns.',
          tools: ['file_read', 'search_code', 'lint_check', 'test_runner'],
        },
      ],
    },
  },
  {
    id: 'data-science',
    name: 'Data Science',
    description: 'Data analysis and ML model development',
    icon: '📊',
    config: {
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
      maxRetries: 3,
      timeout: 300000,
      agents: [
        {
          name: 'Data Analyst',
          type: 'analyst',
          model: 'gpt-4o',
          temperature: 0.2,
          maxTokens: 8192,
          systemPrompt: 'You are an expert data scientist. Analyze data, build ML models, and generate insightful visualizations using Python.',
          tools: ['file_read', 'file_write', 'shell_exec', 'test_runner'],
        },
        {
          name: 'Report Generator',
          type: 'writer',
          model: 'gpt-4o',
          temperature: 0.5,
          maxTokens: 4096,
          systemPrompt: 'You generate clear, well-structured reports from data analysis results. Use tables, charts descriptions, and plain language.',
          tools: ['file_read', 'file_write'],
        },
      ],
    },
  },
];

const CUSTOM_TEMPLATES_KEY = 'maf-custom-templates';

export function loadCustomTemplates(): ConfigTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: ConfigTemplate[]): void {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
}
