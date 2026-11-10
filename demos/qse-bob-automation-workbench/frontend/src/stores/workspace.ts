import { create } from 'zustand';

/**
 * UI-only state. Secrets (API keys, access tokens) are intentionally never stored here:
 * form fields hold them transiently and clear them after submit. Nothing is persisted to
 * browser storage except non-sensitive prompt draft.
 */
interface WorkspaceState {
  activeRepositoryId: string | null;
  activeExecutionId: string | null;
  promptDraft: string;
  setActiveRepository: (id: string | null) => void;
  setActiveExecution: (id: string | null) => void;
  setPromptDraft: (p: string) => void;
}

const DRAFT_KEY = 'qse.promptDraft';
const read = (k: string) => {
  try {
    return window.sessionStorage.getItem(k);
  } catch {
    return null;
  }
};

export const useWorkspace = create<WorkspaceState>((set) => ({
  activeRepositoryId: read('qse.activeRepo'),
  activeExecutionId: read('qse.activeExec'),
  promptDraft: read(DRAFT_KEY) ?? '',
  setActiveRepository: (id) => {
    try {
      if (id) window.sessionStorage.setItem('qse.activeRepo', id);
      else window.sessionStorage.removeItem('qse.activeRepo');
    } catch {
      /* storage unavailable */
    }
    set({ activeRepositoryId: id });
  },
  setActiveExecution: (id) => {
    try {
      if (id) window.sessionStorage.setItem('qse.activeExec', id);
      else window.sessionStorage.removeItem('qse.activeExec');
    } catch {
      /* storage unavailable */
    }
    set({ activeExecutionId: id });
  },
  setPromptDraft: (p) => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, p);
    } catch {
      /* storage unavailable */
    }
    set({ promptDraft: p });
  }
}));
