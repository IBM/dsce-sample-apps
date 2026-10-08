'use client';

import React from 'react';
import { POC_OFFENSES } from '@/data/sampleOffenses';
import { PocOffense } from '@/types';
import { ShieldAlert, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface OffenseSelectorProps {
  selectedOffenseId: string;
  onSelectOffense: (offense: PocOffense) => void;
}

export const OffenseSelector: React.FC<OffenseSelectorProps> = ({
  selectedOffenseId, onSelectOffense,
}) => {
  const selectedOffense = POC_OFFENSES.find((o) => o.id === selectedOffenseId);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = POC_OFFENSES.find((o) => o.id === e.target.value);
    if (found) onSelectOffense(found);
  };

  const severityPill: Record<string, string> = {
    Critical: 'border-red-500/30 bg-red-500/10 text-red-400',
    High:     'border-orange-500/30 bg-orange-500/10 text-orange-400',
    Medium:   'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    Low:      'border-sky-500/30 bg-sky-500/10 text-sky-400',
  };

  const modulePill: Record<string, string> = {
    M1: 'border-red-500/30 bg-red-500/10 text-red-400',
    M2: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    M3: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    M4: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    M5: 'border-lime-500/30 bg-lime-500/10 text-lime-400',
    M6: 'border-green-500/30 bg-green-500/10 text-green-400',
    N1: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
  };

  const tpCount = POC_OFFENSES.filter((o) => o.expectedOutcome === 'True Positive').length;
  const niCount = POC_OFFENSES.filter((o) => o.expectedOutcome === 'Non-Issue').length;
  const isTP = selectedOffense?.expectedOutcome === 'True Positive';

  return (
    <div className="w-full rounded-xl border border-slate-800/60 bg-[#0a0c16] p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
            isTP ? 'bg-orange-500/10 text-orange-400 ring-orange-500/20' : 'bg-teal-500/10 text-teal-400 ring-teal-500/20'
          }`}>
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Select Offense</span>
              {selectedOffense && (
                <>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${severityPill[selectedOffense.severity] ?? 'border-slate-700 text-slate-400'}`}>
                    {selectedOffense.severity}
                  </span>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${modulePill[selectedOffense.module] ?? 'border-slate-700 text-slate-400'}`}>
                    {selectedOffense.module}
                  </span>
                  {isTP ? (
                    <span className="flex items-center gap-1 rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange-400">
                      <AlertTriangle className="h-2.5 w-2.5" />True Positive
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded border border-teal-500/30 bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-teal-400">
                      <CheckCircle2 className="h-2.5 w-2.5" />Non-Issue
                    </span>
                  )}
                </>
              )}
            </div>
            {selectedOffense && (
              <p className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">{selectedOffense.title}</p>
            )}
          </div>
        </div>

        {/* Dropdown */}
        <div className="relative w-full sm:w-[380px] shrink-0">
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
          <select
            value={selectedOffenseId}
            onChange={handleChange}
            className="w-full appearance-none rounded-lg border border-slate-700/60 bg-slate-900/60 py-2 pl-3.5 pr-9 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors cursor-pointer"
          >
            <option value="" disabled>— Select an Offense —</option>
            {[...POC_OFFENSES]
              .sort((a, b) => Number(a.id) - Number(b.id))
              .map((o: PocOffense) => (
                <option key={o.id} value={o.id}>{`#${o.id} — ${o.title}`}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 pt-2.5 border-t border-slate-800/60 text-[11px]">
        <span className="font-mono text-slate-600">{POC_OFFENSES.length} offenses loaded</span>
        <span className="flex items-center gap-1 text-orange-400 font-medium"><AlertTriangle className="h-3 w-3" />{tpCount} True Positive</span>
        <span className="flex items-center gap-1 text-teal-400 font-medium"><CheckCircle2 className="h-3 w-3" />{niCount} Non-Issue</span>
        {selectedOffense?.closeNote && (
          <span className="ml-auto text-slate-600 italic truncate max-w-xs">{selectedOffense.closeNote}</span>
        )}
      </div>
    </div>
  );
};
