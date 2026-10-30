'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { OffenseSelector } from '@/components/OffenseSelector';
import { StageCard } from '@/components/StageCard';
import { AnalyticsVisualizer } from '@/components/AnalyticsVisualizer';
import { PipelineFlow } from '@/components/PipelineFlow';
import { ConfigViewer } from '@/components/ConfigViewer';
import { IncidentReportModal } from '@/components/IncidentReportModal';
import { ActionApprovalPanel, ActionItem } from '@/components/ActionApprovalPanel';
import { ConversationalSupervisorWidget } from '@/components/ConversationalSupervisorWidget';
import { WxoChatWidget } from '@/components/WxoChatWidget';
import { DEFAULT_STAGES } from '@/data/defaultStages';
import { POC_OFFENSES } from '@/data/sampleOffenses';
import { buildMockRunDetails } from '@/data/mockPipelineData';
import { StageConfig, StageState, ConfigResponse, PocOffense } from '@/types';
import {
  Shield,
  Play,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  FileText,
  Download,
  Lock,
} from 'lucide-react';

export default function SOCDashboard() {
  const [stages, setStages] = useState<StageConfig[]>(DEFAULT_STAGES);
  const [runs, setRuns] = useState<Record<string, StageState>>({});
  const runsRef = useRef<Record<string, StageState>>({});
  const selectedOffenseIdRef = useRef<string>(POC_OFFENSES[0].id);

  const [mockMode, setMockMode] = useState<boolean>(true);
  const [selectedOffenseId, setSelectedOffenseId] = useState<string>(POC_OFFENSES[0].id);
  // Keep a ref in sync so async functions always read the latest offense ID
  selectedOffenseIdRef.current = selectedOffenseId;
  const [globalPrompt, setGlobalPrompt] = useState<string>(`Analyze QRadar Offense ${POC_OFFENSES[0].id}`);
  const [serviceConfigured, setServiceConfigured] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    '⚡ Simulation Mode Active — Running end-to-end WxO multi-agent pipeline.'
  );
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [executionOpen, setExecutionOpen] = useState<boolean>(true);
  const [analyticsOpen, setAnalyticsOpen] = useState<boolean>(true);
  const [configViewerOpen, setConfigViewerOpen] = useState<boolean>(false);
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
  const [actionApprovalOpen, setActionApprovalOpen] = useState<boolean>(false);

  // Promise resolver reference for approval gating
  const actionApprovalResolverRef = useRef<((items: ActionItem[]) => void) | null>(null);

  const selectedOffense = POC_OFFENSES.find((o) => o.id === selectedOffenseId) || POC_OFFENSES[0];
  const rcaCompleted = runs['rca']?.run?.status === 'completed';

  const updateRunsState = (newRuns: Record<string, StageState>) => {
    runsRef.current = newRuns;
    setRuns(newRuns);
  };

  useEffect(() => {
    // Restore persisted mode — default to Mock if nothing saved
    const savedMockMode = localStorage.getItem('soc_mock_mode');
    const initialMock = savedMockMode !== null ? savedMockMode === 'true' : true;
    setMockMode(initialMock);
    fetchConfig(initialMock);
  }, []);

  const handleToggleMockMode = (targetMode?: boolean) => {
    const nextMock = targetMode !== undefined ? targetMode : !mockMode;
    setMockMode(nextMock);
    localStorage.setItem('soc_mock_mode', String(nextMock));
    if (nextMock) {
      setStatusMessage('⚡ Simulation Mode Active — Running end-to-end WxO multi-agent pipeline.');
    } else {
      setActionApprovalOpen(false);
      setReportModalOpen(false);
      setStatusMessage(
        serviceConfigured
          ? 'Live watsonx Orchestrate endpoint execution active.'
          : '⚠️ Live mode selected — WxO credentials not configured in .env.'
      );
    }
  };

  const fetchConfig = async (currentMockMode?: boolean) => {
    const isMock = currentMockMode !== undefined ? currentMockMode : mockMode;
    try {
      const res = await fetch('/api/config');
      const data: ConfigResponse = await res.json();
      if (data.success && data.stages && data.stages.length > 0) {
        setStages(data.stages);
        setServiceConfigured(data.serviceConfigured);
        if (!data.serviceConfigured) {
          // WxO not configured — force Mock Mode on and persist it (FR-01).
          setMockMode(true);
          localStorage.setItem('soc_mock_mode', 'true');
          setStatusMessage('⚡ Self-Contained Simulation Engine Active.');
        } else if (isMock) {
          setStatusMessage('⚡ Simulation Mode Active — Running end-to-end WxO multi-agent pipeline.');
        } else {
          setStatusMessage('watsonx Orchestrate agent endpoints connected.');
        }
      }
    } catch {
      // Config fetch failed — force Mock Mode on (not persisted) (FR-01).
      setMockMode(true);
      setStatusMessage('⚡ Self-Contained Simulation Engine Active.');
    }
  };

  const handleSelectOffense = (offense: PocOffense) => {
    setSelectedOffenseId(offense.id);
    setGlobalPrompt(`Analyze QRadar Offense ${offense.id}`);
    setActionApprovalOpen(false);
    const cleared: Record<string, StageState> = {};
    for (const key of Object.keys(runsRef.current)) {
      const { prompt: _dropped, ...rest } = runsRef.current[key];
      cleared[key] = rest;
    }
    updateRunsState(cleared);
  };

  const handlePromptChange = (stageKey: string, prompt: string) => {
    updateRunsState({ ...runsRef.current, [stageKey]: { ...runsRef.current[stageKey], prompt } });
  };

  const handleClearData = () => {
    runsRef.current = {};
    setRuns({});
    setActionApprovalOpen(false);
    setStatusMessage('Cleared saved execution outputs and traces.');
  };

  const handleLoadMockResults = () => {
    const loaded: Record<string, StageState> = {};
    const startedAt = new Date().toISOString();
    for (const stage of stages) {
      const mockDetails = buildMockRunDetails(stage.key, selectedOffenseIdRef.current, startedAt);
      loaded[stage.key] = {
        prompt: buildPromptForStage(stage.key, loaded),
        loading: false,
        run: mockDetails,
      };
    }
    updateRunsState(loaded);
    setActionApprovalOpen(false);
    setStatusMessage(`⚡ Telemetry & outputs populated for Offense #${selectedOffenseIdRef.current}. Report ready!`);
  };

  const handleActionDecided = (items: ActionItem[]) => {
    if (actionApprovalResolverRef.current) {
      actionApprovalResolverRef.current(items);
      actionApprovalResolverRef.current = null;
    }
  };

  const buildPromptForStage = (stageKey: string, currentRuns: Record<string, StageState>): string => {
    const base = globalPrompt.trim();
    const triageOutput         = currentRuns['triage']?.run?.outputText || '';
    const classificationOutput = currentRuns['classification']?.run?.outputText || '';
    const rcaOutput            = currentRuns['rca']?.run?.outputText || '';
    const actionOutput         = currentRuns['action']?.run?.outputText || '';

    switch (stageKey) {
      case 'triage':
        return base;

      case 'classification': {
        const parts = [`Offense ID: ${selectedOffenseId}`, base];
        if (triageOutput) parts.push(`[TRIAGE RESULT]:\n${triageOutput}`);
        else parts.push('[TRIAGE RESULT]: Not yet available — please run Triage first.');
        return parts.join('\n\n').trim();
      }

      case 'rca': {
        const parts = [base];
        if (triageOutput) parts.push(`[TRIAGE RESULT]:\n${triageOutput}`);
        if (classificationOutput) parts.push(`[CLASSIFICATION RESULT]:\n${classificationOutput}`);
        return parts.join('\n\n').trim();
      }

      case 'notification': {
        const parts = [base];
        if (rcaOutput) parts.push(`[RCA REPORT]:\n${rcaOutput}`);
        else if (classificationOutput) parts.push(`[CLASSIFICATION RESULT]:\n${classificationOutput}`);
        return parts.join('\n\n').trim();
      }

      case 'action': {
        const parts = [base];
        if (triageOutput) parts.push(`[TRIAGE RESULT]:\n${triageOutput}`);
        if (classificationOutput) parts.push(`[CLASSIFICATION RESULT]:\n${classificationOutput}`);
        if (rcaOutput) parts.push(`[RCA REPORT]:\n${rcaOutput}`);
        return parts.join('\n\n').trim();
      }

      case 'close': {
        const parts = [base];
        if (triageOutput) parts.push(`[TRIAGE RESULT]:\n${triageOutput}`);
        if (classificationOutput) parts.push(`[CLASSIFICATION RESULT]:\n${classificationOutput}`);
        if (rcaOutput) parts.push(`[RCA REPORT]:\n${rcaOutput}`);
        if (actionOutput) parts.push(`[ACTION REPORT]:\n${actionOutput}`);
        return parts.join('\n\n').trim();
      }

      default: {
        const currentIndex = stages.findIndex((s) => s.key === stageKey);
        if (currentIndex > 0) {
          const prevOutput = currentRuns[stages[currentIndex - 1].key]?.run?.outputText || '';
          if (prevOutput) return `${base}\n\n[Previous Stage Output]:\n${prevOutput}`.trim();
        }
        return base;
      }
    }
  };

  const POLL_INTERVAL_MS = 4000;
  const POLL_TIMEOUT_MS  = 360000;

  const runStage = async (
    stageKey: string,
    preserveStatusBanner = false,
    overrideRuns?: Record<string, StageState>
  ): Promise<Record<string, StageState>> => {
    const activeRuns = overrideRuns || runsRef.current;
    const stage = stages.find((s) => s.key === stageKey);
    if (!stage) return activeRuns;

    const currentStageState = activeRuns[stageKey] || {};
    const inheritedPrompt   = buildPromptForStage(stageKey, activeRuns);
    const promptToUse       = currentStageState.prompt?.trim() || inheritedPrompt || `Analyze QRadar Offense ${selectedOffenseIdRef.current}`;

    const loadingRuns = { ...activeRuns, [stageKey]: { ...activeRuns[stageKey], loading: true, error: undefined } };
    updateRunsState(loadingRuns);

    // ── MOCK MODE EXECUTION (NEVER FAILS, ALWAYS COMPLETES SEAMLESSLY) ────────
    if (mockMode) {
      try {
        const startedAt = new Date().toISOString();

        if (stageKey === 'action') {
          setStatusMessage(`[Action] Action Approval Required — Waiting for analyst review…`);
          setActionApprovalOpen(true);

          // Await user decision via ActionApprovalPanel
          const decisions = await new Promise<ActionItem[]>((resolve) => {
            actionApprovalResolverRef.current = resolve;
          });

          const approvedCount = decisions.filter((d) => d.status === 'approved').length;
          const rejectedCount = decisions.filter((d) => d.status === 'rejected').length;

          setStatusMessage(`[Action] Enforcing ${approvedCount} approved remediation action(s) across firewall & host controls…`);
          await new Promise((r) => setTimeout(r, 2500));
          setStatusMessage(`[Action] Verifying containment policies and synchronizing audit trail with SIEM…`);
          await new Promise((r) => setTimeout(r, 2500));

          const mockRunDetails = buildMockRunDetails(stageKey, selectedOffenseIdRef.current, startedAt);
          if (mockRunDetails?.analytics) {
            mockRunDetails.analytics.durationMs = 5000;
          }

          // Customize output text with approved items
          const actionSummary = decisions.map((d) => `- **${d.name}** (\`${d.id}\`): ${d.status === 'approved' ? '✅ EXECUTED' : '❌ REJECTED by Analyst'}`).join('\n');
          mockRunDetails.outputText = `### [Action Agent] Approval-Gated Remediation Summary\n\n**Adjudication Overview:**\n- Approved: ${approvedCount}\n- Rejected: ${rejectedCount}\n\n**Action Results:**\n${actionSummary}\n\n*Containment measures synchronized with perimeter firewall and SIEM.*`;

          const completedRuns = {
            ...runsRef.current,
            [stageKey]: { prompt: promptToUse, loading: false, run: mockRunDetails, error: undefined },
          };
          updateRunsState(completedRuns);
          setActionApprovalOpen(false);

          if (!preserveStatusBanner) {
            setStatusMessage(`[Action] Completed in 5.0s — ${approvedCount} action(s) executed successfully.`);
          }
          return completedRuns;
        }

        // Standard non-action stages — 5 seconds total realistic execution with progressive updates
        setStatusMessage(`[${stage.label}] Initiating agent reasoning & fetching offense #${selectedOffenseIdRef.current} telemetry…`);
        await new Promise((r) => setTimeout(r, 1650));
        setStatusMessage(`[${stage.label}] Executing security tools & evaluating baseline policies…`);
        await new Promise((r) => setTimeout(r, 1700));
        setStatusMessage(`[${stage.label}] Synthesizing findings and generating structured report…`);
        await new Promise((r) => setTimeout(r, 1650));

        const mockRunDetails = buildMockRunDetails(stageKey, selectedOffenseIdRef.current, startedAt);
        if (mockRunDetails?.analytics) {
          mockRunDetails.analytics.durationMs = 5000;
        }
        const completedRuns = {
          ...runsRef.current,
          [stageKey]: { prompt: promptToUse, loading: false, run: mockRunDetails, error: undefined },
        };
        updateRunsState(completedRuns);

        if (!preserveStatusBanner) {
          setStatusMessage(`[${stage.label}] Completed in 5.0s — status: completed`);
        }
        return completedRuns;
      } catch (err: any) {
        // Fallback resilience: guarantee mock mode never fails
        const fallbackDetails = buildMockRunDetails(stageKey, selectedOffenseIdRef.current);
        const completedRuns = {
          ...runsRef.current,
          [stageKey]: { prompt: promptToUse, loading: false, run: fallbackDetails, error: undefined },
        };
        updateRunsState(completedRuns);
        return completedRuns;
      }
    }

    // ── LIVE WXO EXECUTION ───────────────────────────────────────────────────
    setStatusMessage(`[${stage.label}] Submitting prompt to watsonx Orchestrate…`);

    try {
      const postRes = await fetch(`/api/poc-stages/${stageKey}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToUse }),
      });
      const postPayload = await postRes.json();
      if (!postRes.ok || !postPayload.success) throw new Error(postPayload.error || `Stage execution failed: ${stage.label}`);

      const { runId, threadId, startedAt } = postPayload;
      setStatusMessage(`[${stage.label}] Run created (${runId.slice(0, 8)}…) — agent is processing…`);

      const deadline  = Date.now() + POLL_TIMEOUT_MS;
      let   pollCount = 0;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        pollCount++;

        const pollUrl = `/api/poc-stages/${stageKey}/run/${encodeURIComponent(runId)}`
          + `?startedAt=${encodeURIComponent(startedAt)}`
          + `&threadId=${encodeURIComponent(threadId || '')}`;

        const pollRes     = await fetch(pollUrl);
        const pollPayload = await pollRes.json();

        if (!pollRes.ok && pollPayload?.retryable) {
          const elapsedS = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
          setStatusMessage(
            `[${stage.label}] Status check timed out — retrying… · ${elapsedS}s elapsed (poll #${pollCount})`
          );
          continue;
        }

        if (!pollRes.ok || !pollPayload.success) {
          throw new Error(pollPayload.error || `Stage polling failed: ${stage.label}`);
        }

        if (!pollPayload.completed) {
          const elapsedS = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
          setStatusMessage(
            `[${stage.label}] Agent running… status: ${pollPayload.status} · ${elapsedS}s elapsed (poll #${pollCount})`
          );
          continue;
        }

        // Done
        const completedRuns = {
          ...runsRef.current,
          [stageKey]: { prompt: promptToUse, loading: false, run: pollPayload.run },
        };
        updateRunsState(completedRuns);
        if (!preserveStatusBanner) {
          const dur = pollPayload.run?.analytics?.durationMs;
          const durStr = dur ? ` in ${(dur / 1000).toFixed(1)}s` : '';
          setStatusMessage(`[${stage.label}] Completed${durStr} — status: ${pollPayload.run?.status}`);
        }
        return completedRuns;
      }

      throw new Error(`Client timed out waiting for ${stage.label} to complete (>${POLL_TIMEOUT_MS / 1000}s).`);
    } catch (error: any) {
      const errorRuns = { ...runsRef.current, [stageKey]: { ...runsRef.current[stageKey], loading: false, error: error.message } };
      updateRunsState(errorRuns);
      if (!preserveStatusBanner) setStatusMessage(`[${stage.label}] Error: ${error.message}`);
      throw error;
    }
  };

  const runAllStages = async () => {
    if (running) return;
    setRunning(true);
    setStatusMessage('⚡ Initiating SOC 5-Agent Pipeline — Triage → Action…');

    let currentRuns = { ...runsRef.current };
    const errors: string[] = [];

    for (const stage of stages) {
      setStatusMessage(`Executing ${stage.label} Agent for Offense #${selectedOffenseIdRef.current}…`);
      try {
        currentRuns = await runStage(stage.key, true, currentRuns);
        if (mockMode && stage.key !== 'action') {
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch (error: any) {
        errors.push(`${stage.label}: ${error.message}`);
        setStatusMessage(`${stage.label} failed — continuing pipeline…`);
      }
    }

    setRunning(false);
    if (errors.length === 0) {
      setStatusMessage(
        'Pipeline completed successfully. Remediation actions adjudicated and verified.'
      );
    } else if (errors.length === stages.length) {
      setStatusMessage('Pipeline finished — all stages failed. Check configuration.');
    } else {
      setStatusMessage(`Pipeline finished. ${errors.length} stage(s) failed: ${errors.join(' | ')}`);
    }
  };

  const stageStatuses = Object.fromEntries(
    stages.map((s) => [
      s.key,
      runsRef.current[s.key]?.loading
        ? 'running'
        : (runs[s.key]?.run?.status as any) || 'idle',
    ])
  );

  return (
    <div className="min-h-screen bg-[#080a12] text-slate-200 flex flex-col font-sans relative">
      <Navbar
        mockMode={mockMode}
        onToggleMockMode={handleToggleMockMode}
        serviceConfigured={serviceConfigured}
        running={running}
        onRunAll={runAllStages}
        onClear={handleClearData}
        statusMessage={statusMessage}
      />

      <main className="flex-1 w-full px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* ── Section 1: Pipeline Architecture ─────────────────────────────── */}
        <section className="space-y-3">
          {/* Hero banner */}
          <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 p-6 sm:p-8 shadow-lg shadow-indigo-900/50">
            <div className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-indigo-500/20" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Agentic Security Operations Platform
                  </h1>
                </div>
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="self-start inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors shrink-0"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  {showGuide ? 'Hide guide' : 'How it works'}
                </button>
              </div>
              <p className="text-sm text-indigo-100 max-w-2xl">
                End-to-end incident resolution via 5-agent pipeline: Triage → Classification → RCA → Notification → Action.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-indigo-200/70">
                <span>Triage → Classification → RCA → Notification → Action</span>
                <span>·</span><span>{POC_OFFENSES.length} Active Offenses</span>
                <span>·</span><span>QRadar SIEM</span>
                {mockMode && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-300 font-semibold">⚡ High-Fidelity Simulation Mode</span>
                  </>
                )}
              </div>
              {showGuide && (
                <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-xs text-indigo-100 space-y-2">
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li><strong className="text-white">Triage Agent:</strong> Fetches offense + events, enriches IPs, checks BENIGN allowlist, scores severity.</li>
                    <li><strong className="text-white">Classification Agent:</strong> Runs M1–M7/N1–N3 detection modules and adjudicates verdict.</li>
                    <li><strong className="text-white">RCA Agent:</strong> Performs root cause analysis, evidence correlation, and investigation summarization.</li>
                    <li><strong className="text-white">Notification Agent:</strong> Builds customer-ready notification and sends alert to stakeholders.</li>
                    <li><strong className="text-white">Action Agent:</strong> Executes firewall/host containment actions based on classification.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* Pipeline flow diagram */}
          <PipelineFlow stageStatuses={stageStatuses} />
        </section>

        {/* ── RCA Report Floating Alert Banner (Mock Mode Only) ─────────────── */}
        {rcaCompleted && mockMode && (
          <section className="animate-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-teal-500/40 bg-gradient-to-r from-teal-950/90 via-slate-900 to-indigo-950/80 p-4 sm:px-6 shadow-lg shadow-teal-950/40">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Root Cause Investigation Report Ready for Download
                    </h3>
                    <span className="rounded-full bg-teal-500/20 border border-teal-500/30 px-2 py-0.5 text-[10px] font-mono text-teal-300">
                      Offense #{selectedOffense.id}
                    </span>
                  </div>
                  <p className="text-xs text-teal-300/80 mt-0.5">
                    5-dimension analysis, chronological timeline, and MITRE ATT&CK mapping completed.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReportModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-teal-500 active:scale-95 transition-all shrink-0"
              >
                <Download className="h-4 w-4" />
                <span>View & Download Incident Report</span>
              </button>
            </div>
          </section>
        )}

        {/* ── Section 2: Agent Execution ────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-800/60 bg-[#0d1117] overflow-hidden">
          {/* Section header */}
          <div
            className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 cursor-pointer select-none"
            onClick={() => setExecutionOpen((o) => !o)}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-400">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-semibold text-slate-100 tracking-tight">Agent Execution</h2>
              <span className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] font-mono text-slate-500">{stages.length} stages</span>
            </div>
            <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
              {mockMode && (
                <button
                  onClick={handleLoadMockResults}
                  disabled={running}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-40 transition-all active:scale-95 shadow-sm"
                  title="Instantly pre-populate all stage responses for this offense"
                >
                  <Zap className="h-3 w-3" />
                  
                </button>
              )}
              <button
                onClick={runAllStages}
                disabled={running}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Run Pipeline</span>
              </button>
              <button
                onClick={() => setExecutionOpen((o) => !o)}
                className="flex items-center justify-center h-6 w-6 rounded-md text-indigo-300 hover:text-white transition-colors"
              >
                {executionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {executionOpen && (
            <>
              {/* Offense selector */}
              <div className="px-5 pt-4 pb-4 border-b border-slate-800/60">
                <OffenseSelector
                  selectedOffenseId={selectedOffenseId}
                  onSelectOffense={handleSelectOffense}
                />
              </div>

              {/* Stage cards — horizontal scrollable */}
              <div className="p-5 bg-[#0a0c16]">
                <div className="w-full overflow-x-auto pb-2">
                  <div className="flex items-start min-w-max">
                    {stages.map((stage, index) => (
                      <React.Fragment key={stage.key}>
                        <div className="flex-shrink-0">
                          <StageCard
                            stage={stage}
                            index={index}
                            stageState={runs[stage.key] || {}}
                            onRunStage={(key) => runStage(key)}
                            onPromptChange={handlePromptChange}
                            isPipelineRunning={running}
                            compact={true}
                            onViewReport={mockMode ? () => setReportModalOpen(true) : undefined}
                          />
                        </div>
                        {index < stages.length - 1 && (
                          <div className="flex items-center px-2 pt-16 shrink-0 text-slate-700">
                            <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                              <path d="M0 6 H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              <path d="M11 2 L18 6 L11 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Action Approval Required Panel (Mock Mode Only) ───────── */}
              {actionApprovalOpen && mockMode && (
                <div className="px-5 pb-5 bg-[#0a0c16] animate-in fade-in slide-in-from-top-2 duration-300">
                  <ActionApprovalPanel
                    key={selectedOffense.id}
                    offense={selectedOffense}
                    isOpen={actionApprovalOpen}
                    onAllDecided={handleActionDecided}
                    onViewRcaReport={() => setReportModalOpen(true)}
                  />
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Section 3: Pipeline Analytics & Agent Telemetry ──────────────── */}
        <AnalyticsVisualizer
          stages={stages}
          runs={runs}
          selectedOffenseId={selectedOffenseId}
          open={analyticsOpen}
          onToggle={() => setAnalyticsOpen((o) => !o)}
        />

        {/* ── Section 4: Agent & Config Files ──────────────────────────────── */}
        <ConfigViewer open={configViewerOpen} onToggle={() => setConfigViewerOpen((o) => !o)} />
      </main>

      {!mockMode && serviceConfigured && <ConversationalSupervisorWidget />}
      <WxoChatWidget mockMode={mockMode} selectedOffenseId={selectedOffenseId} />

      {/* Floating Bottom-Left "View RCA Report" Pill Button (Mock Mode Only) */}
      {rcaCompleted && mockMode && (
        <button
          onClick={() => setReportModalOpen(true)}
          className="fixed bottom-24 left-6 z-40 inline-flex items-center gap-2 rounded-full bg-[#0066cc] px-4 py-2.5 text-xs font-bold text-white shadow-xl shadow-blue-950/50 hover:bg-[#0052a3] active:scale-95 transition-all"
        >
          <FileText className="h-4 w-4" />
          <span>View RCA Report</span>
        </button>
      )}

      {/* Incident Report Modal (Mock Mode Only) */}
      {mockMode && (
        <IncidentReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          offense={selectedOffense}
          runs={runs}
        />
      )}

      <footer className="mt-12 border-t border-slate-800/60 bg-[#0d1117] py-5">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <span>SOC — Agentic Security Operations Platform</span>
          <span className="font-mono text-[11px] text-slate-700">
            Triage · Classification · RCA · Notification · Action · watsonx Orchestrate
          </span>
        </div>
      </footer>
    </div>
  );
}
