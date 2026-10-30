'use client';

import React from 'react';
import {
  ShieldAlert,
  RefreshCw,
  Trash2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Radio,
} from 'lucide-react';

interface NavbarProps {
  mockMode: boolean;
  onToggleMockMode: (nextMode?: boolean) => void;
  serviceConfigured: boolean;
  running: boolean;
  onRunAll: () => void;
  onClear: () => void;
  statusMessage: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  mockMode,
  onToggleMockMode,
  serviceConfigured,
  running,
  onRunAll,
  onClear,
  statusMessage,
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
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                  mockMode
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                }`}
              >
                {mockMode ? <Sparkles className="h-2.5 w-2.5" /> : <Radio className="h-2.5 w-2.5" />}
                {mockMode ? 'SIMULATION' : 'LIVE WXO'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Triage · Classification · RCA · Notification · Action
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Segmented Mode Switch: Mock Mode vs Live WxO */}
          <div className="flex items-center rounded-lg border border-slate-700/80 bg-slate-900/90 p-0.5 text-xs">
            <button
              onClick={() => onToggleMockMode(true)}
              disabled={running}
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                mockMode
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              } disabled:opacity-50`}
              title="Activate Mock Mode (Self-contained simulation with authentic telemetry)"
            >
              <Sparkles className="h-3 w-3" />
              <span>Mock Mode</span>
            </button>
            <button
              onClick={() => onToggleMockMode(false)}
              disabled={running}
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                !mockMode
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              } disabled:opacity-50`}
              title={
                serviceConfigured
                  ? 'Activate Live watsonx Orchestrate endpoint execution'
                  : 'Live mode (Watsonx credentials not detected in .env)'
              }
            >
              <Radio className="h-3 w-3" />
              <span>Live WxO</span>
            </button>
          </div>

          {/* Connection Status Pill */}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-[11px] font-medium text-slate-400">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                  mockMode
                    ? 'bg-emerald-400'
                    : serviceConfigured
                    ? 'bg-blue-400'
                    : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  mockMode
                    ? 'bg-emerald-500'
                    : serviceConfigured
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
                }`}
              />
            </span>
            {mockMode
              ? 'Simulation Engine'
              : serviceConfigured
              ? 'WxO Connected'
              : 'WxO Disconnected'}
          </div>

          {/* Clear Button */}
          <button
            onClick={onClear}
            disabled={running}
            title="Clear cached run data"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Clear</span>
          </button>

          {/* Run Pipeline Button */}
          <button
            onClick={onRunAll}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {running ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Running…</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                <span>Run Pipeline</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status sub-bar */}
      <div className="border-t border-slate-800/50 bg-[#0b1120]/80 px-4 py-1.5 text-xs text-slate-400 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            {running ? (
              <RefreshCw className="h-3 w-3 animate-spin text-indigo-400 shrink-0" />
            ) : mockMode ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
            ) : serviceConfigured ? (
              <CheckCircle2 className="h-3 w-3 text-blue-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
            )}
            <span className="truncate font-mono text-[11px] text-slate-300">
              {statusMessage}
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-500 font-mono shrink-0">
            <span>5 Autonomous Agents</span>
            <span>·</span>
            <span>QRadar SIEM</span>
            {mockMode && (
              <>
                <span>·</span>
                <span className="text-emerald-400 font-semibold">Simulation Engine</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
