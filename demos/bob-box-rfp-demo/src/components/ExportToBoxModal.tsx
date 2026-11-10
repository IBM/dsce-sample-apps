import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FolderUp,
  CheckCircle2,
  Loader2,
  FileText,
  ExternalLink,
  Download,
  Check
} from 'lucide-react';
import { BobLogo } from './BobLogo';
import { BoxLogo } from './BoxLogo';
import { buildDeliverables, downloadAllAssetsLocally, type ExportInput } from '../services/boxExportService';

interface ExportToBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportInput: ExportInput;
}

export const ExportToBoxModal: React.FC<ExportToBoxModalProps> = ({
  isOpen,
  onClose,
  exportInput,
}) => {
  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'completed' | 'error'>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedDownload, setCopiedDownload] = useState(false);

  if (!isOpen) return null;

  const deliverables = buildDeliverables(exportInput);
  const customerName = exportInput.brief.customerName;

  const steps = [
    `Verifying Box workspace folder: ${customerName} / Bob Prepared Deliverables...`,
    'Building native Office binaries (.pptx & .docx)...',
    'Uploading 4 generated deliverables to Box Content Cloud...',
    'Creating Box audit trail & permission tags...'
  ];

  const handleStartExport = async () => {
    setExportState('exporting');
    setCurrentStep(0);
    setErrorMessage('');

    // Step animation ticker
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 600);

    try {
      // Build every file in the browser from the live brief/plan/assets, then upload them together
      const form = new FormData();
      for (const asset of deliverables) {
        form.append('files', await asset.getBlob(), asset.filename);
      }
      const res = await fetch('/api/export-to-box', { method: 'POST', body: form });
      const data = await res.json();
      clearInterval(interval);

      if (res.ok && data.success) {
        setCurrentStep(steps.length - 1);
        setExportState('completed');
      } else {
        setErrorMessage(data.error || 'Failed to upload files to Box. Please check your developer token.');
        setExportState('error');
      }
    } catch (err: any) {
      clearInterval(interval);
      setErrorMessage(err.message || 'Network error communicating with Box export endpoint.');
      setExportState('error');
    }
  };

  const handleDownloadAll = async () => {
    await downloadAllAssetsLocally(deliverables);
    setCopiedDownload(true);
    setTimeout(() => setCopiedDownload(false), 2500);
  };

  const handleReset = () => {
    setExportState('idle');
    setCurrentStep(0);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-modal border border-gray-200 overflow-hidden animate-slide-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-[#001d6c] via-[#0043ce] to-[#0061d5] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center justify-center p-1.5 shadow-xs">
              <FolderUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  Export Deliverables to Box
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-blue-100 border border-white/20">
                  4 Artifacts
                </span>
              </div>
              <p className="text-xs text-blue-100">
                Save Bob's synthesized assets directly to {customerName}'s Box folder
              </p>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Target Destination Info */}
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-gray-700">
              <BoxLogo className="text-xl" />
              <span className="text-gray-400">/</span>
              <span className="font-semibold text-gray-800 truncate">
                {customerName} / Bob Prepared Deliverables
              </span>
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded uppercase">
              Target Folder
            </span>
          </div>

          {/* Asset Checklist */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-mono">
              Prepared Deliverables to Export:
            </span>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {deliverables.map((asset, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-center justify-between text-xs hover:bg-white transition-colors"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-gray-900 block truncate">
                        {asset.title}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono block truncate">
                        {asset.filename}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${
                    asset.format === 'pptx'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {asset.format}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Export Status / Progress Tracker */}
          {exportState === 'exporting' && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-blue-200 space-y-3 animate-fade-in">
              <div className="flex items-center space-x-2 text-xs font-semibold text-blue-800">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span>Exporting to Box Cloud Storage ({currentStep + 1}/4)...</span>
              </div>

              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#0f62fe] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>

              <p className="text-[11px] text-gray-600 font-mono truncate">
                {steps[currentStep]}
              </p>
            </div>
          )}

          {/* Export Completed Banner */}
          {exportState === 'completed' && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3 animate-fade-in">
              <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs sm:text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>4 Artifacts Successfully Uploaded to Box!</span>
              </div>

              <p className="text-xs text-emerald-700">
                Your demonstration packet is synced with Box in <code className="font-mono bg-emerald-100/80 px-1 py-0.5 rounded text-emerald-900">{customerName} / Bob Prepared Deliverables</code>.
              </p>
            </div>
          )}

          {/* Export Error Banner */}
          {exportState === 'error' && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2 animate-fade-in">
              <div className="flex items-center space-x-2 text-rose-800 font-bold text-xs sm:text-sm">
                <X className="w-4 h-4 text-rose-600" />
                <span>Box Upload Token Expired or Unavailable</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">
                {errorMessage}
              </p>
              <p className="text-[11px] text-gray-500 font-mono mt-1">
                Tip: Refresh your 60-minute Developer Token in Box Developer Console and paste into <code className="bg-gray-100 px-1 rounded">.env</code>.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 sm:p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {exportState === 'idle' && (
            <>
              <button
                onClick={handleReset}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleStartExport}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-md transition-all cursor-pointer"
              >
                <FolderUp className="w-4 h-4" />
                <span>Upload All 4 Files to Box</span>
              </button>
            </>
          )}

          {exportState === 'exporting' && (
            <div className="w-full flex justify-center py-1">
              <span className="text-xs font-medium text-gray-500 flex items-center space-x-2">
                <BobLogo className="w-4 h-4" />
                <span>IBM Bob is synchronizing with Box MCP...</span>
              </span>
            </div>
          )}

          {exportState === 'error' && (
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                onClick={handleDownloadAll}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 transition-colors cursor-pointer"
              >
                {copiedDownload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5" />}
                <span>{copiedDownload ? 'Downloaded!' : 'Download Local Office Files'}</span>
              </button>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleStartExport}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-xs transition-colors cursor-pointer"
                >
                  Retry Upload
                </button>
              </div>
            </div>
          )}

          {exportState === 'completed' && (
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                onClick={handleDownloadAll}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 transition-colors cursor-pointer"
              >
                {copiedDownload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5" />}
                <span>{copiedDownload ? 'Downloaded Office Files!' : 'Download Local Office Files (.pptx, .docx)'}</span>
              </button>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <a
                  href="https://app.box.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#0061d5] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <span>Open in Box Web App</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
