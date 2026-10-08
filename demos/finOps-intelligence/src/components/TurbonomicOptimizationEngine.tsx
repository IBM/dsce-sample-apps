import React, { useState } from 'react';
import type { TurbonomicAction, ApplicationData } from '../types';
import {
  Zap,
  CheckCircle2,
  Layers,
  Server,
  Database,
  HardDrive,
  Play,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Activity
} from 'lucide-react';

interface Props {
  actions: TurbonomicAction[];
  applications: ApplicationData[];
  onExecuteAction: (actionId: string) => void;
  onExecuteAllForApp: (appId: string) => void;
  onResetActions: () => void;
  selectedAppId: string | null;
}

export const TurbonomicOptimizationEngine: React.FC<Props> = ({
  actions,
  applications,
  onExecuteAction,
  onExecuteAllForApp,
  onResetActions,
  selectedAppId
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterApp, setFilterApp] = useState<string>(selectedAppId || 'ALL');

  const filteredActions = actions.filter((act) => {
    const matchesType = filterType === 'ALL' || act.actionType === filterType;
    const matchesApp = filterApp === 'ALL' || act.applicationId === filterApp;
    return matchesType && matchesApp;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const getEntityIcon = (type: TurbonomicAction['entityType']) => {
    switch (type) {
      case 'VirtualMachine':
        return <Server className="w-4 h-4 text-[#78a9ff]" />;
      case 'ContainerPod':
        return <Layers className="w-4 h-4 text-[#a56eff]" />;
      case 'DatabaseServer':
        return <Database className="w-4 h-4 text-[#007d79]" />;
      case 'Volume':
        return <HardDrive className="w-4 h-4 text-[#ff832b]" />;
      default:
        return <Cpu className="w-4 h-4 text-[#c6c6c6]" />;
    }
  };

  const getActionTypeBadge = (actionType: TurbonomicAction['actionType']) => {
    switch (actionType) {
      case 'RIGHTSIZE':
        return <span className="px-2 py-0.5 text-[11px] font-semibold uppercase bg-[#0f62fe]/15 text-[#78a9ff] border border-[#0f62fe]/40">Rightsize VM/DB</span>;
      case 'RESIZE_CPU_MEM':
        return <span className="px-2 py-0.5 text-[11px] font-semibold uppercase bg-[#8a3ffc]/15 text-[#d4bbff] border border-[#8a3ffc]/40">K8s Pod Resizing</span>;
      case 'PARK_OFFHOURS':
        return <span className="px-2 py-0.5 text-[11px] font-semibold uppercase bg-[#6929c4]/15 text-[#d4bbff] border border-[#6929c4]/40">Workload Parking</span>;
      case 'PURGE_UNUSED':
        return <span className="px-2 py-0.5 text-[11px] font-semibold uppercase bg-[#fa4d56]/15 text-[#ff8389] border border-[#fa4d56]/40">Purge Unused / Zombie</span>;
      case 'SCALE_TIER':
        return <span className="px-2 py-0.5 text-[11px] font-semibold uppercase bg-[#ff832b]/15 text-[#ffb178] border border-[#ff832b]/40">Scale Storage Tier</span>;
    }
  };

  const executedSavings = actions
    .filter((a) => a.status === 'EXECUTED')
    .reduce((acc, a) => acc + a.monthlyCostSavings, 0);

  const pendingSavings = actions
    .filter((a) => a.status === 'RECOMMENDED')
    .reduce((acc, a) => acc + a.monthlyCostSavings, 0);

  return (
    <div className="space-y-4">
      {/* Carbon Tile Header */}
      <div className="bg-[#262626] border border-[#393939] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-[#8a3ffc]/20 text-[#d4bbff] border border-[#8a3ffc]/50">
                IBM Turbonomic
              </span>
              <span className="text-xs text-[#8d8d8d]">Performance-Aware Automation Engine</span>
            </div>
            <h2 className="text-2xl font-light text-[#f4f4f4] mt-2">Workload Demand & Infrastructure Actions</h2>
            <p className="text-xs text-[#c6c6c6] mt-1">
              Turbonomic analyzes actual CPU, memory, IOPS, and network demand to generate safe, non-disruptive rightsizing and automated execution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onExecuteAllForApp(filterApp === 'ALL' ? '' : filterApp)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-[#ffffff] text-xs font-medium transition-colors"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{filterApp === 'ALL' ? 'Automate All Actions' : 'Automate Filtered BU'}</span>
            </button>
            <button
              onClick={onResetActions}
              className="p-2 bg-[#161616] hover:bg-[#393939] text-[#c6c6c6] border border-[#393939] transition-colors"
              title="Reset actions to recommended state"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#393939] mt-6 border border-[#393939]">
          <div className="p-4 bg-[#161616] flex items-center justify-between">
            <span className="text-xs text-[#8d8d8d]">Total Optimization Potential:</span>
            <span className="text-sm font-mono font-semibold text-[#f4f4f4]">{formatCurrency(executedSavings + pendingSavings)}/mo</span>
          </div>
          <div className="p-4 bg-[#161616] flex items-center justify-between">
            <span className="text-xs text-[#42be65]">Realized Automated Savings:</span>
            <span className="text-sm font-mono font-semibold text-[#42be65]">{formatCurrency(executedSavings)}/mo</span>
          </div>
          <div className="p-4 bg-[#161616] flex items-center justify-between">
            <span className="text-xs text-[#f1c21b]">Pending Actions in Queue:</span>
            <span className="text-sm font-mono font-semibold text-[#f1c21b]">{actions.filter(a => a.status === 'RECOMMENDED').length} actions</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[#393939]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#8d8d8d]">Target Application:</span>
            <select
              value={filterApp}
              onChange={(e) => setFilterApp(e.target.value)}
              className="text-xs bg-[#161616] border border-[#393939] px-2.5 py-1.5 text-[#f4f4f4] focus:outline-none focus:border-[#0f62fe]"
            >
              <option value="ALL">All Enterprise Applications</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {['ALL', 'RIGHTSIZE', 'RESIZE_CPU_MEM', 'PARK_OFFHOURS', 'PURGE_UNUSED', 'SCALE_TIER'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  filterType === type
                    ? 'bg-[#0f62fe] text-[#ffffff]'
                    : 'bg-[#161616] text-[#c6c6c6] border border-[#393939] hover:bg-[#393939]'
                }`}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action List Grid */}
      <div className="space-y-2">
        {filteredActions.length === 0 ? (
          <div className="text-center py-12 bg-[#262626] border border-[#393939] text-[#8d8d8d] text-xs">
            No optimization actions match the selected filter criteria.
          </div>
        ) : (
          filteredActions.map((action) => {
            const app = applications.find((a) => a.id === action.applicationId);
            const isExecuted = action.status === 'EXECUTED';
            const isExecuting = action.status === 'EXECUTING';

            return (
              <div
                key={action.id}
                className={`p-5 border transition-colors ${
                  isExecuted
                    ? 'bg-[#262626] border-l-4 border-l-[#42be65] border-[#393939]'
                    : 'bg-[#262626] border-l-4 border-l-[#0f62fe] border-[#393939] hover:border-r-[#6f6f6f]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Entity info & Badges */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-[#f4f4f4] font-semibold">
                        {getEntityIcon(action.entityType)}
                        <span>{action.targetEntityName}</span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] bg-[#161616] text-[#c6c6c6] border border-[#393939]">
                        {action.cloudProvider}
                      </span>
                      {getActionTypeBadge(action.actionType)}
                      <span className="text-xs text-[#8d8d8d]">
                        • {app?.name} ({app?.businessUnit})
                      </span>
                    </div>

                    {/* Resizing Transition */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs bg-[#161616] p-3 border border-[#393939]">
                      <div className="text-[#ff8389] font-mono flex items-center gap-1">
                        <span className="text-[11px] text-[#8d8d8d]">Current:</span> {action.currentSpecification}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#8d8d8d] hidden sm:block" />
                      <div className="text-[#42be65] font-mono font-medium flex items-center gap-1">
                        <span className="text-[11px] text-[#8d8d8d]">Target:</span> {action.recommendedSpecification}
                      </div>
                    </div>

                    {/* Workload Rationale */}
                    <div className="flex items-start gap-2 text-xs text-[#c6c6c6]">
                      <ShieldCheck className="w-4 h-4 text-[#78a9ff] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{action.reason}</p>
                    </div>

                    {/* Performance telemetry stats */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#8d8d8d] pt-1 font-mono">
                      <span>CPU Avg: <strong className="text-[#f4f4f4]">{action.performanceMetrics.cpuAvgUtilization}%</strong></span>
                      <span>CPU Peak: <strong className="text-[#f4f4f4]">{action.performanceMetrics.cpuPeakUtilization}%</strong></span>
                      <span>Memory Peak: <strong className="text-[#f4f4f4]">{action.performanceMetrics.memPeakUtilization}%</strong></span>
                      {action.performanceMetrics.iopsOrLatencyRisk && (
                        <span className="text-[#78a9ff]">Telemetry: {action.performanceMetrics.iopsOrLatencyRisk}</span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Cost Savings & Action Execution */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#393939]">
                    <div className="text-left lg:text-right font-mono">
                      <div className="text-[11px] text-[#8d8d8d] uppercase tracking-wider">Estimated Savings</div>
                      <div className="text-lg font-light text-[#42be65]">
                        {formatCurrency(action.monthlyCostSavings)}
                        <span className="text-xs text-[#8d8d8d] font-normal">/mo</span>
                      </div>
                      <div className="text-[10px] text-[#8d8d8d]">
                        {formatCurrency(action.monthlyCostSavings * 12)}/yr run-rate
                      </div>
                    </div>

                    <div>
                      {isExecuted ? (
                        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#42be65]/15 text-[#42be65] border border-[#42be65]/40 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Executed & Verified</span>
                        </div>
                      ) : isExecuting ? (
                        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0f62fe]/15 text-[#78a9ff] border border-[#0f62fe]/40 text-xs font-medium animate-pulse">
                          <Activity className="w-4 h-4 animate-spin" />
                          <span>Orchestrating Cloud API...</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => onExecuteAction(action.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-[#ffffff] text-xs font-medium transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Execute Optimization</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
