import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Select as RadixThemesSelect, TextField } from '@radix-ui/themes';
import { LockClosedIcon, PlusIcon, TrashIcon, Pencil1Icon, CheckIcon } from '@radix-ui/react-icons';
import { useAppStore } from '../stores/useAppStore';
import type { ConfigAgent, ProviderOption } from '../types';
import { DataManager, exportAllData, importAllData, type ExportData } from '../storage/dataManager';
import { Select } from '../components/ui/Select';

/* ═══════════════════════════════════════════════════════════════════
   Settings
   ═══════════════════════════════════════════════════════════════════ */
export default function Settings() {
  const config = useAppStore((s) => s.config);
  const setConfig = useAppStore((s) => s.setConfig);
  const providers = useAppStore((s) => s.providers);
  const addProvider = useAppStore((s) => s.addProvider);
  const updateProvider = useAppStore((s) => s.updateProvider);
  const deleteProvider = useAppStore((s) => s.deleteProvider);

  const [provider, setProvider] = useState(config.defaultProvider);
  const [model, setModel] = useState(config.defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [maxRetries, setMaxRetries] = useState(config.maxRetries);
  const [timeout, setTimeoutVal] = useState(config.timeout);
  const [agents, setAgents] = useState<ConfigAgent[]>(Array.isArray(config.agents) ? config.agents : []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableModels = providers.find((p) => p.id === provider)?.models ?? [];

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    const newConfig = { ...config, defaultProvider: provider, defaultModel: model, maxRetries, timeout, agents };
    setConfig(newConfig);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  }, [config, provider, model, maxRetries, timeout, agents, setConfig]);

  const updateAgent = (index: number, updates: Partial<ConfigAgent>) => {
    setAgents((prev) => prev.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  };

  const removeAgent = (index: number) => {
    setAgents((prev) => prev.filter((_, i) => i !== index));
  };

  const addAgent = () => {
    setAgents((prev) => [...prev, {
      name: 'New Agent',
      type: 'custom',
      model: availableModels[0] ?? 'gpt-4o',
      temperature: 0.3,
      maxTokens: 4096,
      systemPrompt: '',
      tools: [],
    }]);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-12)', margin: 0 }}>
          Settings
        </h1>
        <p style={{ color: 'var(--gray-11)', fontSize: 13, margin: '4px 0 0' }}>
          Configure providers, models, and agent templates
        </p>
      </div>

      {/* ── Provider 管理 ─────────────────────────────────── */}
      <Section title="Providers">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {providers.map((p) => (
            <ProviderEditor
              key={p.id}
              provider={p}
              onUpdate={(updates) => updateProvider(p.id, updates)}
              onDelete={() => deleteProvider(p.id)}
              canDelete={providers.length > 1}
            />
          ))}
          <button onClick={addProvider} style={{
            ...btnStyle, justifyContent: 'center', padding: '10px',
            border: '1px dashed var(--gray-6)', color: 'var(--gray-10)',
          }}>
            <PlusIcon width={14} height={14} /> 添加 Provider
          </button>
        </div>
      </Section>

      {/* ── Provider & Model 选择 ─────────────────────────── */}
      <Section title="Default Provider & Model">
        <Field label="Provider">
          <RadixThemesSelect.Root value={provider} onValueChange={(v) => {
            setProvider(v);
            const m = providers.find((pp) => pp.id === v)?.models[0];
            if (m) setModel(m);
          }}>
            <RadixThemesSelect.Trigger placeholder="Select provider" />
            <RadixThemesSelect.Content>
              {providers.map((p) => (
                <RadixThemesSelect.Item key={p.id} value={p.id}>{p.label}</RadixThemesSelect.Item>
              ))}
            </RadixThemesSelect.Content>
          </RadixThemesSelect.Root>
        </Field>
        <Field label="Default Model">
          <RadixThemesSelect.Root value={model} onValueChange={setModel}>
            <RadixThemesSelect.Trigger placeholder="Select model" />
            <RadixThemesSelect.Content>
              {availableModels.map((m) => (
                <RadixThemesSelect.Item key={m} value={m}>{m}</RadixThemesSelect.Item>
              ))}
            </RadixThemesSelect.Content>
          </RadixThemesSelect.Root>
        </Field>
      </Section>

      {/* ── API Key ─────────────────────────────────────────── */}
      <Section title="API Key">
        <Field label="API Key">
          <div style={{ position: 'relative' }}>
            <LockClosedIcon width={14} height={14} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--gray-9)', pointerEvents: 'none',
            }} />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key..."
              style={{
                ...inputStyle, paddingLeft: 36,
                fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em',
              }}
            />
          </div>
        </Field>
        <p style={{ fontSize: 12, color: 'var(--gray-10)', margin: '4px 0 0' }}>
          Stored locally. Never sent to external servers.
        </p>
      </Section>

      {/* ── Advanced ────────────────────────────────────────── */}
      <Section title="Advanced">
        <Field label="Max Retries">
          <input type="number" value={maxRetries} min={0} max={10}
            onChange={(e) => setMaxRetries(Number(e.target.value))}
            style={{ ...inputStyle, width: 100 }} />
        </Field>
        <Field label="Timeout (ms)">
          <input type="number" value={timeout} min={5000} step={1000}
            onChange={(e) => setTimeoutVal(Number(e.target.value))}
            style={{ ...inputStyle, width: 140 }} />
        </Field>
      </Section>

      {/* ── Agent Templates ─────────────────────────────────── */}
      <Section title="Agent Templates">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {agents.map((agent, i) => (
            <div key={i} style={{
              background: 'var(--gray-2)', border: '1px solid var(--gray-6)',
              borderRadius: 10, padding: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input value={agent.name}
                    onChange={(e) => updateAgent(i, { name: e.target.value })}
                    style={{ ...inputStyle, width: 140, fontWeight: 600 }} />
                  <span style={{ fontSize: 11, color: 'var(--gray-9)', textTransform: 'uppercase' }}>{agent.type}</span>
                </div>
                <button onClick={() => removeAgent(i)} style={iconBtnStyle} title="Remove">
                  <TrashIcon width={14} height={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <SmallField label="Model">
                  <Select value={agent.model} onValueChange={(v) => updateAgent(i, { model: v })}
                    options={availableModels.map(m => ({ value: m, label: m }))} />
                </SmallField>
                <SmallField label="Temperature">
                  <input type="number" value={agent.temperature} min={0} max={2} step={0.1}
                    onChange={(e) => updateAgent(i, { temperature: Number(e.target.value) })}
                    style={selectStyle} />
                </SmallField>
                <SmallField label="Max Tokens">
                  <input type="number" value={agent.maxTokens} min={256} step={256}
                    onChange={(e) => updateAgent(i, { maxTokens: Number(e.target.value) })}
                    style={selectStyle} />
                </SmallField>
              </div>
              <SmallField label="System Prompt">
                <textarea value={agent.systemPrompt}
                  onChange={(e) => updateAgent(i, { systemPrompt: e.target.value })}
                  rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }} />
              </SmallField>
            </div>
          ))}
          <button onClick={addAgent} style={{
            ...btnStyle, justifyContent: 'center', padding: '10px',
            border: '1px dashed var(--gray-6)', color: 'var(--gray-10)',
          }}>
            <PlusIcon width={14} height={14} /> Add Agent Template
          </button>
        </div>
      </Section>

      <StorageManagement />

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button onClick={handleSave} disabled={saving} style={{
          ...btnStyle, padding: '10px 28px', fontSize: 14, fontWeight: 600,
          background: saved ? 'var(--green-3)' : 'var(--status-running)',
          color: saved ? 'var(--green-9)' : 'var(--gray-1)',
          border: saved ? '1px solid var(--green-7)' : '1px solid var(--status-running)',
          borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.7 : 1, transition: 'all 0.2s',
        }}>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}

