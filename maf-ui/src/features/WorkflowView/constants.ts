import type { AgentStatus } from '../../types';

export const STATUS_CONFIG: Record<AgentStatus, { color: string; bg: string; label: string; pulse?: boolean }> = {
  idle:    { color: 'var(--gray-11)', bg: 'var(--gray-3)', label: 'Idle' },
  running: { color: 'var(--blue-9)', bg: 'var(--blue-3)', label: 'Running', pulse: true },
  waiting: { color: 'var(--amber-9)', bg: 'var(--amber-3)', label: 'Waiting' },
  done:    { color: 'var(--green-9)', bg: 'var(--green-3)', label: 'Done' },
  error:   { color: 'var(--red-9)', bg: 'var(--red-3)', label: 'Error' },
};
