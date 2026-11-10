import { useCallback, useEffect, useReducer, useRef } from 'react';
import { BoxDocument, ChatMessage, WorkspaceArtifact, WorkspaceContext } from '../types';
import { generateArtifact } from '../services/artifactGenerator';
import {
  CONTEXT_ARTIFACT_ID,
  addArtifactVersion,
  getArtifactLabel,
  getLatestArtifact,
  inferArtifactType,
} from '../services/workspaceArtifacts';

export interface UseWorkspaceChatOptions {
  /** Live (or mock) Box documents used to ground generation. */
  documents: BoxDocument[];
  mode: 'mock' | 'live_mcp';
  /** Extracted Context tab content (from `useWorkspaceContext`); grounds generation when ready. */
  context?: WorkspaceContext | null;
}

export interface UseWorkspaceChatResult {
  /** Always starts with the `context` artifact, followed by generated versions in creation order. */
  artifacts: WorkspaceArtifact[];
  chatMessages: ChatMessage[];
  activeArtifactId: string;
  /** True while Bob is generating; `sendMessage` is ignored during this time. */
  isThinking: boolean;
  sendMessage: (text: string) => void;
  selectArtifact: (artifactId: string) => void;
  /** Clears artifacts and chat (e.g. on "Reset Demo"). */
  reset: () => void;
}

interface State {
  artifacts: WorkspaceArtifact[];
  chatMessages: ChatMessage[];
  activeArtifactId: string;
  isThinking: boolean;
}

type Action =
  | { type: 'user_message'; message: ChatMessage }
  | { type: 'generated'; artifacts: WorkspaceArtifact[]; activeArtifactId: string; message: ChatMessage }
  | { type: 'failed'; message: ChatMessage }
  | { type: 'select'; artifactId: string }
  | { type: 'reset' };

const createContextArtifact = (): WorkspaceArtifact => ({
  id: CONTEXT_ARTIFACT_ID,
  type: 'context',
  title: 'Context',
  content: '',
  version: 1,
  isLatest: true,
  lastUpdated: new Date().toISOString(),
});

const createInitialState = (): State => ({
  artifacts: [createContextArtifact()],
  chatMessages: [],
  activeArtifactId: CONTEXT_ARTIFACT_ID,
  isThinking: false,
});

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'user_message':
      return { ...state, chatMessages: [...state.chatMessages, action.message], isThinking: true };
    case 'generated':
      return {
        ...state,
        artifacts: action.artifacts,
        activeArtifactId: action.activeArtifactId,
        chatMessages: [...state.chatMessages, action.message],
        isThinking: false,
      };
    case 'failed':
      return { ...state, chatMessages: [...state.chatMessages, action.message], isThinking: false };
    case 'select':
      return { ...state, activeArtifactId: action.artifactId };
    case 'reset':
      return createInitialState();
  }
}

const timeLabel = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

let messageCounter = 0;
const nextMessageId = (sender: ChatMessage['sender']) => `${sender}-${Date.now()}-${++messageCounter}`;

/**
 * Owns the workspace chat loop: user prompt -> thinking -> Bob reply + a new versioned
 * artifact tab (made active). New artifact type => v1; same type => next version, previous
 * version's `isLatest` cleared. Local React state only.
 */
export function useWorkspaceChat({ documents, mode, context = null }: UseWorkspaceChatOptions): UseWorkspaceChatResult {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  // Refs let the async send flow read current values without re-creating `sendMessage`.
  const stateRef = useRef(state);
  stateRef.current = state;
  const inputsRef = useRef({ documents, mode, context });
  inputsRef.current = { documents, mode, context };
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sendMessage = useCallback((rawText: string) => {
    const text = rawText.trim();
    if (!text || stateRef.current.isThinking) return;

    const runId = ++runIdRef.current;
    const { artifacts, activeArtifactId } = stateRef.current;
    const type = inferArtifactType(text, artifacts, activeArtifactId);
    const latest = getLatestArtifact(artifacts, type);

    // Mark thinking immediately so a rapid second send is ignored before React re-renders.
    stateRef.current = { ...stateRef.current, isThinking: true };
    dispatch({
      type: 'user_message',
      message: { id: nextMessageId('user'), sender: 'user', text, grounded: true, timestamp: timeLabel() },
    });

    const { documents: docs, mode: currentMode, context: currentContext } = inputsRef.current;

    void (async () => {
      try {
        const generated = await generateArtifact({
          type,
          prompt: text,
          documents: docs,
          context: currentContext,
          previous: latest ? { content: latest.content, version: latest.version, data: latest.data } : undefined,
          mode: currentMode,
        });
        if (!mountedRef.current || runIdRef.current !== runId) return;

        // Re-read artifacts: the user cannot add versions meanwhile, but selection may have changed.
        const { artifacts: next, artifact } = addArtifactVersion(stateRef.current.artifacts, {
          type,
          content: generated.content,
          data: generated.data,
        });
        dispatch({
          type: 'generated',
          artifacts: next,
          activeArtifactId: artifact.id,
          message: {
            id: nextMessageId('bob'),
            sender: 'bob',
            text: `${generated.summary}\n\nAdded "${artifact.title}" to the workspace.`,
            grounded: true,
            supportingDocIds: generated.supportingDocIds,
            timestamp: timeLabel(),
            artifactId: artifact.id,
          },
        });
      } catch (err) {
        console.warn('[Workspace] Artifact generation failed:', err);
        if (!mountedRef.current || runIdRef.current !== runId) return;
        dispatch({
          type: 'failed',
          message: {
            id: nextMessageId('bob'),
            sender: 'bob',
            text: `I could not generate the ${getArtifactLabel(type)} right now. Please try again.`,
            grounded: true,
            timestamp: timeLabel(),
          },
        });
      }
    })();
  }, []);

  const selectArtifact = useCallback((artifactId: string) => {
    dispatch({ type: 'select', artifactId });
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1; // drop any in-flight generation
    dispatch({ type: 'reset' });
  }, []);

  return {
    artifacts: state.artifacts,
    chatMessages: state.chatMessages,
    activeArtifactId: state.activeArtifactId,
    isThinking: state.isThinking,
    sendMessage,
    selectArtifact,
    reset,
  };
}
