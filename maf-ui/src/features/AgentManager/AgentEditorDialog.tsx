import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, Button, TextField, TextArea, Slider, Checkbox,
  Flex, Box, Text, Heading, IconButton, Card, SegmentedControl,
} from '@radix-ui/themes';
import { PlusIcon, Pencil1Icon, Cross2Icon } from '@radix-ui/react-icons';
import type { CustomAgent } from '../../types';
import { AVAILABLE_TOOLS } from '../../types';
import { Select } from '../../components/ui/Select';
import { useAppStore } from '../../stores/useAppStore';

/* ─── 预设模板 ────────────────────────────────────────────── */

interface AgentTemplate {
  name: string;
  type: string;
  description: string;
  model: string;
  provider: string;
  temperature: number;
  maxTokens: number;
  maxSteps: number;
  systemPrompt: string;
  tools: string[];
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    name: 'Python 开发者', type: 'coder',
    description: '专注于 Python 代码开发的 Agent',
    model: 'gpt-4o', provider: 'openai', temperature: 0.3,
    maxTokens: 4096, maxSteps: 15,
    systemPrompt: '你是一个资深 Python 开发者，擅长编写高质量、可维护的代码。遵循 PEP8 规范，注重类型注解和文档字符串。',
    tools: ['read_file', 'write_file', 'run_command', 'search_code'],
  },
  {
    name: '代码审查员', type: 'reviewer',
    description: '专业代码审查和质量分析',
    model: 'claude-sonnet', provider: 'anthropic', temperature: 0.2,
    maxTokens: 4096, maxSteps: 10,
    systemPrompt: '你是一个代码审查专家，专注于发现代码中的潜在问题、安全隐患和性能优化点。',
    tools: ['read_file', 'search_code'],
  },
  {
    name: '测试工程师', type: 'tester',
    description: '自动化测试用例生成与执行',
    model: 'gpt-4o', provider: 'openai', temperature: 0.2,
    maxTokens: 4096, maxSteps: 12,
    systemPrompt: '你是一个 QA 工程师，擅长编写单元测试、集成测试和端到端测试。',
    tools: ['read_file', 'write_file', 'run_command'],
  },
  {
    name: '全栈助手', type: 'custom',
    description: '全栈开发任务处理',
    model: 'gpt-4o', provider: 'openai', temperature: 0.4,
    maxTokens: 8192, maxSteps: 20,
    systemPrompt: '你是一个全栈开发助手，能够处理前端、后端和 DevOps 相关任务。',
    tools: ['read_file', 'write_file', 'patch_file', 'list_files', 'run_command', 'search_code'],
  },
];

const TYPE_ICONS: Record<string, string> = {
  coder: '💻', reviewer: '🔍', tester: '🧪', custom: '🤖',
};

/* ─── Section ─────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Heading size="3" weight="bold" mb="3" style={{ color: 'var(--gray-12)' }}>
        {title}
      </Heading>
      {children}
    </Box>
  );
}

function Field({ label, error, children }: { label?: string; error?: string; children: React.ReactNode }) {
  return (
    <Box>
      {label && <Text size="1" weight="medium" color="gray" mb="1" style={{ display: 'block' }}>{label}</Text>}
      {children}
      {error && <Text size="1" color="red" mt="1">{error}</Text>}
    </Box>
  );
}

/* ─── AgentEditorDialog ───────────────────────────────────── */

