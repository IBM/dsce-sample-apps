import React, { useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Database, CheckCircle } from 'lucide-react';
import { BobLogo } from './BobLogo';
import { BoxLogo } from './BoxLogo';

interface LandingScreenProps {
  onStartPreparation: (promptText: string) => void;
  onOpenSuggestionModal?: (suggestion: string) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onStartPreparation }) => {
  const [promptText, setPromptText] = useState('Prepare me for tomorrow’s demo with Acme Corp.');

  const suggestions = [
    { label: 'Prepare me for tomorrow’s demo with Acme Corp.', query: 'Prepare me for tomorrow’s demo with Acme Corp.' },
    { label: 'How close is Acme to renewing?', query: 'How close is Acme to renewing?' },
    { label: 'What are the top blockers in the security review?', query: 'What are the top blockers in the security review?' },
    { label: 'What technical requirements has Acme documented?', query: 'What technical requirements has Acme documented?' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (promptText.trim()) {
      onStartPreparation(promptText.trim());
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full animate-slide-up">
      {/* Bob + Box Co-Branded Hero Tag */}
      <div className="flex items-center space-x-2.5 mb-6 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-xs">
        <div className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center p-0.5">
          <BobLogo className="w-full h-full" />
        </div>
        <span className="text-xs font-bold text-gray-900">Bob</span>
        <span className="text-gray-300 font-semibold text-xs">+</span>
        <BoxLogo className="text-xl" />
        <span className="text-gray-300">•</span>
        <span className="text-xs font-medium text-gray-600">Customer Account Intelligence &amp; Action Accelerator</span>
      </div>

      {/* Main Title & Subtitle */}
      <div className="text-center max-w-3xl mb-10">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-4">
          Turn Box Customer Knowledge into Action with IBM Bob
        </h1>
        <p className="text-base sm:text-lg text-gray-600 font-normal leading-relaxed max-w-2xl mx-auto">
          Ask Bob anything about your customer accounts — from renewal health and discovery gaps to automated, tailored demo prep.
        </p>
      </div>

      {/* Prompt Card */}
      <div className="w-full bg-white rounded-2xl shadow-card border border-gray-200 p-6 sm:p-8 mb-8 relative overflow-hidden transition-all hover:shadow-card-hover">
        {/* Subtle decorative gradient top bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0f62fe] via-[#0061d5] to-[#001d6c]" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium pb-2 border-b border-gray-100">
            <span className="flex items-center space-x-1.5 text-gray-700">
              <Sparkles className="w-4 h-4 text-[#0f62fe]" />
              <span className="font-semibold">Bob Agentic Workspace Prompt</span>
            </span>
            <span className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <Database className="w-3 h-3" />
              <span>Target: Your Box Workspace</span>
            </span>
          </div>

          <div className="relative">
            <textarea
              rows={3}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ask Bob to prepare your customer demo..."
              className="w-full text-base sm:text-lg font-medium text-gray-900 bg-gray-50/70 hover:bg-gray-50 focus:bg-white rounded-xl border border-gray-300 focus:border-[#0f62fe] focus:ring-2 focus:ring-blue-100 p-4 transition-all resize-none outline-none leading-relaxed"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-gray-500 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Evidence-based analysis</span>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 text-base font-semibold text-white bg-[#0f62fe] hover:bg-[#0043ce] active:bg-[#001d6c] rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[0.99] cursor-pointer"
            >
              <span>Prepare My Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Prompt Suggestions */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
            Suggested Context Exploration Queries
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPromptText(item.query);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-xs font-medium text-gray-700 border border-gray-200 hover:border-blue-200 transition-colors text-left cursor-pointer"
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Value Pillars Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-gray-900">1. Context in Box</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Discovery notes, RFP, security policies, and technical specs stored in Box.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-gray-900">2. Bob MCP Synthesis</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Analyzes deal health, extracts pain points, and synthesizes answers with citations.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-gray-900">3. Actionable Outcomes</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Generates executive briefs, risk assessments, or tailored customer demo packets in seconds.
            </p>
          </div>
        </div>
      </div>

      {/* Central Message Banner */}
      <div className="mt-8 text-center text-xs font-medium text-gray-500 max-w-xl">
        <span className="text-[#0061d5] font-semibold">“Box provides the customer context.</span>{' '}
        <span className="text-[#0f62fe] font-semibold">Bob turns that context into grounded customer intelligence and action.”</span>
      </div>
    </div>
  );
};
