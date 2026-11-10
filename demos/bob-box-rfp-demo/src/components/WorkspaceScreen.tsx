import React, { useEffect, useRef, useState } from 'react';
import {
  BoxDocument,
  ChatMessage,
  FileType,
  WorkspaceArtifact,
  WorkspaceContext,
  WorkspaceContextStatus,
} from '../types';
import { getFileTypeBadge } from '../utils/formatters';
import { BobLogo } from './BobLogo';
import { ArtifactPanel } from './ArtifactPanel';
import { ContextPanel } from './ContextPanel';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  FileSpreadsheet,
  FileText,
  History,
  LayoutList,
  Mail,
  Presentation,
  Send,
} from 'lucide-react';

/** Id used for the Context tab when no `context` artifact is supplied. */
export const CONTEXT_TAB_ID = 'context';

export interface WorkspaceScreenProps {
  initialPrompt: string;
  artifacts: WorkspaceArtifact[];
  chatMessages: ChatMessage[];
  sourceFiles: BoxDocument[];
  onSendMessage: (text: string) => void;
  /** True while Bob is generating: shows a "thinking" bubble and disables the send input. */
  isThinking?: boolean;
  activeArtifactId: string;
  onSelectArtifact: (artifactId: string) => void;
  /** Extracted Context tab content (see `useWorkspaceContext`). */
  context?: WorkspaceContext | null;
  contextStatus?: WorkspaceContextStatus;
  contextError?: string | null;
  onRetryContext?: () => void;
  /** Called with a `BoxDocument.id` when a document is clicked in the Context tab. */
  onSelectSourceDocument?: (docId: string) => void;
}

// ─── Tab grouping ─────────────────────────────────────────────────────────────

export interface ArtifactTabGroup {
  type: string;
  /** Newest version of this artifact type (shown with the "Current" badge). */
  latest: WorkspaceArtifact;
  /** Older versions, sorted ascending by version. */
  older: WorkspaceArtifact[];
  /** True when 3+ versions exist: `older` collapses into a history dropdown. */
  collapsed: boolean;
}

/**
 * Groups non-context artifacts by `type` (in order of first appearance) and applies the
 * versioning rules: latest version is current, older versions are dimmed, and with 3+
 * versions all but the latest collapse into a history dropdown.
 */
