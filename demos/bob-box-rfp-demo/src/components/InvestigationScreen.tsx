import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { BobTinkering } from './BobTinkering';
import { BoxLogo } from './BoxLogo';

interface InvestigationScreenProps {
  promptText?: string;
  fetchPromise?: Promise<void> | null;
  onComplete: () => void;
}

/** Derive stage labels from the user's prompt so the screen reflects what they asked */
function buildStages(prompt: string): Array<{ id: number; label: string; detail: string }> {
  const p = (prompt || '').trim().toLowerCase();

  // Extract a "customer name" hint from the prompt — anything after "for" or "with"
  const customerMatch = prompt.match(/(?:for|with)\s+([A-Z][a-zA-Z0-9 ]+?)(?:\s+demo|\s+meeting|\s+prep|\.|\?|$)/i);
  const customer = customerMatch ? customerMatch[1].trim() : 'the customer';

  const isDemo = /demo|present|pitch|show/i.test(p);
  const isRenewal = /renew|churn|health|risk/i.test(p);
  const isSecurity = /secur|compli|ciso|audit/i.test(p);
  const isTech = /tech|req|api|integrat|architect/i.test(p);

  return [
    {
      id: 1,
      label: `Connecting to Box workspace for ${customer}`,
      detail: 'Reading folder structure and locating relevant files via Box MCP...',
    },
    {
      id: 2,
      label: 'Reading discovery notes and meeting records',
      detail: 'Parsing discovery notes, call summaries, and email threads...',
    },
    {
      id: 3,
      label: isDemo
        ? 'Extracting what the customer wants to see'
        : isRenewal
        ? 'Assessing renewal signals and risk factors'
        : 'Extracting key customer context',
      detail: isDemo
        ? 'Identifying demo requests, capability asks, and priorities from documents...'
        : isRenewal
        ? 'Looking for churn signals, blockers, and usage patterns...'
        : 'Pulling key themes, priorities, and stated goals from customer files...',
    },
    {
      id: 4,
      label: isTech || isSecurity
        ? 'Cross-referencing technical and security requirements'
        : 'Identifying pain points and blockers',
      detail: isTech || isSecurity
        ? 'Checking documented requirements: SSO, encryption, data residency, API specs...'
        : 'Finding documented friction points across workflow and operations notes...',
    },
    {
      id: 5,
      label: 'Scanning for unresolved open questions',
      detail: 'Flagging items marked TBD, unconfirmed, or pending decision...',
    },
    {
      id: 6,
      label: isDemo
        ? 'Building tailored demo plan and presentation flow'
        : 'Synthesizing customer intelligence brief',
      detail: isDemo
        ? 'Sequencing demo steps around documented priorities and stakeholder concerns...'
        : 'Compiling grounded summary with evidence citations from all documents...',
    },
    {
      id: 7,
      label: 'Generating real-time assets from live Box data',
      detail: 'Writing demo script, slide notes, validation checklist, and executive brief...',
    },
  ];
}

const STAGE_INTERVAL_MS = 900;   // time between stage advances
const MIN_STAGES_SHOWN = 4;      // minimum stages to display before we can complete
const COMPLETE_DELAY_MS = 500;   // brief pause after both conditions met before advancing

export const InvestigationScreen: React.FC<InvestigationScreenProps> = ({
  promptText = '',
  fetchPromise,
  onComplete,
}) => {
  const stages = buildStages(promptText);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [fetchDone, setFetchDone] = useState(false);

  // Track whether onComplete has already been called
  const completedRef = useRef(false);

  // Watch for the fetch promise to resolve
  useEffect(() => {
    if (!fetchPromise) {
      // No promise provided (e.g. mount preload path) — treat as immediately done
      setFetchDone(true);
      return;
    }
    fetchPromise.then(() => setFetchDone(true)).catch(() => setFetchDone(true));
  }, [fetchPromise]);

  // Advance through stages on a timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStageIdx(prev => {
        if (prev < stages.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [stages.length]);

  // Fire onComplete once BOTH: enough stages shown AND fetch is done
  useEffect(() => {
    if (completedRef.current) return;
    if (fetchDone && currentStageIdx >= MIN_STAGES_SHOWN) {
      completedRef.current = true;
      // Quickly finish remaining stages visually, then advance
      const remaining = stages.length - 1 - currentStageIdx;
      const finishDelay = remaining > 0 ? remaining * 150 + COMPLETE_DELAY_MS : COMPLETE_DELAY_MS;
      // Flash through remaining stages
      if (remaining > 0) {
        let i = 0;
        const flush = setInterval(() => {
          setCurrentStageIdx(prev => Math.min(prev + 1, stages.length - 1));
          if (++i >= remaining) clearInterval(flush);
        }, 150);
      }
      setTimeout(onComplete, finishDelay);
    }
  }, [fetchDone, currentStageIdx, stages.length, onComplete]);

  const progressPercent = Math.round(((currentStageIdx + 1) / stages.length) * 100);

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full animate-slide-up">
      <div className="w-full bg-white rounded-2xl shadow-card border border-gray-200 p-6 sm:p-10 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center p-1 shadow-sm overflow-hidden">
              <BobTinkering className="w-full h-full" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Bob is Reading Your Box Workspace
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 italic max-w-xs truncate">
                "{promptText || 'Preparing your demo…'}"
              </p>
            </div>
          </div>
          <BoxLogo className="hidden sm:inline-block text-3xl" />
        </div>

        {/* Progress Bar */}
        <div className="my-6">
          <div className="flex items-center justify-between text-xs font-medium text-gray-600 mb-2">
            <span>Progress: Stage {currentStageIdx + 1} of {stages.length}</span>
            <span className="font-semibold text-blue-600">{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0f62fe] to-[#0061d5] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stages Checklist */}
        <div className="space-y-3 mt-6">
          {stages.map((stage, idx) => {
            const isCompleted = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;

            return (
              <div
                key={stage.id}
                className={`flex items-start space-x-3 p-3 rounded-xl transition-all duration-300 ${
                  isCurrent
                    ? 'bg-blue-50/80 border border-blue-200 shadow-xs'
                    : isCompleted
                    ? 'bg-gray-50/60 border border-gray-100 text-gray-600'
                    : 'opacity-40 text-gray-400'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 text-[#0f62fe] animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${isCurrent ? 'text-blue-900' : isCompleted ? 'text-gray-800' : 'text-gray-500'}`}>
                      {stage.label}
                    </p>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {stage.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Footer */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span className={fetchDone ? 'text-emerald-600 font-medium' : ''}>
            {fetchDone ? '✓ Box files loaded — generating assets…' : 'Fetching live Box documents via MCP…'}
          </span>
          <span className="font-mono text-[11px]">box.com/v2/mcp</span>
        </div>
      </div>
    </div>
  );
};
