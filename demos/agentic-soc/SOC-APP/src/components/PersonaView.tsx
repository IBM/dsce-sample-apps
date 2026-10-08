'use client';

import React from 'react';
import { StageConfig, StageState } from '@/types';
import {
  User,
  ShieldCheck,
  BarChart2,
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

interface PersonaViewProps {
  stages: StageConfig[];
  runs: Record<string, StageState>;
  open?: boolean;
  onToggle?: () => void;
}

// ── Per-stage keys each persona "owns" ────────────────────────────────────────
const PERSONA_STAGES = {
  l1:   ['triage'],
  l2:   ['classification', 'rca'],
  ciso: ['notification', 'action'],
} as const;

type PersonaKey = keyof typeof PERSONA_STAGES;

// ── Status helpers ─────────────────────────────────────────────────────────────
function stageStatus(key: string, runs: Record<string, StageState>): 'idle' | 'running' | 'completed' | 'failed' {
  const s = runs[key];
  if (!s) return 'idle';
  if (s.loading) return 'running';
  if (s.run?.status === 'completed') return 'completed';
  if (s.error || s.run?.status === 'failed') return 'failed';
  return 'idle';
}

function personaOverallStatus(stageKeys: readonly string[], runs: Record<string, StageState>): 'idle' | 'running' | 'completed' | 'failed' | 'waiting' {
  const statuses = stageKeys.map((k) => stageStatus(k, runs));
  if (statuses.some((s) => s === 'running')) return 'running';
  if (statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.some((s) => s === 'failed')) return 'failed';
  if (statuses.some((s) => s === 'completed')) return 'running'; // partially done
  return 'idle';
}

// ── Stage accent colours ───────────────────────────────────────────────────────
const ACCENT: Record<string, { dot: string; bar: string; text: string; bg: string; border: string }> = {
  triage:         { dot: 'bg-indigo-400',  bar: 'bg-indigo-500',  text: 'text-indigo-300',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30'  },
  classification: { dot: 'bg-violet-400',  bar: 'bg-violet-500',  text: 'text-violet-300',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30'  },
  rca:            { dot: 'bg-teal-400',    bar: 'bg-teal-500',    text: 'text-teal-300',    bg: 'bg-teal-500/10',    border: 'border-teal-500/30'    },
  notification:   { dot: 'bg-amber-400',   bar: 'bg-amber-500',   text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  action:         { dot: 'bg-rose-400',    bar: 'bg-rose-500',    text: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30'    },
};

// ── What each persona sees per stage ──────────────────────────────────────────
const PERSONA_STAGE_LABEL: Record<string, Record<string, string>> = {
  l1: {
    triage: 'Offense scored & ServiceNow ticket opened automatically',
  },
  l2: {
    classification: 'Verdict determined — TP / FP / BP with evidence',
    rca:            'Full root cause report with MITRE ATT&CK mapping',
  },
  ciso: {
    notification: 'Incident report dispatched to stakeholders',
    action:       'Remediation executed — IP blocked, firewall updated',
  },
};

const PERSONA_IDLE_LABEL: Record<string, Record<string, string>> = {
  l1: {
    triage: 'Waiting for offense input…',
  },
  l2: {
    classification: 'Waiting for Triage to complete…',
    rca:            'Waiting for Classification verdict…',
  },
  ciso: {
    notification: 'Waiting for RCA report…',
    action:       'Waiting for RCA + Classification…',
  },
};

// ── Stage mini row ─────────────────────────────────────────────────────────────
function StageMiniRow({
  stageKey,
  personaKey,
  runs,
  stages,
}: {
  stageKey: string;
  personaKey: PersonaKey;
  runs: Record<string, StageState>;
  stages: StageConfig[];
}) {
  const status   = stageStatus(stageKey, runs);
  const stageObj = stages.find((s) => s.key === stageKey);
  const ac       = ACCENT[stageKey] ?? ACCENT['triage'];
  const run      = runs[stageKey]?.run;
  const dur      = run?.analytics?.durationMs;

  const label =
    status === 'completed'
      ? PERSONA_STAGE_LABEL[personaKey]?.[stageKey] ?? `${stageObj?.label} completed`
      : status === 'running'
      ? `${stageObj?.label} agent processing…`
      : status === 'failed'
      ? `${stageObj?.label} — error`
      : PERSONA_IDLE_LABEL[personaKey]?.[stageKey] ?? `Waiting for ${stageObj?.label}…`;

  return (
    <div className={`rounded-lg border p-3 transition-all duration-300 ${
      status === 'completed' ? `${ac.bg} ${ac.border}` :
      status === 'running'   ? 'bg-indigo-500/5 border-indigo-500/20' :
      status === 'failed'    ? 'bg-red-500/10 border-red-500/30' :
                               'bg-slate-900/40 border-slate-800/60'
    }`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          {/* status dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            {status === 'running' && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${ac.dot}`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${
              status === 'completed' ? ac.dot :
              status === 'running'   ? ac.dot :
              status === 'failed'    ? 'bg-red-400' :
                                       'bg-slate-600'
            }`} />
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${
            status === 'completed' ? ac.text :
            status === 'running'   ? 'text-indigo-300' :
            status === 'failed'    ? 'text-red-400' :
                                     'text-slate-500'
          }`}>{stageObj?.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {dur && <span className="text-[10px] font-mono text-slate-500">{(dur / 1000).toFixed(1)}s</span>}
          {status === 'completed' && <CheckCircle2 className="h-3 w-3 text-teal-400 shrink-0" />}
          {status === 'running'   && <Zap className="h-3 w-3 text-indigo-400 animate-pulse shrink-0" />}
          {status === 'failed'    && <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
          {status === 'idle'      && <Clock className="h-3 w-3 text-slate-600 shrink-0" />}
        </div>
      </div>
      <p className={`text-[11px] leading-relaxed ${
        status === 'completed' ? 'text-slate-300' :
        status === 'running'   ? 'text-slate-400 animate-pulse' :
        status === 'failed'    ? 'text-red-400' :
                                 'text-slate-600 italic'
      }`}>{label}</p>

      {/* Short output preview for completed stages */}
      {status === 'completed' && run?.outputText && (
        <div className={`mt-2 rounded border p-2 text-[10px] font-mono leading-relaxed line-clamp-3 overflow-hidden ${ac.bg} ${ac.border} ${ac.text}`}>
          {run.outputText.slice(0, 220).replace(/\n/g, ' · ') + (run.outputText.length > 220 ? '…' : '')}
        </div>
      )}
    </div>
  );
}

// ── Persona card ────────────────────────────────────────────────────────────────
interface PersonaCardProps {
  personaKey: PersonaKey;
  title: string;
  role: string;
  icon: React.ElementType;
  headerColor: string;
  borderColor: string;
  benefit: string;
  stageKeys: readonly string[];
  runs: Record<string, StageState>;
  stages: StageConfig[];
}

function PersonaCard({
  personaKey, title, role, icon: Icon,
  headerColor, borderColor, benefit,
  stageKeys, runs, stages,
}: PersonaCardProps) {
  const overall = personaOverallStatus(stageKeys, runs);

  const completedCount = stageKeys.filter((k) => stageStatus(k, runs) === 'completed').length;
  const totalToolCalls = stageKeys.reduce((acc, k) => {
    const s = runs[k];
    if (!s?.run) return acc;
    // count tool calls from analytics or traces length as proxy
    return acc + (s.run.analytics?.traceCount || 0);
  }, 0);

  return (
    <div className={`flex flex-col rounded-xl border bg-[#0a0c16] overflow-hidden transition-all duration-500 ${
      overall === 'completed' ? borderColor :
      overall === 'running'   ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' :
      overall === 'failed'    ? 'border-red-500/30' :
                                'border-slate-800/60'
    }`}>
      {/* Card header */}
      <div className={`${headerColor} px-4 py-3 flex items-start justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white tracking-wide">{title}</p>
            <p className="text-[11px] text-white/70">{role}</p>
          </div>
        </div>
        <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
          overall === 'completed' ? 'border-teal-500/40 bg-teal-500/15 text-teal-300' :
          overall === 'running'   ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300 animate-pulse' :
          overall === 'failed'    ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                                    'border-slate-700/50 bg-slate-800/50 text-slate-400'
        }`}>
          {overall === 'completed' ? '✓ Done' :
           overall === 'running'   ? '⚡ Active' :
           overall === 'failed'    ? '✗ Error' :
                                     '⏸ Waiting'}
        </span>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-px bg-slate-800/40 border-b border-slate-800/60 text-[10px] font-mono">
        <div className="bg-[#0a0c16] px-3 py-2">
          <span className="text-slate-600 block uppercase text-[9px] tracking-wider mb-0.5">Stages</span>
          <span className="text-slate-300 font-semibold">{completedCount} / {stageKeys.length} done</span>
        </div>
        <div className="bg-[#0a0c16] px-3 py-2">
          <span className="text-slate-600 block uppercase text-[9px] tracking-wider mb-0.5">Traces</span>
          <span className="text-slate-300 font-semibold">{totalToolCalls > 0 ? totalToolCalls : '—'}</span>
        </div>
      </div>

      {/* Stage rows */}
      <div className="p-3 space-y-2.5 flex-1">
        {stageKeys.map((k) => (
          <StageMiniRow
            key={k}
            stageKey={k}
            personaKey={personaKey}
            runs={runs}
            stages={stages}
          />
        ))}
      </div>

      {/* What this means for the persona */}
      <div className="px-4 py-3 border-t border-slate-800/60 bg-slate-900/30">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <span className="text-slate-300 font-semibold">Impact: </span>{benefit}
        </p>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export const PersonaView: React.FC<PersonaViewProps> = ({
  stages, runs, open = true, onToggle,
}) => {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-[#080a12] overflow-hidden">
      {/* Section header */}
      <div
        className={`flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 ${onToggle ? 'cursor-pointer select-none' : ''}`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 ring-1 ring-indigo-500/25">
            <User className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
            Persona View
            <span className="ml-2 text-indigo-200/50 font-normal">— What each role sees, in parallel</span>
          </h2>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono text-indigo-200/50 hidden sm:block">3 roles · live</span>
          {onToggle && (
            <button className="flex items-center justify-center h-6 w-6 rounded-md text-indigo-300 hover:text-white transition-colors">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="p-5 space-y-4">
          {/* Explainer strip */}
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs text-indigo-200/80 leading-relaxed">
            Each column shows what a different SOC persona experiences <strong className="text-white">as the pipeline runs</strong> — in real time.
            Agents work autonomously; personas receive results automatically without any manual hand-off.
          </div>

          {/* Three persona columns — side by side */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* L1 Analyst */}
            <PersonaCard
              personaKey="l1"
              title="Tier-1 Analyst"
              role="L1 Responder"
              icon={User}
              headerColor="bg-gradient-to-br from-blue-700/80 to-blue-800/70"
              borderColor="border-blue-500/40"
              benefit="No more raw queue triage. Every offense arrives pre-scored and pre-enriched. Only reviews what needs a human call."
              stageKeys={PERSONA_STAGES.l1}
              runs={runs}
              stages={stages}
            />

            {/* L2/L3 Analyst */}
            <PersonaCard
              personaKey="l2"
              title="Tier-2 / Tier-3 Analyst"
              role="Investigator"
              icon={ShieldCheck}
              headerColor="bg-gradient-to-br from-violet-700/80 to-violet-800/70"
              borderColor="border-violet-500/40"
              benefit="Only sees the 20–30% that are real threats — each with a complete RCA brief, MITRE mapping, and evidence chain ready."
              stageKeys={PERSONA_STAGES.l2}
              runs={runs}
              stages={stages}
            />

            {/* CISO */}
            <PersonaCard
              personaKey="ciso"
              title="SOC Manager / CISO"
              role="Decision Maker"
              icon={BarChart2}
              headerColor="bg-gradient-to-br from-emerald-700/80 to-emerald-800/70"
              borderColor="border-emerald-500/40"
              benefit="100% coverage, consistent standards, automatic audit trail. Every remediation gated, logged, and defensible."
              stageKeys={PERSONA_STAGES.ciso}
              runs={runs}
              stages={stages}
            />

          </div>

          {/* Parallel execution callout */}
          <div className="flex items-start gap-3 rounded-lg border border-slate-800/60 bg-slate-900/30 px-4 py-3 text-xs text-slate-400 leading-relaxed">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-300">How this works:</strong> Each agent fires automatically as its upstream stage completes —
              Triage → Classification → RCA → Notification → Action. From the personas' perspective, results arrive in parallel
              without any manual hand-off or ticket routing. Watsonx Orchestrate is the control plane that makes this happen.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
