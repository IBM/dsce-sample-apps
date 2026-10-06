import React from 'react';
import { DollarSign, TrendingDown, Target, Zap } from 'lucide-react';
import type { FinOpsKPIs } from '../types';

interface Props {
  kpis: FinOpsKPIs;
  executedCount: number;
  totalActionsCount: number;
}

export const MetricHighlights: React.FC<Props> = ({ kpis, executedCount, totalActionsCount }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const progressPercent = Math.round((executedCount / (totalActionsCount || 1)) * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#393939] border border-[#393939]">
      {/* Total Spend & Optimization */}
      <div className="bg-[#262626] p-5 relative hover:bg-[#333333] transition-colors">
        <div className="flex items-center justify-between text-[#c6c6c6] text-xs font-semibold tracking-wide uppercase">
          <span>Enterprise Cloud Spend</span>
          <DollarSign className="w-4 h-4 text-[#fa4d56]" />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-light text-[#f4f4f4] tracking-tight">
            {formatCurrency(kpis.totalMonthlySpendBefore)}
          </span>
          <span className="text-xs text-[#8d8d8d]">/mo</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#ff8389] font-medium bg-[#fa4d56]/15 px-2 py-0.5 border border-[#fa4d56]/40 w-fit">
          <span>Over Budget: +{kpis.budgetVariancePercent}%</span>
        </div>
      </div>

      {/* Potential vs Realized Monthly Savings */}
      <div className="bg-[#262626] p-5 relative hover:bg-[#333333] transition-colors">
        <div className="flex items-center justify-between text-[#c6c6c6] text-xs font-semibold tracking-wide uppercase">
          <span>Monthly Cost Reduction</span>
          <TrendingDown className="w-4 h-4 text-[#42be65]" />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-light text-[#42be65] tracking-tight">
            {formatCurrency(kpis.potentialMonthlySavings)}
          </span>
          <span className="text-xs text-[#8d8d8d]">/mo</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#42be65] font-medium bg-[#42be65]/15 px-2 py-0.5 border border-[#42be65]/40 w-fit">
          <span>Annual Run-Rate: {formatCurrency(kpis.realizedAnnualSavings)}</span>
        </div>
      </div>

      {/* Target Spend Post-Optimization */}
      <div className="bg-[#262626] p-5 relative hover:bg-[#333333] transition-colors">
        <div className="flex items-center justify-between text-[#c6c6c6] text-xs font-semibold tracking-wide uppercase">
          <span>Optimized Monthly Spend</span>
          <Target className="w-4 h-4 text-[#4589ff]" />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-light text-[#4589ff] tracking-tight">
            {formatCurrency(kpis.totalMonthlySpendAfter)}
          </span>
          <span className="text-xs text-[#8d8d8d]">/mo</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#78a9ff] font-medium bg-[#0f62fe]/15 px-2 py-0.5 border border-[#0f62fe]/40 w-fit">
          <span>Savings: {Math.round((kpis.potentialMonthlySavings / kpis.totalMonthlySpendBefore) * 100)}% reduction</span>
        </div>
      </div>

      {/* Closed-Loop Execution Status */}
      <div className="bg-[#262626] p-5 relative hover:bg-[#333333] transition-colors">
        <div className="flex items-center justify-between text-[#c6c6c6] text-xs font-semibold tracking-wide uppercase">
          <span>Turbonomic Actions Executed</span>
          <Zap className="w-4 h-4 text-[#a56eff]" />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-light text-[#d4bbff] tracking-tight">
            {executedCount} / {totalActionsCount}
          </span>
          <span className="text-xs text-[#8d8d8d]">actions ({progressPercent}%)</span>
        </div>
        <div className="mt-3 w-full bg-[#393939] h-1 overflow-hidden">
          <div
            className="bg-[#0f62fe] h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
