import React, { useState } from 'react';
import type { ApplicationData } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Cpu, Layers, Database, HardDrive, Network, Sparkles, ArrowUpRight } from 'lucide-react';

interface Props {
  applications: ApplicationData[];
  onSelectApp: (appId: string) => void;
  selectedAppId: string | null;
}

export const CloudabilityAnalytics: React.FC<Props> = ({ applications, onSelectApp, selectedAppId }) => {
  const [activeView, setActiveView] = useState<'all' | 'breakdown' | 'unit_economics'>('all');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const chartData = applications.map((app) => ({
    name: app.name.split(' ')[0], // short name
    fullName: app.name,
    Current: app.currentCost.total,
    Optimized: app.optimizedCost.total,
    Budget: app.monthlyBudget,
    Savings: app.currentCost.total - app.optimizedCost.total,
    id: app.id
  }));

  const totalCurrentCost = applications.reduce((acc, a) => acc + a.currentCost.total, 0);

  // IBM Carbon color palette for data visualisations
  const aggregateResourceCategories = [
    { name: 'Compute / VMs', value: applications.reduce((acc, a) => acc + a.currentCost.compute, 0), color: '#0f62fe' },
    { name: 'Kubernetes Pods', value: applications.reduce((acc, a) => acc + a.currentCost.kubernetes, 0), color: '#8a3ffc' },
    { name: 'Managed Databases', value: applications.reduce((acc, a) => acc + a.currentCost.database, 0), color: '#007d79' },
    { name: 'Block & Object Storage', value: applications.reduce((acc, a) => acc + a.currentCost.storage, 0), color: '#ff832b' },
    { name: 'Network & Other PaaS', value: applications.reduce((acc, a) => acc + a.currentCost.networkOther, 0), color: '#d12771' }
  ];

  const selectedApp = applications.find(a => a.id === selectedAppId) || applications[0];

  return (
    <div className="space-y-4">
      {/* Carbon Tile Header */}
      <div className="bg-[#262626] border border-[#393939] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-[#0f62fe]/20 text-[#78a9ff] border border-[#0f62fe]/50">
                IBM Cloudability
              </span>
              <span className="text-xs text-[#8d8d8d]">Financial Visibility & Showback</span>
            </div>
            <h2 className="text-2xl font-light text-[#f4f4f4] mt-2">Multi-Cloud Spend & Unit Economics</h2>
            <p className="text-xs text-[#c6c6c6] mt-1">
              Cloudability informs FinOps teams where cloud money is going, attributes costs by business unit, and highlights budget overruns.
            </p>
          </div>

          {/* Carbon Tab switcher */}
          <div className="flex items-center bg-[#161616] p-1 border border-[#393939]">
            <button
              onClick={() => setActiveView('all')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeView === 'all' ? 'bg-[#393939] text-[#ffffff]' : 'text-[#c6c6c6] hover:text-[#ffffff]'
              }`}
            >
              App Comparison
            </button>
            <button
              onClick={() => setActiveView('breakdown')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeView === 'breakdown' ? 'bg-[#393939] text-[#ffffff]' : 'text-[#c6c6c6] hover:text-[#ffffff]'
              }`}
            >
              Resource Distribution
            </button>
            <button
              onClick={() => setActiveView('unit_economics')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeView === 'unit_economics' ? 'bg-[#393939] text-[#ffffff]' : 'text-[#c6c6c6] hover:text-[#ffffff]'
              }`}
            >
              Unit Economics
            </button>
          </div>
        </div>

        {/* Carbon Callout Banner */}
        <div className="mt-6 p-4 bg-[#161616] border-l-4 border-l-[#0f62fe] border border-[#393939] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#78a9ff] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-[#f4f4f4] uppercase tracking-wider">Retail Application Scenario (Example from Case Study)</h4>
              <p className="text-xs text-[#c6c6c6] mt-1 leading-relaxed">
                Current monthly spend is <span className="font-semibold text-[#ff8389]">$370,000/mo</span> (Budget: $310,000/mo, <span className="text-[#ff8389] font-medium">+18% above budget</span>).
                Turbonomic discovered 25 oversized VMs, pod overprovisioning, and 24x7 non-prod VMs to reduce spend to <span className="font-semibold text-[#42be65]">$290,000/mo</span> ($80k/mo savings).
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectApp('app-retail')}
            className="px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-[#ffffff] text-xs font-medium shrink-0 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Drill into Retail</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeView === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Charts */}
          <div className="lg:col-span-2 bg-[#262626] border border-[#393939] p-6">
            <h3 className="text-sm font-semibold text-[#f4f4f4] uppercase tracking-wider mb-1">Monthly Spend vs Budget vs Optimized (USD)</h3>
            <p className="text-xs text-[#8d8d8d] mb-6">Compare actual run-rates against allocated business unit budgets and Turbonomic optimized projections.</p>
            
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#393939" vertical={false} />
                  <XAxis dataKey="name" stroke="#8d8d8d" fontSize={12} tickLine={false} />
                  <YAxis stroke="#8d8d8d" fontSize={12} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#161616', borderColor: '#393939', borderRadius: '0px', color: '#f4f4f4' }}
                    formatter={(val: any) => [formatCurrency(Number(val)), '']}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="Current" fill="#fa4d56" name="Current Spend (Cloudability)" />
                  <Bar dataKey="Budget" fill="#6f6f6f" name="Allocated Budget" />
                  <Bar dataKey="Optimized" fill="#42be65" name="Optimized Spend (Turbonomic)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Allocation by Business Unit */}
          <div className="bg-[#262626] border border-[#393939] p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#f4f4f4] uppercase tracking-wider mb-1">Cost Allocation by BU</h3>
              <p className="text-xs text-[#8d8d8d] mb-4">Cloudability tag-based showback attribution.</p>

              <div className="space-y-2">
                {applications.map((app) => {
                  const percentOfTotal = Math.round((app.currentCost.total / totalCurrentCost) * 100);
                  const isOver = app.currentCost.total > app.monthlyBudget;
                  const isSelected = selectedAppId === app.id;

                  return (
                    <div
                      key={app.id}
                      onClick={() => onSelectApp(app.id)}
                      className={`p-3 border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#393939] border-[#0f62fe]'
                          : 'bg-[#161616] border-[#393939] hover:border-[#6f6f6f]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#f4f4f4]">{app.name}</span>
                        <span className="text-xs font-mono text-[#f4f4f4]">{formatCurrency(app.currentCost.total)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#8d8d8d] mt-1">
                        <span>{app.businessUnit}</span>
                        <span className={isOver ? 'text-[#ff8389] font-medium' : 'text-[#42be65] font-medium'}>
                          {isOver ? `+$${(app.currentCost.total - app.monthlyBudget) / 1000}k over budget` : 'On Budget'}
                        </span>
                      </div>
                      <div className="mt-2 w-full bg-[#262626] h-1 overflow-hidden">
                        <div className="bg-[#0f62fe] h-full" style={{ width: `${percentOfTotal}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-[#393939] flex items-center justify-between text-xs text-[#8d8d8d]">
              <span>Portfolio Total:</span>
              <span className="text-sm font-semibold text-[#f4f4f4]">{formatCurrency(totalCurrentCost)}/mo</span>
            </div>
          </div>
        </div>
      )}

      {activeView === 'breakdown' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Resource Breakdown Donut */}
          <div className="bg-[#262626] border border-[#393939] p-6">
            <h3 className="text-sm font-semibold text-[#f4f4f4] uppercase tracking-wider mb-1">Infrastructure Spend Categories</h3>
            <p className="text-xs text-[#8d8d8d] mb-6">Cloudability breakdown across Compute, Kubernetes, Database, and Storage.</p>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aggregateResourceCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {aggregateResourceCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#161616', borderColor: '#393939', borderRadius: '0px', color: '#f4f4f4' }}
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Spend']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#393939]">
              {aggregateResourceCategories.map((cat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-[#c6c6c6] truncate">{cat.name}:</span>
                  <span className="font-semibold text-[#f4f4f4] ml-auto">{formatCurrency(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Application Detailed Breakdown */}
          <div className="bg-[#262626] border border-[#393939] p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#393939]">
              <div>
                <span className="text-xs text-[#78a9ff] font-semibold uppercase tracking-wider">{selectedApp.businessUnit}</span>
                <h3 className="text-lg font-light text-[#f4f4f4] mt-0.5">{selectedApp.name}</h3>
              </div>
              <div className="flex gap-1.5">
                {selectedApp.cloudProviders.map((prov) => (
                  <span key={prov} className="px-2 py-0.5 text-xs bg-[#161616] text-[#c6c6c6] border border-[#393939]">
                    {prov}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between p-3 bg-[#161616] border border-[#393939]">
                <div className="flex items-center gap-2 text-xs text-[#f4f4f4]">
                  <Cpu className="w-4 h-4 text-[#78a9ff]" />
                  <span>Compute (EC2 / Azure VMs)</span>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs font-semibold text-[#f4f4f4]">{formatCurrency(selectedApp.currentCost.compute)}</div>
                  <div className="text-[10px] text-[#42be65]">Target: {formatCurrency(selectedApp.optimizedCost.compute)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#161616] border border-[#393939]">
                <div className="flex items-center gap-2 text-xs text-[#f4f4f4]">
                  <Layers className="w-4 h-4 text-[#a56eff]" />
                  <span>Kubernetes (EKS / AKS Pods)</span>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs font-semibold text-[#f4f4f4]">{formatCurrency(selectedApp.currentCost.kubernetes)}</div>
                  <div className="text-[10px] text-[#42be65]">Target: {formatCurrency(selectedApp.optimizedCost.kubernetes)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#161616] border border-[#393939]">
                <div className="flex items-center gap-2 text-xs text-[#f4f4f4]">
                  <Database className="w-4 h-4 text-[#007d79]" />
                  <span>Managed Databases (RDS / Aurora / SQL)</span>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs font-semibold text-[#f4f4f4]">{formatCurrency(selectedApp.currentCost.database)}</div>
                  <div className="text-[10px] text-[#42be65]">Target: {formatCurrency(selectedApp.optimizedCost.database)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#161616] border border-[#393939]">
                <div className="flex items-center gap-2 text-xs text-[#f4f4f4]">
                  <HardDrive className="w-4 h-4 text-[#ff832b]" />
                  <span>Storage (EBS / Blob / S3)</span>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs font-semibold text-[#f4f4f4]">{formatCurrency(selectedApp.currentCost.storage)}</div>
                  <div className="text-[10px] text-[#42be65]">Target: {formatCurrency(selectedApp.optimizedCost.storage)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#161616] border border-[#393939]">
                <div className="flex items-center gap-2 text-xs text-[#f4f4f4]">
                  <Network className="w-4 h-4 text-[#d12771]" />
                  <span>Network Egress & PaaS</span>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs font-semibold text-[#f4f4f4]">{formatCurrency(selectedApp.currentCost.networkOther)}</div>
                  <div className="text-[10px] text-[#42be65]">Target: {formatCurrency(selectedApp.optimizedCost.networkOther)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'unit_economics' && (
        <div className="bg-[#262626] border border-[#393939] p-6">
          <h3 className="text-sm font-semibold text-[#f4f4f4] uppercase tracking-wider mb-1">FinOps Unit Economics & Business Margin Impact</h3>
          <p className="text-xs text-[#8d8d8d] mb-6">
            Translating cloud cost reduction directly into customer & transaction unit economics to improve gross margins.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {applications.map((app) => {
              const diffPercent = Math.round(((app.unitCostBefore - app.unitCostAfter) / app.unitCostBefore) * 100);

              return (
                <div key={app.id} className="p-5 bg-[#161616] border border-[#393939] flex flex-col justify-between">
                  <div>
                    <span className="text-xs text-[#78a9ff] font-semibold uppercase tracking-wider">{app.name}</span>
                    <h4 className="text-sm font-semibold text-[#f4f4f4] mt-1">{app.unitEconomicsMetric}</h4>
                    <p className="text-xs text-[#8d8d8d] mt-1">Monthly Volume: {(app.monthlyUnits).toLocaleString()} units</p>

                    <div className="mt-4 space-y-2 font-mono">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#8d8d8d]">Current Unit Cost:</span>
                        <span className="font-semibold text-[#ff8389]">${app.unitCostBefore.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#8d8d8d]">Optimized Unit Cost:</span>
                        <span className="font-semibold text-[#42be65]">${app.unitCostAfter.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#393939] flex items-center justify-between">
                    <span className="text-xs text-[#c6c6c6]">Margin Improvement:</span>
                    <span className="px-2 py-0.5 text-xs font-semibold bg-[#42be65]/15 text-[#42be65] border border-[#42be65]/40">
                      +{diffPercent}% Efficiency
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
