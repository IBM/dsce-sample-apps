'use client';

import React from 'react';
import { StageConfig, StageState, PocOffense } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Clock, Wrench, FileCode, CheckCircle2, ShieldAlert, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { POC_OFFENSES } from '@/data/sampleOffenses';

interface AnalyticsVisualizerProps {
  stages: StageConfig[];
  runs: Record<string, StageState>;
  selectedOffenseId?: string;
  open?: boolean;
  onToggle?: () => void;
}

function countUniqueToolCalls(stageState?: StageState): number {
  const run = stageState?.run;
  if (!run) return 0;
  const toolCallsMap = new Map<string, boolean>();
  const searchTarget = [
    run?.raw, run?.raw?.result, run?.raw?.result?.data, run?.raw?.result?.data?.message,
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
              if (id) toolCallsMap.set(id, true);
            }
          }
          if ((detail.type === 'tool_response' || detail.type === 'tool_call') && detail.tool_call_id) {
            toolCallsMap.set(detail.tool_call_id, true);
          }
        }
      }
    }
  }
  return toolCallsMap.size;
}

// Per-stage colors mapping
const STAGE_COLORS: Record<string, string> = {
  triage:         '#6366f1',
  classification: '#8b5cf6',
  rca:            '#14b8a6',
  notification:   '#f59e0b',
  action:         '#f43f5e',
  close:          '#10b981',
};
const FALLBACK_COLORS = ['#6366f1', '#8b5cf6', '#14b8a6', '#f59e0b', '#f43f5e', '#10b981'];

export const AnalyticsVisualizer: React.FC<AnalyticsVisualizerProps> = ({
  stages, runs, selectedOffenseId, open = true, onToggle,
}) => {
  const chartData = stages.map((stage) => {
    const stageState = runs[stage.key];
    const run = stageState?.run;
    const durationMs = run?.analytics?.durationMs || 0;
    const toolCalls = countUniqueToolCalls(stageState);
    const traceCount = run?.analytics?.traceCount || 0;
    return {
      name: stage.label,
      key: stage.key,
      durationSec: Number((durationMs / 1000).toFixed(2)),
      toolCalls,
      traceCount,
      status: run?.status || 'idle',
    };
  });

  const totalDurationMs = Object.values(runs).reduce((acc, s) => acc + (s.run?.analytics?.durationMs || 0), 0);
  const totalToolCalls = chartData.reduce((acc, d) => acc + d.toolCalls, 0);
  const totalTraces = Object.values(runs).reduce((acc, s) => acc + (s.run?.analytics?.traceCount || 0), 0);
  const completedCount = Object.values(runs).filter((s) => s.run?.status === 'completed').length;

  const selectedOffense = selectedOffenseId ? POC_OFFENSES.find((o) => o.id === selectedOffenseId) : undefined;
  const toolDistributionData = chartData.filter((d) => d.toolCalls > 0);

  return (
    <div className="rounded-xl border border-slate-800/60 bg-[#080a12] overflow-hidden space-y-0">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 ${onToggle ? 'cursor-pointer select-none' : ''}`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 ring-1 ring-indigo-500/25">
            <ShieldAlert className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
            Pipeline Analytics <span className="text-indigo-200/50 font-normal">& Agent Telemetry</span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-indigo-200/50">watsonx Orchestrate</span>
          {onToggle && (
            <button className="flex items-center justify-center h-6 w-6 rounded-md text-indigo-300 hover:text-white transition-colors">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="p-5 space-y-5">
          {/* Expected outcome banner */}
          {selectedOffense && (
            <div className={`flex items-center gap-3 rounded-lg border p-3 text-xs ${
              selectedOffense.expectedOutcome === 'True Positive'
                ? 'border-orange-500/25 bg-orange-500/5 text-orange-300'
                : 'border-cyan-500/25 bg-cyan-500/5 text-cyan-300'
            }`}>
              {selectedOffense.expectedOutcome === 'True Positive' ? (
                <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-cyan-400 shrink-0" />
              )}
              <div>
                <span className="font-semibold">[{selectedOffense.module}] Offense #{selectedOffense.id}</span>
                {' — '}Expected: <span className="font-bold">{selectedOffense.expectedOutcome}</span>
                {selectedOffense.closeNote && <span className="ml-2 text-slate-500 italic">{selectedOffense.closeNote}</span>}
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-800/50 bg-[#0a0c16] p-3.5">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-400">Total Execution Time</span>
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div className="text-lg font-bold text-white font-mono">
                {totalDurationMs > 0 ? `${(totalDurationMs / 1000).toFixed(1)}s` : '—'}
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">All stages combined</p>
            </div>

            <div className="rounded-lg border border-slate-800/50 bg-[#0a0c16] p-3.5">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-400">Tool Invocations</span>
                <Wrench className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div className="text-lg font-bold text-white font-mono">{totalToolCalls || '—'}</div>
              <p className="text-[10px] text-slate-600 mt-0.5">QRadar & enrichment</p>
            </div>

            <div className="rounded-lg border border-slate-800/50 bg-[#0a0c16] p-3.5">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-400">Traces Captured</span>
                <FileCode className="h-3.5 w-3.5 text-cyan-400" />
              </div>
              <div className="text-lg font-bold text-white font-mono">{totalTraces || '—'}</div>
              <p className="text-[10px] text-slate-600 mt-0.5">Audit telemetry events</p>
            </div>

            <div className="rounded-lg border border-slate-800/50 bg-[#0a0c16] p-3.5">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-400">Stages Completed</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
              </div>
              <div className="text-lg font-bold text-white font-mono">{completedCount} / {stages.length}</div>
              <p className="text-[10px] text-slate-600 mt-0.5">Pipeline progress</p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Duration Bar Chart */}
            <div className="lg:col-span-2 rounded-lg border border-slate-800/50 bg-[#0a0c16] p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                Execution Duration per Stage (s)
              </h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0c16', borderColor: '#1e2a3a', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} itemStyle={{ color: '#67e8f9' }} labelStyle={{ color: '#f1f5f9', fontWeight: 600 }} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                    <Bar dataKey="durationSec" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.status === 'completed' ? (STAGE_COLORS[entry.key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]) : '#1a1f2e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tool Call Distribution Pie */}
            <div className="rounded-lg border border-slate-800/50 bg-[#0a0c16] p-4 flex flex-col justify-between">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Tool Call Distribution
              </h3>
              {toolDistributionData.length > 0 ? (
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={toolDistributionData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="toolCalls">
                        {toolDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STAGE_COLORS[entry.key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0a0c16', borderColor: '#1e2a3a', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} itemStyle={{ color: '#67e8f9' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-xs text-slate-500 py-8">No tool invocation telemetry yet</div>
              )}
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 mt-2">
                {chartData.map((item, idx) => (
                  <span key={item.key} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: STAGE_COLORS[item.key] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length] }} />
                    {item.name}: {item.toolCalls}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
