export interface ApiLogEntry {
  id: string;
  timestamp: string;
  service: 'IBM_CLOUDABILITY' | 'IBM_TURBONOMIC';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  endpoint: string;
  status: number;
  requestPayload?: any;
  responsePayload: any;
  durationMs: number;
  description: string;
}

export const CloudabilityApiExplorer = {
  getReportingViews: (endpoint: string, apiKey: string) => ({
    endpoint: `${endpoint}/reporting/views`,
    method: 'GET' as const,
    headers: {
      'Authorization': `Bearer ${apiKey.replace(/.(?=.{4})/g, '*')}`,
      'Accept': 'application/json'
    },
    sampleResponse: {
      result: [
        { id: "view-enterprise-global-all", name: "Global Enterprise Multi-Cloud View", default: true },
        { id: "view-retail-prod", name: "Digital Commerce BU Spend", default: false },
        { id: "view-banking-prod", name: "Financial Services BU Core", default: false }
      ]
    }
  }),

  getCloudSpendReport: (endpoint: string, apiKey: string, viewId: string) => ({
    endpoint: `${endpoint}/reporting/reports/spend-by-dimension?viewId=${viewId}&dimensions=vendor,service_name,tag_Application&metrics=unblended_cost,usage_quantity`,
    method: 'GET' as const,
    headers: {
      'Authorization': `Bearer ${apiKey.replace(/.(?=.{4})/g, '*')}`,
      'Accept': 'application/json'
    },
    sampleResponse: {
      meta: { totalSpend: 2000000, currency: "USD", timePeriod: "Current Month MTD" },
      results: [
        { application: "Retail E-Commerce Platform", vendor: "AWS", cost: 260000, budget: 210000, variance: "+23.8%" },
        { application: "Retail E-Commerce Platform", vendor: "Azure", cost: 110000, budget: 100000, variance: "+10.0%" },
        { application: "Core Banking & Payments", vendor: "Azure", cost: 720000, budget: 600000, variance: "+20.0%" },
        { application: "Core Banking & Payments", vendor: "AWS", cost: 280000, budget: 250000, variance: "+12.0%" },
        { application: "Enterprise Data & AI Analytics", vendor: "AWS", cost: 410000, budget: 380000, variance: "+7.9%" },
        { application: "Enterprise Data & AI Analytics", vendor: "GCP", cost: 220000, budget: 210000, variance: "+4.7%" }
      ]
    }
  }),

  getForecastingData: (endpoint: string) => ({
    endpoint: `${endpoint}/forecasting/models/ml-regressor?horizon=6months&algorithm=arima_xgboost_blend`,
    method: 'GET' as const,
    sampleResponse: {
      status: "SUCCESS",
      modelConfidenceInterval: "95%",
      projectedRunRateQ3: 2750000,
      optimizedRunRateQ3: 1510000,
      monthlyForecasts: [
        { month: "Apr", unconstrained: "$2.12M", optimized: "$1.62M", budget: "$1.75M" },
        { month: "May", unconstrained: "$2.24M", optimized: "$1.56M", budget: "$1.75M" },
        { month: "Jun", unconstrained: "$2.36M", optimized: "$1.54M", budget: "$1.75M" },
        { month: "Jul", unconstrained: "$2.49M", optimized: "$1.53M", budget: "$1.75M" },
        { month: "Aug", unconstrained: "$2.61M", optimized: "$1.52M", budget: "$1.75M" },
        { month: "Sep", unconstrained: "$2.75M", optimized: "$1.51M", budget: "$1.75M" }
      ]
    }
  }),

  getSpendingAnomalies: (endpoint: string) => ({
    endpoint: `${endpoint}/anomalies/detections?timeframe=last_7_days&min_spike_percent=50`,
    method: 'GET' as const,
    sampleResponse: {
      detectedAnomaliesCount: 4,
      totalSpikeBurnRate: 28150,
      detections: [
        { id: "anom-001", service: "AWS DynamoDB", spike: "+422%", amount: "$7,600", severity: "CRITICAL", rootCause: "Uncontrolled batch indexing query" },
        { id: "anom-002", service: "Azure Premium SSD", spike: "+259%", amount: "$8,300", severity: "HIGH", rootCause: "Orphaned 8TB unattached disks" },
        { id: "anom-003", service: "GCP BigQuery", spike: "+215%", amount: "$9,700", severity: "CRITICAL", rootCause: "Ad-hoc cross-region join without slot reservation" },
        { id: "anom-004", service: "AWS NAT Gateway", spike: "+300%", amount: "$2,550", severity: "MEDIUM", rootCause: "Cross-AZ egress without VPC endpoints" }
      ]
    }
  }),

  getTrueCostBreakdown: (endpoint: string) => ({
    endpoint: `${endpoint}/containers/truecost/allocations?include_discounts=true&include_shared=true`,
    method: 'GET' as const,
    sampleResponse: {
      tagComplianceOverall: "94.2%",
      totalDirectIaaS: "$950,000",
      totalSharedK8sAllocated: "$362,000",
      totalAmortizedCommitments: "-$310,000",
      totalUnallocatedOverhead: "$87,000",
      totalNetTrueCost: "$1,640,000"
    }
  }),

  getUnitEconomics: (endpoint: string) => ({
    endpoint: `${endpoint}/business-metrics/unit-economics/applications`,
    method: 'GET' as const,
    sampleResponse: {
      metrics: [
        { app: "Retail E-Commerce", unit: "Per Checkout Order", costBefore: "$0.37", costAfter: "$0.29", marginImpact: "+21.6%" },
        { app: "Core Banking", unit: "Per Transaction", costBefore: "$0.050", costAfter: "$0.040", marginImpact: "+20.0%" },
        { app: "Enterprise Analytics", unit: "Per Query Executed", costBefore: "$0.021", costAfter: "$0.015", marginImpact: "+28.5%" }
      ]
    }
  })
};

export const TurbonomicApiExplorer = {
  getActionsByScope: (serverUrl: string, apiPath: string, scopeName: string) => ({
    endpoint: `${serverUrl}${apiPath}/actions?scope=${encodeURIComponent(scopeName)}&risk_type=PERFORMANCE_ASSURANCE,COST_EFFICIENCY`,
    method: 'GET' as const,
    headers: {
      'Content-Type': 'application/json',
      'X-Turbonomic-Session': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    },
    sampleResponse: {
      totalCount: 12,
      actionsSummary: {
        RIGHTSIZE: 5,
        RESIZE_CPU_MEM: 3,
        PARK_OFFHOURS: 2,
        PURGE_UNUSED: 1,
        SCALE_TIER: 1
      },
      potentialMonthlySavings: 460000
    }
  }),

  executeAction: (serverUrl: string, apiPath: string, actionId: string) => ({
    endpoint: `${serverUrl}${apiPath}/actions/${actionId}`,
    method: 'POST' as const,
    headers: {
      'Content-Type': 'application/json',
      'X-Turbonomic-Session': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    },
    body: {
      actionState: "EXECUTE",
      enforcePerformanceGuardrails: true,
      executionSchedule: "IMMEDIATE"
    },
    sampleResponse: {
      actionId,
      status: "EXECUTING",
      targetEntity: "retail-cart-service-vm-cluster",
      orchestratedVia: "AWS EC2 API / Azure ARM",
      message: "Orchestrating live performance-aware resizing without workload downtime."
    }
  })
};
