import React, { useState } from 'react';
import { BoxDocument } from '../types';
import { GeneratedDemoAssets, GeneratedDemoPlan, GeneratedExecBrief } from '../services/assetGenerator';
import { SlideDeckViewer } from './SlideDeckViewer';
import { ExportToBoxModal } from './ExportToBoxModal';
import {
  Presentation,
  Copy,
  Check,
  Download,
  FileText,
  ArrowRight,
  ShieldCheck,
  FolderUp
} from 'lucide-react';

interface DemoAssetsScreenProps {
  documents: BoxDocument[];
  assets: GeneratedDemoAssets;
  plan: GeneratedDemoPlan;
  brief: GeneratedExecBrief;
  findings?: import('../types').Finding[];
  onProceedToDemoReady: () => void;
  onPreviewDocument: (doc: BoxDocument) => void;
}

export const DemoAssetsScreen: React.FC<DemoAssetsScreenProps> = ({
  documents,
  assets,
  plan,
  brief,
  findings = [],
  onProceedToDemoReady,
}) => {
  const [activeTab, setActiveTab] = useState<'deck' | 'script'>('deck');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const scriptContent = assets.scriptContent;
  const customerName = assets.customerName;

  const handleSimulatedDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full animate-slide-up">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-[#0f62fe] text-white">
              <Presentation className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-gray-900">
              Generated Demo Deliverables &amp; Assets
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Presentation &amp; Script
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Complete presentation toolkit tailored to {customerName}'s requirements — generated from live Box data.
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onProceedToDemoReady}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-md transition-all self-start lg:self-auto cursor-pointer"
        >
          <span>View Executive Brief</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Asset Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-xs mb-6 overflow-x-auto flex space-x-2">
        <button
          onClick={() => setActiveTab('deck')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'deck'
              ? 'bg-[#0f62fe] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Presentation className="w-4 h-4" />
          <span>1. Presentation Slide Deck</span>
        </button>

        <button
          onClick={() => setActiveTab('script')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'script'
              ? 'bg-[#0f62fe] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>2. Customer Demo Script (5-7 Min)</span>
        </button>
      </div>

      {/* Tab 1: Slide Deck */}
      {activeTab === 'deck' && (
        <SlideDeckViewer documents={documents} findings={findings} />
      )}

      {/* Tab 2: Demo Script */}
      {activeTab === 'script' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Tailored {customerName} Demo Script
              </h3>
              <p className="text-xs text-gray-500">
                Scripted verbatim presentation connecting intake friction directly to Box AI and Salesforce integration.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleCopy(scriptContent, 'script')}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors cursor-pointer"
              >
                {copiedKey === 'script' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'script' ? 'Copied!' : 'Copy Script'}</span>
              </button>

              <button
                onClick={() => handleSimulatedDownload(`${customerName.replace(/\s+/g, '_')}_Demo_Script.txt`, scriptContent)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export (.txt)</span>
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0061d5] hover:bg-[#0043ce] transition-colors cursor-pointer"
              >
                <FolderUp className="w-3.5 h-3.5" />
                <span>Export to Box</span>
              </button>
            </div>
          </div>

          <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-[550px] overflow-y-auto">
            {scriptContent}
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-xs text-gray-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Demo assets are ready to export or present. Proceed to the final executive packet?</span>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#0061d5] hover:bg-[#0043ce] transition-all cursor-pointer w-full sm:w-auto"
          >
            <FolderUp className="w-4 h-4" />
            <span>Export to Box</span>
          </button>

          <button
            onClick={onProceedToDemoReady}
            className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-md transition-all cursor-pointer w-full sm:w-auto"
          >
            <span>View Executive Brief</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Export to Box Modal */}
      <ExportToBoxModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        exportInput={{ documents, findings, brief, plan, assets }}
      />
    </div>
  );
};
