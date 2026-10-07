import React, { useState } from 'react';
import {
  Send,
  Copy,
  Terminal
} from 'lucide-react';
import type { EnvironmentConfig } from '../types';
import { CloudabilityApiExplorer, TurbonomicApiExplorer } from '../services/apiDocs';

interface Props {
  config: EnvironmentConfig;
  onSimulateActionExecution: (actionId: string) => void;
}

export const ApiInteractionHub: React.FC<Props> = ({ config, onSimulateActionExecution }) => {
  const [activeApi, setActiveApi] = useState<'cloudability' | 'turbonomic'>('cloudability');
  const [selectedEndpointKey, setSelectedEndpointKey] = useState<string>('cld_spend');
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestCall = () => {
    setIsExecuting(true);
    setExecutionResult(null);

    setTimeout(() => {
      setIsExecuting(false);
      if (selectedEndpointKey === 'cld_views') {
        setExecutionResult(CloudabilityApiExplorer.getReportingViews(config.cloudability.endpoint, config.cloudability.apiKey).sampleResponse);
      } else if (selectedEndpointKey === 'cld_spend') {
        setExecutionResult(CloudabilityApiExplorer.getCloudSpendReport(config.cloudability.endpoint, config.cloudability.apiKey, config.cloudability.viewId).sampleResponse);
      } else if (selectedEndpointKey === 'cld_forecast') {
        setExecutionResult(CloudabilityApiExplorer.getForecastingData(config.cloudability.endpoint).sampleResponse);
      } else if (selectedEndpointKey === 'cld_anomalies') {
        setExecutionResult(CloudabilityApiExplorer.getSpendingAnomalies(config.cloudability.endpoint).sampleResponse);
      } else if (selectedEndpointKey === 'cld_truecost') {
        setExecutionResult(CloudabilityApiExplorer.getTrueCostBreakdown(config.cloudability.endpoint).sampleResponse);
      } else if (selectedEndpointKey === 'cld_unit_econ') {
        setExecutionResult(CloudabilityApiExplorer.getUnitEconomics(config.cloudability.endpoint).sampleResponse);
      } else if (selectedEndpointKey === 'turbo_actions') {
        setExecutionResult(TurbonomicApiExplorer.getActionsByScope(config.turbonomic.serverUrl, config.turbonomic.apiPath, config.turbonomic.targetScopes[0]).sampleResponse);
      } else if (selectedEndpointKey === 'turbo_execute') {
        const firstAction = config.actions[0];
        onSimulateActionExecution(firstAction.id);
        setExecutionResult(TurbonomicApiExplorer.executeAction(config.turbonomic.serverUrl, config.turbonomic.apiPath, firstAction.id).sampleResponse);
      }
    }, 600);
  };

  return (
    <div className="space-y-4">
      {/* Carbon Tile Header */}
      <div className="bg-[#262626] border border-[#393939] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-[#0f62fe]/20 text-[#78a9ff] border border-[#0f62fe]/50">
                REST API Explorer
              </span>
              <span className="text-xs text-[#8d8d8d]">IBM Cloudability & Turbonomic Endpoints</span>
            </div>
            <h2 className="text-2xl font-light text-[#f4f4f4] mt-2">API Protocol & Payload Inspector</h2>
            <p className="text-xs text-[#c6c6c6] mt-1">
              Inspect, test, and verify the exact REST API calls exchanged between Cloudability (FinOps reports, ML forecasts, TrueCost, Anomalies) and Turbonomic (Action execution).
            </p>
          </div>

          <div className="flex items-center bg-[#161616] p-1 border border-[#393939]">
            <button
              onClick={() => {
                setActiveApi('cloudability');
                setSelectedEndpointKey('cld_spend');
                setExecutionResult(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeApi === 'cloudability'
                  ? 'bg-[#393939] text-[#ffffff]'
                  : 'text-[#c6c6c6] hover:text-[#ffffff]'
              }`}
            >
              IBM Cloudability APIs
            </button>
            <button
              onClick={() => {
                setActiveApi('turbonomic');
                setSelectedEndpointKey('turbo_actions');
                setExecutionResult(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeApi === 'turbonomic'
                  ? 'bg-[#393939] text-[#ffffff]'
                  : 'text-[#c6c6c6] hover:text-[#ffffff]'
              }`}
            >
              IBM Turbonomic APIs
            </button>
          </div>
        </div>
      </div>

      {/* Main API Testing Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Endpoint Selector List */}
        <div className="bg-[#262626] border border-[#393939] p-5 space-y-3">
          <h3 className="text-xs font-semibold text-[#8d8d8d] uppercase tracking-wider">
            {activeApi === 'cloudability' ? 'Cloudability REST Endpoints' : 'Turbonomic REST Endpoints'}
          </h3>

          {activeApi === 'cloudability' ? (
            <div className="space-y-2">
              <button
                onClick={() => {
                  setSelectedEndpointKey('cld_spend');
                  setExecutionResult(null);
                }}
                className={`w-full text-left p-3 border text-xs transition-colors ${
                  selectedEndpointKey === 'cld_spend'
                    ? 'bg-[#393939] border-[#0f62fe] text-[#f4f4f4]'
                    : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:border-[#6f6f6f]'
                }`}
              >
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-1.5 py-0.5 bg-[#0f62fe]/20 text-[#78a9ff] font-bold">GET</span>
                  <span className="truncate">/reporting/reports/spend-by-dimension</span>
                </div>
                <p className="text-[11px] text-[#8d8d8d] mt-1">Multi-cloud spend & budget variance</p>
              </button>

              <button
                onClick={() => {
                  setSelectedEndpointKey('cld_forecast');
                  setExecutionResult(null);
                }}
                className={`w-full text-left p-3 border text-xs transition-colors ${
                  selectedEndpointKey === 'cld_forecast'
                    ? 'bg-[#393939] border-[#0f62fe] text-[#f4f4f4]'
                    : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:border-[#6f6f6f]'
                }`}
              >
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-1.5 py-0.5 bg-[#0f62fe]/20 text-[#78a9ff] font-bold">GET</span>
                  <span className="truncate">/forecasting/models/ml-regressor</span>
                </div>
                <p className="text-[11px] text-[#8d8d8d] mt-1">Machine Learning predictive run-rate models</p>
              </button>

              <button
                onClick={() => {
                  setSelectedEndpointKey('cld_anomalies');
                  setExecutionResult(null);
                }}
                className={`w-full text-left p-3 border text-xs transition-colors ${
                  selectedEndpointKey === 'cld_anomalies'
                    ? 'bg-[#393939] border-[#0f62fe] text-[#f4f4f4]'
                    : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:border-[#6f6f6f]'
                }`}
              >
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-1.5 py-0.5 bg-[#0f62fe]/20 text-[#78a9ff] font-bold">GET</span>
                  <span className="truncate">/anomalies/detections</span>
                </div>
                <p className="text-[11px] text-[#8d8d8d] mt-1">Real-time spend anomaly spike detection</p>
              </button>

              <button
                onClick={() => {
                  setSelectedEndpointKey('cld_truecost');
                  setExecutionResult(null);
                }}
                className={`w-full text-left p-3 border text-xs transition-colors ${
                  selectedEndpointKey === 'cld_truecost'
                    ? 'bg-[#393939] border-[#0f62fe] text-[#f4f4f4]'
                    : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:border-[#6f6f6f]'
                }`}
              >
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-1.5 py-0.5 bg-[#0f62fe]/20 text-[#78a9ff] font-bold">GET</span>
                  <span className="truncate">/containers/truecost/allocations</span>
                </div>
                <p className="text-[11px] text-[#8d8d8d] mt-1">TrueCost™ K8s & discount amortization</p>
              </button>

              <button
                onClick={() => {
                  setSelectedEndpointKey('cld_views');
                  setExecutionResult(null);
                }}
                className={`w-full text-left p-3 border text-xs transition-colors ${
                  selectedEndpointKey === 'cld_views'
                    ? 'bg-[#393939] border-[#0f62fe] text-[#f4f4f4]'
                    : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:border-[#6f6f6f]'
                }`}
              >
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-1.5 py-0.5 bg-[#0f62fe]/20 text-[#78a9ff] font-bold">GET</span>
                  <span className="truncate">/reporting/views</span>
                </div>
                <p className="text-[11px] text-[#8d8d8d] mt-1">Query business unit showback scopes</p>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => {
                  setSelectedEndpointKey('turbo_actions');
                  setExecutionResult(null);
                }}
                className={`w-full text-left p-3 border text-xs transition-colors ${
                  selectedEndpointKey === 'turbo_actions'
                    ? 'bg-[#393939] border-[#8a3ffc] text-[#f4f4f4]'
                    : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:border-[#6f6f6f]'
                }`}
              >
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-1.5 py-0.5 bg-[#0f62fe]/20 text-[#78a9ff] font-bold">GET</span>
                  <span className="truncate">{config.turbonomic.apiPath}/actions</span>
                </div>
                <p className="text-[11px] text-[#8d8d8d] mt-1">Query pending rightsizing & parking actions</p>
              </button>

              <button
                onClick={() => {
                  setSelectedEndpointKey('turbo_execute');
                  setExecutionResult(null);
                }}
                className={`w-full text-left p-3 border text-xs transition-colors ${
                  selectedEndpointKey === 'turbo_execute'
                    ? 'bg-[#393939] border-[#8a3ffc] text-[#f4f4f4]'
                    : 'bg-[#161616] border-[#393939] text-[#c6c6c6] hover:border-[#6f6f6f]'
                }`}
              >
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-1.5 py-0.5 bg-[#42be65]/20 text-[#42be65] font-bold">POST</span>
                  <span className="truncate">{config.turbonomic.apiPath}/actions/{'{actionId}'}</span>
                </div>
                <p className="text-[11px] text-[#8d8d8d] mt-1">Execute automated resource modification</p>
              </button>
            </div>
          )}
        </div>

        {/* Request & Response Terminal */}
        <div className="lg:col-span-2 bg-[#262626] border border-[#393939] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#393939]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#42be65]" />
              <span className="text-xs font-semibold text-[#f4f4f4] uppercase tracking-wider">HTTP Request Inspector</span>
            </div>

            <button
              onClick={handleTestCall}
              disabled={isExecuting}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0f62fe] hover:bg-[#0353e9] text-[#ffffff] text-xs font-medium transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>{isExecuting ? 'Sending...' : 'Send Test Request'}</span>
            </button>
          </div>

          {/* Request Box */}
          <div className="space-y-1">
            <span className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">Target Request Details</span>
            <div className="p-3 bg-[#161616] border border-[#393939] font-mono text-xs text-[#c6c6c6] overflow-x-auto">
              <div className="text-[#78a9ff] font-semibold">
                {selectedEndpointKey === 'turbo_execute' ? 'POST' : 'GET'}{' '}
                {activeApi === 'cloudability'
                  ? `${config.cloudability.endpoint}${
                      selectedEndpointKey === 'cld_views'
                        ? '/reporting/views'
                        : selectedEndpointKey === 'cld_spend'
                        ? `/reporting/reports/spend-by-dimension?viewId=${config.cloudability.viewId}`
                        : selectedEndpointKey === 'cld_forecast'
                        ? '/forecasting/models/ml-regressor?horizon=6months'
                        : selectedEndpointKey === 'cld_anomalies'
                        ? '/anomalies/detections?timeframe=last_7_days'
                        : selectedEndpointKey === 'cld_truecost'
                        ? '/containers/truecost/allocations'
                        : '/business-metrics/unit-economics'
                    }`
                  : `${config.turbonomic.serverUrl}${config.turbonomic.apiPath}/${
                      selectedEndpointKey === 'turbo_actions'
                        ? `actions?scope=${encodeURIComponent(config.turbonomic.targetScopes[0])}`
                        : `actions/${config.actions[0].id}`
                    }`}
              </div>
              <div className="text-[#8d8d8d] mt-1">
                Authorization: Bearer {activeApi === 'cloudability' ? 'cld-live-***' : 'turbotoken_***'}
              </div>
            </div>
          </div>

          {/* Response Payload */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">HTTP 200 OK Response Payload</span>
              {executionResult && (
                <button
                  onClick={() => copyToClipboard(JSON.stringify(executionResult, null, 2))}
                  className="inline-flex items-center gap-1 text-[11px] text-[#78a9ff] hover:text-[#a6c8ff]"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              )}
            </div>

            <pre className="p-3 bg-[#161616] border border-[#393939] font-mono text-xs text-[#42be65] max-h-64 overflow-y-auto leading-relaxed">
              {executionResult
                ? JSON.stringify(executionResult, null, 2)
                : '// Click "Send Test Request" to query live API response mock with current environment credentials...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
