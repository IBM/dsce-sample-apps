import React, { useState } from 'react';
import { BoxDocument, Finding } from '../types';
import { BobLogo } from './BobLogo';
import { ExportToBoxModal } from './ExportToBoxModal';
import {
  Copy,
  Check,
  RotateCcw,
  MessageSquare,
  Presentation,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Users,
  Target,
  AlertCircle,
  FolderUp
} from 'lucide-react';

interface DemoReadyScreenProps {
  documents: BoxDocument[];
  findings: Finding[];
  onReviewEvidence: () => void;
  onViewScript: () => void;
  onResetDemo: () => void;
  onPreviewDocument: (doc: BoxDocument) => void;
  onOpenAskBob?: () => void;
}

export const DemoReadyScreen: React.FC<DemoReadyScreenProps> = ({
  onReviewEvidence,
  onViewScript,
  onResetDemo,
  onOpenAskBob,
}) => {
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleCopyMeetingBrief = () => {
    const briefText = `ACME CORP — DEMO READINESS EXECUTIVE BRIEF
Account: Acme Corp (Commercial Onboarding Modernization)
Target Demo: Tomorrow, 10:00 AM EST
Audience: David Chen (IT Lead), Rachel Green (IT Director), Marcus Vance (CISO Office)

CORE CONTEXT:
• Primary Pain Point: 48-hour classification backlog across network shares & 2–3 hrs daily manual Salesforce re-entry
• Solution Focus: Box AI automated classification & W-9 extraction with live Salesforce Sales Cloud canvas handoff
• Technical Mandates: SAML 2.0 / OpenID SSO, REST API, AES-256 / TLS 1.2+, Strict US Data Residency, 365-day Audit Logs
• Key Q&A Confirmation: Identity Provider standard (Okta vs Azure AD) & Retention schedule (3 vs 7 yrs)

Prepared with IBM Bob • 100% Grounded in Customer Box Records`;

    navigator.clipboard.writeText(briefText);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full animate-slide-up">
      {/* Blue Banner - Minimal without buttons */}
      <div className="bg-gradient-to-r from-[#001d6c] via-[#0043ce] to-[#0061d5] rounded-3xl p-6 sm:p-8 text-white shadow-card mb-6 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-100 border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>Prepared with Bob</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Acme Corp Demo Ready
          </h2>

          <p className="text-sm sm:text-base text-blue-100 font-normal max-w-2xl">
            Synthesized and grounded in 12 customer workspace files for tomorrow's executive presentation with David Chen, Rachel Green, and Marcus Vance.
          </p>
        </div>
      </div>

      {/* Prominent Feature: Export Deliverables to Box Cloud Workspace */}
      <div className="bg-white rounded-3xl border-2 border-blue-200 p-6 sm:p-7 shadow-card mb-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center space-x-2">
            <span className="h-5 px-2 rounded bg-[#0061d5] text-white font-black text-[10px] flex items-center shadow-xs">
              box
            </span>
            <span className="text-gray-300 font-bold">•</span>
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider font-mono">
              Official Box Ingestion
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            Export Demonstration Packet to Box
          </h3>

          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            Sync native Office files directly into Acme Corp’s Box folder: interactive 6-slide PowerPoint presentation (<strong className="text-amber-800">.pptx</strong>), formatted executive brief (<strong className="text-blue-800">.docx</strong>), demo script, and validation matrix.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-medium border border-amber-200 flex items-center space-x-1">
              <span>📊 Slide Deck (.pptx)</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-medium border border-blue-200 flex items-center space-x-1">
              <span>📝 Executive Brief (.docx)</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-medium border border-blue-200 flex items-center space-x-1">
              <span>📝 Demo Script (.docx)</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-medium border border-emerald-200 flex items-center space-x-1">
              <span>📋 Validation Matrix (.docx)</span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsExportModalOpen(true)}
          className="w-full md:w-auto inline-flex items-center justify-center space-x-2.5 px-6 py-4 rounded-2xl font-bold text-sm sm:text-base text-white bg-[#0061d5] hover:bg-[#0043ce] shadow-md hover:shadow-lg transition-all cursor-pointer flex-shrink-0"
        >
          <FolderUp className="w-5 h-5" />
          <span>Export Packet to Box</span>
          <ArrowRight className="w-4 h-4 ml-0.5" />
        </button>
      </div>

      {/* Main Grid: Succinct Meeting Brief (Left) + Ask Bob Assistant Launcher (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        {/* Super Succinct Meeting Brief Card (7 cols) */}
        <div className="md:col-span-7 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Executive Meeting Brief
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold text-white bg-[#0061d5] hover:bg-[#0043ce] rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>Export to Box</span>
                </button>

                <button
                  onClick={handleCopyMeetingBrief}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedBrief ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                      <span>Copy Brief</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-gray-700">
              <div className="flex items-start space-x-2.5">
                <Users className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-gray-900 block">Stakeholders</span>
                  <p className="text-gray-600">David Chen (IT Lead), Rachel Green (IT Director), Marcus Vance (CISO Office)</p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-gray-900 block">Core Bottleneck</span>
                  <p className="text-gray-600">48-hour classification backlog &amp; 2–3 hours daily manual Salesforce re-entry.</p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-gray-900 block">Demonstration Focus</span>
                  <p className="text-gray-600">Box AI automated tax classification, metadata extraction, and live Salesforce canvas sync.</p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-gray-900 block">Validated Mandates &amp; Q&amp;A Goal</span>
                  <p className="text-gray-600">SAML SSO, AES-256, US Data Residency. Confirm IdP standard (Okta vs Azure AD) in Q&amp;A.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>Source: 12 Box Documents</span>
            <span className="text-emerald-600 font-semibold">100% Grounded</span>
          </div>
        </div>

        {/* Ask Bob Interactive Direct Launcher Card (5 cols) */}
        <div className="md:col-span-5 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 rounded-2xl border border-blue-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5">
              <span className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center p-1 shadow-sm">
                <BobLogo className="w-full h-full" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Ask Bob Assistant
                </h3>
                <p className="text-[11px] text-gray-500">
                  Grounded across all 12 Box records
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Need instant answers or deep-dive verification during or before the meeting? Pull up Ask Bob to query technical requirements, security mandates, or customer notes.
            </p>

            <div className="p-3 bg-white rounded-xl border border-blue-100 text-[11px] space-y-1.5 text-gray-600 shadow-2xs">
              <span className="font-semibold text-blue-700 block text-[10px] uppercase tracking-wider font-mono">
                Sample Grounded Inquiries
              </span>
              <p className="italic">“What IdP standard does Acme use?”</p>
              <p className="italic">“What is Acme’s data residency requirement?”</p>
            </div>
          </div>

          {onOpenAskBob && (
            <button
              onClick={onOpenAskBob}
              className="mt-4 w-full inline-flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-[#0f62fe] hover:bg-[#0043ce] text-white shadow-md transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open Ask Bob Assistant</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-xs text-gray-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Demo packet prepared. Ready for the live meeting?</span>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={onViewScript}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Presentation className="w-3.5 h-3.5" />
            <span>Launch Slide Deck &amp; Script</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#0061d5] hover:bg-[#0043ce] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <FolderUp className="w-3.5 h-3.5" />
            <span>Export to Box</span>
          </button>

          <button
            onClick={onReviewEvidence}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Review Evidence
          </button>

          <button
            onClick={onResetDemo}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Export to Box Modal */}
      <ExportToBoxModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};
