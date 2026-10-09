'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

type StageStatus = 'idle' | 'running' | 'completed' | 'failed';

interface PipelineFlowProps {
  stageStatuses: Record<string, StageStatus>;
}

const statusRing: Record<string, string> = {
  idle:      '',
  running:   'ring-2 ring-inset ring-indigo-500/30',
  completed: 'ring-2 ring-inset ring-teal-500/30',
  failed:    'ring-2 ring-inset ring-red-500/30',
};
const statusDot: Record<string, string> = {
  idle:      'bg-slate-500',
  running:   'bg-indigo-400 animate-ping',
  completed: 'bg-teal-400',
  failed:    'bg-red-400',
};
const statusText: Record<string, string> = {
  idle:      '',
  running:   'text-indigo-300',
  completed: 'text-teal-300',
  failed:    'text-red-300',
};

interface PipelineNodeProps {
  num: string;
  label: string;
  description: string[];
  toolsLabel?: string;
  status: StageStatus;
  colorClasses: { border: string; bg: string; text: string; dot: string; badge?: string };
}

function PipelineNode({ num, label, description, toolsLabel, status, colorClasses }: PipelineNodeProps) {
  const dotClass = status !== 'idle' ? statusDot[status] : colorClasses.dot;

  return (
    <div className={`flex flex-col items-center gap-3 rounded-xl border px-4 py-5 shrink-0 flex-1 min-w-[140px] ${colorClasses.border} ${colorClasses.bg} ${statusRing[status]}`}>
      <div className="flex items-center gap-2 w-full justify-center">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${dotClass}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotClass.replace(' animate-ping', '')}`} />
        </span>
        <span className={`text-sm font-bold ${status === 'idle' ? colorClasses.text : statusText[status] || colorClasses.text}`}>
          {label}
        </span>
        <span className={`text-[11px] font-mono ml-auto opacity-60 ${colorClasses.text}`}>{num}</span>
      </div>
      <div className={`text-xs text-center space-y-1 leading-relaxed w-full opacity-80 ${colorClasses.text}`}>
        {description.map((d, i) => <div key={i}>{d}</div>)}
      </div>
      {toolsLabel && (
        <span className={`text-xs font-mono border rounded px-2 py-0.5 opacity-90 ${colorClasses.text} ${colorClasses.badge || colorClasses.border}`}>
          {toolsLabel}
        </span>
      )}
    </div>
  );
}

function Arrow({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center shrink-0 px-1">
      <div className="flex items-center gap-1">
        <div className={`h-px w-5 bg-gradient-to-r ${from} ${to}`} />
        <ArrowRight className="h-4 w-4 text-slate-400/70" />
      </div>
    </div>
  );
}

export const PipelineFlow: React.FC<PipelineFlowProps> = ({ stageStatuses }) => {
  const s = (key: string): StageStatus => stageStatuses[key] || 'idle';

  return (
    <div className="w-full rounded-xl border border-indigo-500/30 bg-gradient-to-r from-violet-950/80 via-indigo-950/70 to-cyan-950/60 p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest bg-gradient-to-r from-violet-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
          Pipeline Architecture
        </h2>
        <span className="text-xs font-mono text-indigo-300/60">5-Agent Sequential SOC Pipeline</span>
      </div>

      <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">

        {/* Triage */}
        <PipelineNode
          num="01" label="Triage" status={s('triage')}
          description={['Offense metadata + type', 'Asset criticality', 'Threat intel + severity', 'Severity scoring (T0–T9)']}
          colorClasses={{ border: 'border-indigo-500/40', bg: 'bg-gradient-to-b from-indigo-900/60 to-indigo-950/50', text: 'text-indigo-100', dot: 'bg-indigo-400' }}
        />
        <Arrow from="from-indigo-400/60" to="to-violet-400/60" />

        {/* Classification */}
        <PipelineNode
          num="02" label="Classification" status={s('classification')}
          description={['M1–M7 detection modules', 'Event fetch + normalise', 'Adjudication + confidence', 'Verdict determination']}
          colorClasses={{ border: 'border-violet-500/40', bg: 'bg-gradient-to-b from-violet-900/60 to-violet-950/50', text: 'text-violet-100', dot: 'bg-violet-400' }}
        />
        <Arrow from="from-violet-400/60" to="to-teal-400/60" />

        {/* RCA */}
        <PipelineNode
          num="03" label="RCA" status={s('rca')}
          description={['Root cause analysis', 'Evidence correlation', 'Attack chain mapping', 'RCA report generation']}
          colorClasses={{ border: 'border-teal-500/40', bg: 'bg-gradient-to-b from-teal-900/60 to-teal-950/50', text: 'text-teal-100', dot: 'bg-teal-400' }}
        />
        <Arrow from="from-teal-400/60" to="to-amber-400/60" />

        {/* Notification */}
        <PipelineNode
          num="04" label="Notification" status={s('notification')}
          description={['Customer notification', 'Incident communication', 'Stakeholder alerting']}
          colorClasses={{ border: 'border-amber-500/40', bg: 'bg-gradient-to-b from-amber-900/60 to-amber-950/50', text: 'text-amber-100', dot: 'bg-amber-400' }}
        />
        <Arrow from="from-amber-400/60" to="to-rose-400/60" />

        {/* Action */}
        <PipelineNode
          num="05" label="Action" status={s('action')}
          description={['Remediation execution', 'Firewall / containment', 'Decision recording']}
          colorClasses={{ border: 'border-rose-500/40', bg: 'bg-gradient-to-b from-rose-900/60 to-rose-950/50', text: 'text-rose-100', dot: 'bg-rose-400' }}
        />

      </div>
    </div>
  );
};
