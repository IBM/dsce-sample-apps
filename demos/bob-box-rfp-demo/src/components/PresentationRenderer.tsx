/**
 * PresentationRenderer
 *
 * Renders a `PresentationData` (plain-data slide deck from the AI generator) in the same
 * 16:9 IBM Carbon style used by `SlideDeckViewer`, reusing its navigation and notes layout.
 *
 * The existing `SlideDeckViewer` expects `Slide` objects with React-node `visual` fields built
 * by `slideDeckData.tsx` — those cannot be constructed from plain `PresentationSlideData`.
 * This renderer reproduces the visual look from scratch using the same Tailwind classes.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { BobLogo } from './BobLogo';
import { IbmLogo } from './IbmLogo';
import type { PresentationSlideData } from '../services/workspaceArtifacts';

// ─── Slide visual ─────────────────────────────────────────────────────────────

const SlideVisual: React.FC<{ slide: PresentationSlideData; total: number }> = ({
  slide,
  total,
}) => {
  const isTitle = slide.id === 1;

  if (isTitle) {
    // Title / cover slide — dark IBM style
    return (
      <div className="w-full h-full bg-[#161616] flex flex-col justify-between p-8 sm:p-12 select-none">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-6 h-6 rounded bg-white inline-flex items-center justify-center p-1">
              <BobLogo className="w-full h-full" />
            </span>
            <IbmLogo className="h-5 w-auto" color="#ffffff" />
          </div>
          <span className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
            IBM Confidential
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col justify-center space-y-4">
          <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#0f62fe]">
            RFP Response
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{slide.title}</h1>
          {slide.subtitle && (
            <p className="text-sm sm:text-base text-gray-300 font-light">{slide.subtitle}</p>
          )}
          {slide.bullets.length > 0 && (
            <ul className="space-y-1 border-t border-gray-700 pt-3 text-xs sm:text-sm text-gray-400">
              {slide.bullets.slice(0, 4).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] font-mono text-gray-600">
          <span>Slide 1 / {total}</span>
          <span className="text-[#0f62fe]">Grounded by Box MCP</span>
        </div>
      </div>
    );
  }

  // Content slide — white IBM style
  return (
    <div className="w-full h-full bg-white flex flex-col p-6 sm:p-10 select-none">
      {/* Slide header bar */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#0f62fe] mb-5">
        <div>
          <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-[#0f62fe] mb-0.5">
            Slide {slide.id}
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-[#161616] leading-tight">{slide.title}</h2>
          {slide.subtitle && (
            <p className="text-xs sm:text-sm text-[#525252] mt-0.5">{slide.subtitle}</p>
          )}
        </div>
        <span className="hidden sm:flex w-7 h-7 rounded bg-gray-900 items-center justify-center p-1 flex-shrink-0">
          <BobLogo className="w-full h-full" />
        </span>
      </div>

      {/* Bullet points */}
      <ul className="flex-1 space-y-2.5 overflow-hidden">
        {slide.bullets.slice(0, 6).map((bullet, i) => (
          <li key={i} className="flex items-start space-x-3 text-sm text-[#161616]">
            <span className="mt-1 w-2 h-2 rounded-full bg-[#0f62fe] flex-shrink-0" />
            <span className="leading-snug">{bullet}</span>
          </li>
        ))}
        {slide.bullets.length > 6 && (
          <li className="text-xs text-gray-400 italic pl-5">
            +{slide.bullets.length - 6} more points in speaker notes
          </li>
        )}
      </ul>

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between text-[9px] font-mono text-gray-400">
        <span>Slide {slide.id} / {total}</span>
        <span className="text-[#0f62fe]">Verified by Box MCP</span>
      </div>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export interface PresentationRendererProps {
  slides: PresentationSlideData[];
}

export const PresentationRenderer: React.FC<PresentationRendererProps> = ({ slides }) => {
  const [idx, setIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const total = slides.length;
  const slide = slides[Math.min(idx, total - 1)];

  const goToPrev = () => setIdx(i => (i > 0 ? i - 1 : total - 1));
  const goToNext = () => setIdx(i => (i < total - 1 ? i + 1 : 0));

  // Reset to first slide when the deck changes (different artifact version selected)
  const prevTotal = useRef(total);
  useEffect(() => {
    if (prevTotal.current !== total) {
      setIdx(0);
      prevTotal.current = total;
    }
  }, [total]);

  // Keyboard navigation (only when no input is focused)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  const handleCopyNotes = () => {
    const lines = [
      `[SLIDE ${slide.id}: ${slide.title}]`,
      ...(slide.subtitle ? [`Subtitle: ${slide.subtitle}`] : []),
      '',
      'BULLET POINTS:',
      ...slide.bullets.map((b, i) => `${i + 1}. ${b}`),
      ...(slide.notes ? ['', `SPEAKER NOTES:\n${slide.notes}`] : []),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* 16:9 Slide viewer */}
      <div className="relative w-full aspect-[16/9] min-h-[320px] max-h-[480px] rounded-2xl shadow-md overflow-hidden bg-white border border-gray-200">
        <SlideVisual slide={slide} total={total} />
      </div>

      {/* Navigation strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Slide pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 border ${
                i === idx
                  ? 'bg-[#161616] text-white shadow-xs font-bold border-[#161616]'
                  : 'bg-white hover:bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              <span className={i === idx ? 'text-[#0f62fe]' : 'text-gray-400 font-bold'}>
                {String(s.id).padStart(2, '0')}.
              </span>
              <span className="truncate max-w-[130px] sm:max-w-none">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Stepper */}
        <div className="flex items-center space-x-2 self-end sm:self-auto flex-shrink-0">
          <button
            onClick={goToPrev}
            className="p-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-2xs transition-colors cursor-pointer"
            title="Previous Slide (← Arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-gray-700 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
            {String(slide.id).padStart(2, '0')} / {String(total).padStart(2, '0')}
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

      {/* Speaker notes panel */}
      {(slide.bullets.length > 0 || slide.notes) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-[#161616] text-sm">
                Speaker Notes · Slide {slide.id}
              </h3>
              <p className="text-[11px] text-[#525252] font-mono">{slide.title}</p>
            </div>
            <button
              onClick={handleCopyNotes}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors cursor-pointer"
              title="Copy notes to clipboard"
            >
              {copied ? (
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

          {/* Bullets beyond the 6 shown on slide */}
          {slide.bullets.length > 0 && (
            <ul className="space-y-1.5 text-xs text-gray-700">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-blue-100 text-[#0f62fe] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 font-mono">
                    {i + 1}
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {slide.notes && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 italic leading-relaxed">
              <span className="not-italic font-bold text-gray-700 block mb-1">Speaker notes:</span>
              {slide.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
