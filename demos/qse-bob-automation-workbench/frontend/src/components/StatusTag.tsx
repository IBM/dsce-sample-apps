import { Tag } from '@carbon/react';
import type { BobConnectionState, ExecutionStatus, QseStatus, RepoStatus, StepStatus } from '../types/api';

type TagType = 'green' | 'red' | 'blue' | 'gray' | 'cyan' | 'purple' | 'magenta' | 'warm-gray' | 'cool-gray' | 'teal' | 'outline';

const MAP: Record<string, { type: TagType; label: string }> = {
  not_configured: { type: 'gray', label: 'Not configured' },
  connecting: { type: 'blue', label: 'Connecting' },
  connected: { type: 'green', label: 'Connected' },
  auth_failed: { type: 'red', label: 'Authentication failed' },
  connection_failed: { type: 'red', label: 'Connection failed' },
  pending: { type: 'gray', label: 'Pending' },
  validating: { type: 'blue', label: 'Validating' },
  validated: { type: 'cyan', label: 'Validated' },
  cloning: { type: 'blue', label: 'Cloning' },
  cloned: { type: 'green', label: 'Cloned' },
  failed: { type: 'red', label: 'Failed' },
  discovered: { type: 'cyan', label: 'Discovered' },
  valid: { type: 'green', label: 'Valid' },
  invalid: { type: 'red', label: 'Invalid' },
  queued: { type: 'gray', label: 'Queued' },
  running: { type: 'blue', label: 'Running' },
  cancelling: { type: 'warm-gray', label: 'Cancelling' },
  completed: { type: 'green', label: 'Completed' },
  cancelled: { type: 'warm-gray', label: 'Cancelled' },
  skipped: { type: 'gray', label: 'Skipped' }
};

export type AnyStatus = BobConnectionState | RepoStatus | QseStatus | ExecutionStatus | StepStatus;

export function StatusTag({ status, size = 'md' }: { status: AnyStatus; size?: 'sm' | 'md' }) {
  const m = MAP[status] ?? { type: 'gray' as TagType, label: status };
  return (
    <Tag type={m.type} size={size} title={m.label}>
      {m.label}
    </Tag>
  );
}

export const statusLabel = (s: string) => MAP[s]?.label ?? s;
