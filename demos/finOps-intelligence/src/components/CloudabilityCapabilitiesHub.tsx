import React, { useState } from 'react';
import type { CloudabilityForecast, SpendingAnomaly, TrueCostDimension, ApplicationData } from '../types';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  AlertOctagon,
  Zap,
  ShieldCheck,
  CheckCircle2,
  PieChart as PieIcon,
  Tag,
  Layers,
  Sparkles,
  Award
} from 'lucide-react';

interface Props {
  forecasts: CloudabilityForecast[];
  anomalies: SpendingAnomaly[];
  trueCostData: TrueCostDimension[];
  applications: ApplicationData[];
  onExecuteRemediation?: (anomalyId: string) => void;
}

export const CloudabilityCapabilitiesHub: React.FC<Props> = ({
  forecasts,
  anomalies,
  trueCostData,
  onExecuteRemediation
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'forecasting' | 'truecost' | 'anomalies' | 'features'>('forecasting');
  const [anomalyFilter, setAnomalyFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [remediatedIds, setRemediatedIds] = useState<string[]>(['anom-002', 'anom-004']);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const filteredAnomalies = anomalies.filter(
    (a) => anomalyFilter === 'ALL' || a.severity === anomalyFilter
  );

  const handleRemediate = (id: string) => {
    if (!remediatedIds.includes(id)) {
      setRemediatedIds((prev) => [...prev, id]);
    }
    if (onExecuteRemediation) {
      onExecuteRemediation(id);
    }
  };

  // TrueCost category color map
  const trueCostColors = ['#0f62fe', '#8a3ffc', '#007d79', '#ff832b', '#d12771', '#33b1ff'];

  const trueCostPieData = trueCostData.map((d, i) => ({
    name: d.dimensionCategory.split(' ')[0] + ' ' + (d.dimensionCategory.split(' ')[1] || ''),
    fullName: d.dimensionCategory,
    value: Math.max(0, d.trueCost),
    rawSpend: d.rawSpend,
    discounts: d.amortizedDiscounts,
    color: trueCostColors[i % trueCostColors.length]
  }));

  const totalRawSpend = trueCostData.reduce((acc, d) => acc + d.rawSpend, 0);
  const totalTrueCost = trueCostData.reduce((acc, d) => acc + d.trueCost, 0);
  const totalDiscounts = trueCostData.reduce((acc, d) => acc + Math.abs(d.amortizedDiscounts), 0);

  return (
    <div className="space-y-4">
      {/* Carbon Tile Header */}
      <div className="bg-[#262626] border border-[#393939] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-[#0f62fe]/20 text-[#78a9ff] border border-[#0f62fe]/50">
                IBM Cloudability Suite
              </span>
              <span className="text-xs text-[#8d8d8d]">Financial Intelligence & FinOps Governance</span>
            </div>
            <h2 className="text-2xl font-light text-[#f4f4f4] mt-2">
              Forecasting, TrueCost™ Explorer & Spending Anomalies
            </h2>
            <p className="text-xs text-[#c6c6c6] mt-1">
              Deep-dive into IBM Cloudability's machine learning cost forecasts, container TrueCost allocation, real-time anomaly detection, and core FinOps capabilities.
            </p>
          </div>

          {/* Carbon Sub-Tabs Switcher */}
          <div className="flex flex-wrap items-center bg-[#161616] p-1 border border-[#393939]">
            <button
              onClick={() => setActiveSubTab('forecasting')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'forecasting'
                  ? 'bg-[#393939] text-[#ffffff]'
                  : 'text-[#c6c6c6] hover:text-[#ffffff]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#78a9ff]" />
              <span>Forecasting & Budgets</span>
            </button>

            <button
              onClick={() => setActiveSubTab('truecost')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'truecost'
                  ? 'bg-[#393939] text-[#ffffff]'
                  : 'text-[#c6c6c6] hover:text-[#ffffff]'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5 text-[#a56eff]" />
              <span>TrueCost™ Explorer</span>
            </button>

            <button
              onClick={() => setActiveSubTab('anomalies')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'anomalies'
                  ? 'bg-[#393939] text-[#ffffff]'
                  : 'text-[#c6c6c6] hover:text-[#ffffff]'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-[#fa4d56]" />
              <span>Spending Anomalies</span>
            </button>

            <button
              onClick={() => setActiveSubTab('features')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'features'
                  ? 'bg-[#393939] text-[#ffffff]'
                  : 'text-[#c6c6c6] hover:text-[#ffffff]'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-[#42be65]" />
              <span>Capabilities Matrix</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: FORECASTING */}
      {activeSubTab === 'forecasting' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Forecast Chart */}
            <div className="lg:col-span-2 bg-[#262626] border border-[#393939] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#393939] gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#f4f4f4] uppercase tracking-wider">
                    Machine Learning Spend Trajectory (9-Month Forecast)
                  </h3>
                  <p className="text-xs text-[#8d8d8d] mt-0.5">
                    Unconstrained Growth vs Turbonomic Closed-Loop vs Monthly Budget ($1.75M)
                  </p>
                </div>
                <span className="px-2 py-0.5 text-[11px] bg-[#0f62fe]/15 text-[#78a9ff] border border-[#0f62fe]/40 font-mono">
                  Confidence: 95% Interval
                </span>
              </div>

              <div className="h-80 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecasts} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#393939" vertical={false} />
                    <XAxis dataKey="month" stroke="#8d8d8d" fontSize={11} tickLine={false} />
                    <YAxis stroke="#8d8d8d" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#161616', borderColor: '#393939', borderRadius: '0px', color: '#f4f4f4' }}
                      formatter={(val: any) => [val !== null ? formatCurrency(Number(val)) : 'N/A', '']}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="confidenceUpper"
                      fill="#fa4d56"
                      fillOpacity={0.08}
                      stroke="none"
                      name="Confidence Range Upper"
                    />
                    <Line
                      type="monotone"
                      dataKey="unconstrainedForecast"
                      stroke="#fa4d56"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#fa4d56' }}
                      name="Unconstrained Run-Rate (No Action)"
                    />
                    <Line
                      type="monotone"
                      dataKey="budgetTarget"
                      stroke="#f1c21b"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                      name="Allocated Budget Limit ($1.75M)"
                    />
                    <Line
                      type="monotone"
                      dataKey="optimizedForecast"
                      stroke="#42be65"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#42be65' }}
                      name="Cloudability + Turbonomic Optimized"
                    />
                    <Bar
                      dataKey="baselineHistorical"
                      fill="#0f62fe"
                      opacity={0.7}
                      name="Historical Invoiced Actuals"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Forecast Summary & Insights */}
            <div className="bg-[#262626] border border-[#393939] p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#f4f4f4] uppercase tracking-wider mb-3">
                  Forecasting Intelligence
                </h3>

                <div className="space-y-3 font-mono">
                  <div className="p-3 bg-[#161616] border border-[#393939]">
                    <span className="text-[11px] text-[#8d8d8d] uppercase tracking-wider block">Unconstrained Q3 Exit Run-Rate</span>
                    <span className="text-xl font-light text-[#fa4d56] mt-1 block">$2,750,000/mo</span>
                    <span className="text-[10px] text-[#ff8389]">+57% over allocated budget without Turbonomic actions</span>
                  </div>

                  <div className="p-3 bg-[#161616] border border-[#393939]">
                    <span className="text-[11px] text-[#8d8d8d] uppercase tracking-wider block">Closed-Loop Optimized Run-Rate</span>
                    <span className="text-xl font-light text-[#42be65] mt-1 block">$1,510,000/mo</span>
                    <span className="text-[10px] text-[#42be65]">-13.7% below budget target with continuous right-sizing</span>
                  </div>

                  <div className="p-3 bg-[#161616] border border-[#393939]">
                    <span className="text-[11px] text-[#8d8d8d] uppercase tracking-wider block">Cumulative 6-Month Avoided Spend</span>
                    <span className="text-xl font-light text-[#78a9ff] mt-1 block">$5,450,000</span>
                    <span className="text-[10px] text-[#c6c6c6]">Measured across AWS, Azure, and GCP</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#393939] text-xs text-[#8d8d8d]">
                <span>Algorithms: <strong>ARIMA + XGBoost Multi-Cloud Seasonal Regressors</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRUECOST EXPLORER */}
      {activeSubTab === 'truecost' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Donut Chart of TrueCost */}
            <div className="bg-[#262626] border border-[#393939] p-6">
              <h3 className="text-sm font-semibold text-[#f4f4f4] uppercase tracking-wider mb-1">
                TrueCost™ Amortized Allocation
              </h3>
              <p className="text-xs text-[#8d8d8d] mb-4">
                Raw cloud spend adjusted for EDP discounts, RI amortization, shared K8s, and tag hygiene.
              </p>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={trueCostPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {trueCostPieData.map((entry, index) => (
                        <Cell key={`tc-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#161616', borderColor: '#393939', borderRadius: '0px', color: '#f4f4f4' }}
                      formatter={(val: any) => [formatCurrency(Number(val)), 'TrueCost']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-3 border-t border-[#393939] space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-[#8d8d8d]">
                  <span>Total Invoiced Spend:</span>
                  <span className="text-[#f4f4f4] font-semibold">{formatCurrency(totalRawSpend)}</span>
                </div>
                <div className="flex justify-between text-[#8d8d8d]">
                  <span>Commitment Discounts Reallocated:</span>
                  <span className="text-[#42be65]">-{formatCurrency(totalDiscounts)}</span>
                </div>
                <div className="flex justify-between text-[#8d8d8d] pt-1 border-t border-[#393939]">
                  <span className="text-[#78a9ff] font-semibold">Net TrueCost (BU Attributed):</span>
                  <span className="text-[#78a9ff] font-semibold">{formatCurrency(totalTrueCost)}</span>
                </div>
              </div>
            </div>

            {/* Right: TrueCost Dimension Breakdown Table */}
            <div className="lg:col-span-2 bg-[#262626] border border-[#393939] p-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#393939]">
                <div>
                  <h3 className="text-sm font-semibold text-[#f4f4f4] uppercase tracking-wider">
                    TrueCost™ Multi-Cloud Dimension Ledger
                  </h3>
                  <p className="text-xs text-[#8d8d8d] mt-0.5">
                    Tag compliance scoring & amortized unit allocation per business unit
                  </p>
                </div>
                <span className="px-2 py-0.5 text-xs bg-[#42be65]/15 text-[#42be65] border border-[#42be65]/40 font-mono">
                  Tag Compliance: 94.2%
                </span>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#393939] text-[#8d8d8d] uppercase tracking-wider bg-[#161616]">
                      <th className="py-2.5 px-3 font-semibold">Dimension Category</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Invoiced Spend</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Discounts / Amort</th>
                      <th className="py-2.5 px-3 font-semibold text-right text-[#78a9ff]">TrueCost™</th>
                      <th className="py-2.5 px-3 font-semibold">Attributed BU / Scope</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Tag Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#393939] font-mono">
                    {trueCostData.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-[#333333] transition-colors">
                        <td className="py-2.5 px-3 font-sans text-[#f4f4f4] flex items-center gap-2">
                          <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: trueCostColors[idx % trueCostColors.length] }} />
                          <span className="truncate max-w-xs">{item.dimensionCategory}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#c6c6c6]">{formatCurrency(item.rawSpend)}</td>
                        <td className="py-2.5 px-3 text-right text-[#42be65]">
                          {item.amortizedDiscounts !== 0 ? formatCurrency(item.amortizedDiscounts) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#78a9ff]">{formatCurrency(item.trueCost)}</td>
                        <td className="py-2.5 px-3 font-sans text-xs text-[#8d8d8d]">{item.attributedBU}</td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <span className={`px-2 py-0.5 text-[10px] ${item.tagComplianceScore >= 90 ? 'bg-[#42be65]/15 text-[#42be65]' : 'bg-[#fa4d56]/15 text-[#ff8389]'}`}>
                            {item.tagComplianceScore}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SPENDING ANOMALIES */}
      {activeSubTab === 'anomalies' && (
        <div className="space-y-4">
          {/* Anomaly Controls & Filter Strip */}
          <div className="bg-[#262626] border border-[#393939] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8d8d8d] uppercase tracking-wider font-semibold">Severity Filter:</span>
              <div className="flex gap-1">
                {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setAnomalyFilter(sev)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      anomalyFilter === sev
                        ? 'bg-[#0f62fe] text-[#ffffff]'
                        : 'bg-[#161616] text-[#c6c6c6] border border-[#393939] hover:bg-[#393939]'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#8d8d8d] font-mono">
              <span>Active Anomalies: <strong className="text-[#fa4d56]">{anomalies.filter(a => !remediatedIds.includes(a.id)).length}</strong></span>
              <span>•</span>
              <span>Remediated: <strong className="text-[#42be65]">{remediatedIds.length}</strong></span>
            </div>
          </div>

          {/* Anomaly Cards Grid */}
          <div className="space-y-3">
            {filteredAnomalies.map((anom) => {
              const isRemediated = remediatedIds.includes(anom.id);

              return (
                <div
                  key={anom.id}
                  className={`p-5 bg-[#262626] border transition-colors ${
                    isRemediated
                      ? 'border-l-4 border-l-[#42be65] border-[#393939]'
                      : anom.severity === 'CRITICAL'
                      ? 'border-l-4 border-l-[#fa4d56] border-[#393939]'
                      : anom.severity === 'HIGH'
                      ? 'border-l-4 border-l-[#ff832b] border-[#393939]'
                      : 'border-l-4 border-l-[#f1c21b] border-[#393939]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Anomaly Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            anom.severity === 'CRITICAL'
                              ? 'bg-[#fa4d56]/20 text-[#ff8389] border border-[#fa4d56]/50'
                              : anom.severity === 'HIGH'
                              ? 'bg-[#ff832b]/20 text-[#ffb178] border border-[#ff832b]/50'
                              : 'bg-[#f1c21b]/20 text-[#f1c21b] border border-[#f1c21b]/50'
                          }`}
                        >
                          {anom.severity} Spike (+{anom.spikePercent}%)
                        </span>

                        <span className="text-xs font-semibold text-[#f4f4f4]">{anom.service}</span>
                        <span className="px-1.5 py-0.2 text-[10px] bg-[#161616] text-[#c6c6c6] border border-[#393939]">
                          {anom.cloudProvider}
                        </span>
                        <span className="text-xs text-[#8d8d8d]">
                          • {anom.applicationName} ({anom.businessUnit})
                        </span>
                        <span className="text-xs text-[#8d8d8d] ml-auto font-mono">
                          Detected: {anom.detectedDate}
                        </span>
                      </div>

                      {/* Root Cause & Turbonomic Remediation */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        <div className="p-3 bg-[#161616] border border-[#393939]">
                          <span className="text-[10px] text-[#fa4d56] uppercase tracking-wider font-semibold block">Cloudability Anomaly Detection</span>
                          <p className="text-[#c6c6c6] mt-1 leading-relaxed">{anom.rootCause}</p>
                        </div>
                        <div className="p-3 bg-[#161616] border border-[#393939]">
                          <span className="text-[10px] text-[#78a9ff] uppercase tracking-wider font-semibold block flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Turbonomic Automated Remediation Action
                          </span>
                          <p className="text-[#c6c6c6] mt-1 leading-relaxed">{anom.turbonomicRemediation}</p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Cost & Action */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#393939]">
                      <div className="text-left lg:text-right font-mono">
                        <div className="text-[10px] text-[#8d8d8d] uppercase tracking-wider">Spike vs Baseline</div>
                        <div className="text-lg font-light text-[#fa4d56]">
                          {formatCurrency(anom.actualCost)}
                          <span className="text-xs text-[#8d8d8d]"> (Exp: {formatCurrency(anom.expectedCost)})</span>
                        </div>
                        <div className="text-[11px] text-[#ff8389]">
                          +{formatCurrency(anom.spikeAmount)} unexpected burn
                        </div>
                      </div>

                      <div>
                        {isRemediated ? (
                          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#42be65]/15 text-[#42be65] border border-[#42be65]/40 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Remediated with Turbo Action</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRemediate(anom.id)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0f62fe] hover:bg-[#0353e9] text-[#ffffff] text-xs font-medium transition-colors"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>Trigger Turbo Remediation</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CAPABILITIES MATRIX */}
      {activeSubTab === 'features' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. TrueCost & Tag Hygiene */}
            <div className="p-5 bg-[#262626] border border-[#393939] border-t-2 border-t-[#0f62fe] space-y-2">
              <div className="flex items-center gap-2 text-[#78a9ff]">
                <Tag className="w-4 h-4" />
                <h4 className="text-sm font-semibold text-[#f4f4f4]">TrueCost™ & Container Attribution</h4>
              </div>
              <p className="text-xs text-[#c6c6c6] leading-relaxed">
                Reallocates multi-tenant Kubernetes and OpenShift cluster resources down to the individual namespace, pod, label, and service level, factoring in amortized discounts and shared network overhead.
              </p>
              <div className="pt-2 text-[11px] text-[#8d8d8d] font-mono">
                Supports: EKS, AKS, GKE, Red Hat OpenShift, ECS
              </div>
            </div>

            {/* 2. Machine Learning Forecasting */}
            <div className="p-5 bg-[#262626] border border-[#393939] border-t-2 border-t-[#78a9ff] space-y-2">
              <div className="flex items-center gap-2 text-[#78a9ff]">
                <TrendingUp className="w-4 h-4" />
                <h4 className="text-sm font-semibold text-[#f4f4f4]">Predictive ML Forecasting & Budgets</h4>
              </div>
              <p className="text-xs text-[#c6c6c6] leading-relaxed">
                Employs machine learning algorithms to project future expenditure based on historical burn rate, seasonal variations, and planned architecture changes with multi-tiered budget threshold alerts.
              </p>
              <div className="pt-2 text-[11px] text-[#8d8d8d] font-mono">
                Alerts: Email, Slack, PagerDuty, Webhooks, ServiceNow
              </div>
            </div>

            {/* 3. Real-Time Anomaly Detection */}
            <div className="p-5 bg-[#262626] border border-[#393939] border-t-2 border-t-[#fa4d56] space-y-2">
              <div className="flex items-center gap-2 text-[#fa4d56]">
                <AlertOctagon className="w-4 h-4" />
                <h4 className="text-sm font-semibold text-[#f4f4f4]">Automated Spending Anomalies</h4>
              </div>
              <p className="text-xs text-[#c6c6c6] leading-relaxed">
                Monitors cost metrics on an hourly/daily basis across every cloud provider. Instantly surfaces rogue workloads, unintentional provisioning spikes, and unconstrained API queries before invoices surge.
              </p>
              <div className="pt-2 text-[11px] text-[#8d8d8d] font-mono">
                Detection Window: Sub-hourly to daily telemetry
              </div>
            </div>

            {/* 4. FinOps FOCUS Schema & Normalized Reporting */}
            <div className="p-5 bg-[#262626] border border-[#393939] border-t-2 border-t-[#8a3ffc] space-y-2">
              <div className="flex items-center gap-2 text-[#d4bbff]">
                <Layers className="w-4 h-4" />
                <h4 className="text-sm font-semibold text-[#f4f4f4]">FinOps Open Cost Schema (FOCUS™)</h4>
              </div>
              <p className="text-xs text-[#c6c6c6] leading-relaxed">
                Standardizes disparate billing line items across AWS, Microsoft Azure, Google Cloud, and Oracle Cloud into unified FinOps Foundation FOCUS 1.0 datasets for consistent cross-cloud analytics.
              </p>
              <div className="pt-2 text-[11px] text-[#8d8d8d] font-mono">
                Standard: FinOps Foundation Premier Member
              </div>
            </div>

            {/* 5. Commitment & Discount Portfolio Management */}
            <div className="p-5 bg-[#262626] border border-[#393939] border-t-2 border-t-[#42be65] space-y-2">
              <div className="flex items-center gap-2 text-[#42be65]">
                <ShieldCheck className="w-4 h-4" />
                <h4 className="text-sm font-semibold text-[#f4f4f4]">Commitment & Rate Optimization</h4>
              </div>
              <p className="text-xs text-[#c6c6c6] leading-relaxed">
                Analyzes portfolio utilization for AWS Savings Plans, Reserved Instances (RIs), Azure Savings Plans, and GCP CUDs. Recommends ideal commitment blend to maximize effective savings rate (ESR).
              </p>
              <div className="pt-2 text-[11px] text-[#8d8d8d] font-mono">
                Coverage Goal: 85%–90% optimal commitment
              </div>
            </div>

            {/* 6. Unit Economics & Business Metric Mapping */}
            <div className="p-5 bg-[#262626] border border-[#393939] border-t-2 border-t-[#ff832b] space-y-2">
              <div className="flex items-center gap-2 text-[#ffb178]">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-sm font-semibold text-[#f4f4f4]">Unit Economics & Margin Insights</h4>
              </div>
              <p className="text-xs text-[#c6c6c6] leading-relaxed">
                Correlates cloud spend directly with business telemetry (orders placed, active subscribers, search queries, payment transactions) to empower engineering and finance leaders with real margin visibility.
              </p>
              <div className="pt-2 text-[11px] text-[#8d8d8d] font-mono">
                Integration: Datadog, Splunk, Dynatrace, Custom REST
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
