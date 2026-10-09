'use client';

import React, { useState } from 'react';
import { StageConfig, StageState } from '@/types';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  FileText,
  Terminal,
  Activity,
  Copy,
  Check,
  Code2,
  ChevronDown,
  Minimize2,
  Maximize2,
} from 'lucide-react';

interface StageCardProps {
  stage: StageConfig;
  index: number;
  stageState: StageState;
  onRunStage: (stageKey: string) => void;
  onPromptChange: (stageKey: string, prompt: string) => void;
  isPipelineRunning: boolean;
  /** When true renders as compact expandable column */
  compact?: boolean;
}

// Accent colour per stage key — 6 distinct colours for 6 stages
function stageAccent(key: string) {
  const accents: Record<string, {
    ring: string; icon: string; btn: string; tab: string; border: string; header: string;
  }> = {
    triage: {
      ring: 'ring-indigo-500/30', icon: 'bg-indigo-500/15 text-indigo-400',
      btn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm',
      tab: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      border: 'border-indigo-500/50 ring-2 ring-indigo-500/20',
      header: 'bg-indigo-500/5 border-b border-indigo-500/15',
    },
    classification: {
      ring: 'ring-violet-500/30', icon: 'bg-violet-500/15 text-violet-400',
      btn: 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm',
      tab: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
      border: 'border-violet-500/50 ring-2 ring-violet-500/20',
      header: 'bg-violet-500/5 border-b border-violet-500/15',
    },
    rca: {
      ring: 'ring-teal-500/30', icon: 'bg-teal-500/15 text-teal-400',
      btn: 'bg-teal-600 hover:bg-teal-500 text-white shadow-sm',
      tab: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      border: 'border-teal-500/50 ring-2 ring-teal-500/20',
      header: 'bg-teal-500/5 border-b border-teal-500/15',
    },
    notification: {
      ring: 'ring-amber-500/30', icon: 'bg-amber-500/15 text-amber-400',
      btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm',
      tab: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      border: 'border-amber-500/50 ring-2 ring-amber-500/20',
      header: 'bg-amber-500/5 border-b border-amber-500/15',
    },
    action: {
      ring: 'ring-rose-500/30', icon: 'bg-rose-500/15 text-rose-400',
      btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm',
      tab: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      border: 'border-rose-500/50 ring-2 ring-rose-500/20',
      header: 'bg-rose-500/5 border-b border-rose-500/15',
    },
    close: {
      ring: 'ring-emerald-500/30', icon: 'bg-emerald-500/15 text-emerald-400',
      btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm',
      tab: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      border: 'border-emerald-500/50 ring-2 ring-emerald-500/20',
      header: 'bg-emerald-500/5 border-b border-emerald-500/15',
    },
  };
  return accents[key] || {
    ring: 'ring-slate-700/60', icon: 'bg-slate-800/60 text-slate-400',
    btn: 'bg-slate-700 hover:bg-slate-600 text-white shadow-sm',
    tab: 'bg-slate-800/60 text-slate-300 border-slate-700/60',
    border: 'border-slate-700/60',
    header: 'bg-slate-900/40 border-b border-slate-800/60',
  };
}

