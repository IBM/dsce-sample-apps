import React, { useState } from 'react';
import {
  Eye,
  Sliders,
  Play,
  BarChart3,
  CheckCircle2
} from 'lucide-react';
import type { ApplicationData, TurbonomicAction } from '../types';

interface Props {
  applications: ApplicationData[];
  actions: TurbonomicAction[];
  onExecuteAll: () => void;
}

export const ClosedLoopFinOpsWorkflow: React.FC<Props> = ({ actions, onExecuteAll }) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const executedCount = actions.filter((a) => a.status === 'EXECUTED').length;
  const isAllExecuted = executedCount === actions.length;

  return (
    <div className="space-y-4">
      {/* Carbon Tile Header */}
      <div className="bg-[#262626] border border-[#393939] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-[#0f62fe]/20 text-[#78a9ff] border border-[#0f62fe]/50">
                Architectural Closed-Loop
              </span>
              <span className="text-xs text-[#8d8d8d]">FinOps Execution Engine</span>
            </div>
            <h2 className="text-2xl font-light text-[#f4f4f4] mt-2">INFORM → OPTIMIZE → OPERATE → MEASURE</h2>
            <p className="text-xs text-[#c6c6c6] mt-1">
              How IBM Cloudability and IBM Turbonomic join forces to turn cloud financial visibility into automated infrastructure optimization.
            </p>
          </div>

          <button
            onClick={onExecuteAll}
            disabled={isAllExecuted}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors ${
              isAllExecuted
                ? 'bg-[#42be65]/15 text-[#42be65] border border-[#42be65]/40 cursor-default'
                : 'bg-[#0f62fe] hover:bg-[#0353e9] text-[#ffffff]'
            }`}
          >
            {isAllExecuted ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Closed-Loop Complete</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Full Closed-Loop Cycle</span>
              </>
            )}
          </button>
        </div>

        {/* 4 Steps Navigation Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#393939] mt-6 border border-[#393939]">
          {/* Step 1: INFORM */}
          <div
            onClick={() => setActiveStep(1)}
            className={`p-4 transition-colors cursor-pointer ${
              activeStep === 1
                ? 'bg-[#393939] border-t-2 border-t-[#0f62fe]'
                : 'bg-[#161616] hover:bg-[#262626]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#78a9ff] uppercase tracking-wider">Step 1 • INFORM</span>
              <Eye className="w-4 h-4 text-[#78a9ff]" />
            </div>
            <h4 className="text-sm font-semibold text-[#f4f4f4] mt-1">IBM Cloudability</h4>
            <p className="text-xs text-[#8d8d8d] mt-1">Cost attribution, showback, budget tracking, and waste detection.</p>
          </div>

          {/* Step 2: OPTIMIZE */}
          <div
            onClick={() => setActiveStep(2)}
            className={`p-4 transition-colors cursor-pointer ${
              activeStep === 2
                ? 'bg-[#393939] border-t-2 border-t-[#8a3ffc]'
                : 'bg-[#161616] hover:bg-[#262626]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#d4bbff] uppercase tracking-wider">Step 2 • OPTIMIZE</span>
              <Sliders className="w-4 h-4 text-[#d4bbff]" />
            </div>
            <h4 className="text-sm font-semibold text-[#f4f4f4] mt-1">IBM Turbonomic</h4>
            <p className="text-xs text-[#8d8d8d] mt-1">Workload demand analytics, rightsizing, container scaling & parking.</p>
          </div>

          {/* Step 3: OPERATE */}
          <div
            onClick={() => setActiveStep(3)}
            className={`p-4 transition-colors cursor-pointer ${
              activeStep === 3
                ? 'bg-[#393939] border-t-2 border-t-[#a56eff]'
                : 'bg-[#161616] hover:bg-[#262626]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#d4bbff] uppercase tracking-wider">Step 3 • OPERATE</span>
              <Play className="w-4 h-4 text-[#a56eff]" />
            </div>
            <h4 className="text-sm font-semibold text-[#f4f4f4] mt-1">Continuous Automation</h4>
            <p className="text-xs text-[#8d8d8d] mt-1">Automated non-disruptive cloud resource modifications.</p>
          </div>

          {/* Step 4: MEASURE */}
          <div
            onClick={() => setActiveStep(4)}
            className={`p-4 transition-colors cursor-pointer ${
              activeStep === 4
                ? 'bg-[#393939] border-t-2 border-t-[#42be65]'
                : 'bg-[#161616] hover:bg-[#262626]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#42be65] uppercase tracking-wider">Step 4 • MEASURE</span>
              <BarChart3 className="w-4 h-4 text-[#42be65]" />
            </div>
            <h4 className="text-sm font-semibold text-[#f4f4f4] mt-1">Realized FinOps ROI</h4>
            <p className="text-xs text-[#8d8d8d] mt-1">Validate savings in Cloudability and continuously repeat the cycle.</p>
          </div>
        </div>
      </div>

      {/* Deep Dive Panel based on active step */}
      <div className="bg-[#262626] border border-[#393939] p-6">
        {activeStep === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#161616] border border-[#393939] text-[#78a9ff]">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#f4f4f4]">Step 1: INFORM — Financial Visibility & Accountability</h3>
                <p className="text-xs text-[#8d8d8d]">Provided by IBM Cloudability</p>
              </div>
            </div>

            <p className="text-xs text-[#c6c6c6] leading-relaxed">
              Cloudability ingests raw billing, telemetry, and tag streams across AWS, Azure, and GCP. It maps enterprise expenditures to business units, highlights that the <strong className="text-[#f4f4f4]">Retail application is spending $370,000/month (18% over budget)</strong>, and reveals low commitment coverage and idle staging costs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#78a9ff] uppercase tracking-wider">1. Ingest & Normalize</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Multi-cloud billing data normalized into standard FinOps FOCUS schemas.</p>
              </div>
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#78a9ff] uppercase tracking-wider">2. Allocate & Showback</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">100% cost attribution to application teams and business owners.</p>
              </div>
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#78a9ff] uppercase tracking-wider">3. Detect Anomalies</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Identifies budget overrun alerts and surfaces waste hotspots for Turbonomic.</p>
              </div>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#161616] border border-[#393939] text-[#d4bbff]">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#f4f4f4]">Step 2: OPTIMIZE — Performance-Aware Resource Analytics</h3>
                <p className="text-xs text-[#8d8d8d]">Provided by IBM Turbonomic</p>
              </div>
            </div>

            <p className="text-xs text-[#c6c6c6] leading-relaxed">
              Turbonomic moves beyond basic threshold matching. It constructs a full topological dependency graph of the application, analyzing CPU, GPU, memory, storage IOPS, network throughput, and cloud pricing to discover exactly how to optimize without risking SLA degradations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#d4bbff] uppercase tracking-wider">1. Workload Profiling</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Evaluates continuous peak vs average consumption across VM and Pod fleets.</p>
              </div>
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#d4bbff] uppercase tracking-wider">2. Performance Assurance</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Ensures applications always have sufficient headroom during flash-sale spikes.</p>
              </div>
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#d4bbff] uppercase tracking-wider">3. Action Formulation</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Generates specific rightsizing, container resizing, and parking schedules.</p>
              </div>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#161616] border border-[#393939] text-[#a56eff]">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#f4f4f4]">Step 3: OPERATE — Policy-Driven Continuous Automation</h3>
                <p className="text-xs text-[#8d8d8d]">Executed via IBM Turbonomic & Cloud APIs</p>
              </div>
            </div>

            <p className="text-xs text-[#c6c6c6] leading-relaxed">
              Instead of endless spreadsheets and ignored advisory emails, Turbonomic executes the changes automatically through native cloud APIs (AWS EC2/EKS, Azure VM/AKS, GCP GKE). Resizing occurs dynamically, non-prod environments park on schedule, and unattached volumes are purged.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#a56eff] uppercase tracking-wider">1. Policy Automation</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Automated execution during pre-approved maintenance or real-time windows.</p>
              </div>
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#a56eff] uppercase tracking-wider">2. Zero Friction Execution</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Reduces engineering toil by taking the burden off developers.</p>
              </div>
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#a56eff] uppercase tracking-wider">3. Audit & Rollback</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Complete change tracking and instant reversion capability if required.</p>
              </div>
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#161616] border border-[#393939] text-[#42be65]">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#f4f4f4]">Step 4: MEASURE — Realized Financial Accountability</h3>
                <p className="text-xs text-[#8d8d8d]">Closed-Loop Validation via IBM Cloudability</p>
              </div>
            </div>

            <p className="text-xs text-[#c6c6c6] leading-relaxed">
              Cloudability ingests the post-optimization billing telemetry, proving that the <strong className="text-[#f4f4f4]">Retail application cost dropped from $370k/mo to $290k/mo ($960k/yr saved)</strong>, and unit cost per checkout order fell from $0.37 to $0.29. The closed loop is complete and repeats continuously.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#42be65] uppercase tracking-wider">1. Verify Run-Rate</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Validates that monthly spend aligns with newly optimized target baselines.</p>
              </div>
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#42be65] uppercase tracking-wider">2. Unit Economics</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">Proves margin expansion per transaction, query, or active customer.</p>
              </div>
              <div className="p-4 bg-[#161616] border border-[#393939]">
                <h5 className="text-xs font-semibold text-[#42be65] uppercase tracking-wider">3. Continuous Loop</h5>
                <p className="text-xs text-[#8d8d8d] mt-1">New deployments automatically enter the Inform → Optimize cycle.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
