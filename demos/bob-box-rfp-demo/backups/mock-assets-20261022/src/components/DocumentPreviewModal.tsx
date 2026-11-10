import React from 'react';
import { BoxDocument } from '../types';
import { 
  X, 
  Folder, 
  CheckCircle2
} from 'lucide-react';
import { formatDate, getFileTypeBadge } from '../utils/formatters';

interface DocumentPreviewModalProps {
  document: BoxDocument | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document,
  onClose,
}) => {
  if (!document) return null;

  const badge = getFileTypeBadge(document.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-modal border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Box-Styled Top Header Bar */}
        <div className="px-5 py-3.5 bg-[#0061d5] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center font-bold text-xs">
              box
            </div>
            <span className="text-xs font-medium text-blue-100 hidden sm:inline">
              Acme Corp Workspace • File Preview
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="font-mono text-blue-200 bg-white/10 px-2 py-0.5 rounded">
              {document.metadata.boxFileId}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Info Sub-header */}
        <div className="p-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                {badge.label}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                {document.name}
              </h2>
            </div>

            <p className="text-xs text-gray-500 flex items-center space-x-1">
              <Folder className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{document.folderPath}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <div className="text-right hidden sm:block">
              <span className="font-medium text-gray-700 block">{document.owner.name}</span>
              <span className="text-[11px] text-gray-400">{formatDate(document.modifiedAt)}</span>
            </div>
            <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-semibold text-xs">
              {document.size}
            </span>
          </div>
        </div>

        {/* Modal Body: Document Viewer + Metadata Panel */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-4 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
          {/* Main Document Content Area */}
          <div className="lg:col-span-3 p-6 bg-white overflow-y-auto font-mono text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 font-sans mb-4">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Document Summary
              </p>
              <p className="text-xs text-gray-600">
                {document.summary}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-inner font-sans">
              <div className="border-b border-gray-200 pb-2 mb-4 flex items-center justify-between text-[11px] text-gray-400">
                <span>Synthetic Box File Content</span>
                <span>Classification: {document.metadata.classification}</span>
              </div>
              <pre className="font-sans text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                {document.fullContent}
              </pre>
            </div>
          </div>

          {/* Right Metadata Sidebar */}
          <div className="lg:col-span-1 p-5 bg-gray-50/70 space-y-4 text-xs">
            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Security & Governance
              </span>
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                {document.metadata.classification}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Department
              </span>
              <p className="text-gray-700 font-medium">
                {document.metadata.department}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Box Metadata Tags
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {document.metadata.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                MCP Synchronization
              </span>
              <p className="text-emerald-700 font-medium flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{document.metadata.lastSynced}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end text-xs text-gray-500">
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded-lg border border-gray-300 shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
