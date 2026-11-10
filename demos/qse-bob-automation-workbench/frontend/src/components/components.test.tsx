import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusTag } from './StatusTag';
import { Markdown } from './Markdown';
import { LogViewer } from './LogViewer';

describe('StatusTag', () => {
  it.each([
    ['not_configured', 'Not configured'],
    ['connecting', 'Connecting'],
    ['connected', 'Connected'],
    ['auth_failed', 'Authentication failed'],
    ['connection_failed', 'Connection failed']
  ] as const)('renders the Bob state %s', (status, label) => {
    render(<StatusTag status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('Markdown', () => {
  it('does not render raw HTML or javascript: links from untrusted report content', () => {
    const { container } = render(<Markdown>{'<script>alert(1)</script>\n\n[x](javascript:alert(1)) [ok](https://example.com)'}</Markdown>);
    expect(container.querySelector('script')).toBeNull();
    const links = Array.from(container.querySelectorAll('a'));
    expect(links.every((a) => !(a.getAttribute('href') ?? '').startsWith('javascript:'))).toBe(true);
    const ok = screen.getByText('ok');
    expect(ok).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
  it('renders GFM tables', () => {
    render(<Markdown>{'| a | b |\n|---|---|\n| 1 | 2 |'}</Markdown>);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

describe('LogViewer', () => {
  const log = (id: number, source: 'backend' | 'headless-bob', message: string) => ({ id, executionId: 'e', ts: '2026-01-01T10:00:00Z', source, level: 'info' as const, step: null, message });
  it('shows an empty state and then log lines', () => {
    const { rerender } = render(<LogViewer logs={[]} live={false} />);
    expect(screen.getByText('No log output yet.')).toBeInTheDocument();
    rerender(<LogViewer logs={[log(1, 'backend', 'cloning'), log(2, 'headless-bob', 'thinking')]} live />);
    expect(screen.getByText('cloning')).toBeInTheDocument();
    expect(screen.getByText('thinking')).toBeInTheDocument();
    expect(screen.getByText(/2 lines · live/)).toBeInTheDocument();
  });
});
