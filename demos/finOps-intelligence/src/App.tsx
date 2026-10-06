import { useState } from 'react';
import { enterpriseScenarioConfig, defaultForecasts, defaultAnomalies, defaultTrueCostData } from './data/defaultConfig';
import type { EnvironmentConfig, TurbonomicAction } from './types';
import { MetricHighlights } from './components/MetricHighlights';
import { CloudabilityAnalytics } from './components/CloudabilityAnalytics';
import { CloudabilityCapabilitiesHub } from './components/CloudabilityCapabilitiesHub';
import { TurbonomicOptimizationEngine } from './components/TurbonomicOptimizationEngine';
import { ClosedLoopFinOpsWorkflow } from './components/ClosedLoopFinOpsWorkflow';
import { ApiInteractionHub } from './components/ApiInteractionHub';
import { BusinessValueHub } from './components/BusinessValueHub';
import { EnvironmentConfigModal } from './components/EnvironmentConfigModal';
import {
  Layers,
  BarChart2,
  Cpu,
  Settings,
  Code2,
  Award,
  Zap,
  TrendingUp
} from 'lucide-react';

export function App() {
  const [config, setConfig] = useState<EnvironmentConfig>(enterpriseScenarioConfig);
  const [activeTab, setActiveTab] = useState<'overview' | 'cloudability' | 'capabilities' | 'turbonomic' | 'workflow' | 'api' | 'value' | 'config'>('overview');
  const [selectedAppId, setSelectedAppId] = useState<string | null>('app-retail');

  // Handle single action execution
  const handleExecuteAction = (actionId: string) => {
    setConfig((prev) => {
      const updatedActions: TurbonomicAction[] = prev.actions.map((act) => {
        if (act.id === actionId) {
          return {
            ...act,
            status: 'EXECUTED',
            executedAt: new Date().toISOString()
          };
        }
        return act;
      });

      const totalExecutedSavings = updatedActions
        .filter((a) => a.status === 'EXECUTED')
        .reduce((sum, a) => sum + a.monthlyCostSavings, 0);

      const newSpend = prev.finopsKpis.totalMonthlySpendBefore - totalExecutedSavings;

      return {
        ...prev,
        actions: updatedActions,
        finopsKpis: {
          ...prev.finopsKpis,
          totalMonthlySpendAfter: newSpend,
          potentialMonthlySavings: totalExecutedSavings
        }
      };
    });
  };

  // Handle execute all for application
  const handleExecuteAllForApp = (appId: string) => {
    setConfig((prev) => {
      const updatedActions: TurbonomicAction[] = prev.actions.map((act) => {
        if (!appId || act.applicationId === appId) {
          return {
            ...act,
            status: 'EXECUTED',
            executedAt: new Date().toISOString()
          };
        }
        return act;
      });

      const totalExecutedSavings = updatedActions
        .filter((a) => a.status === 'EXECUTED')
        .reduce((sum, a) => sum + a.monthlyCostSavings, 0);

      const newSpend = prev.finopsKpis.totalMonthlySpendBefore - totalExecutedSavings;

      return {
        ...prev,
        actions: updatedActions,
        finopsKpis: {
          ...prev.finopsKpis,
          totalMonthlySpendAfter: newSpend,
          potentialMonthlySavings: totalExecutedSavings
        }
      };
    });
  };

  const handleResetActions = () => {
    setConfig((prev) => ({
      ...prev,
      actions: prev.actions.map((act) => ({
        ...act,
        status: 'RECOMMENDED',
        executedAt: undefined
      })),
      finopsKpis: {
        ...prev.finopsKpis,
        totalMonthlySpendAfter: enterpriseScenarioConfig.finopsKpis.totalMonthlySpendAfter,
        potentialMonthlySavings: enterpriseScenarioConfig.finopsKpis.potentialMonthlySavings
      }
    }));
  };

  const executedCount = config.actions.filter((a) => a.status === 'EXECUTED').length;

  return (
    <div className="min-h-screen bg-[#161616] text-[#f4f4f4] flex flex-col font-sans selection:bg-[#0f62fe] selection:text-[#ffffff]">
      {/* IBM Carbon Shell Header */}
      <header className="sticky top-0 z-40 bg-[#161616] border-b border-[#393939]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <span className="font-semibold text-white text-base tracking-tight">
                IBM <span className="font-light text-[#c6c6c6]">Cloudability</span> <span className="text-[#8d8d8d]">+</span> <span className="font-light text-[#c6c6c6]">Turbonomic</span>
              </span>
              <span className="hidden md:inline-block ml-3 px-2 py-0.5 text-[11px] font-semibold bg-[#0f62fe]/20 text-[#78a9ff] border border-[#0f62fe]/40 uppercase tracking-wider">
                Continuous FinOps
              </span>
            </div>
          </div>

          {/* Scopes & Config button */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-3 pr-4 border-r border-[#393939] text-xs">
              <div className="flex items-center gap-1.5 text-[#c6c6c6]">
                <span className="w-2 h-2 bg-[#42be65]" />
                <span className="font-medium text-[#f4f4f4]">Active Scopes: AWS • Azure • GCP</span>
              </div>
              <div className="text-[#8d8d8d]">
                Target: <strong className="text-[#f4f4f4] font-normal">{config.name.split(' ')[0]}</strong>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('config')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border ${
                activeTab === 'config'
                  ? 'bg-[#0f62fe] text-[#ffffff] border-[#0f62fe]'
                  : 'bg-[#262626] text-[#c6c6c6] border-[#393939] hover:bg-[#393939] hover:text-[#ffffff]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Input File / Config</span>
            </button>
          </div>
        </div>

        {/* Carbon Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto scrollbar-none border-t border-[#393939]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'overview'
                ? 'border-[#0f62fe] text-[#ffffff] bg-[#262626]'
                : 'border-transparent text-[#c6c6c6] hover:text-[#ffffff] hover:bg-[#262626]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Executive Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('cloudability')}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'cloudability'
                ? 'border-[#0f62fe] text-[#ffffff] bg-[#262626]'
                : 'border-transparent text-[#c6c6c6] hover:text-[#ffffff] hover:bg-[#262626]'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Cloudability (Financial View)</span>
          </button>

          <button
            onClick={() => setActiveTab('capabilities')}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'capabilities'
                ? 'border-[#0f62fe] text-[#ffffff] bg-[#262626]'
                : 'border-transparent text-[#c6c6c6] hover:text-[#ffffff] hover:bg-[#262626]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#78a9ff]" />
            <span>Forecasting, TrueCost™ & Anomalies</span>
          </button>

          <button
            onClick={() => setActiveTab('turbonomic')}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'turbonomic'
                ? 'border-[#0f62fe] text-[#ffffff] bg-[#262626]'
                : 'border-transparent text-[#c6c6c6] hover:text-[#ffffff] hover:bg-[#262626]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Turbonomic (Action Center)</span>
          </button>

          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'workflow'
                ? 'border-[#0f62fe] text-[#ffffff] bg-[#262626]'
                : 'border-transparent text-[#c6c6c6] hover:text-[#ffffff] hover:bg-[#262626]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Closed-Loop Workflow</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'api'
                ? 'border-[#0f62fe] text-[#ffffff] bg-[#262626]'
                : 'border-transparent text-[#c6c6c6] hover:text-[#ffffff] hover:bg-[#262626]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>REST API Console</span>
          </button>

          <button
            onClick={() => setActiveTab('value')}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'value'
                ? 'border-[#0f62fe] text-[#ffffff] bg-[#262626]'
                : 'border-transparent text-[#c6c6c6] hover:text-[#ffffff] hover:bg-[#262626]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Business Outcomes & Value</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Carbon Metric Tile Row */}
        <MetricHighlights
          kpis={config.finopsKpis}
          executedCount={executedCount}
          totalActionsCount={config.actions.length}
        />

        {/* Dynamic Views */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <ClosedLoopFinOpsWorkflow
              applications={config.applications}
              actions={config.actions}
              onExecuteAll={() => handleExecuteAllForApp('')}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CloudabilityAnalytics
                applications={config.applications}
                onSelectApp={(id) => {
                  setSelectedAppId(id);
                  setActiveTab('cloudability');
                }}
                selectedAppId={selectedAppId}
              />
              <TurbonomicOptimizationEngine
                actions={config.actions}
                applications={config.applications}
                onExecuteAction={handleExecuteAction}
                onExecuteAllForApp={handleExecuteAllForApp}
                onResetActions={handleResetActions}
                selectedAppId={selectedAppId}
              />
            </div>
          </div>
        )}

        {activeTab === 'cloudability' && (
          <CloudabilityAnalytics
            applications={config.applications}
            onSelectApp={setSelectedAppId}
            selectedAppId={selectedAppId}
          />
        )}

        {activeTab === 'capabilities' && (
          <CloudabilityCapabilitiesHub
            forecasts={config.forecasts || defaultForecasts}
            anomalies={config.anomalies || defaultAnomalies}
            trueCostData={config.trueCostData || defaultTrueCostData}
            applications={config.applications}
            onExecuteRemediation={() => {
              if (config.actions.length > 0) {
                handleExecuteAction(config.actions[0].id);
              }
            }}
          />
        )}

        {activeTab === 'turbonomic' && (
          <TurbonomicOptimizationEngine
            actions={config.actions}
            applications={config.applications}
            onExecuteAction={handleExecuteAction}
            onExecuteAllForApp={handleExecuteAllForApp}
            onResetActions={handleResetActions}
            selectedAppId={selectedAppId}
          />
        )}

        {activeTab === 'workflow' && (
          <ClosedLoopFinOpsWorkflow
            applications={config.applications}
            actions={config.actions}
            onExecuteAll={() => handleExecuteAllForApp('')}
          />
        )}

        {activeTab === 'api' && (
          <ApiInteractionHub
            config={config}
            onSimulateActionExecution={handleExecuteAction}
          />
        )}

        {activeTab === 'value' && <BusinessValueHub />}

        {activeTab === 'config' && (
          <EnvironmentConfigModal
            config={config}
            onUpdateConfig={setConfig}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#393939] bg-[#161616] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#8d8d8d] gap-2">
          <div className="flex items-center gap-2">
            <span>IBM Carbon Design System (g100)</span>
            <span>•</span>
            <span>IBM Cloudability & IBM Turbonomic Integration</span>
          </div>
          <div>
            <span>Continuous FinOps: Inform ➔ Optimize ➔ Operate ➔ Measure</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
