import React, { useState } from 'react';
import { BoxDocument, ContextItem, WorkspaceContext, WorkspaceContextStatus } from '../types';
import { getFileTypeBadge } from '../utils/formatters';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export interface ContextPanelProps {
  /** Extracted context (company background, requirements, gaps). `null` while loading / on error. */
  context: WorkspaceContext | null;
  status: WorkspaceContextStatus;
  /** Generic error message shown when `status === 'error'`. */
  error?: string | null;
  /** Live (or mock) document list shown in the Uploaded Files section. */
  documents: BoxDocument[];
  /** Called with a `BoxDocument.id` when a source document card or source chip is clicked. */
  onSelectDocument?: (docId: string) => void;
  /** Re-runs the extraction (shown as a button when provided). */
  onRetry?: () => void;
}

type SectionKey = 'background' | 'requirements' | 'files' | 'gaps';

const ORIGIN_LABEL: Record<WorkspaceContext['origin'], string> = {
  bob: 'Extracted by Bob from live Box documents',
  derived: 'Derived from live Box documents',
  mock: 'Demo data (mock mode, not live Box)',
};

// ─── Building blocks ──────────────────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  subtitle: string;
  count: number;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, count, icon, open, onToggle, children }) => (
  <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <span className="flex items-center space-x-3 min-w-0">
        <span className="p-1.5 rounded-lg bg-gray-50 border border-gray-200 flex-shrink-0">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900">
            {title} <span className="text-xs font-semibold text-gray-400">({count})</span>
          </span>
          <span className="block text-xs text-gray-500 truncate">{subtitle}</span>
        </span>
      </span>
      {open ? (
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      )}
    </button>
    {open && <div className="px-4 pb-4 border-t border-gray-100 pt-3">{children}</div>}
  </section>
);

const EmptyNote: React.FC<{ text: string }> = ({ text }) => <p className="text-xs text-gray-500 italic">{text}</p>;

const ItemList: React.FC<{
  items: ContextItem[];
  documents: BoxDocument[];
  onSelectDocument?: (docId: string) => void;
  accent: string;
  emptyText: string;
}> = ({ items, documents, onSelectDocument, accent, emptyText }) => {
  if (items.length === 0) return <EmptyNote text={emptyText} />;
  const known = new Set(documents.map(d => d.id));
  return (
    <ul className="space-y-2.5">
      {items.map(item => (
        <li key={item.id} className={`rounded-xl border bg-white p-3 border-l-4 border-gray-200 ${accent}`}>
          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
          {item.detail && <p className="text-xs text-gray-600 leading-relaxed mt-1">{item.detail}</p>}
          {item.sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source</span>
              {item.sources.map(src => {
                const clickable = Boolean(onSelectDocument) && known.has(src.documentId);
                return (
                  <button
                    key={src.documentId}
                    type="button"
                    disabled={!clickable}
                    onClick={() => onSelectDocument?.(src.documentId)}
                    title={src.documentName}
                    className={`inline-flex items-center space-x-1 max-w-full px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-[11px] text-gray-700 ${
                      clickable ? 'hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <FileText className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{src.documentName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

const DocumentCards: React.FC<{
  documents: BoxDocument[];
  onSelectDocument?: (docId: string) => void;
}> = ({ documents, onSelectDocument }) => {
  if (documents.length === 0) return <EmptyNote text="No documents were found in Box." />;
  return (
    <ul className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
      {documents.map(doc => {
        const badge = getFileTypeBadge(doc.type);
        return (
          <li key={doc.id}>
            <button
              type="button"
              onClick={() => onSelectDocument?.(doc.id)}
              disabled={!onSelectDocument}
              className="w-full text-left rounded-xl border border-gray-200 bg-white p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer disabled:cursor-default"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 break-words min-w-0">{doc.name}</p>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 break-words">
                {doc.folderPath.replace(/^All Files\s*\/\s*/, '')}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{doc.size}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ContextPanel: React.FC<ContextPanelProps> = ({
  context,
  status,
  error,
  documents,
  onSelectDocument,
  onRetry,
}) => {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    background: true,
    requirements: true,
    files: true,
    gaps: true,
  });
  const toggle = (key: SectionKey) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const isLoading = status === 'loading' || status === 'idle';
  const extractedReady = status === 'ready' && context !== null;

  const retryButton = onRetry && (
    <button
      onClick={onRetry}
      className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 cursor-pointer"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      <span>Retry</span>
    </button>
  );

  const pending = (label: string) =>
    isLoading ? (
      <div className="flex items-center space-x-2 text-xs text-gray-500" role="status">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        <span>{label}</span>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3" role="alert">
        <span className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error || 'Could not build the context from the Box documents.'}</span>
        </span>
        {retryButton}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Context{extractedReady && context.customerName ? `: ${context.customerName}` : ''}
          </h2>
          <p className="text-xs text-gray-500">
            {extractedReady
              ? ORIGIN_LABEL[context.origin]
              : isLoading
                ? 'Bob is reading the documents in Box…'
                : 'Context unavailable'}
          </p>
        </div>
        {extractedReady && context.origin === 'mock' && (
          <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
            Mock data
          </span>
        )}
      </div>

      <Section
        title="Company Background"
        subtitle="Who the customer is and the situation behind the request"
        count={extractedReady ? context.companyBackground.length : 0}
        icon={<Building2 className="w-4 h-4 text-blue-600" />}
        open={open.background}
        onToggle={() => toggle('background')}
      >
        {extractedReady ? (
          <ItemList
            items={context.companyBackground}
            documents={documents}
            onSelectDocument={onSelectDocument}
            accent="border-l-blue-500"
            emptyText="No company background was found in the documents."
          />
        ) : (
          pending('Extracting company background…')
        )}
      </Section>

      <Section
        title="RFP Requirements"
        subtitle="What the RFP and any addenda ask the bidder to deliver"
        count={extractedReady ? context.requirements.length : 0}
        icon={<ClipboardList className="w-4 h-4 text-emerald-600" />}
        open={open.requirements}
        onToggle={() => toggle('requirements')}
      >
        {extractedReady ? (
          <ItemList
            items={context.requirements}
            documents={documents}
            onSelectDocument={onSelectDocument}
            accent="border-l-emerald-500"
            emptyText="No requirements were found in the documents."
          />
        ) : (
          pending('Extracting RFP requirements…')
        )}
      </Section>

      <Section
        title="Uploaded Files"
        subtitle="Source documents Bob read from Box"
        count={documents.length}
        icon={<FileText className="w-4 h-4 text-gray-600" />}
        open={open.files}
        onToggle={() => toggle('files')}
      >
        <DocumentCards documents={documents} onSelectDocument={onSelectDocument} />
      </Section>

      <Section
        title="Gaps / Unclear Items"
        subtitle="Unresolved decisions, conflicts and items to confirm with the customer"
        count={extractedReady ? context.openQuestions.length : 0}
        icon={<HelpCircle className="w-4 h-4 text-purple-600" />}
        open={open.gaps}
        onToggle={() => toggle('gaps')}
      >
        {extractedReady ? (
          <ItemList
            items={context.openQuestions}
            documents={documents}
            onSelectDocument={onSelectDocument}
            accent="border-l-purple-500"
            emptyText="No gaps or unclear items were found in the documents."
          />
        ) : (
          pending('Looking for gaps and unclear items…')
        )}
      </Section>
    </div>
  );
};
