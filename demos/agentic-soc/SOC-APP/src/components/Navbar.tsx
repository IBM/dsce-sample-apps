'use client';

import React from 'react';
import { ShieldAlert, RefreshCw, Trash2, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

interface NavbarProps {
  serviceConfigured: boolean;
  running: boolean;
  onRunAll: () => void;
  onClear: () => void;
  statusMessage: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  serviceConfigured, running, onRunAll, onClear, statusMessage,
}) => {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#0d1117] shadow-sm">
      <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100 tracking-tight">SOC</span>
              <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700/50">
                5-Agent
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">Triage · Classification · RCA · Notification · Action</p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-[11px] font-medium text-slate-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${serviceConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${serviceConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            {serviceConfigured ? 'watsonx orchestrate connected' : 'Mock Active'}
          </div>

          <button onClick={onClear} disabled={running} title="Clear cached run data"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Clear</span>
          </button>

          <button onClick={onRunAll} disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {running
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /><span>Running…</span></>
              : <><Zap className="h-3.5 w-3.5" /><span>Run Pipeline</span></>}
          </button>
        </div>
      </div>

      {/* Status sub-bar */}
      <div className="border-t border-slate-800/50 bg-[#0b1120]/80 px-4 py-1.5 text-xs text-slate-400 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            {running ? (
              <RefreshCw className="h-3 w-3 animate-spin text-indigo-400 shrink-0" />
            ) : serviceConfigured ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
            )}
            <span className="truncate font-mono text-[11px] text-slate-300">{statusMessage}</span>
          </div>
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-500 font-mono shrink-0">
            <span>5 Autonomous Agents</span>
            <span>·</span>
            <span>QRadar SIEM</span>
          </div>
        </div>
      </div>
    </header>
  );
};