/* ── Provider Editor ──────────────────────────────────────────── */
function ProviderEditor({
  provider,
  onUpdate,
  onDelete,
  canDelete,
}: {
  provider: ProviderOption;
  onUpdate: (updates: Partial<ProviderOption>) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [newModel, setNewModel] = useState('');

  const addModel = () => {
    if (!newModel.trim()) return;
    onUpdate({ models: [...provider.models, newModel.trim()] });
    setNewModel('');
  };

  const removeModel = (idx: number) => {
    onUpdate({ models: provider.models.filter((_, i) => i !== idx) });
  };

  return (
    <div style={{
      background: 'var(--gray-3)', border: '1px solid var(--gray-6)',
      borderRadius: 8, padding: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {editing ? (
          <TextField.Root
            value={provider.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            size="1"
            style={{ width: 160 }}
          />
        ) : (
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-12)', flex: 1 }}>{provider.label}</span>
        )}
        <button onClick={() => setEditing(!editing)} style={iconBtnStyle} title="Edit name">
          {editing ? <CheckIcon width={14} height={14} /> : <Pencil1Icon width={14} height={14} />}
        </button>
        {canDelete && (
          <button onClick={onDelete} style={iconBtnStyle} title="Delete provider">
            <TrashIcon width={14} height={14} />
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {provider.models.map((m, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', fontSize: 11, borderRadius: 4,
            background: 'var(--gray-4)', color: 'var(--gray-11)',
            border: '1px solid var(--gray-6)',
          }}>
            {m}
            <button onClick={() => removeModel(i)} style={{
              background: 'none', border: 'none', color: 'var(--gray-9)',
              cursor: 'pointer', padding: 0, fontSize: 12,
            }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={newModel}
          onChange={(e) => setNewModel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addModel()}
          placeholder="添加模型..."
          style={{ ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 12 }}
        />
        <button onClick={addModel} style={{ ...btnStyle, padding: '4px 10px', fontSize: 11 }}>
          <PlusIcon width={12} height={12} /> 添加
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--gray-2)', border: '1px solid var(--gray-6)',
      borderRadius: 12, padding: 20, marginBottom: 16,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-12)', marginBottom: 16 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-11)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--gray-10)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  );
}

/* ── Storage Management ────────────────────────────────────────── */
function StorageManagement() {
  const [usage, setUsage] = useState({ used: 0, total: 0 });
  const [taskCount, setTaskCount] = useState(0);
  const [logCount, setLogCount] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadStats = useCallback(async () => {
    try {
      const [u, tasks, logs] = await Promise.all([
        DataManager.storage.getUsage(),
        DataManager.taskHistory.getAll(),
        DataManager.logHistory.getAll(),
      ]);
      setUsage(u);
      setTaskCount(tasks.length);
      setLogCount(logs.length);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleClearHistory = async () => {
    setClearing(true);
    try { await DataManager.storage.cleanup(); await loadStats(); }
    finally { setClearing(false); }
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maf-ui-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data: ExportData = JSON.parse(text);
      await importAllData(data);
      await loadStats();
    } catch { alert('导入失败：无效的备份文件'); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const usagePercent = usage.total > 0 ? Math.min(100, (usage.used / usage.total) * 100) : 0;

  return (
    <Section title="Storage Management">
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-11)', marginBottom: 6 }}>
          <span>已用空间: {formatBytes(usage.used)}</span>
          <span>总计: {formatBytes(usage.total)}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--gray-4)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.3s',
            width: `${usagePercent}%`,
            background: usagePercent > 80 ? 'var(--red-9)' : usagePercent > 50 ? 'var(--amber-9)' : 'var(--green-9)',
          }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: 12, borderRadius: 8, background: 'var(--gray-3)', border: '1px solid var(--gray-6)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-12)' }}>{taskCount}</div>
          <div style={{ fontSize: 11, color: 'var(--gray-10)', textTransform: 'uppercase' }}>任务历史</div>
        </div>
        <div style={{ flex: 1, padding: 12, borderRadius: 8, background: 'var(--gray-3)', border: '1px solid var(--gray-6)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-12)' }}>{logCount}</div>
          <div style={{ fontSize: 11, color: 'var(--gray-10)', textTransform: 'uppercase' }}>日志条目</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleClearHistory} disabled={clearing} style={{
          ...btnStyle, background: 'var(--red-3)', color: 'var(--red-9)', border: '1px solid var(--red-7)',
        }}>
          <TrashIcon width={14} height={14} /> {clearing ? '清理中...' : '清理历史数据'}
        </button>
        <button onClick={handleExport} style={btnStyle}>导出所有数据</button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={importing} style={btnStyle}>
          {importing ? '导入中...' : '导入数据'}
        </button>
      </div>
    </Section>
  );
}

/* ── Shared styles ──────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--gray-12)',
  background: 'var(--gray-1)', border: '1px solid var(--gray-6)',
  borderRadius: 6, outline: 'none',
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 12,
  fontFamily: 'inherit', color: 'var(--gray-12)',
  background: 'var(--gray-1)', border: '1px solid var(--gray-6)',
  borderRadius: 6, outline: 'none',
};

const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', fontSize: 12, fontWeight: 500,
  fontFamily: 'inherit', color: 'var(--gray-12)',
  background: 'var(--gray-3)', border: '1px solid var(--gray-6)',
  borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6,
  background: 'transparent', border: '1px solid var(--gray-6)',
  color: 'var(--gray-10)', cursor: 'pointer', transition: 'all 0.15s',
};
