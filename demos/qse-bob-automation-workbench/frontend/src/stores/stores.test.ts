import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from './notifications';
import { useWorkspace } from './workspace';
import { useSession } from './session';

describe('workspace store', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('persists only non-sensitive UI state in sessionStorage', () => {
    useWorkspace.getState().setPromptDraft('analyse this');
    useWorkspace.getState().setActiveRepository('repo-1');
    expect(useWorkspace.getState().promptDraft).toBe('analyse this');
    const stored = JSON.stringify({ ...window.sessionStorage });
    expect(stored).toContain('repo-1');
    expect(window.localStorage.length).toBe(0);
  });

  it('clears the active repository', () => {
    useWorkspace.getState().setActiveRepository('r');
    useWorkspace.getState().setActiveRepository(null);
    expect(window.sessionStorage.getItem('qse.activeRepo')).toBeNull();
  });
});

describe('session store', () => {
  it('stores the user but never persists a token in browser storage', () => {
    useSession.getState().setSession({ id: '1', username: 'admin', role: 'admin' }, 'csrf-secret');
    expect(useSession.getState().user?.username).toBe('admin');
    expect(JSON.stringify({ ...window.localStorage, ...window.sessionStorage })).not.toContain('csrf-secret');
  });
});

describe('notifications store', () => {
  it('queues and dismisses toasts', () => {
    const before = useToasts.getState().toasts.length;
    useToasts.getState().push({ kind: 'info', title: 'hi' });
    expect(useToasts.getState().toasts.length).toBe(before + 1);
    const id = useToasts.getState().toasts.at(-1)!.id;
    useToasts.getState().dismiss(id);
    expect(useToasts.getState().toasts.length).toBe(before);
  });
});
