'use client';

import React, { useState } from 'react';
import { PocOffense, StageState } from '@/types';
import {
  generateIncidentReportHtml,
  generateIncidentReportMarkdown,
} from '@/lib/reportGenerator';
import {
  X,
  Download,
  Printer,
  FileText,
  Code2,
  Check,
  Copy,
  ExternalLink,
  Shield,
  Sparkles,
} from 'lucide-react';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  offense: PocOffense;
  runs: Record<string, StageState>;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  onClose,
  offense,
  runs,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'markdown'>('preview');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const htmlContent = generateIncidentReportHtml({ offense, runs });
  const markdownContent = generateIncidentReportMarkdown({ offense, runs });

  const handleDownloadHtml = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Incident_Report_Offense_${offense.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Incident_Report_Offense_${offense.id}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl h-[90vh] rounded-2xl border border-slate-700/80 bg-[#0d1117] shadow-2xl shadow-indigo-950/80 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-indigo-950/90 to-slate-900 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Incident Investigation Report
                </h2>
                <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-mono text-indigo-300">
                  Offense #{offense.id}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <Sparkles className="h-2.5 w-2.5" />
                  RCA Certified
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                5-Dimension Root Cause Analysis & Mitigation Summary
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Buttons */}
            <button
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95 transition-all"
              title="Download standalone HTML report"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download HTML</span>
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
              title="Download raw Markdown report"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Download MD</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
              title="Print or Save as PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-slate-800/80 bg-slate-900/60 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                activeTab === 'preview'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Visual HTML Report</span>
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                activeTab === 'markdown'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Markdown Source</span>
            </button>
          </div>

          {activeTab === 'markdown' && (
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-auto bg-[#080a12] p-4 sm:p-6">
          {activeTab === 'preview' ? (
            <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden border border-slate-800 bg-white shadow-inner">
              <iframe
                title="Incident Report Preview"
                srcDoc={htmlContent}
                sandbox=""
                className="w-full h-full min-h-[550px] border-none"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-5 font-mono text-xs text-slate-300 leading-relaxed overflow-auto max-h-[600px] whitespace-pre-wrap">
              {markdownContent}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-[#0d1117] text-xs text-slate-500">
          <span>Target: {offense.destinationIp} · Source: {offense.sourceIp}</span>
          <span className="font-mono text-[11px]">Ready for executive export & SIEM sync</span>
        </div>
      </div>
    </div>
  );
};
