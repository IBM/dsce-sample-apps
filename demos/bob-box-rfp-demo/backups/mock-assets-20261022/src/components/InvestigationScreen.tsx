import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { BobTinkering } from './BobTinkering';

interface InvestigationScreenProps {
  onComplete: () => void;
}

interface InvestigationStage {
  id: number;
  label: string;
  detail: string;
}

const STAGES: InvestigationStage[] = [
  { id: 1, label: 'Searching Acme’s Box workspace', detail: 'Querying 12 structured customer documents in Box repository...' },
  { id: 2, label: 'Reviewing discovery notes', detail: 'Parsing Acme_Discovery_Notes.docx and Customer_Workflow_Notes.docx...' },
  { id: 3, label: 'Extracting documented pain points', detail: 'Synthesizing manual classification backlog, legacy shares, and Salesforce re-entry...' },
  { id: 4, label: 'Identifying technical requirements', detail: 'Cross-referencing SSO, Salesforce integration, REST APIs, and US Data Residency...' },
  { id: 5, label: 'Reviewing previous customer questions', detail: 'Analyzing RFP mandatory criteria and SE Demo Request priorities...' },
  { id: 6, label: 'Finding unresolved questions', detail: 'Isolating 5 unconfirmed items (volume, retention schedule, external collaborators)...' },
  { id: 7, label: 'Building the demo briefing', detail: 'Synthesizing evidence citations and preparing tailored presentation packet...' },
];

export const InvestigationScreen: React.FC<InvestigationScreenProps> = ({ onComplete }) => {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);

  useEffect(() => {
    // Progress through stages every ~850ms (total ~6 seconds)
    const interval = setInterval(() => {
      setCurrentStageIdx((prev) => {
        if (prev < STAGES.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            onComplete();
          }, 600);
          return prev;
        }
      });
    }, 850);

    return () => clearInterval(interval);
  }, [onComplete]);

  const progressPercent = Math.round(((currentStageIdx + 1) / STAGES.length) * 100);

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full animate-slide-up">
      {/* Investigation Card */}
      <div className="w-full bg-white rounded-2xl shadow-card border border-gray-200 p-6 sm:p-10 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center p-1 shadow-sm overflow-hidden">
              <BobTinkering className="w-full h-full" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Bob is Investigating Acme’s Box Workspace
              </h2>
              <p className="text-xs text-gray-500">
                Extracting grounded customer context via Box Model Context Protocol (MCP)
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="my-6">
          <div className="flex items-center justify-between text-xs font-medium text-gray-600 mb-2">
            <span>Progress: Stage {currentStageIdx + 1} of {STAGES.length}</span>
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
          {STAGES.map((stage, idx) => {
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
                        In Progress
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

        {/* Trust Notice */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Grounded in synthetic Box documents • Deterministic reasoning</span>
          <span className="font-mono text-[11px]">acme.app.box.com/v2/mcp</span>
        </div>
      </div>
    </div>
  );
};