export function groupArtifactTabs(artifacts: WorkspaceArtifact[]): ArtifactTabGroup[] {
  const byType = new Map<string, WorkspaceArtifact[]>();
  for (const artifact of artifacts) {
    if (artifact.type === 'context') continue;
    byType.set(artifact.type, [...(byType.get(artifact.type) ?? []), artifact]);
  }

  return Array.from(byType, ([type, versions]) => {
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    const latest = sorted.find(a => a.isLatest) ?? sorted[sorted.length - 1];
    const older = sorted.filter(a => a.id !== latest.id);
    return { type, latest, older, collapsed: sorted.length >= 3 };
  });
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const FileIcon: React.FC<{ type: FileType }> = ({ type }) => {
  const cls = 'w-3.5 h-3.5 flex-shrink-0';
  if (type === 'xlsx') return <FileSpreadsheet className={`${cls} text-emerald-600`} />;
  if (type === 'pptx') return <Presentation className={`${cls} text-orange-600`} />;
  if (type === 'email') return <Mail className={`${cls} text-gray-500`} />;
  if (type === 'pdf') return <FileText className={`${cls} text-red-600`} />;
  return <FileText className={`${cls} text-blue-600`} />;
};

const CurrentBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
      active ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'
    }`}
  >
    Current
  </span>
);

const tabClass = (active: boolean, dimmed: boolean, bold: boolean) =>
  `flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${
    bold ? 'font-bold' : 'font-medium'
  } ${
    active
      ? 'bg-[#0f62fe] text-white shadow-xs'
      : `text-gray-600 hover:bg-gray-100 ${dimmed ? 'opacity-60' : ''}`
  }`;

// ─── Component ────────────────────────────────────────────────────────────────

export const WorkspaceScreen: React.FC<WorkspaceScreenProps> = ({
  initialPrompt,
  artifacts,
  chatMessages,
  sourceFiles,
  onSendMessage,
  isThinking = false,
  activeArtifactId,
  onSelectArtifact,
  context = null,
  contextStatus = 'idle',
  contextError = null,
  onRetryContext,
  onSelectSourceDocument,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [filesOpen, setFilesOpen] = useState(false);
  const [openHistoryType, setOpenHistoryType] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ block: 'end' });
  }, [chatMessages.length, isThinking]);

  const contextArtifact = artifacts.find(a => a.type === 'context');
  const contextId = contextArtifact?.id ?? CONTEXT_TAB_ID;
  const groups = groupArtifactTabs(artifacts);
  const activeArtifact = artifacts.find(a => a.id === activeArtifactId);
  const isContextActive = activeArtifactId === contextId || activeArtifactId === CONTEXT_TAB_ID || activeArtifact?.type === 'context';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isThinking) return;
    onSendMessage(text);
    setInputValue('');
  };

  const selectArtifact = (id: string) => {
    setOpenHistoryType(null);
    onSelectArtifact(id);
  };

  const renderVersionTab = (artifact: WorkspaceArtifact, isLatest: boolean) => {
    const active = artifact.id === activeArtifactId;
    return (
      <button
        key={artifact.id}
        onClick={() => selectArtifact(artifact.id)}
        className={tabClass(active, !isLatest, isLatest)}
        aria-current={active ? 'page' : undefined}
      >
        <span>{artifact.title}</span>
        {isLatest && <CurrentBadge active={active} />}
      </button>
    );
  };

  const renderGroup = (group: ArtifactTabGroup) => {
    const historyOpen = openHistoryType === group.type;
    const activeInHistory = group.older.some(a => a.id === activeArtifactId);

    return (
      <div key={group.type} className="flex items-center space-x-1 relative">
        {group.collapsed ? (
          <>
            <button
              onClick={() => setOpenHistoryType(historyOpen ? null : group.type)}
              className={`flex items-center space-x-1 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer whitespace-nowrap ${
                activeInHistory ? 'bg-[#0f62fe] text-white' : 'text-gray-500 hover:bg-gray-100 opacity-80'
              }`}
              aria-haspopup="menu"
              aria-expanded={historyOpen}
              title={`Earlier versions (${group.older.length})`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{group.older.length}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {historyOpen && (
              <>
                <button
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close version history"
                  onClick={() => setOpenHistoryType(null)}
                />
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-1 z-20 min-w-[180px] bg-white border border-gray-200 rounded-xl shadow-lg py-1"
                >
                  {[...group.older].reverse().map(a => (
                    <button
                      key={a.id}
                      role="menuitem"
                      onClick={() => selectArtifact(a.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-100 ${
                        a.id === activeArtifactId ? 'text-[#0f62fe] font-bold' : 'text-gray-600'
                      }`}
                    >
                      {a.title}
                    </button>
                  ))}
                </div>
              </>
            )}
            {renderVersionTab(group.latest, true)}
          </>
        ) : (
          <>
            {group.older.map(a => renderVersionTab(a, false))}
            {renderVersionTab(group.latest, true)}
          </>
        )}
      </div>
    );
  };

  const shownArtifact = isContextActive ? contextArtifact : activeArtifact;

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[560px] bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <aside className="w-[280px] flex-shrink-0 flex flex-col border-r border-gray-200 bg-gray-50/50">
        {/* Original prompt */}
        <div className="p-3 border-b border-gray-200 bg-white max-h-32 overflow-y-auto">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Original request
          </span>
          <p className="text-xs text-gray-900 leading-relaxed whitespace-pre-wrap">{initialPrompt}</p>
        </div>

        {/* Chat thread */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {chatMessages.map(msg => {
            const isBob = msg.sender === 'bob';
            return (
              <div key={msg.id} className={`flex flex-col ${isBob ? 'items-start' : 'items-end'}`}>
                <div
                  className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed ${
                    isBob
                      ? 'bg-white border border-gray-200 text-gray-900 rounded-tl-xs'
                      : 'bg-[#0f62fe] text-white rounded-tr-xs shadow-xs'
                  }`}
                >
                  {isBob && (
                    <div className="flex items-center space-x-1.5 mb-1.5 pb-1 border-b border-gray-200 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                      <span className="w-3.5 h-3.5 rounded bg-gray-900 inline-flex items-center justify-center p-0.5">
                        <BobLogo className="w-full h-full" />
                      </span>
                      <span>Bob</span>
                      {msg.insufficientEvidence && (
                        <span className="text-amber-700 bg-amber-50 px-1.5 rounded border border-amber-200">
                          Insufficient evidence
                        </span>
                      )}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap font-sans">{msg.text}</p>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            );
          })}
          {isThinking && (
            <div className="flex flex-col items-start" role="status" aria-live="polite">
              <div className="max-w-[92%] rounded-2xl rounded-tl-xs p-3 text-xs bg-white border border-gray-200 text-gray-600 flex items-center space-x-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                <span>Bob is thinking…</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Source files (collapsible) */}
        <div className="border-t border-gray-200 bg-white">
          <button
            onClick={() => setFilesOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
            aria-expanded={filesOpen}
          >
            <span className="flex items-center space-x-1.5">
              {filesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>Source Files ({sourceFiles.length})</span>
            </span>
          </button>
          {filesOpen && (
            <ul className="max-h-40 overflow-y-auto px-3 pb-2 space-y-1">
              {sourceFiles.map(file => (
                <li
                  key={file.id}
                  className="flex items-center space-x-2 text-xs text-gray-700"
                  title={`${file.folderPath} (${getFileTypeBadge(file.type).label})`}
                >
                  <FileIcon type={file.type} />
                  <span className="truncate">{file.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Input footer */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 bg-white flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={isThinking ? 'Bob is working…' : 'Ask Bob to create or refine…'}
            maxLength={2000}
            disabled={isThinking}
            className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={isThinking || !inputValue.trim()}
            aria-label="Send message"
            className="p-2 rounded-xl bg-[#0f62fe] text-white hover:bg-[#0043ce] disabled:opacity-40 transition-colors shadow-xs cursor-pointer flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </aside>

      {/* ── Right area ─────────────────────────────────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col">
        {/* Tab bar */}
        <div className="p-2 border-b border-gray-200 flex flex-wrap items-center gap-1">
          <button
            onClick={() => selectArtifact(contextId)}
            className={tabClass(isContextActive, false, true)}
            aria-current={isContextActive ? 'page' : undefined}
          >
            <LayoutList className="w-4 h-4" />
            <span>Context</span>
          </button>
          {groups.map(renderGroup)}
        </div>

        {/* Tab content (placeholder) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {isContextActive ? (
            <ContextPanel
              context={context}
              status={contextStatus}
              error={contextError}
              documents={sourceFiles}
              onRetry={onRetryContext}
              onSelectDocument={docId => {
                setFilesOpen(true);
                onSelectSourceDocument?.(docId);
              }}
            />
          ) : shownArtifact ? (
            <ArtifactPanel artifact={shownArtifact} />
          ) : (
            <p className="text-sm text-gray-500">Select a tab to view its content.</p>
          )}
        </div>
      </section>
    </div>
  );
};
