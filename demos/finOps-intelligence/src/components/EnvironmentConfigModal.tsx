import React, { useState } from 'react';
import type { EnvironmentConfig } from '../types';
import { Upload, Download, RefreshCw, CheckCircle2, AlertTriangle, Server, Cloud } from 'lucide-react';
import { enterpriseScenarioConfig } from '../data/defaultConfig';

interface Props {
  config: EnvironmentConfig;
  onUpdateConfig: (newConfig: EnvironmentConfig) => void;
}

export const EnvironmentConfigModal: React.FC<Props> = ({ config, onUpdateConfig }) => {
  const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [formData, setFormData] = useState<EnvironmentConfig>(config);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        // validate minimal schema
        if (!parsed.cloudability || !parsed.turbonomic || !parsed.applications) {
          throw new Error("Missing required config sections (cloudability, turbonomic, or applications)");
        }
        setJsonText(JSON.stringify(parsed, null, 2));
        setFormData(parsed);
        onUpdateConfig(parsed);
        setParseError(null);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err: any) {
        setParseError(`Failed to parse JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleJsonSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setFormData(parsed);
      onUpdateConfig(parsed);
      setParseError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setParseError(`JSON Syntax Error: ${err.message}`);
    }
  };

  const handleResetDefault = () => {
    setFormData(enterpriseScenarioConfig);
    setJsonText(JSON.stringify(enterpriseScenarioConfig, null, 2));
    onUpdateConfig(enterpriseScenarioConfig);
    setParseError(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDownloadConfig = () => {
    const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloud-finops-env-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#262626] border border-[#393939] p-6 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#393939]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-[#0f62fe]/20 text-[#78a9ff] border border-[#0f62fe]/50">
              Environment & API Target Configuration
            </span>
          </div>
          <h2 className="text-2xl font-light text-[#f4f4f4] mt-2">Multi-Cloud & IBM API Setup</h2>
          <p className="text-xs text-[#c6c6c6] mt-1">
            Accept configuration via JSON file upload or interactive fields for IBM Cloudability and IBM Turbonomic integration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-[#ffffff] text-xs font-medium transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload JSON Input File</span>
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={handleDownloadConfig}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#161616] hover:bg-[#393939] text-[#f4f4f4] text-xs font-medium border border-[#393939] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Config</span>
          </button>

          <button
            onClick={handleResetDefault}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#161616] hover:bg-[#393939] text-[#f4f4f4] text-xs font-medium border border-[#393939] transition-colors"
            title="Reset to $2M/mo Retail/Banking/Analytics Enterprise Baseline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Load Default Scenario</span>
          </button>
        </div>
      </div>

      {parseError && (
        <div className="mt-4 p-3 bg-[#fa4d56]/15 border border-[#fa4d56]/40 flex items-center gap-3 text-[#ff8389] text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="mt-4 p-3 bg-[#42be65]/15 border border-[#42be65]/40 flex items-center gap-3 text-[#42be65] text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Configuration applied successfully to live FinOps analytics and automation engine!</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#393939] mt-6 gap-6">
        <button
          onClick={() => setActiveTab('form')}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'form'
              ? 'border-[#0f62fe] text-[#78a9ff]'
              : 'border-transparent text-[#8d8d8d] hover:text-[#f4f4f4]'
          }`}
        >
          Form View (Parameters)
        </button>
        <button
          onClick={() => {
            setJsonText(JSON.stringify(formData, null, 2));
            setActiveTab('json');
          }}
          className={`pb-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'json'
              ? 'border-[#0f62fe] text-[#78a9ff]'
              : 'border-transparent text-[#8d8d8d] hover:text-[#f4f4f4]'
          }`}
        >
          Raw JSON Input Editor
        </button>
      </div>

      {activeTab === 'form' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          {/* IBM Cloudability Config Card */}
          <div className="p-5 bg-[#161616] border border-[#393939] space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#393939]">
              <div className="p-2 bg-[#262626] border border-[#393939] text-[#78a9ff]">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[#f4f4f4] text-sm">IBM Cloudability API Target</h3>
                <p className="text-xs text-[#8d8d8d]">Financial Management, Allocation & Tagging</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">Cloudability REST API Endpoint</label>
                <input
                  type="text"
                  value={formData.cloudability.endpoint}
                  onChange={(e) => {
                    const updated = {
                      ...formData,
                      cloudability: { ...formData.cloudability, endpoint: e.target.value }
                    };
                    setFormData(updated);
                    onUpdateConfig(updated);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-[#262626] border border-[#393939] text-xs text-[#f4f4f4] focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">API Key / Token (FinOps Read-Only)</label>
                <input
                  type="password"
                  value={formData.cloudability.apiKey}
                  onChange={(e) => {
                    const updated = {
                      ...formData,
                      cloudability: { ...formData.cloudability, apiKey: e.target.value }
                    };
                    setFormData(updated);
                    onUpdateConfig(updated);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-[#262626] border border-[#393939] text-xs text-[#f4f4f4] focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">Reporting View ID</label>
                <input
                  type="text"
                  value={formData.cloudability.viewId}
                  onChange={(e) => {
                    const updated = {
                      ...formData,
                      cloudability: { ...formData.cloudability, viewId: e.target.value }
                    };
                    setFormData(updated);
                    onUpdateConfig(updated);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-[#262626] border border-[#393939] text-xs text-[#f4f4f4] focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">Configured Cloud Vendor Accounts</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="text-xs px-2 py-0.5 bg-[#ff832b]/15 text-[#ffb178] border border-[#ff832b]/40">
                    AWS ({formData.cloudability.vendorAccounts.aws.length} accounts)
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-[#0f62fe]/15 text-[#78a9ff] border border-[#0f62fe]/40">
                    Azure ({formData.cloudability.vendorAccounts.azure.length} subs)
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-[#42be65]/15 text-[#42be65] border border-[#42be65]/40">
                    GCP ({formData.cloudability.vendorAccounts.gcp.length} projects)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* IBM Turbonomic Config Card */}
          <div className="p-5 bg-[#161616] border border-[#393939] space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#393939]">
              <div className="p-2 bg-[#262626] border border-[#393939] text-[#d4bbff]">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[#f4f4f4] text-sm">IBM Turbonomic API Target</h3>
                <p className="text-xs text-[#8d8d8d]">Resource Optimization & Performance Engine</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">Turbonomic Server URL / Host</label>
                <input
                  type="text"
                  value={formData.turbonomic.serverUrl}
                  onChange={(e) => {
                    const updated = {
                      ...formData,
                      turbonomic: { ...formData.turbonomic, serverUrl: e.target.value }
                    };
                    setFormData(updated);
                    onUpdateConfig(updated);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-[#262626] border border-[#393939] text-xs text-[#f4f4f4] focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">API Base Path</label>
                <input
                  type="text"
                  value={formData.turbonomic.apiPath}
                  onChange={(e) => {
                    const updated = {
                      ...formData,
                      turbonomic: { ...formData.turbonomic, apiPath: e.target.value }
                    };
                    setFormData(updated);
                    onUpdateConfig(updated);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-[#262626] border border-[#393939] text-xs text-[#f4f4f4] focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">Service Account / Role</label>
                <input
                  type="text"
                  value={formData.turbonomic.username}
                  onChange={(e) => {
                    const updated = {
                      ...formData,
                      turbonomic: { ...formData.turbonomic, username: e.target.value }
                    };
                    setFormData(updated);
                    onUpdateConfig(updated);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-[#262626] border border-[#393939] text-xs text-[#f4f4f4] focus:outline-none focus:border-[#0f62fe]"
                />
              </div>

              <div>
                <label className="text-xs text-[#8d8d8d] font-semibold uppercase tracking-wider">Active Target Scopes ({formData.turbonomic.targetScopes.length})</label>
                <div className="mt-1 flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                  {formData.turbonomic.targetScopes.map((scope, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-[#262626] text-[#c6c6c6] border border-[#393939]">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-xs text-[#8d8d8d]">
            Edit the entire multi-cloud environment topology, applications, budget limits, and Turbonomic action queue directly:
          </p>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={16}
            className="w-full font-mono text-xs bg-[#161616] p-4 border border-[#393939] text-[#42be65] focus:outline-none focus:border-[#0f62fe]"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={handleJsonSave}
              className="px-5 py-2.5 bg-[#0f62fe] hover:bg-[#0353e9] text-[#ffffff] font-medium text-xs transition-colors"
            >
              Apply JSON Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