export const StageCard: React.FC<StageCardProps> = ({
  stage,
  index,
  stageState,
  onRunStage,
  onPromptChange,
  isPipelineRunning,
  compact = false,
}) => {
  const [activeTab, setActiveTab] = useState<'output' | 'tools' | 'traces' | 'prompt'>('output');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const run = stageState.run;
  const isLoading = stageState.loading;
  const status = isLoading ? 'running' : run?.status || 'idle';
  const accent = stageAccent(stage.key);

  const formatDuration = (ms?: number | null) => {
    if (typeof ms !== 'number') return '—';
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const extractToolCalls = () => {
    if (!run) return [];
    const toolCallsMap = new Map<string, any>();
    const searchTarget = [
      run?.raw,
      run?.raw?.result,
      run?.raw?.result?.data,
      run?.raw?.result?.data?.message,
      ...(Array.isArray(run?.traces) ? run.traces : []),
    ];
    for (const target of searchTarget) {
      if (!target) continue;
      const stepHistory = target.step_history || target.message?.step_history || (Array.isArray(target) ? target : null);
      if (Array.isArray(stepHistory)) {
        for (const step of stepHistory) {
          const stepDetails = step?.step_details || step?.delta?.step_details || (step?.type ? [step] : null);
          if (!Array.isArray(stepDetails)) continue;
          for (const detail of stepDetails) {
            if (!detail) continue;
            if (detail.type === 'tool_calls' && Array.isArray(detail.tool_calls)) {
              for (const tc of detail.tool_calls) {
                const id = tc.id || tc.tool_call_id || tc.name;
                if (!id) continue;
                if (!toolCallsMap.has(id)) {
                  toolCallsMap.set(id, { id, name: tc.name || 'Tool Call', input: tc.args || tc.input || tc.arguments || null, output: null });
                } else {
                  const ex = toolCallsMap.get(id);
                  if (!ex.input && (tc.args || tc.input)) ex.input = tc.args || tc.input;
                }
              }
            }
            if (detail.type === 'tool_response' && detail.tool_call_id) {
              const id = detail.tool_call_id;
              let contentParsed = detail.content;
              try {
                if (typeof detail.content === 'string' && (detail.content.startsWith('{') || detail.content.startsWith('[')))
                  contentParsed = JSON.parse(detail.content);
              } catch { contentParsed = detail.content; }
              if (!toolCallsMap.has(id)) {
                toolCallsMap.set(id, { id, name: detail.name || 'Tool Call', input: null, output: contentParsed });
              } else {
                const ex = toolCallsMap.get(id);
                ex.output = contentParsed;
                if (detail.name && ex.name === 'Tool Call') ex.name = detail.name;
              }
            }
            if (detail.type === 'tool_call' && detail.tool_call_id) {
              const id = detail.tool_call_id;
              if (!toolCallsMap.has(id)) {
                toolCallsMap.set(id, { id, name: detail.name || 'Tool Call', input: detail.args || detail.input || null, output: null });
              } else {
                const ex = toolCallsMap.get(id);
                if (!ex.input && detail.args) ex.input = detail.args;
              }
            }
          }
        }
      }
    }
    return Array.from(toolCallsMap.values());
  };

  const toolCalls = extractToolCalls();

  const statusBadges = {
    idle:      { label: 'Standby',    color: 'bg-slate-800/60 text-slate-400 border-slate-700/60',                      icon: Clock },
    running:   { label: 'Executing…', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 animate-pulse',     icon: Activity },
    completed: { label: 'Completed',  color: 'bg-teal-500/15 text-teal-300 border-teal-500/30',                          icon: CheckCircle2 },
    failed:    { label: 'Failed',     color: 'bg-red-500/15 text-red-400 border-red-500/30',                             icon: AlertCircle },
  };

  const currentBadge = statusBadges[status as keyof typeof statusBadges] || statusBadges.idle;
  const BadgeIcon = currentBadge.icon;
  const tabActiveClass = accent.tab;

  // ─── COMPACT COLUMN MODE ────────────────────────────────────────────────────
  if (compact) {
    const borderColor = isLoading
      ? 'border-violet-500/50 ring-1 ring-violet-500/30'
      : status === 'completed'
      ? 'border-emerald-500/40'
      : status === 'failed'
      ? 'border-red-900/50'
      : 'border-slate-800/80';

    return (
      <div
        className={`relative flex flex-col rounded-xl border transition-all duration-300 bg-slate-900/60 backdrop-blur-sm shadow-sm shrink-0 ${borderColor} ${
          expanded ? 'w-[620px]' : 'w-[200px]'
        }`}
        style={{ transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)' }}
      >
        {/* Compact header */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-col gap-2 p-3 text-left w-full focus:outline-none group"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-slate-500">Stage 0{index + 1}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${accent.icon} font-mono text-[10px] font-semibold ring-1 ${accent.ring}`}>
              {index + 1}
            </div>
            <span className="text-xs font-semibold text-slate-100 leading-tight">{stage.label}</span>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium w-fit ${currentBadge.color}`}>
            <BadgeIcon className={`h-2.5 w-2.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{currentBadge.label}</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {run?.analytics?.durationMs ? `${(run.analytics.durationMs / 1000).toFixed(1)}s` : '—'}
          </span>
        </button>

        {/* Run button */}
        <div className="px-3 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); onRunStage(stage.key); }}
            disabled={isLoading || isPipelineRunning}
            className={`w-full inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 ${accent.btn}`}
          >
            <Play className="h-2.5 w-2.5 fill-current" />
            <span>Run</span>
          </button>
        </div>

        {/* Expanded panel */}
        {expanded && (
          <div className="border-t border-slate-800/80 overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <p className="text-[11px] text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50 leading-relaxed">
                {stage.instruction}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-slate-950/60 px-4 py-2 border-y border-slate-800/80 text-[10px] font-mono">
              <div><span className="text-[9px] uppercase text-slate-500 block">Thread ID</span><span className="text-slate-300 truncate block">{run?.threadId || '—'}</span></div>
              <div><span className="text-[9px] uppercase text-slate-500 block">Run ID</span><span className="text-slate-300 truncate block">{run?.runId || '—'}</span></div>
              <div><span className="text-[9px] uppercase text-slate-500 block">Duration</span><span className="text-slate-300 block">{formatDuration(run?.analytics?.durationMs)}</span></div>
              <div><span className="text-[9px] uppercase text-slate-500 block">Tools / Traces</span><span className="text-slate-300 block">{toolCalls.length} / {run?.analytics?.traceCount ?? 0}</span></div>
            </div>
            <div className="p-3">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 mb-2 gap-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {(['output', 'tools', 'traces', 'prompt'] as const).map((tab) => {
                    const icons = { output: FileText, tools: Wrench, traces: Terminal, prompt: Code2 };
                    const labels = { output: 'Output', tools: `Tools (${toolCalls.length})`, traces: `Traces (${run?.traces?.length || 0})`, prompt: 'Prompt' };
                    const TabIcon = icons[tab];
                    return (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${activeTab === tab ? tabActiveClass : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                      >
                        <TabIcon className="h-3 w-3" />
                        <span>{labels[tab]}</span>
                      </button>
                    );
                  })}
                </div>
                {activeTab === 'output' && run?.outputText && (
                  <button onClick={() => handleCopy(run.outputText)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors">
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="min-h-[120px] max-h-[360px] rounded-lg bg-slate-950/80 border border-slate-800/80 p-3 font-mono text-xs text-slate-200 overflow-auto">
                {activeTab === 'output' && (
                  isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-2">
                      <Activity className="h-5 w-5 animate-spin text-violet-400" />
                      <p className="text-[11px]">Processing…</p>
                    </div>
                  ) : run?.outputText ? (
                    <pre className="whitespace-pre-wrap leading-relaxed text-slate-200 font-sans text-[11px]">{run.outputText}</pre>
                  ) : (
                    <p className="text-slate-500 italic py-6 text-center font-sans text-[11px]">Not executed yet.</p>
                  )
                )}
                {activeTab === 'tools' && (
                  isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-2">
                      <Activity className="h-5 w-5 animate-spin text-violet-400" />
                      <p className="text-[11px]">Capturing tool calls…</p>
                    </div>
                  ) : toolCalls.length > 0 ? (
                    <div className="space-y-3 font-sans">
                      {toolCalls.map((tc, idx) => (
                        <div key={tc.id || idx} className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 space-y-2 font-mono">
                          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                              <span className="font-semibold text-violet-300">{tc.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">#{idx + 1}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Arguments</span>
                            <pre className="rounded bg-slate-950 p-2 text-[10px] text-slate-300 leading-tight whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {tc.input ? (typeof tc.input === 'object' ? JSON.stringify(tc.input, null, 2) : tc.input) : 'No arguments'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-emerald-400 block mb-1">Response</span>
                            <pre className="rounded bg-slate-950 p-2 text-[10px] text-emerald-300/90 leading-tight whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {tc.output ? (typeof tc.output === 'object' ? JSON.stringify(tc.output, null, 2) : tc.output) : 'Completed'}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px] font-sans py-6 text-center">No tool calls captured.</p>
                  )
                )}
                {activeTab === 'traces' && (
                  run?.traces && run.traces.length > 0 ? (
                    <pre className="whitespace-pre-wrap text-[10px] text-violet-300/90 leading-tight">{JSON.stringify(run.traces, null, 2)}</pre>
                  ) : (
                    <p className="text-slate-500 italic py-6 text-center font-sans text-[11px]">No traces captured.</p>
                  )
                )}
                {activeTab === 'prompt' && (
                  <div className="space-y-2 font-sans">
                    <label className="text-[11px] text-slate-400 font-medium block">Override Prompt</label>
                    <textarea value={stageState.prompt || ''} onChange={(e) => onPromptChange(stage.key, e.target.value)} rows={4}
                      placeholder={`Custom instructions for ${stage.label}…`}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 text-[11px] text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <p className="text-[10px] text-slate-500">Leave blank to use global prompt + previous stage outputs.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── FULL CARD MODE ─────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <div className={`rounded-xl border bg-[#0a0c16] shadow-sm transition-all duration-300 ${
          isLoading ? accent.border : status === 'completed' ? 'border-teal-500/40' : status === 'failed' ? 'border-red-500/30' : 'border-slate-800/60'
        }`}>
        {/* Header */}
        <div className={`flex flex-col gap-3 p-4 sm:p-5 ${accent.header}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent.icon} font-mono text-xs font-bold ring-1 ${accent.ring}`}>
                0{index + 1}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">{stage.label} Agent</h3>
                <p className="text-xs font-mono text-slate-500 mt-0.5 truncate max-w-xs sm:max-w-md">ID: {stage.agentId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${currentBadge.color}`}>
                <BadgeIcon className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{currentBadge.label}</span>
              </span>
              <button onClick={() => onRunStage(stage.key)} disabled={isLoading || isPipelineRunning}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 focus:outline-none ${accent.btn}`}>
                <Play className="h-3 w-3 fill-current" />
                <span>Run Stage</span>
              </button>
              <button onClick={() => setMinimized((v) => !v)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors"
                title={minimized ? 'Expand card' : 'Minimize card'}>
                {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {!minimized && (
            <p className="text-xs text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed">{stage.instruction}</p>
          )}
        </div>

        {/* Body */}
        {!minimized && (
          <>
            {/* Telemetry Row */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/40 px-4 py-2.5 border-b border-slate-800/60 sm:grid-cols-4 text-xs font-mono">
              <div><span className="text-[10px] uppercase text-slate-600 block">Thread ID</span><span className="text-slate-300 truncate block">{run?.threadId || '—'}</span></div>
              <div><span className="text-[10px] uppercase text-slate-600 block">Run ID</span><span className="text-slate-300 truncate block">{run?.runId || '—'}</span></div>
              <div><span className="text-[10px] uppercase text-slate-600 block">Duration</span><span className="text-slate-300 block">{formatDuration(run?.analytics?.durationMs)}</span></div>
              <div><span className="text-[10px] uppercase text-slate-600 block">Tools / Traces</span><span className="text-slate-300 block">{toolCalls.length} / {run?.analytics?.traceCount ?? 0}</span></div>
            </div>

            {/* Tabs */}
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800/60 pb-2 mb-3 gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { id: 'output', icon: FileText, label: 'Agent Output' },
                    { id: 'tools', icon: Wrench, label: `Tool Calls (${toolCalls.length})` },
                    { id: 'traces', icon: Terminal, label: `Traces (${run?.traces?.length || 0})` },
                    { id: 'prompt', icon: Code2, label: 'Override Prompt' },
                  ].map(({ id, icon: Icon, label }) => (
                    <button key={id} onClick={() => setActiveTab(id as any)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${activeTab === id ? tabActiveClass : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                {activeTab === 'output' && run?.outputText && (
                  <button onClick={() => handleCopy(run.outputText)} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              <div className="min-h-[140px] rounded-lg bg-slate-950/60 border border-slate-800/60 p-3.5 font-mono text-xs text-slate-300 overflow-x-auto">
                {activeTab === 'output' && (
                  isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-2">
                      <Activity className="h-5 w-5 animate-spin text-indigo-400" />
                      <p className="text-xs">watsonx Orchestrate agent processing request…</p>
                    </div>
                  ) : run?.outputText ? (
                    <pre className="whitespace-pre-wrap leading-relaxed text-slate-200 font-sans text-xs">{run.outputText}</pre>
                  ) : (
                    <p className="text-slate-500 italic py-6 text-center font-sans">Stage has not been executed yet.</p>
                  )
                )}
                {activeTab === 'tools' && (
                  isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-2">
                      <Activity className="h-5 w-5 animate-spin text-indigo-400" />
                      <p className="text-xs">Capturing tool calls…</p>
                    </div>
                  ) : toolCalls.length > 0 ? (
                    <div className="space-y-3 font-sans">
                      {toolCalls.map((tc, idx) => (
                        <div key={tc.id || idx} className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 space-y-2 font-mono">
                          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                              <span className="font-semibold text-indigo-300">{tc.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">#{idx + 1}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">Arguments</span>
                            <pre className="rounded bg-slate-950 p-2 text-[11px] text-slate-300 leading-tight whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {tc.input ? (typeof tc.input === 'object' ? JSON.stringify(tc.input, null, 2) : tc.input) : 'No arguments required'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-teal-400 block mb-1">Response</span>
                            <pre className="rounded bg-slate-950 p-2 text-[11px] text-teal-300/90 leading-tight whitespace-pre-wrap max-h-60 overflow-y-auto">
                              {tc.output ? (typeof tc.output === 'object' ? JSON.stringify(tc.output, null, 2) : tc.output) : 'Execution completed'}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs font-sans py-6 text-center">No tool calls captured.</p>
                  )
                )}
                {activeTab === 'traces' && (
                  run?.traces && run.traces.length > 0 ? (
                    <pre className="whitespace-pre-wrap text-[11px] text-indigo-400/90 leading-tight">{JSON.stringify(run.traces, null, 2)}</pre>
                  ) : (
                    <p className="text-slate-500 italic py-6 text-center font-sans">No trace payloads captured.</p>
                  )
                )}
                {activeTab === 'prompt' && (
                  <div className="space-y-2 font-sans">
                    <label className="text-xs text-slate-400 font-medium block">Stage Override Prompt (Optional)</label>
                    <textarea value={stageState.prompt || ''} onChange={(e) => onPromptChange(stage.key, e.target.value)} rows={4}
                      placeholder={`Provide custom instructions for the ${stage.label} agent…`}
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <p className="text-[11px] text-slate-500">If left blank, global prompt and previous stage outputs are passed automatically.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
