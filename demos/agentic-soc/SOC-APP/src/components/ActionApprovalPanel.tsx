'use client';

import React, { useState, useEffect } from 'react';
import { PocOffense } from '@/types';
import { ShieldAlert, Check, X, CheckCircle2, XCircle, Sparkles, Lock } from 'lucide-react';

export interface ActionItem {
  id: string;
  name: string;
  target: string;
  reasoning: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'pending' | 'approved' | 'rejected';
}

interface ActionApprovalPanelProps {
  offense: PocOffense;
  isOpen: boolean;
  onAllDecided: (results: ActionItem[]) => void;
  onViewRcaReport?: () => void;
}

export const ActionApprovalPanel: React.FC<ActionApprovalPanelProps> = ({
  offense,
  isOpen,
  onAllDecided,
  onViewRcaReport,
}) => {
  const isTP = offense.expectedOutcome === 'True Positive';
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Build realistic action items based on offense matching screenshot layout
  const buildInitialActions = (): ActionItem[] => {
    if (isTP) {
      const srcIp =
        offense.sourceIp && !offense.sourceIp.includes('x')
          ? offense.sourceIp
          : '10.50.4.120';
      const destTarget =
        offense.destinationIp &&
        !offense.destinationIp.includes('x') &&
        offense.destinationIp !== '—'
          ? offense.destinationIp
          : 'CORP-WKS-TEST01';
      const userTarget =
        offense.id === '177507'
          ? 'compromised.user@company.com'
          : 'test.user@company.com';

      return [
        {
          id: `ACT-QR-${offense.id}-001`,
          name: 'block_ip_address',
          target: srcIp,
          reasoning: 'IP associated with malicious activity',
          severity: 'HIGH',
          status: 'pending',
        },
        {
          id: `ACT-QR-${offense.id}-002`,
          name: 'disable_user_account',
          target: userTarget,
          reasoning: 'User account compromised',
          severity: 'HIGH',
          status: 'pending',
        },
        {
          id: `ACT-QR-${offense.id}-003`,
          name: 'isolate_device',
          target: destTarget,
          reasoning: 'Device shows signs of compromise',
          severity: 'MEDIUM',
          status: 'pending',
        },
      ];
    }

    return [
      {
        id: `ACT-QR-${offense.id}-001`,
        name: 'close_offense_ticket',
        target: `QRadar Offense #${offense.id}`,
        reasoning: `Baseline verified — matches allowlist (${offense.closeNote || 'Normal Behavior'})`,
        severity: 'LOW',
        status: 'pending',
      },
    ];
  };

  const [actions, setActions] = useState<ActionItem[]>(() => buildInitialActions());

  // Reset when offense changes — rebuild actions from the latest offense prop
  useEffect(() => {
    const latestIsTP = offense.expectedOutcome === 'True Positive';
    const srcIp =
      offense.sourceIp && !offense.sourceIp.includes('x')
        ? offense.sourceIp
        : '10.50.4.120';
    const destTarget =
      offense.destinationIp &&
      !offense.destinationIp.includes('x') &&
      offense.destinationIp !== '—'
        ? offense.destinationIp
        : 'CORP-WKS-TEST01';
    const userTarget =
      offense.id === '177507'
        ? 'compromised.user@company.com'
        : 'test.user@company.com';

    const freshActions: ActionItem[] = latestIsTP
      ? [
          {
            id: `ACT-QR-${offense.id}-001`,
            name: 'block_ip_address',
            target: srcIp,
            reasoning: 'IP associated with malicious activity',
            severity: 'HIGH',
            status: 'pending',
          },
          {
            id: `ACT-QR-${offense.id}-002`,
            name: 'disable_user_account',
            target: userTarget,
            reasoning: 'User account compromised',
            severity: 'HIGH',
            status: 'pending',
          },
          {
            id: `ACT-QR-${offense.id}-003`,
            name: 'isolate_device',
            target: destTarget,
            reasoning: 'Device shows signs of compromise',
            severity: 'MEDIUM',
            status: 'pending',
          },
        ]
      : [
          {
            id: `ACT-QR-${offense.id}-001`,
            name: 'close_offense_ticket',
            target: `QRadar Offense #${offense.id}`,
            reasoning: `Baseline verified — matches allowlist (${offense.closeNote || 'Normal Behavior'})`,
            severity: 'LOW',
            status: 'pending',
          },
        ];

    setActions(freshActions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offense.id]);

  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDecision = (id: string, decision: 'approved' | 'rejected') => {
    const updated = actions.map((a) => (a.id === id ? { ...a, status: decision } : a));
    setActions(updated);

    // Check if all actions are decided
    const remainingPending = updated.filter((a) => a.status === 'pending');
    if (remainingPending.length === 0) {
      setTimeout(() => {
        onAllDecided(updated);
      }, 500);
    }
  };

  const handleApproveAll = () => {
    const updated = actions.map((a) => ({ ...a, status: 'approved' as const }));
    setActions(updated);
    setTimeout(() => {
      onAllDecided(updated);
    }, 400);
  };

  return (
    <div
      ref={panelRef}
      className="rounded-2xl border-2 border-amber-400/90 bg-[#0c101a] p-5 sm:p-6 shadow-2xl shadow-amber-950/40 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-400/30">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-amber-300 tracking-tight flex items-center gap-2">
              Action Approval Required
              <span className="text-xs font-normal text-amber-400/80 font-mono">
                ({actions.filter((a) => a.status === 'pending').length} pending review)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and approve automated remediation measures proposed by the Action Agent.
            </p>
          </div>
        </div>

        <button
          onClick={handleApproveAll}
          className="self-start sm:self-center inline-flex items-center gap-1.5 rounded-lg bg-[#28a745] hover:bg-[#218838] px-3.5 py-1.5 text-xs font-bold text-white shadow-md active:scale-95 transition-all"
        >
          <Check className="h-3.5 w-3.5" />
          <span>Approve All Actions</span>
        </button>
      </div>

      {/* Action Items List */}
      <div className="space-y-4">
        {actions.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${
              item.status === 'approved'
                ? 'border-emerald-500/60 bg-emerald-950/20'
                : item.status === 'rejected'
                ? 'border-red-500/60 bg-red-950/20 opacity-80'
                : 'border-amber-400/80 bg-slate-900/80 hover:border-amber-400'
            }`}
          >
            {/* Card Top Row */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
              <span className="font-mono text-sm sm:text-base font-bold text-amber-300">
                {item.name}
              </span>
              <span
                className={`rounded-full px-3 py-0.5 text-[11px] font-bold tracking-wide uppercase shadow-sm ${
                  item.severity === 'HIGH'
                    ? 'bg-[#dc3545] text-white'
                    : item.severity === 'MEDIUM'
                    ? 'bg-[#fd7e14] text-white'
                    : 'bg-[#17a2b8] text-white'
                }`}
              >
                {item.severity}
              </span>
            </div>

            {/* Card Body Table */}
            <div className="p-4 space-y-2 text-xs font-mono">
              <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] gap-2 items-baseline">
                <span className="text-slate-400 font-semibold">Action ID:</span>
                <span className="text-slate-100 font-bold">{item.id}</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] gap-2 items-baseline">
                <span className="text-slate-400 font-semibold">Target:</span>
                <span className="text-slate-200">{item.target}</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] gap-2 items-baseline">
                <span className="text-slate-400 font-semibold">Reasoning:</span>
                <span className="text-slate-300 font-sans">{item.reasoning}</span>
              </div>
            </div>

            {/* Card Decision Buttons */}
            <div className="px-4 pb-4 pt-1">
              {item.status === 'pending' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleDecision(item.id, 'approved')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#28a745] hover:bg-[#218838] py-2.5 text-xs font-bold text-white shadow-md active:scale-98 transition-all"
                  >
                    <Check className="h-4 w-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleDecision(item.id, 'rejected')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#dc3545] hover:bg-[#c82333] py-2.5 text-xs font-bold text-white shadow-md active:scale-98 transition-all"
                  >
                    <X className="h-4 w-4" />
                    <span>Reject</span>
                  </button>
                </div>
              ) : item.status === 'approved' ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-500/40">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Approved — Action queued for execution</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold text-red-300 bg-red-950/50 p-2.5 rounded-lg border border-red-500/40">
                  <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>Rejected by Security Analyst — Action cancelled</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
