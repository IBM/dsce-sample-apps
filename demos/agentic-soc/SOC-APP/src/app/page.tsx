'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { OffenseSelector } from '@/components/OffenseSelector';
import { StageCard } from '@/components/StageCard';
import { AnalyticsVisualizer } from '@/components/AnalyticsVisualizer';
import { PipelineFlow } from '@/components/PipelineFlow';
import { ConfigViewer } from '@/components/ConfigViewer';
import { ConversationalSupervisorWidget } from '@/components/ConversationalSupervisorWidget';
import { WxoChatWidget } from '@/components/WxoChatWidget';
import { PersonaView } from '@/components/PersonaView';
import { DEFAULT_STAGES } from '@/data/defaultStages';
import { POC_OFFENSES } from '@/data/sampleOffenses';
import { StageConfig, StageState, ConfigResponse, PocOffense } from '@/types';
import {
  Shield,
  Play,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function SOCDashboard() {
  const [stages, setStages] = useState<StageConfig[]>(DEFAULT_STAGES);
  const [runs, setRuns] = useState<Record<string, StageState>>({});
  const runsRef = useRef<Record<string, StageState>>({});

  const [selectedOffenseId, setSelectedOffenseId] = useState<string>(POC_OFFENSES[0].id);
  const [globalPrompt, setGlobalPrompt] = useState<string>(`Analyze QRadar Offense ${POC_OFFENSES[0].id}`);
  const [serviceConfigured, setServiceConfigured] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('SOC — Agentic Pipeline Ready.');
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [executionOpen, setExecutionOpen] = useState<boolean>(true);
  const [analyticsOpen, setAnalyticsOpen] = useState<boolean>(true);
  const [personaViewOpen, setPersonaViewOpen] = useState<boolean>(true);
  const [configViewerOpen, setConfigViewerOpen] = useState<boolean>(false);

  const updateRunsState = (newRuns: Record<string, StageState>) => {
    runsRef.current = newRuns;
    setRuns(newRuns);
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data: ConfigResponse = await res.json();
      if (data.success && data.stages && data.stages.length > 0) {
        setStages(data.stages);
        setServiceConfigured(data.serviceConfigured);
        setStatusMessage(
          data.serviceConfigured
            ? 'watsonx Orchestrate agent endpoints connected.'
            : 'Service credentials missing — set agent IDs in .env'
        );
      }
    } catch {
      setStatusMessage('Backend unreachable — using default stage configuration.');
    }
  };

  const handleSelectOffense = (offense: PocOffense) => {
    setSelectedOffenseId(offense.id);
    setGlobalPrompt(`Analyze QRadar Offense ${offense.id}`);
    // Clear per-stage prompt overrides so the new offense ID is picked up
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
    setStatusMessage('Cleared saved execution outputs and traces.');
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
  const POLL_TIMEOUT_MS  = 360000; // 6 min client-side safety net

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
    const promptToUse       = currentStageState.prompt?.trim() || inheritedPrompt;

    if (!promptToUse) {
      setStatusMessage(`Please enter a scenario prompt before executing ${stage.label}.`);
      return activeRuns;
    }

    const loadingRuns = { ...activeRuns, [stageKey]: { ...activeRuns[stageKey], loading: true } };
    updateRunsState(loadingRuns);
    setStatusMessage(`[${stage.label}] Submitting prompt to watsonx Orchestrate…`);

    try {
      // Step 1: POST — returns immediately with runId
      const postRes = await fetch(`/api/poc-stages/${stageKey}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToUse }),
      });
      const postPayload = await postRes.json();
      if (!postRes.ok || !postPayload.success) throw new Error(postPayload.error || `Stage execution failed: ${stage.label}`);

      const { runId, threadId, startedAt } = postPayload;
      setStatusMessage(`[${stage.label}] Run created (${runId.slice(0, 8)}…) — agent is processing…`);

      // Step 2: poll — GET checks status once per tick
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
    setStatusMessage('Initiating SOC 6-Agent Pipeline — Triage → Close…');

    let currentRuns = { ...runsRef.current };
    const errors: string[] = [];

    for (const stage of stages) {
      setStatusMessage(`Executing ${stage.label} Agent…`);
      try {
        currentRuns = await runStage(stage.key, true, currentRuns);
      } catch (error: any) {
        errors.push(`${stage.label}: ${error.message}`);
        setStatusMessage(`${stage.label} failed — continuing pipeline…`);
      }
    }

    setRunning(false);
    if (errors.length === 0) {
      setStatusMessage('Pipeline completed successfully. Review outputs for final verdict.');
    } else if (errors.length === stages.length) {
      setStatusMessage('Pipeline finished — all stages failed. Check configuration.');
    } else {
      setStatusMessage(`Pipeline finished. ${errors.length} stage(s) failed: ${errors.join(' | ')}`);
    }
  };

  // Build stageStatuses for PipelineFlow
  const stageStatuses = Object.fromEntries(
    stages.map((s) => [
      s.key,
      runsRef.current[s.key]?.loading
        ? 'running'
        : (runs[s.key]?.run?.status as any) || 'idle',
    ])
  );

  return (
    <div className="min-h-screen bg-[#080a12] text-slate-200 flex flex-col font-sans">
      <Navbar
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
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Agentic Security Operations Platform
                </h1>
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
            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              <span className="hidden sm:block text-[11px] font-mono text-indigo-200/50">Inspect responses & traces</span>
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

        {/* PersonaView intentionally hidden from UI — kept in script */}
        {/* <PersonaView
          stages={stages}
          runs={runs}
          open={personaViewOpen}
          onToggle={() => setPersonaViewOpen((o) => !o)}
        /> */}

        {/* ── Section 4: Agent & Config Files ──────────────────────────────── */}
        <ConfigViewer open={configViewerOpen} onToggle={() => setConfigViewerOpen((o) => !o)} />
      </main>

      <ConversationalSupervisorWidget />
      <WxoChatWidget />

      <footer className="mt-12 border-t border-slate-800/60 bg-[#0d1117] py-5">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <span>SOC — Agentic Security Operations Platform</span>
          <span className="font-mono text-[11px] text-slate-700">Triage · Classification · RCA · Notification · Action · watsonx Orchestrate</span>
        </div>
      </footer>
    </div>
  );
}
