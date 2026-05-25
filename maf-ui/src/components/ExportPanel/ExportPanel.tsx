import React, { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon, DownloadIcon } from '@radix-ui/react-icons';
import type { ReportOptions } from '../../utils/reportGenerator';

interface ExportPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ReportOptions) => void;
}

const formats: { value: ReportOptions['format']; label: string; desc: string }[] = [
  { value: 'html', label: 'HTML', desc: 'Styled dark-theme report with tables' },
  { value: 'markdown', label: 'Markdown', desc: 'Standard syntax, paste into docs' },
  { value: 'json', label: 'JSON', desc: 'Structured data for pipelines' },
];

const dataTypes: { key: keyof Pick<ReportOptions, 'includeAgents' | 'includeTasks' | 'includeLogs' | 'includeMetrics'>; label: string }[] = [
  { key: 'includeAgents', label: 'Agent Statistics' },
  { key: 'includeTasks', label: 'Task List' },
  { key: 'includeLogs', label: 'Log Entries' },
  { key: 'includeMetrics', label: 'Metrics' },
];

export function ExportPanel({ open, onOpenChange, onExport }: ExportPanelProps) {
  const [format, setFormat] = useState<ReportOptions['format']>('html');
  const [includes, setIncludes] = useState({
    includeAgents: true,
    includeTasks: true,
    includeLogs: true,
    includeMetrics: true,
  });
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const toggleInclude = useCallback((key: keyof typeof includes) => {
    setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleExport = useCallback(() => {
    const options: ReportOptions = {
      format,
      ...includes,
      timeRange: useTimeRange && startTime && endTime ? { start: startTime, end: endTime } : undefined,
    };
    onExport(options);
    onOpenChange(false);
  }, [format, includes, useTimeRange, startTime, endTime, onExport, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            animation: 'maf-fade-in 0.15s ease',
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(480px, 92vw)',
            borderRadius: 12,
            border: '1px solid var(--gray-6)',
            background: 'var(--gray-2)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            animation: 'maf-slide-in 0.15s ease',
            zIndex: 1001,
            outline: 'none',
          }}
        >
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--gray-12)',
              lineHeight: 1.4,
            }}
          >
            Export Report
          </Dialog.Title>
          <Dialog.Description
            style={{
              marginTop: 4,
              fontSize: '13px',
              color: 'var(--gray-11)',
            }}
          >
            Generate and download an execution report.
          </Dialog.Description>

          {/* Format */}
          <div style={{ marginTop: 20 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-11)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Format
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {formats.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  title={f.desc}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1.5px solid ${format === f.value ? 'var(--blue-9)' : 'var(--gray-6)'}`,
                    background: format === f.value ? 'var(--blue-3)' : 'var(--gray-3)',
                    color: format === f.value ? 'var(--blue-11)' : 'var(--gray-11)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data types */}
          <div style={{ marginTop: 20 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-11)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Include Data
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
              {dataTypes.map((dt) => (
                <label
                  key={dt.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--gray-6)',
                    background: includes[dt.key] ? 'var(--gray-3)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--gray-12)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includes[dt.key]}
                    onChange={() => toggleInclude(dt.key)}
                    style={{ accentColor: 'var(--blue-9)' }}
                  />
                  {dt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div style={{ marginTop: 20 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--gray-11)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={useTimeRange}
                onChange={() => setUseTimeRange(!useTimeRange)}
                style={{ accentColor: 'var(--blue-9)' }}
              />
              Time Range Filter
            </label>
            {useTimeRange && (
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--gray-10)' }}>Start</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--gray-6)',
                      background: 'var(--gray-3)',
                      color: 'var(--gray-12)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--gray-10)' }}>End</label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--gray-6)',
                      background: 'var(--gray-3)',
                      color: 'var(--gray-12)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Dialog.Close asChild>
              <button
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--gray-7)',
                  background: 'var(--gray-3)',
                  color: 'var(--gray-11)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleExport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--blue-9)',
                color: 'var(--gray-1)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <DownloadIcon width={14} height={14} />
              Export
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'transparent',
                border: 'none',
                color: 'var(--gray-9)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Cross2Icon width={16} height={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
