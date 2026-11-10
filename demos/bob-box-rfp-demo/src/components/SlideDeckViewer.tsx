import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Copy,
  Check,
  Clock
} from 'lucide-react';
import { buildSlides, buildSlideContext } from './slideDeckData';
import { BoxDocument, Finding } from '../types';

interface SlideDeckViewerProps {
  documents?: BoxDocument[];
  findings?: Finding[];
}

export const SlideDeckViewer: React.FC<SlideDeckViewerProps> = ({
  documents = [],
  findings = [],
}) => {
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [activeNotesTab, setActiveNotesTab] = useState<'bullets' | 'script' | 'objections'>('bullets');

  // Build slides from live context — memoized so they only rebuild when data changes
  const slides = useMemo(
    () => buildSlides(buildSlideContext(documents, findings)),
    [documents, findings]
  );

  const currentSlide = slides[currentSlideIdx];
  const currentNotes = currentSlide.notes;

  const goToPrev = () => {
    setCurrentSlideIdx(prev => (prev > 0 ? prev - 1 : slides.length - 1));
  };

  const goToNext = () => {
    setCurrentSlideIdx(prev => (prev < slides.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIdx]);

  const handleCopyNotes = () => {
    const textToCopy = `[SLIDE ${currentSlide.numberStr}: ${currentSlide.title}]
OBJECTIVE: ${currentNotes.objective}
TARGET AUDIENCE: ${currentNotes.targetAudience}

KEY TALKING POINTS:
${currentNotes.talkingPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

DEMO CUE: ${currentNotes.demoCue}
ANTICIPATED OBJECTION: ${currentNotes.objectionHandling}
SOURCE CITATION: ${currentNotes.sourceCitation}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 16:9 Interactive Slide Viewer with Authentic IBM Watsonx / Carbon Presentation Styling */}
      <div className="relative w-full aspect-[16/9] min-h-[380px] max-h-[540px] rounded-2xl shadow-md overflow-hidden bg-white border border-gray-200">
        {currentSlide.visual}
      </div>

      {/* Navigation & Slide Thumbnails Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Slide Category Selector Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlideIdx(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 border ${
                currentSlideIdx === idx
                  ? 'bg-[#161616] text-white shadow-xs font-bold border-[#161616]'
                  : 'bg-white hover:bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              <span className={currentSlideIdx === idx ? 'text-[#0f62fe]' : 'text-gray-400 font-bold'}>{slide.numberStr}.</span>
              <span className="truncate max-w-[130px] sm:max-w-none">{slide.category}</span>
            </button>
          ))}
        </div>

        {/* Stepper Controls */}
        <div className="flex items-center space-x-2 self-end sm:self-auto flex-shrink-0">
          <button
            onClick={goToPrev}
            className="p-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-2xs transition-colors cursor-pointer"
            title="Previous Slide (← Arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono font-bold text-gray-700 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
            {currentSlide.numberStr} / 06
          </span>

          <button
            onClick={goToNext}
            className="p-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-2xs transition-colors cursor-pointer"
            title="Next Slide (→ Arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Presenter Briefing & Speaker Notes Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 rounded-lg bg-blue-50 text-[#0f62fe]">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-[#161616] text-sm">
                Speaker Notes &amp; Talking Tracks • Slide {currentSlide.numberStr}
              </h3>
              <p className="text-[11px] text-[#525252] font-mono">
                {currentSlide.title}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            {/* Notes Tabs */}
            <div className="flex bg-gray-100 p-0.5 rounded-lg text-[11px] font-medium text-gray-600">
              <button
                onClick={() => setActiveNotesTab('bullets')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeNotesTab === 'bullets' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'hover:text-gray-900'
                }`}
              >
                Key Bullets
              </button>
              <button
                onClick={() => setActiveNotesTab('script')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeNotesTab === 'script' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'hover:text-gray-900'
                }`}
              >
                Full Script
              </button>
              <button
                onClick={() => setActiveNotesTab('objections')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeNotesTab === 'objections' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'hover:text-gray-900'
                }`}
              >
                Objections
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopyNotes}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors cursor-pointer"
              title="Copy notes to clipboard"
            >
              {copiedNotes ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold text-[11px]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-[11px]">Copy Notes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: Key Bullets View */}
        {activeNotesTab === 'bullets' && (
          <div className="space-y-3.5 animate-slide-up">
            {/* Objective & Target Audience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0f62fe] block mb-1">
                  🎯 Slide Objective
                </span>
                <p className="text-gray-800 leading-relaxed font-medium">
                  {currentNotes.objective}
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  👥 Target Audience Persona
                </span>
                <p className="text-gray-800 leading-relaxed font-medium">
                  {currentNotes.targetAudience}
                </p>
              </div>
            </div>

            {/* Bullet Points */}
            <div className="text-xs space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 block">
                🗣️ What to Say (Speaker Bullets)
              </span>
              <ul className="space-y-2 text-gray-700">
                {currentNotes.talkingPoints.map((point, i) => (
                  <li key={i} className="flex items-start space-x-2.5 bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-[#0f62fe] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 font-mono">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed font-normal">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Demo Interaction Cue */}
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-xs text-indigo-950 flex items-start space-x-2">
              <Clock className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5 text-indigo-900">💡 Live Presenter Action Cue:</span>
                <p className="text-[11px] text-indigo-900/90 leading-relaxed">
                  {currentNotes.demoCue}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Full Script View */}
        {activeNotesTab === 'script' && (
          <div className="space-y-3 animate-slide-up text-xs">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 block">
                🎙️ Verbatim Presentation Track
              </span>
              <p className="text-gray-800 text-[12px] leading-relaxed italic">
                "{currentNotes.objective} As we look at this slide, notice how {currentNotes.talkingPoints[0].toLowerCase()} Furthermore, {currentNotes.talkingPoints[1].toLowerCase()} Finally, {currentNotes.talkingPoints[2].toLowerCase()}"
              </p>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Estimated Delivery Time: 45–60 seconds
            </div>
          </div>
        )}

        {/* Tab 3: Anticipated Objections View */}
        {activeNotesTab === 'objections' && (
          <div className="space-y-3 animate-slide-up text-xs">
            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-amber-950 space-y-1.5">
              <span className="font-bold flex items-center space-x-1.5 text-amber-900">
                <span>⚠️ Anticipated Customer Question / Objection</span>
              </span>
              <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                {currentNotes.objectionHandling}
              </p>
            </div>
          </div>
        )}

        {/* Source Grounding Footer */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-mono text-gray-500">
          <span>Grounding Citations: <strong className="text-gray-700">{currentNotes.sourceCitation}</strong></span>
          <span className="text-[#0f62fe]">Verified by Box MCP</span>
        </div>
      </div>
    </div>
  );
};