interface AgentEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: CustomAgent | null;
  onSave: (agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export default function AgentEditorDialog({ open, onOpenChange, agent, onSave }: AgentEditorDialogProps) {
  const isEdit = !!agent;
  const providers = useAppStore((s) => s.providers);

  const [name, setName] = useState('');
  const [type, setType] = useState('custom');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [maxSteps, setMaxSteps] = useState(15);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (agent) {
      setName(agent.name); setType(agent.type); setDescription(agent.description);
      setProvider(agent.provider); setModel(agent.model); setTemperature(agent.temperature);
      setMaxTokens(agent.maxTokens); setMaxSteps(agent.maxSteps);
      setSystemPrompt(agent.systemPrompt); setTools([...agent.tools]);
    } else {
      resetForm();
    }
    setErrors({});
  }, [agent, open]);

  useEffect(() => {
    const p = providers.find((pp) => pp.id === provider);
    if (p && p.models.length > 0 && !p.models.includes(model)) {
      setModel(p.models[0]);
    }
  }, [provider, providers]);

  const resetForm = useCallback(() => {
    setName(''); setType('custom'); setDescription(''); setProvider('openai'); setModel('gpt-4o');
    setTemperature(0.3); setMaxTokens(4096); setMaxSteps(15); setSystemPrompt(''); setTools([]); setErrors({});
  }, []);

  const applyTemplate = useCallback((tpl: AgentTemplate) => {
    setName(tpl.name); setType(tpl.type); setDescription(tpl.description);
    setProvider(tpl.provider); setModel(tpl.model); setTemperature(tpl.temperature);
    setMaxTokens(tpl.maxTokens); setMaxSteps(tpl.maxSteps);
    setSystemPrompt(tpl.systemPrompt); setTools([...tpl.tools]); setErrors({});
  }, []);

  const toggleTool = useCallback((toolId: string) => {
    setTools((prev) => prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]);
  }, []);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = '名称不能为空';
    if (!description.trim()) errs.description = '描述不能为空';
    if (!systemPrompt.trim()) errs.systemPrompt = '系统提示词不能为空';
    if (maxTokens < 256 || maxTokens > 32768) errs.maxTokens = 'Max Tokens 范围: 256-32768';
    if (maxSteps < 1 || maxSteps > 50) errs.maxSteps = 'Max Steps 范围: 1-50';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, description, systemPrompt, maxTokens, maxSteps]);

  const handleSave = useCallback(() => {
    if (!validate()) return;
    onSave({
      name: name.trim(), type, description: description.trim(), provider, model,
      temperature, maxTokens, maxSteps, systemPrompt: systemPrompt.trim(), tools,
    });
    onOpenChange(false);
  }, [name, type, description, provider, model, temperature, maxTokens, maxSteps, systemPrompt, tools, validate, onSave, onOpenChange]);

  const availableModels = providers.find((p) => p.id === provider)?.models ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px" style={{ maxHeight: '88vh' }}>
        {/* Header */}
        <Flex align="center" justify="between" mb="5">
          <Flex align="center" gap="2">
            {isEdit ? <Pencil1Icon width={18} height={18} /> : <PlusIcon width={18} height={18} />}
            <Dialog.Title style={{ margin: 0, fontSize: 18 }}>
              {isEdit ? '编辑 Agent' : '创建自定义 Agent'}
            </Dialog.Title>
          </Flex>
          <Dialog.Close>
            <IconButton variant="ghost" color="gray" size="1">
              <Cross2Icon width={14} height={14} />
            </IconButton>
          </Dialog.Close>
        </Flex>

        {/* Body */}
        <Box style={{ maxHeight: 'calc(88vh - 140px)', overflowY: 'auto', paddingRight: 4 }}>
          <Flex direction="column" gap="5">

            {/* ── 1. 快速模板 ── */}
            {!isEdit && (
              <Section title="快速模板">
                <Flex gap="2" wrap="wrap">
                  {AGENT_TEMPLATES.map((tpl) => (
                    <Card
                      key={tpl.name}
                      asChild
                      size="1"
                      style={{
                        flex: '1 1 calc(50% - 4px)', minWidth: 200, cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <button onClick={() => applyTemplate(tpl)} style={{
                        background: 'none', border: '1px solid var(--gray-6)',
                        borderRadius: 'var(--radius-3)', padding: '12px 14px', textAlign: 'left',
                      }}>
                        <Flex align="center" gap="3">
                          <Text size="4">{TYPE_ICONS[tpl.type]}</Text>
                          <Box style={{ minWidth: 0, flex: 1 }}>
                            <Text size="2" weight="bold">{tpl.name}</Text>
                            <Text size="1" color="gray" style={{
                              display: 'block', marginTop: 2,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {tpl.description}
                            </Text>
                          </Box>
                        </Flex>
                      </button>
                    </Card>
                  ))}
                </Flex>
              </Section>
            )}

            {/* ── 2. 基本信息 ── */}
            <Section title="基本信息">
              <Flex direction="column" gap="3">
                <Flex gap="3">
                  <Box style={{ flex: 2 }}>
                    <Field label="名称 *" error={errors.name}>
                      <TextField.Root
                        value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Agent 名称"
                        color={errors.name ? 'red' : undefined}
                        variant={errors.name ? 'soft' : 'surface'}
                        size="2"
                      />
                    </Field>
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Field label="类型">
                      <Select
                        value={type} onValueChange={setType}
                        options={Object.entries(TYPE_ICONS).map(([v, icon]) => ({
                          value: v, label: `${icon} ${v.charAt(0).toUpperCase() + v.slice(1)}`,
                        }))}
                      />
                    </Field>
                  </Box>
                </Flex>
                <Field label="描述 *" error={errors.description}>
                  <TextField.Root
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="简要描述 Agent 的职责和能力"
                    color={errors.description ? 'red' : undefined}
                    variant={errors.description ? 'soft' : 'surface'}
                    size="2"
                  />
                </Field>
              </Flex>
            </Section>

            {/* ── 3. 模型配置 ── */}
            <Section title="模型配置">
              <Flex direction="column" gap="3">
                <Field label="Provider">
                  <SegmentedControl.Root
                    value={provider}
                    onValueChange={(v) => { if (v) setProvider(v); }}
                    size="2"
                  >
                    {providers.map((p) => (
                      <SegmentedControl.Item key={p.id} value={p.id}>
                        {p.label}
                      </SegmentedControl.Item>
                    ))}
                  </SegmentedControl.Root>
                </Field>

                <Flex gap="3">
                  <Box style={{ flex: 1 }}>
                    <Field label="Model">
                      <Select
                        value={model} onValueChange={setModel}
                        options={availableModels.map(m => ({ value: m, label: m }))}
                      />
                    </Field>
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Field label={`Temperature  ${temperature.toFixed(1)}`}>
                      <Box pt="1">
                        <Slider
                          size="1"
                          min={0} max={20} step={1}
                          value={[Math.round(temperature * 10)]}
                          onValueChange={([v]) => setTemperature(v / 10)}
                        />
                      </Box>
                    </Field>
                  </Box>
                </Flex>

                <Flex gap="3">
                  <Box style={{ flex: 1 }}>
                    <Field label="Max Tokens" error={errors.maxTokens}>
                      <TextField.Root
                        type="number"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(parseInt(e.target.value) || 256)}
                        color={errors.maxTokens ? 'red' : undefined}
                        variant={errors.maxTokens ? 'soft' : 'surface'}
                        size="2"
                      />
                    </Field>
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Field label="Max Steps (ReAct)" error={errors.maxSteps}>
                      <TextField.Root
                        type="number"
                        value={maxSteps}
                        onChange={(e) => setMaxSteps(parseInt(e.target.value) || 1)}
                        color={errors.maxSteps ? 'red' : undefined}
                        variant={errors.maxSteps ? 'soft' : 'surface'}
                        size="2"
                      />
                    </Field>
                  </Box>
                </Flex>
              </Flex>
            </Section>

            {/* ── 4. 系统提示词 ── */}
            <Section title="系统提示词">
              <Field error={errors.systemPrompt}>
                <TextArea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="定义 Agent 的行为和能力..."
                  rows={4}
                  resize="vertical"
                  color={errors.systemPrompt ? 'red' : undefined}
                  variant={errors.systemPrompt ? 'soft' : 'surface'}
                  size="2"
                />
              </Field>
            </Section>

            {/* ── 5. 启用工具 ── */}
            <Section title={`启用工具  (${tools.length}/${AVAILABLE_TOOLS.length})`}>
              <Flex gap="2" wrap="wrap">
                {AVAILABLE_TOOLS.map((tool) => {
                  const active = tools.includes(tool.id);
                  return (
                    <Box
                      key={tool.id}
                      onClick={() => toggleTool(tool.id)}
                      style={{
                        flex: '0 0 calc(33.333% - 6px)',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-3)',
                        border: `1.5px solid ${active ? 'var(--accent-9)' : 'var(--gray-6)'}`,
                        background: active ? 'var(--accent-3)' : 'var(--gray-2)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        userSelect: 'none',
                      }}
                    >
                      <Flex align="center" gap="2">
                        <Checkbox checked={active} size="1" tabIndex={-1} />
                        <Text size="2" weight={active ? 'medium' : 'regular'} style={{
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {tool.icon} {tool.name}
                        </Text>
                      </Flex>
                    </Box>
                  );
                })}
              </Flex>
            </Section>

          </Flex>
        </Box>

        {/* Footer */}
        <Flex justify="end" gap="3" pt="4" mt="2" style={{ borderTop: '1px solid var(--gray-6)' }}>
          <Dialog.Close>
            <Button variant="soft" color="gray" size="2">取消</Button>
          </Dialog.Close>
          <Button onClick={handleSave} color="blue" size="2">
            {isEdit ? '保存修改' : '创建 Agent'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
