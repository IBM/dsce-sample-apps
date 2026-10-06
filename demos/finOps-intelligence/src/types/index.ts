export interface EnvironmentConfig {
  name: string;
  description: string;
  monthlyBudgetTotal: number;
  cloudability: {
    endpoint: string;
    apiKey: string;
    viewId: string;
    vendorAccounts: {
      aws: string[];
      azure: string[];
      gcp: string[];
    };
  };
  turbonomic: {
    serverUrl: string;
    apiPath: string;
    authType: 'basic' | 'oauth2' | 'token';
    username: string;
    token?: string;
    targetScopes: string[];
  };
  applications: ApplicationData[];
  actions: TurbonomicAction[];
  finopsKpis: FinOpsKPIs;
  forecasts?: CloudabilityForecast[];
  anomalies?: SpendingAnomaly[];
  trueCostData?: TrueCostDimension[];
}

export interface CostBreakdown {
  compute: number;
  kubernetes: number;
  database: number;
  storage: number;
  networkOther: number;
  total: number;
}

export interface ApplicationData {
  id: string;
  name: string;
  businessUnit: string;
  environment: 'Production' | 'Staging' | 'Development';
  cloudProviders: ('AWS' | 'Azure' | 'GCP')[];
  monthlyBudget: number;
  currentCost: CostBreakdown;
  optimizedCost: CostBreakdown;
  unitEconomicsMetric: string;
  unitCostBefore: number;
  unitCostAfter: number;
  monthlyUnits: number;
  healthScore: number;
  turbonomicTargetId: string;
}

export interface TurbonomicAction {
  id: string;
  applicationId: string;
  targetEntityName: string;
  entityType: 'VirtualMachine' | 'ContainerPod' | 'DatabaseServer' | 'Volume' | 'CloudPolicy';
  cloudProvider: 'AWS' | 'Azure' | 'GCP';
  actionType: 'RIGHTSIZE' | 'RESIZE_CPU_MEM' | 'PARK_OFFHOURS' | 'PURGE_UNUSED' | 'SCALE_TIER';
  riskCategory: 'PERFORMANCE_ASSURANCE' | 'COST_EFFICIENCY' | 'SAVINGS_PLAN';
  currentSpecification: string;
  recommendedSpecification: string;
  monthlyCostSavings: number;
  reason: string;
  performanceMetrics: {
    cpuAvgUtilization: number;
    cpuPeakUtilization: number;
    memAvgUtilization: number;
    memPeakUtilization: number;
    iopsOrLatencyRisk?: string;
  };
  status: 'RECOMMENDED' | 'QUEUED' | 'EXECUTING' | 'EXECUTED' | 'ROLLED_BACK';
  executedAt?: string;
  policyAutomationEnabled: boolean;
}

export interface FinOpsKPIs {
  totalMonthlySpendBefore: number;
  totalMonthlySpendAfter: number;
  potentialMonthlySavings: number;
  realizedAnnualSavings: number;
  budgetVariancePercent: number;
  unallocatedCostPercent: number;
  wasteScoreReductionPercent: number;
  coverageCommitmentPercent: number;
}

export interface CloudabilityForecast {
  month: string;
  baselineHistorical: number | null;
  unconstrainedForecast: number;
  optimizedForecast: number;
  budgetTarget: number;
  confidenceLower: number;
  confidenceUpper: number;
}

export interface SpendingAnomaly {
  id: string;
  service: string;
  cloudProvider: 'AWS' | 'Azure' | 'GCP';
  applicationName: string;
  businessUnit: string;
  detectedDate: string;
  expectedCost: number;
  actualCost: number;
  spikeAmount: number;
  spikePercent: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  rootCause: string;
  turbonomicRemediation: string;
  status: 'ACTIVE_INVESTIGATING' | 'REMEDIATED' | 'ACCEPTED_EXPECTED';
}

export interface TrueCostDimension {
  id: string;
  dimensionCategory: string; // e.g. "Direct Cloud (IaaS/PaaS)", "Shared Kubernetes Clusters", "Discounts & EDP/RI/SP", "Unallocated & Tag Hygiene", "License & Observability"
  rawSpend: number;
  amortizedDiscounts: number;
  sharedClusterReallocated: number;
  trueCost: number;
  attributedBU: string;
  tagComplianceScore: number;
}
