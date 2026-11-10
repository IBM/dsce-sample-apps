import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PipelineTwin, buildExternals } from './PipelineTwin';
import type { Execution, ExecutionStep, StepStatus } from '../types/api';

const KEYS = ['validate_config', 'prepare_repo', 'validate_qse', 'prepare_context', 'submit_prompt', 'bob_processing', 'retrieve_results', 'generate_report'];
const step = (key: string, status: StepStatus): ExecutionStep => ({ key, label: key, source: key === 'bob_processing' ? 'headless-bob' : 'backend', status, startedAt: null, finishedAt: null, message: null });
const execution = (statuses: StepStatus[], mock = false): Execution =>
  ({ id: 'e1', status: 'running', mock, steps: KEYS.map((k, i) => step(k, statuses[i] ?? 'pending')) }) as unknown as Execution;

describe('PipelineTwin', () => {
  it('renders all pipeline steps as pending when there is no execution', () => {
    render(<PipelineTwin execution={null} />);
    for (const k of KEYS) expect(screen.getByTestId(`twin-step-${k}`)).toHaveClass('twin-node--idle');
  });

  it('reflects real step statuses', () => {
    render(<PipelineTwin execution={execution(['completed', 'completed', 'running', 'failed'])} />);
    expect(screen.getByTestId('twin-step-validate_config')).toHaveClass('twin-node--ok');
    expect(screen.getByTestId('twin-step-validate_qse')).toHaveClass('twin-node--active');
    expect(screen.getByTestId('twin-step-prepare_context')).toHaveClass('twin-node--error');
    expect(screen.getByTestId('twin-step-submit_prompt')).toHaveClass('twin-node--idle');
  });

  it('shows the demo notice only for recorded runs', () => {
    const { rerender } = render(<PipelineTwin execution={execution([])} streamMode="realtime" />);
    expect(screen.queryByText(/DEMO/)).toBeNull();
    rerender(<PipelineTwin execution={execution([], true)} streamMode="mock" />);
    expect(screen.getByText(/DEMO/)).toBeInTheDocument();
  });
});

describe('buildExternals', () => {
  it('derives external system health from connection status', () => {
    const ext = buildExternals({
      bob: { state: 'connected', adapter: 'rest-threads', mock: false } as never,
      repo: { status: 'cloned', owner: 'o', name: 'n' } as never,
      qse: { status: 'invalid', version: null } as never,
      streamMode: 'realtime'
    });
    const by = Object.fromEntries(ext.map((e) => [e.id, e]));
    expect(by.bob.tone).toBe('ok');
    expect(by.git.tone).toBe('ok');
    expect(by.qse.tone).toBe('error');
  });

  it('marks everything idle when nothing is configured', () => {
    expect(buildExternals({}).every((e) => e.tone === 'idle')).toBe(true);
  });
});
