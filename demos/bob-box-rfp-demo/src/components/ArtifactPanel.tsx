/**
 * ArtifactPanel
 *
 * Top-level switcher rendered in the WorkspaceScreen right-hand content area for any
 * non-context artifact tab.  It shows a compact header (title, version badge, timestamp)
 * and delegates to the appropriate renderer:
 *
 *   • presentation → PresentationRenderer (plain-data slide viewer)
 *   • rfp_response (+ any unknown type) → MarkdownRenderer with Copy / Download .md
 */

import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import type { WorkspaceArtifact } from '../types';
import { isPresentationData } from '../services/workspaceArtifacts';
import { MarkdownRenderer } from './MarkdownRenderer';
import { PresentationRenderer } from './PresentationRenderer';
import { formatDate } from '../utils/formatters';

// ─── Header ───────────────────────────────────────────────────────────────────

interface ArtifactHeaderProps {
  artifact: WorkspaceArtifact;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
  /** Hide download for types that have their own export (e.g. presentation handles PPTX itself). */
  showDownload?: boolean;
}

const ArtifactHeader: React.FC<ArtifactHeaderProps> = ({
  artifact,
  onCopy,
  onDownload,
  copied,
  showDownload = true,
}) => (
  <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-gray-200">
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-base font-bold text-gray-900 truncate">{artifact.title}</h2>
        {artifact.isLatest && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0">
            Current
          </span>
        )}
        {!artifact.isLatest && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-gray-100 text-gray-500 flex-shrink-0">
            Older version
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mt-0.5">
        Version {artifact.version} · Updated {formatDate(artifact.lastUpdated)}
      </p>
    </div>

    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={onCopy}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors cursor-pointer"
        title="Copy content to clipboard"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-600">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-gray-500" />
            <span>Copy</span>
          </>
        )}
      </button>

      {showDownload && (
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors cursor-pointer"
          title="Download as Markdown (.md)"
        >
          <Download className="w-3.5 h-3.5 text-gray-500" />
          <span>Download .md</span>
        </button>
      )}
    </div>
  </div>
);

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_') || 'artifact';
}

// ─── Generic (Markdown) renderer ─────────────────────────────────────────────

const GenericArtifactPanel: React.FC<{ artifact: WorkspaceArtifact }> = ({ artifact }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadMarkdown(`${safeFilename(artifact.title)}.md`, artifact.content);
  };

  return (
    <div>
      <ArtifactHeader
        artifact={artifact}
        onCopy={handleCopy}
        onDownload={handleDownload}
        copied={copied}
      />
      {artifact.content ? (
        <MarkdownRenderer content={artifact.content} />
      ) : (
        <p className="text-sm text-gray-500 italic">No content generated yet.</p>
      )}
    </div>
  );
};

// ─── Presentation renderer panel ──────────────────────────────────────────────

const PresentationArtifactPanel: React.FC<{ artifact: WorkspaceArtifact }> = ({ artifact }) => {
  const [copied, setCopied] = useState(false);

  // Copy the markdown outline (artifact.content)
  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download the markdown outline
  const handleDownload = () => {
    downloadMarkdown(`${safeFilename(artifact.title)}.md`, artifact.content);
  };

  const presData = isPresentationData(artifact.data) ? artifact.data : null;

  return (
    <div>
      <ArtifactHeader
        artifact={artifact}
        onCopy={handleCopy}
        onDownload={handleDownload}
        copied={copied}
      />
      {presData ? (
        <PresentationRenderer slides={presData.slides} />
      ) : (
        /* Fallback: render the markdown outline if structured data is missing/invalid */
        <div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mb-4">
            Slide data unavailable — showing markdown outline.
          </p>
          <MarkdownRenderer content={artifact.content} />
        </div>
      )}
    </div>
  );
};

// ─── Public switcher ──────────────────────────────────────────────────────────

export interface ArtifactPanelProps {
  artifact: WorkspaceArtifact;
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({ artifact }) => {
  switch (artifact.type) {
    case 'presentation':
      return <PresentationArtifactPanel artifact={artifact} />;
    default:
      return <GenericArtifactPanel artifact={artifact} />;
  }
};
