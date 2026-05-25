import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import jsYaml from 'js-yaml';
import { useAppStore } from '../../stores/useAppStore';
import type { MAFConfig, ConfigAgent } from '../../types';
import type { ConfigTemplate } from './templates';
import { PRESET_TEMPLATES } from './templates';
import { ConfigAdvisor } from '../AIAssistant';
import { useTranslation } from '../../i18n';
import { Select } from '../../components/ui/Select';
import {
  GearIcon,
  PlusIcon,
  UploadIcon,
  DownloadIcon,
  ResetIcon,
  CheckIcon,
  ChevronRightIcon,
  Cross2Icon,
  PersonIcon,
  TrashIcon,
} from '@radix-ui/react-icons';

/* ─── constants ───────────────────────────────────────────────────── */

const PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'ollama'] as const;

const MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview'],
  anthropic: ['claude-sonnet', 'claude-haiku', 'claude-opus'],
  google: ['gemini-pro', 'gemini-flash'],
  deepseek: ['deepseek-v3', 'deepseek-coder'],
  ollama: ['llama3', 'codellama', 'mistral'],
};

const ALL_MODELS = [...new Set(Object.values(MODELS).flat())];

const AVAILABLE_TOOLS = [
  'file_read',
  'file_write',
  'shell_exec',
  'search_code',
  'browser',
  'test_runner',
  'lint_check',
  'task_decompose',
  'agent_assign',
  'result_merge',
  'status_check',
  'task_graph',
  'dependency_analysis',
];

/* ─── helpers ─────────────────────────────────────────────────────── */

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/* ─── Slider (styled range input) ─────────────────────────────────── */

function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  width,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number | string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: width ?? '100%' }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1,
          height: 4,
          borderRadius: 2,
          appearance: 'none',
          background: `linear-gradient(to right, var(--accent-9) ${pct}%, var(--gray-6) ${pct}%)`,
          outline: 'none',
          cursor: 'pointer',
        }}
      />
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--gray-11)',
          minWidth: 32,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
}

/* ─── Switch ──────────────────────────────────────────────────────── */

