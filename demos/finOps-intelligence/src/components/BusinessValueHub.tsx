import React from 'react';
import {
  CheckCircle2
} from 'lucide-react';

export const BusinessValueHub: React.FC = () => {
  const businessOutcomes = [
    {
      title: "Reduce Cloud Spend",
      outcome: "Identify waste, overprovisioning, and inefficient cloud consumption and continuously optimize resources to lower infrastructure costs.",
      benefit: "Immediate 23% run-rate cost reduction",
      color: "border-l-[#0f62fe]"
    },
    {
      title: "Improve Cloud Cost Accountability",
      outcome: "Allocate cloud spend to applications, products, teams, and business units, enabling accurate showback/chargeback and ownership.",
      benefit: "100% allocation across AWS/Azure/GCP",
      color: "border-l-[#78a9ff]"
    },
    {
      title: "Maximize ROI from Cloud Investments",
      outcome: "Align infrastructure consumption with actual application demand so the organization pays for resources it actually needs.",
      benefit: "Optimized unit economics per customer query",
      color: "border-l-[#42be65]"
    },
    {
      title: "Accelerate FinOps Decisions",
      outcome: "Combine financial insights from Cloudability with actionable resource optimization recommendations from Turbonomic.",
      benefit: "Insight-to-action cycle from weeks to minutes",
      color: "border-l-[#8a3ffc]"
    },
    {
      title: "Automate Cost Optimization",
      outcome: "Move from periodic/manual optimization exercises to policy-driven, continuous optimization of cloud resources.",
      benefit: "Zero-touch rightsizing & workload parking",
      color: "border-l-[#a56eff]"
    },
    {
      title: "Protect Application Performance",
      outcome: "Optimize infrastructure based on application and workload demand rather than reducing resources purely based on cost.",
      benefit: "SLAs protected with guaranteed headroom",
      color: "border-l-[#f1c21b]"
    },
    {
      title: "Improve Budget & Forecast Accuracy",
      outcome: "Give FinOps and business leaders greater visibility into spending patterns, forecasts, budgets, and optimization opportunities.",
      benefit: "Variance reduced from +18% to <2%",
      color: "border-l-[#fa4d56]"
    },
    {
      title: "Strengthen Eng–Finance Collaboration",
      outcome: "Provide Finance, FinOps, application owners, and engineering teams with shared cost and operational context for decision-making.",
      benefit: "Single pane of truth for economics & resources",
      color: "border-l-[#007d79]"
    }
  ];

  const comparisonRows = [
    { req: "Cloud spend visibility", cld: "Primary", turbo: "Supporting" },
    { req: "AWS / Azure / GCP cost analysis", cld: "Yes", turbo: "Yes" },
    { req: "Cost allocation & Showback", cld: "Yes (Primary)", turbo: "—" },
    { req: "Budgeting & Forecasting", cld: "Yes", turbo: "—" },
    { req: "FinOps KPI & FOCUS Reporting", cld: "Primary", turbo: "Supporting" },
    { req: "Rightsizing recommendations", cld: "Yes (Cost-only)", turbo: "Yes (Performance-aware)" },
    { req: "Application-aware optimization", cld: "—", turbo: "Primary (Workload graphs)" },
    { req: "Kubernetes & Pod optimization", cld: "—", turbo: "Yes (CPU/Mem limits & requests)" },
    { req: "Database & PaaS optimization", cld: "—", turbo: "Yes (IOPS, storage, sizing)" },
    { req: "Automated resource actions", cld: "—", turbo: "Yes (Direct Cloud API orchestration)" },
    { req: "Workload parking (Off-hours)", cld: "—", turbo: "Yes (Schedule & demand-based)" },
    { req: "Performance assurance guardrails", cld: "—", turbo: "Primary" }
  ];

  return (
    <div className="space-y-4">
      {/* Carbon Hero Banner */}
      <div className="bg-[#262626] border border-[#393939] p-6 border-l-4 border-l-[#0f62fe]">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-[#0f62fe]/20 text-[#78a9ff] border border-[#0f62fe]/50">
            Executive Value Proposition
          </span>
        </div>
        <h2 className="text-2xl font-light text-[#f4f4f4] mt-2">
          Turn Cloud Spend into Business Value with Closed-Loop FinOps
        </h2>
        <p className="text-xs text-[#c6c6c6] mt-2 max-w-4xl leading-relaxed">
          <strong className="text-[#f4f4f4]">Optimize every cloud dollar</strong> by combining financial accountability with automated, performance-aware resource optimization. Gain financial visibility into cloud spend with <strong className="text-[#78a9ff]">IBM Cloudability</strong> and continuously translate FinOps insights into performance-aware resource optimization and automated actions with <strong className="text-[#d4bbff]">IBM Turbonomic</strong>.
        </p>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#393939] mt-6 border border-[#393939]">
          <div className="p-4 bg-[#161616]">
            <span className="text-xs font-semibold text-[#78a9ff] uppercase tracking-wider">Pillar 1</span>
            <h4 className="text-sm font-semibold text-[#f4f4f4] mt-1">Lower Cost</h4>
            <p className="text-xs text-[#8d8d8d] mt-1">Eliminate waste, rightsize VM/K8s/DB, and park off-hours dev.</p>
          </div>
          <div className="p-4 bg-[#161616]">
            <span className="text-xs font-semibold text-[#78a9ff] uppercase tracking-wider">Pillar 2</span>
            <h4 className="text-sm font-semibold text-[#f4f4f4] mt-1">Greater Accountability</h4>
            <p className="text-xs text-[#8d8d8d] mt-1">100% showback/chargeback to business units with unit economics.</p>
          </div>
          <div className="p-4 bg-[#161616]">
            <span className="text-xs font-semibold text-[#d4bbff] uppercase tracking-wider">Pillar 3</span>
            <h4 className="text-sm font-semibold text-[#f4f4f4] mt-1">Automated Optimization</h4>
            <p className="text-xs text-[#8d8d8d] mt-1">Policy-driven cloud API execution without manual spreadsheets.</p>
          </div>
          <div className="p-4 bg-[#161616]">
            <span className="text-xs font-semibold text-[#42be65] uppercase tracking-wider">Pillar 4</span>
            <h4 className="text-sm font-semibold text-[#f4f4f4] mt-1">Assured Performance</h4>
            <p className="text-xs text-[#8d8d8d] mt-1">Guaranteed headroom and latency protection for peak workloads.</p>
          </div>
        </div>
      </div>

      {/* Comparison Matrix: What Each Product Does */}
      <div className="bg-[#262626] border border-[#393939] p-6">
        <h3 className="text-sm font-semibold text-[#f4f4f4] uppercase tracking-wider mb-1">Product Responsibility & Capability Matrix</h3>
        <p className="text-xs text-[#8d8d8d] mb-6">
          Understanding the clear separation between Financial Management (Cloudability) and Operational Optimization (Turbonomic).
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#393939] text-[#8d8d8d] uppercase tracking-wider bg-[#161616]">
                <th className="py-3 px-4 font-semibold">Capability Requirement</th>
                <th className="py-3 px-4 font-semibold text-[#78a9ff]">IBM Cloudability (Financial Intelligence)</th>
                <th className="py-3 px-4 font-semibold text-[#d4bbff]">IBM Turbonomic (Resource & Action Engine)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#393939]">
              {comparisonRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#333333] transition-colors">
                  <td className="py-3 px-4 font-medium text-[#f4f4f4]">{row.req}</td>
                  <td className="py-3 px-4 text-[#c6c6c6]">{row.cld}</td>
                  <td className="py-3 px-4 text-[#c6c6c6]">{row.turbo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Business Value Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {businessOutcomes.map((item, idx) => (
          <div
            key={idx}
            className={`p-5 bg-[#262626] border border-[#393939] border-l-4 ${item.color} flex flex-col justify-between hover:bg-[#333333] transition-colors`}
          >
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#f4f4f4]">{item.title}</h4>
                <CheckCircle2 className="w-4 h-4 text-[#42be65]" />
              </div>
              <p className="text-xs text-[#c6c6c6] mt-2 leading-relaxed">{item.outcome}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#393939] flex items-center justify-between text-xs font-semibold text-[#42be65]">
              <span className="text-[#8d8d8d] font-normal uppercase tracking-wider text-[11px]">Key Impact:</span>
              <span>{item.benefit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
