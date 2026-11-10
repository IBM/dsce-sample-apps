import React from 'react';
import { Finding, BoxDocument } from '../types';
import { 
  X, 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  Eye,
  ArrowRight
} from 'lucide-react';
import { getFileTypeBadge } from '../utils/formatters';

interface EvidenceModalProps {
  finding: Finding | null;
  documents: BoxDocument[];
  onClose: () => void;
  onPreviewDocument: (doc: BoxDocument) => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  finding,
  documents,
  onClose,
  onPreviewDocument,
}) => {
  if (!finding) return null;

  const isInsufficient = finding.insufficientEvidence || finding.strength === 'not_found';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-modal border border-gray-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Evidence Verification Chain</span>
              </span>

              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                isInsufficient
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {finding.strengthLabel}
              </span>
            </div>

            <h2 className="text-xl font-bold text-gray-900 leading-snug">
              {finding.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Grounded Summary Box */}
          <div className="bg-blue-50/40 rounded-xl border border-blue-100 p-4">
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">
              Grounded Finding Statement
            </h3>
            <p className="text-sm text-gray-800 font-medium leading-relaxed">
              {finding.statement}
            </p>
            <p className="text-xs text-blue-700 mt-2">
              {finding.groundedSummary}
            </p>
          </div>

          {/* Insufficient Evidence State */}
          {isInsufficient ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold">
                    Insufficient Evidence in Available Box Content
                  </h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    “I could not find sufficient evidence in the available Box content to support this conclusion.”
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    {finding.missingInfoNote || 'No discovery notes, RFP specifications, or technical matrices documented this item.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Supporting Evidence Excerpts */
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Supporting Box Sources ({finding.excerpts.length})</span>
                </h3>
                <span className="text-[11px] text-gray-400">
                  Direct citation trace to synthetic files
                </span>
              </div>

              <div className="space-y-4">
                {finding.excerpts.map((excerpt, idx) => {
                  const doc = documents.find(d => d.id === excerpt.documentId);
                  const badge = doc ? getFileTypeBadge(doc.type) : null;

                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden"
                    >
                      {/* Document Citation Header */}
                      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center space-x-2 truncate">
                          {badge && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {badge.label}
                            </span>
                          )}
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {excerpt.documentName}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="text-[11px] text-gray-500 truncate">
                            {excerpt.section}
                          </span>
                        </div>

                        {doc && (
                          <button
                            onClick={() => onPreviewDocument(doc)}
                            className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex-shrink-0 cursor-pointer"
                            title="Open simulated document in Box"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Open in Box</span>
                          </button>
                        )}
                      </div>

                      {/* Excerpt Body */}
                      <div className="p-4">
                        <blockquote className="text-xs sm:text-sm text-gray-800 border-l-2 border-[#0061d5] pl-3 py-1 italic bg-blue-50/20 rounded-r">
                          “{excerpt.text}”
                        </blockquote>

                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                          <span className="text-gray-600 font-medium">
                            Context: {excerpt.relevanceNote}
                          </span>
                          {doc && (
                            <span className="text-gray-400 font-mono">
                              {doc.metadata.boxFileId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visual Grounding Pipeline Chain */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-xs text-gray-600 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-gray-700">Verification Trace:</span>
            <div className="flex items-center space-x-1.5 text-gray-500 text-[11px]">
              <span className="px-2 py-0.5 bg-white border border-gray-200 rounded font-medium text-gray-800">Finding</span>
              <ArrowRight className="w-3 h-3 text-gray-400" />
              <span className="px-2 py-0.5 bg-white border border-gray-200 rounded font-medium text-gray-800">Box Excerpt</span>
              <ArrowRight className="w-3 h-3 text-gray-400" />
              <span className="px-2 py-0.5 bg-white border border-gray-200 rounded font-medium text-gray-800">Original Document</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Click "Open in Box" on any excerpt to view the full document.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded-xl border border-gray-300 shadow-xs transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