function Switch({
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: 'none',
        background: checked ? 'var(--accent-9)' : 'var(--gray-6)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.15s ease',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--gray-1)',
          transition: 'left 0.15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

/* ─── Separator ───────────────────────────────────────────────────── */

function Separator() {
  return <div style={{ height: 1, background: 'var(--gray-6)', margin: '16px 0' }} />;
}

/* ─── FieldLabel ──────────────────────────────────────────────────── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--gray-9)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

/* ─── GlobalConfig ────────────────────────────────────────────────── */

function GlobalConfig({
  config,
  onChange,
}: {
  config: MAFConfig;
  onChange: (updates: Partial<MAFConfig>) => void;
}) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 10,
        border: '1px solid var(--gray-6)',
        background: 'var(--gray-2)',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <GearIcon width={16} height={16} color="var(--accent-9)" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-12)' }}>Global Configuration</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        <div>
          <FieldLabel>Default Provider</FieldLabel>
          <Select
            value={config.defaultProvider}
            onValueChange={(v) => onChange({ defaultProvider: v })}
            options={PROVIDERS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
          />
        </div>
        <div>
          <FieldLabel>Default Model</FieldLabel>
          <Select
            value={config.defaultModel}
            onValueChange={(v) => onChange({ defaultModel: v })}
            options={ALL_MODELS.map((m) => ({ value: m, label: m }))}
          />
        </div>
        <div>
          <FieldLabel>Max Retries</FieldLabel>
          <input
            type="number"
            min={0}
            max={10}
            value={config.maxRetries}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ maxRetries: parseInt(e.target.value) || 0 })}
            style={{
              width: '100%',
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--gray-6)',
              background: 'var(--gray-3)',
              color: 'var(--gray-12)',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <FieldLabel>Timeout (ms)</FieldLabel>
          <input
            type="number"
            min={1000}
            step={1000}
            value={config.timeout}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ timeout: parseInt(e.target.value) || 30000 })}
            style={{
              width: '100%',
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--gray-6)',
              background: 'var(--gray-3)',
              color: 'var(--gray-12)',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── AgentConfigCard (sidebar list item) ─────────────────────────── */

function AgentConfigCard({
  agent,
  active,
  onClick,
}: {
  agent: ConfigAgent;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        border: active ? '1px solid var(--accent-7)' : '1px solid transparent',
        background: active ? 'var(--gray-4)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s, border-color 0.1s',
        color: 'var(--gray-12)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: active ? 'var(--accent-4)' : 'var(--gray-5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <PersonIcon width={14} height={14} color={active ? 'var(--accent-11)' : 'var(--gray-9)'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.3 }}>{agent.name}</div>
        <div style={{ fontSize: '11px', color: 'var(--gray-9)', lineHeight: 1.3, marginTop: 1 }}>
          {agent.model} · temp {agent.temperature.toFixed(2)}
        </div>
      </div>
      {active && <ChevronRightIcon width={14} height={14} color="var(--accent-9)" />}
    </button>
  );
}

/* ─── AgentEditor ─────────────────────────────────────────────────── */

function AgentEditor({
  agent,
  onChange,
}: {
  agent: ConfigAgent;
  onChange: (updates: Partial<ConfigAgent>) => void;
}) {
  const toggleTool = (tool: string) => {
    const tools = agent.tools.includes(tool)
      ? agent.tools.filter((t) => t !== tool)
      : [...agent.tools, tool];
    onChange({ tools });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* name + type row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <FieldLabel>Agent Name</FieldLabel>
          <input
            type="text"
            value={agent.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ name: e.target.value })}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--gray-6)',
              background: 'var(--gray-3)',
              color: 'var(--gray-12)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <FieldLabel>Agent Type</FieldLabel>
          <input
            type="text"
            value={agent.type}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ type: e.target.value })}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--gray-6)',
              background: 'var(--gray-3)',
              color: 'var(--gray-12)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* model + temperature */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <FieldLabel>Model</FieldLabel>
          <Select
            value={agent.model}
            onValueChange={(v) => onChange({ model: v })}
            options={ALL_MODELS.map((m) => ({ value: m, label: m }))}
          />
        </div>
        <div>
          <FieldLabel>Temperature</FieldLabel>
          <Slider value={agent.temperature} onChange={(v) => onChange({ temperature: v })} />
        </div>
      </div>

      {/* max tokens */}
      <div style={{ maxWidth: 200 }}>
        <FieldLabel>Max Tokens</FieldLabel>
        <input
          type="number"
          min={256}
          step={256}
          value={agent.maxTokens}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ maxTokens: parseInt(e.target.value) || 2048 })}
          style={{
            width: '100%',
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--gray-6)',
            background: 'var(--gray-3)',
            color: 'var(--gray-12)',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* system prompt */}
      <div>
        <FieldLabel>System Prompt</FieldLabel>
        <textarea
          value={agent.systemPrompt}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ systemPrompt: e.target.value })}
          style={{
            width: '100%',
            minHeight: 100,
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid var(--gray-6)',
            background: 'var(--gray-3)',
            color: 'var(--gray-12)',
            fontSize: '12px',
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* tools */}
      <div>
        <FieldLabel>Tools</FieldLabel>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 8,
          }}
        >
          {AVAILABLE_TOOLS.map((tool) => {
            const active = agent.tools.includes(tool);
            return (
              <label
                key={tool}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${active ? 'var(--accent-7)' : 'var(--gray-6)'}`,
                  background: active ? 'var(--accent-3)' : 'var(--gray-2)',
                  cursor: 'pointer',
                  transition: 'border-color 0.1s, background 0.1s',
                  fontSize: '12px',
                  color: active ? 'var(--accent-11)' : 'var(--gray-11)',
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleTool(tool)}
                  style={{ display: 'none' }}
                />
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    border: `1.5px solid ${active ? 'var(--accent-9)' : 'var(--gray-7)'}`,
                    background: active ? 'var(--accent-9)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'border-color 0.1s, background 0.1s',
                  }}
                >
                  {active && <CheckIcon width={10} height={10} color="white" />}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{tool}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── TemplateSelector ──────────────────────────────────────────────── */

function TemplateSelector({
  onApply,
}: {
  onApply: (config: MAFConfig) => void;
}) {
  const customTemplates = useAppStore((s) => s.customTemplates);
  const saveAsTemplate = useAppStore((s) => s.saveAsTemplate);
  const deleteTemplate = useAppStore((s) => s.deleteTemplate);
  const addLog = useAppStore((s) => s.addLog);
  const { t } = useTranslation();

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const handleApply = useCallback(
    (template: ConfigTemplate) => {
      if (confirmId === template.id) {
        onApply(template.config);
        setConfirmId(null);
        addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          source: 'config',
          message: `Template "${template.name}" applied`,
        });
      } else {
        setConfirmId(template.id);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = setTimeout(() => setConfirmId(null), 3000);
      }
    },
    [confirmId, onApply, addLog]
  );

  const handleSave = useCallback(() => {
    const name = newTemplateName.trim();
    if (!name) return;
    saveAsTemplate(name);
    setNewTemplateName('');
    setShowSaveForm(false);
    addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      source: 'config',
      message: `Configuration saved as template "${name}"`,
    });
  }, [newTemplateName, saveAsTemplate, addLog]);

  const cardStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid var(--gray-6)',
    background: 'var(--gray-2)',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    color: 'var(--gray-12)',
  };

  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 10,
        border: '1px solid var(--gray-6)',
        background: 'var(--gray-2)',
        marginBottom: 20,
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-12)' }}>{t('config.configTemplates')}</span>
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          style={btnStyle('ghost')}
          title="Save current config as template"
        >
          <PlusIcon width={12} height={12} /> {t('config.saveAsTemplate')}
        </button>
      </div>

      {/* save form */}
      {showSaveForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <input
            type="text"
            placeholder={t('config.templateName')}
            value={newTemplateName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTemplateName(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setShowSaveForm(false);
            }}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--gray-6)',
              background: 'var(--gray-3)',
              color: 'var(--gray-12)',
              fontSize: '12px',
              outline: 'none',
            }}
            autoFocus
          />
          <button onClick={handleSave} style={btnStyle('primary')} disabled={!newTemplateName.trim()}>
            {t('common.save')}
          </button>
          <button onClick={() => setShowSaveForm(false)} style={btnStyle('ghost')}>
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* preset templates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {PRESET_TEMPLATES.map((tpl) => {
          const isConfirming = confirmId === tpl.id;
          return (
            <button
              key={tpl.id}
              onClick={() => handleApply(tpl)}
              style={{
                ...cardStyle,
                border: isConfirming ? '1px solid var(--amber-7)' : '1px solid var(--gray-6)',
                background: isConfirming ? 'var(--amber-2)' : 'var(--gray-2)',
              }}
              onMouseEnter={(e: React.MouseEvent) => {
                if (!isConfirming) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-7)';
              }}
              onMouseLeave={(e: React.MouseEvent) => {
                if (!isConfirming) (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-6)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{tpl.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{tpl.name}</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--gray-9)', lineHeight: 1.4 }}>{tpl.description}</span>
              {isConfirming && (
                <span style={{ fontSize: '11px', color: 'var(--amber-11)', fontWeight: 600 }}>
                  {t('config.clickAgainToConfirm')}
                </span>
              )}
            </button>
          );
        })}

        {/* custom templates */}
        {customTemplates.map((tpl) => {
          const isConfirming = confirmId === tpl.id;
          return (
            <div
              key={tpl.id}
              style={{
                ...cardStyle,
                border: isConfirming ? '1px solid var(--amber-7)' : '1px solid var(--gray-6)',
                background: isConfirming ? 'var(--amber-2)' : 'var(--gray-2)',
                cursor: 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '20px', lineHeight: 1 }}>{tpl.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{tpl.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handleApply(tpl)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      border: 'none',
                      background: isConfirming ? 'var(--amber-4)' : 'var(--accent-4)',
                      cursor: 'pointer',
                    }}
                    title={isConfirming ? 'Confirm apply' : 'Apply template'}
                  >
                    {isConfirming ? (
                      <CheckIcon width={12} height={12} color="var(--amber-11)" />
                    ) : (
                      <CheckIcon width={12} height={12} color="var(--accent-11)" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      border: 'none',
                      background: 'var(--red-4)',
                      cursor: 'pointer',
                    }}
                    title="Delete template"
                  >
                    <TrashIcon width={12} height={12} color="var(--red-11)" />
                  </button>
                </div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--gray-9)', lineHeight: 1.4 }}>{tpl.description}</span>
              {isConfirming && (
                <span style={{ fontSize: '11px', color: 'var(--amber-11)', fontWeight: 600 }}>
                  {t('config.clickCheckmarkToConfirm')}
                </span>
              )}
            </div>
          );
        })}

        {customTemplates.length === 0 && (
          <div
            style={{
              ...cardStyle,
              cursor: 'default',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed var(--gray-6)',
              background: 'transparent',
              color: 'var(--gray-8)',
              fontSize: '12px',
            }}
          >
            {t('config.noCustomTemplates')}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ConfigPanel (main export) ───────────────────────────────────── */

export default function ConfigPanel() {
  const storeConfig = useAppStore((s) => s.config);
  const setStoreConfig = useAppStore((s) => s.setConfig);
  const saveConfigToApi = useAppStore((s) => s.saveConfigToApi);
  const addLog = useAppStore((s) => s.addLog);
  const { t } = useTranslation();

  // Local editable copy of config
  const [config, setConfig] = useState<MAFConfig>(() => deepClone(storeConfig));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup saved timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const updateGlobal = useCallback(
    (updates: Partial<MAFConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
      setDirty(true);
      setSaved(false);
    },
    []
  );

  const updateAgent = useCallback(
    (idx: number, updates: Partial<ConfigAgent>) => {
      setConfig((prev) => {
        const agents = [...prev.agents];
        agents[idx] = { ...agents[idx], ...updates };
        return { ...prev, agents };
      });
      setDirty(true);
      setSaved(false);
    },
    []
  );

  const addAgent = useCallback(() => {
    setConfig((prev) => {
      setSelectedIdx(prev.agents.length);
      return {
        ...prev,
        agents: [
          ...prev.agents,
          {
            name: `Agent-${prev.agents.length + 1}`,
            type: 'custom',
            model: prev.defaultModel,
            temperature: 0.3,
            maxTokens: 4096,
            systemPrompt: 'You are a helpful AI assistant.',
            tools: [],
          },
        ],
      };
    });
    setDirty(true);
    setSaved(false);
  }, []);

  const removeAgent = useCallback(
    (idx: number) => {
      if (!Array.isArray(config.agents) || config.agents.length <= 1) return;
      setConfig((prev) => ({
        ...prev,
        agents: (prev.agents || []).filter((_, i) => i !== idx),
      }));
      if (selectedIdx >= (config.agents?.length ?? 1) - 1) {
        setSelectedIdx(Math.max(0, (config.agents?.length ?? 1) - 2));
      }
      setDirty(true);
      setSaved(false);
    },
    [config.agents, selectedIdx]
  );

  const handleSave = useCallback(async () => {
    try {
      await saveConfigToApi(deepClone(config));
      setStoreConfig(deepClone(config));
      setDirty(false);
      setSaved(true);
      addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        source: 'config',
        message: `Configuration saved: ${(config.agents?.length ?? 0)} agents configured`,
      });
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'error',
        source: 'config',
        message: `Failed to save configuration: ${err}`,
      });
    }
  }, [config, setStoreConfig, saveConfigToApi, addLog]);

  const handleReset = useCallback(() => {
    setConfig(deepClone(storeConfig));
    setDirty(false);
    setSaved(false);
    setSelectedIdx(0);
  }, [storeConfig]);

  const handleExport = useCallback(() => {
    const yaml = jsYaml.dump(config, { indent: 2, lineWidth: 120 });
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maf-config.yaml';
    a.click();
    URL.revokeObjectURL(url);
    addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      source: 'config',
      message: 'Configuration exported as YAML',
    });
  }, [config, addLog]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = jsYaml.load(reader.result as string) as MAFConfig;
          if (!parsed || typeof parsed !== 'object') {
            alert('Invalid config file: not a valid YAML object');
            return;
          }
          if (!parsed.defaultProvider || typeof parsed.defaultProvider !== 'string') {
            alert('Invalid config file: missing or invalid defaultProvider');
            return;
          }
          if (!Array.isArray(parsed.agents)) {
            alert('Invalid config file: missing agents array');
            return;
          }
          for (let i = 0; i < parsed.agents.length; i++) {
            const agent = parsed.agents[i];
            if (!agent || typeof agent !== 'object') {
              alert(`Invalid config file: agent at index ${i} is not an object`);
              return;
            }
            if (!agent.name || typeof agent.name !== 'string') {
              alert(`Invalid config file: agent at index ${i} missing name`);
              return;
            }
            if (!agent.model || typeof agent.model !== 'string') {
              alert(`Invalid config file: agent at index ${i} missing model`);
              return;
            }
          }
          setConfig(parsed);
          setDirty(true);
          setSaved(false);
          setSelectedIdx(0);
          addLog({
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: 'info',
            source: 'config',
            message: `Configuration imported from ${file.name}`,
          });
        } catch (err) {
          alert(`Failed to parse YAML: ${err}`);
        }
      };
      reader.readAsText(file);
      // reset input so same file can be re-imported
      e.target.value = '';
    },
    [addLog]
  );

  const agents = Array.isArray(config.agents) ? config.agents : [];
  const selectedAgent = agents[selectedIdx];

  return (
    <div>
      {/* page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--gray-12)' }}>{t('config.title')}</h1>
          {dirty && (
            <span
              style={{
                padding: '1px 8px',
                borderRadius: 9999,
                fontSize: '10px',
                fontWeight: 600,
                background: 'var(--amber-4)',
                color: 'var(--amber-11)',
              }}
            >
              {t('common.unsaved')}
            </span>
          )}
        </div>

        {/* action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={btnStyle('ghost')}
            title="Import YAML"
          >
            <UploadIcon width={14} height={14} /> {t('config.importYaml')}
          </button>
          <button onClick={handleExport} style={btnStyle('ghost')} title="Export YAML">
            <DownloadIcon width={14} height={14} /> {t('config.exportYaml')}
          </button>
          <button onClick={handleReset} style={btnStyle('ghost')} disabled={!dirty} title="Reset changes">
            <ResetIcon width={14} height={14} /> {t('config.resetChanges')}
          </button>
          <button onClick={handleSave} style={btnStyle('primary')} disabled={!dirty}>
            {saved ? <CheckIcon width={14} height={14} /> : null}
            {saved ? t('common.saved') : t('common.save')}
          </button>
        </div>
      </div>

      {/* template selector */}
      <TemplateSelector
        onApply={(templateConfig) => {
          setConfig(deepClone(templateConfig));
          setDirty(true);
          setSaved(false);
          setSelectedIdx(0);
        }}
      />

      {/* global config */}
      <GlobalConfig config={config} onChange={updateGlobal} />

      {/* agents section + config advisor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gap: 0,
          borderRadius: 10,
          border: '1px solid var(--gray-6)',
          background: 'var(--gray-2)',
          overflow: 'hidden',
          minHeight: 500,
        }}
      >
        {/* sidebar: agent list */}
        <div
          style={{
            borderRight: '1px solid var(--gray-6)',
            background: 'var(--gray-1)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--gray-6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-11)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Agents ({agents.length})
            </span>
            <button
              onClick={addAgent}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: 6,
                border: '1px solid var(--gray-6)',
                background: 'var(--gray-3)',
                color: 'var(--gray-11)',
                cursor: 'pointer',
              }}
              title="Add agent"
            >
              <PlusIcon width={14} height={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
            {agents.map((agent, idx) => (
              <div key={idx} style={{ marginBottom: 2, position: 'relative' }}>
                <AgentConfigCard
                  agent={agent}
                  active={selectedIdx === idx}
                  onClick={() => setSelectedIdx(idx)}
                />
                {agents.length > 1 && selectedIdx === idx && (
                  <button
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      removeAgent(idx);
                    }}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: 'none',
                      background: 'var(--red-4)',
                      color: 'var(--red-11)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Remove agent"
                  >
                    <Cross2Icon width={10} height={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* main: agent editor */}
        <div style={{ padding: '20px 24px', overflow: 'auto' }}>
          {selectedAgent ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--accent-4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PersonIcon width={16} height={16} color="var(--accent-11)" />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gray-12)' }}>
                    {selectedAgent.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-9)' }}>{selectedAgent.type}</div>
                </div>
              </div>
              <AgentEditor agent={selectedAgent} onChange={(u) => updateAgent(selectedIdx, u)} />
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--gray-8)',
              }}
            >
              {t('config.selectAgentToConfig')}
            </div>
          )}
        </div>
      </div>

      {/* AI 配置分析建议 */}
      <ConfigAdvisor />
      </div>
    </div>
  );
}

/* ─── button style helper ─────────────────────────────────────────── */

function btnStyle(variant: 'primary' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease, border-color 0.15s ease',
    whiteSpace: 'nowrap',
  };
  if (variant === 'primary') {
    return {
      ...base,
      border: 'none',
      background: 'var(--accent-9)',
      color: 'white',
    };
  }
  return {
    ...base,
    border: '1px solid var(--gray-6)',
    background: 'var(--gray-3)',
    color: 'var(--gray-11)',
  };
}
