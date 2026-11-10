import React, { useState } from 'react';
import { BoxDocument } from '../types';
import { SYNTHETIC_DEMO_PLAN_STEPS, DEMO_CONFIRMATION_QUESTIONS } from '../data/syntheticDemoPlan';
import {
  ListOrdered,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface DemoPlanScreenProps {
  documents: BoxDocument[];
  onGenerateAssets: () => void;
  onPreviewDocument: (doc: BoxDocument) => void;
  onOpenAskBob?: () => void;
}

export const DemoPlanScreen: React.FC<DemoPlanScreenProps> = ({
  documents,
  onGenerateAssets,
  onPreviewDocument,
}) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const getDoc = (id: string): BoxDocument | undefined => {
    return documents.find(d => d.id === id);
  };

  const totalDuration = SYNTHETIC_DEMO_PLAN_STEPS.reduce((acc, s) => acc + s.durationMinutes, 0);

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full animate-slide-up">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-[#0f62fe] text-white">
              <ListOrdered className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-gray-900">
              Acme Corp Tailored Demo Plan
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              8 Tailored Steps • ~{totalDuration} Mins
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Grounded presentation flow designed specifically for David Chen (IT Lead) and Rachel Green (IT Director).
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onGenerateAssets}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-md transition-all self-start lg:self-auto cursor-pointer"
        >
          <span>Generate Demo Assets</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Grid: Steps & Sidebars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column: 8 Steps (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                <span>Recommended Demo Sequence</span>
              </h3>
              <span className="text-xs text-gray-500">
                Paced for a 15–20 min session + Q&A
              </span>
            </div>

            <div className="space-y-3">
              {SYNTHETIC_DEMO_PLAN_STEPS.map((step) => {
                const isExpanded = expandedStep === step.stepNumber;

                return (
                  <div
                    key={step.stepNumber}
                    className={`rounded-xl border transition-all ${
                      isExpanded
                        ? 'border-blue-300 bg-blue-50/20 shadow-xs'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Step Accordion Header */}
                    <div
                      onClick={() => setExpandedStep(isExpanded ? null : step.stepNumber)}
                      className="p-4 flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isExpanded
                            ? 'bg-[#0f62fe] text-white shadow-xs'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {step.stepNumber}
                        </span>

                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 truncate">
                            {step.title}
                          </h4>
                          <span className="text-[11px] text-gray-500 font-medium">
                            {step.category} • ~{step.durationMinutes} min
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-xs text-blue-600 font-medium hidden sm:inline">
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                    </div>

                    {/* Step Details Body */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100/80 space-y-3.5 text-xs animate-slide-up">
                        {/* What to Demonstrate */}
                        <div>
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                            Action to Demonstrate
                          </span>
                          <p className="text-gray-800 bg-white p-3 rounded-lg border border-gray-200 leading-relaxed">
                            {step.actionToDemonstrate}
                          </p>
                        </div>

                        {/* Presenter Talking Point */}
                        <div>
                          <span className="text-[11px] font-bold text-[#0f62fe] uppercase tracking-wider block mb-1">
                            Customer-Specific Talking Point
                          </span>
                          <blockquote className="bg-blue-50/60 text-blue-950 p-3 rounded-lg border border-blue-200 font-medium italic leading-relaxed">
                            {step.presenterTalkingPoint}
                          </blockquote>
                        </div>

                        {/* Why it Matters & Sources Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                              Why it matters to Acme
                            </span>
                            <p className="text-gray-700 leading-snug">
                              {step.whyItMattersToAcme}
                            </p>
                          </div>

                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                              Supporting Sources
                            </span>
                            <div className="space-y-1">
                              {step.supportingDocumentIds.map((docId) => {
                                const doc = getDoc(docId);
                                if (!doc) return null;
                                return (
                                  <button
                                    key={docId}
                                    onClick={() => onPreviewDocument(doc)}
                                    className="flex items-center space-x-1 text-blue-700 hover:text-blue-900 text-[11px] font-medium transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3 text-blue-500" />
                                    <span className="truncate">{doc.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Suggested Transition */}
                        <div className="pt-2 border-t border-gray-100 flex items-center space-x-2 text-[11px] text-gray-600">
                          <span className="font-semibold text-gray-700">Transition:</span>
                          <span className="italic">{step.suggestedTransition}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Questions to Confirm */}
        <div className="space-y-5">
          {/* Questions to Confirm Box */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-gray-100">
              <HelpCircle className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-gray-900">
                Questions to Confirm During Q&A
              </h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Use your reserved 15 minutes to clarify these open items with David Chen & Marcus Vance:
            </p>

            <div className="space-y-2.5">
              {DEMO_CONFIRMATION_QUESTIONS.map((q, idx) => (
                <div key={idx} className="p-3 bg-purple-50/40 rounded-xl border border-purple-100 text-xs">
                  <span className="font-bold text-purple-900 block mb-0.5">
                    {q.topic}
                  </span>
                  <p className="text-gray-800 font-medium italic mb-1">
                    {q.question}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Why: {q.whyToAsk}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-xs text-gray-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Every step traces back to verified Acme documents. Ready to generate ready-to-use demo assets?</span>
        </div>

        <button
          onClick={onGenerateAssets}
          className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] shadow-md transition-all cursor-pointer w-full sm:w-auto"
        >
          <span>Generate Demo Assets</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
