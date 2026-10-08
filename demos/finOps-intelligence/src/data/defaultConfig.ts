import type { EnvironmentConfig, CloudabilityForecast, SpendingAnomaly, TrueCostDimension } from '../types';

export const defaultForecasts: CloudabilityForecast[] = [
  { month: 'Jan (Act)', baselineHistorical: 1820000, unconstrainedForecast: 1820000, optimizedForecast: 1820000, budgetTarget: 1750000, confidenceLower: 1800000, confidenceUpper: 1840000 },
  { month: 'Feb (Act)', baselineHistorical: 1910000, unconstrainedForecast: 1910000, optimizedForecast: 1910000, budgetTarget: 1750000, confidenceLower: 1890000, confidenceUpper: 1930000 },
  { month: 'Mar (Act)', baselineHistorical: 2000000, unconstrainedForecast: 2000000, optimizedForecast: 2000000, budgetTarget: 1750000, confidenceLower: 1970000, confidenceUpper: 2030000 },
  { month: 'Apr (Fcst)', baselineHistorical: null, unconstrainedForecast: 2120000, optimizedForecast: 1620000, budgetTarget: 1750000, confidenceLower: 1540000, confidenceUpper: 1700000 },
  { month: 'May (Fcst)', baselineHistorical: null, unconstrainedForecast: 2240000, optimizedForecast: 1560000, budgetTarget: 1750000, confidenceLower: 1480000, confidenceUpper: 1640000 },
  { month: 'Jun (Fcst)', baselineHistorical: null, unconstrainedForecast: 2360000, optimizedForecast: 1540000, budgetTarget: 1750000, confidenceLower: 1460000, confidenceUpper: 1620000 },
  { month: 'Jul (Fcst)', baselineHistorical: null, unconstrainedForecast: 2490000, optimizedForecast: 1530000, budgetTarget: 1750000, confidenceLower: 1450000, confidenceUpper: 1610000 },
  { month: 'Aug (Fcst)', baselineHistorical: null, unconstrainedForecast: 2610000, optimizedForecast: 1520000, budgetTarget: 1750000, confidenceLower: 1440000, confidenceUpper: 1600000 },
  { month: 'Sep (Fcst)', baselineHistorical: null, unconstrainedForecast: 2750000, optimizedForecast: 1510000, budgetTarget: 1750000, confidenceLower: 1430000, confidenceUpper: 1590000 }
];

export const defaultAnomalies: SpendingAnomaly[] = [
  {
    id: 'anom-001',
    service: 'AWS DynamoDB & Aurora Auto-Scale',
    cloudProvider: 'AWS',
    applicationName: 'Retail E-Commerce Platform',
    businessUnit: 'Digital Commerce BU',
    detectedDate: 'Yesterday 04:30 UTC',
    expectedCost: 1800,
    actualCost: 9400,
    spikeAmount: 7600,
    spikePercent: 422,
    severity: 'CRITICAL',
    rootCause: 'Uncontrolled batch indexing job launched with unbounded Read/Write Capacity on unpartitioned secondary indexes.',
    turbonomicRemediation: 'Turbonomic dynamically adjusted IOPS throttles and triggered partition-aware schema autoscaling policy.',
    status: 'ACTIVE_INVESTIGATING'
  },
  {
    id: 'anom-002',
    service: 'Azure Premium SSD Managed Disks',
    cloudProvider: 'Azure',
    applicationName: 'Core Banking & Payments',
    businessUnit: 'Financial Services BU',
    detectedDate: '3 days ago',
    expectedCost: 3200,
    actualCost: 11500,
    spikeAmount: 8300,
    spikePercent: 259,
    severity: 'HIGH',
    rootCause: 'Orphaned 8TB Ultra SSD disks provisioned during load test without deletion lifecycle tag.',
    turbonomicRemediation: 'Turbonomic flagged unattached volume state >72hrs and queued automated snapshot archive and volume termination.',
    status: 'REMEDIATED'
  },
  {
    id: 'anom-003',
    service: 'GCP BigQuery On-Demand Slot Surge',
    cloudProvider: 'GCP',
    applicationName: 'Enterprise Data & AI Analytics',
    businessUnit: 'Data & AI Insights',
    detectedDate: '5 days ago',
    expectedCost: 4500,
    actualCost: 14200,
    spikeAmount: 9700,
    spikePercent: 215,
    severity: 'CRITICAL',
    rootCause: 'Ad-hoc cross-region join query executed on non-partitioned 90-day telemetry lake without slot reservations.',
    turbonomicRemediation: 'Turbonomic integrated slot reservation guardrail and routed ad-hoc queries into scheduled batch queues.',
    status: 'ACTIVE_INVESTIGATING'
  },
  {
    id: 'anom-004',
    service: 'AWS NAT Gateway Inter-AZ Data Transfer',
    cloudProvider: 'AWS',
    applicationName: 'Retail E-Commerce Platform',
    businessUnit: 'Digital Commerce BU',
    detectedDate: 'Last week',
    expectedCost: 850,
    actualCost: 3400,
    spikeAmount: 2550,
    spikePercent: 300,
    severity: 'MEDIUM',
    rootCause: 'Cross-AZ traffic between EKS pods and Aurora replica crossing NAT Gateway without VPC S3/DynamoDB endpoints.',
    turbonomicRemediation: 'Turbonomic recommended workload co-location policy and provisioned VPC Gateway Endpoints.',
    status: 'REMEDIATED'
  }
];

export const defaultTrueCostData: TrueCostDimension[] = [
  {
    id: 'tc-001',
    dimensionCategory: 'Direct Multi-Cloud Compute & DB (IaaS/PaaS)',
    rawSpend: 1140000,
    amortizedDiscounts: -190000,
    sharedClusterReallocated: 0,
    trueCost: 950000,
    attributedBU: 'Multi-BU (Digital Commerce & Core Banking)',
    tagComplianceScore: 98.4
  },
  {
    id: 'tc-002',
    dimensionCategory: 'Shared Kubernetes Fleets (EKS/AKS Multi-Tenant)',
    rawSpend: 420000,
    amortizedDiscounts: -58000,
    sharedClusterReallocated: 0,
    trueCost: 362000,
    attributedBU: 'Reallocated across 18 Microservices via Pod Namespaces',
    tagComplianceScore: 94.1
  },
  {
    id: 'tc-003',
    dimensionCategory: 'Cloud Commitments, EDP, Savings Plans & RIs',
    rawSpend: -310000,
    amortizedDiscounts: 310000,
    sharedClusterReallocated: 0,
    trueCost: 0,
    attributedBU: 'FinOps Central Portfolio Amortization',
    tagComplianceScore: 100.0
  },
  {
    id: 'tc-004',
    dimensionCategory: 'Unallocated & Untagged Zombie Overhead',
    rawSpend: 95000,
    amortizedDiscounts: -8000,
    sharedClusterReallocated: 0,
    trueCost: 87000,
    attributedBU: 'Shared Infra / Unassigned Backlog (Tag Hygiene Target)',
    tagComplianceScore: 61.2
  },
  {
    id: 'tc-005',
    dimensionCategory: 'Multi-Cloud Egress, Transit Gateways & VPN',
    rawSpend: 90000,
    amortizedDiscounts: -11000,
    sharedClusterReallocated: 0,
    trueCost: 79000,
    attributedBU: 'Enterprise Networking & Security BU',
    tagComplianceScore: 91.5
  },
  {
    id: 'tc-006',
    dimensionCategory: 'Data Lake Storage, S3 Intelligent-Tiering & Blob',
    rawSpend: 190000,
    amortizedDiscounts: -28000,
    sharedClusterReallocated: 0,
    trueCost: 162000,
    attributedBU: 'Data & AI Insights BU',
    tagComplianceScore: 96.8
  }
];

export const enterpriseScenarioConfig: EnvironmentConfig = {
  name: "Global Financial Services & Retail Enterprise",
  description: "Multi-cloud production environment spanning AWS and Azure with $2M/mo cloud expenditure across Retail, Banking, and Analytics applications.",
  monthlyBudgetTotal: 1750000,
  cloudability: {
    endpoint: "https://api.cloudability.com/v3",
    apiKey: "cld-live-9948a2bc4e819f727",
    viewId: "view-enterprise-global-all",
    vendorAccounts: {
      aws: ["112233445566 (Retail-Prod)", "998877665544 (Analytics-DataLake)", "554433221100 (Dev-Shared)"],
      azure: ["sub-bank-core-prod-01", "sub-finops-shared-infra-02"],
      gcp: ["gcp-analytics-bigquery-prod"]
    }
  },
  turbonomic: {
    serverUrl: "https://turbo.enterprise.internal",
    apiPath: "/api/v3",
    authType: "oauth2",
    username: "finops-automation-svc",
    token: "turbotoken_99fba71a0e891cde45889",
    targetScopes: [
      "AWS-AP-Southeast-1",
      "AWS-US-East-1",
      "Azure-EastUS2-FinCore",
      "K8s-Cluster-Retail-EKS-01",
      "K8s-Cluster-Banking-AKS-02"
    ]
  },
  finopsKpis: {
    totalMonthlySpendBefore: 2000000,
    totalMonthlySpendAfter: 1540000,
    potentialMonthlySavings: 460000,
    realizedAnnualSavings: 5520000,
    budgetVariancePercent: 14.3,
    unallocatedCostPercent: 3.2,
    wasteScoreReductionPercent: 68.5,
    coverageCommitmentPercent: 88.4
  },
  forecasts: defaultForecasts,
  anomalies: defaultAnomalies,
  trueCostData: defaultTrueCostData,
  applications: [
    {
      id: "app-retail",
      name: "Retail E-Commerce Platform",
      businessUnit: "Digital Commerce BU",
      environment: "Production",
      cloudProviders: ["AWS", "Azure"],
      monthlyBudget: 310000,
      currentCost: {
        compute: 180000,
        kubernetes: 80000,
        database: 60000,
        storage: 30000,
        networkOther: 20000,
        total: 370000
      },
      optimizedCost: {
        compute: 135000,
        kubernetes: 62000,
        database: 49000,
        storage: 26000,
        networkOther: 18000,
        total: 290000
      },
      unitEconomicsMetric: "Cost Per Checkout Order",
      unitCostBefore: 0.37,
      unitCostAfter: 0.29,
      monthlyUnits: 1000000,
      healthScore: 98.6,
      turbonomicTargetId: "k8s-group-retail-prod-v1"
    },
    {
      id: "app-banking",
      name: "Core Banking & Payments",
      businessUnit: "Financial Services BU",
      environment: "Production",
      cloudProviders: ["Azure", "AWS"],
      monthlyBudget: 850000,
      currentCost: {
        compute: 420000,
        kubernetes: 210000,
        database: 240000,
        storage: 90000,
        networkOther: 40000,
        total: 1000000
      },
      optimizedCost: {
        compute: 330000,
        kubernetes: 165000,
        database: 195000,
        storage: 75000,
        networkOther: 35000,
        total: 800000
      },
      unitEconomicsMetric: "Cost Per Financial Transaction",
      unitCostBefore: 0.050,
      unitCostAfter: 0.040,
      monthlyUnits: 20000000,
      healthScore: 99.9,
      turbonomicTargetId: "azure-rg-banking-core-eastus"
    },
    {
      id: "app-analytics",
      name: "Enterprise Data & AI Analytics",
      businessUnit: "Data & AI Insights",
      environment: "Production",
      cloudProviders: ["AWS", "GCP"],
      monthlyBudget: 590000,
      currentCost: {
        compute: 290000,
        kubernetes: 130000,
        database: 110000,
        storage: 70000,
        networkOther: 30000,
        total: 630000
      },
      optimizedCost: {
        compute: 205000,
        kubernetes: 100000,
        database: 82000,
        storage: 42000,
        networkOther: 21000,
        total: 450000
      },
      unitEconomicsMetric: "Cost Per Analytics Query Executed",
      unitCostBefore: 0.021,
      unitCostAfter: 0.015,
      monthlyUnits: 30000000,
      healthScore: 97.4,
      turbonomicTargetId: "aws-tag-analytics-lakehouse"
    }
  ],
  actions: [
    {
      id: "act-turbo-001",
      applicationId: "app-retail",
      targetEntityName: "retail-cart-service-vm-cluster (25 instances)",
      entityType: "VirtualMachine",
      cloudProvider: "AWS",
      actionType: "RIGHTSIZE",
      riskCategory: "PERFORMANCE_ASSURANCE",
      currentSpecification: "c5.4xlarge (16 vCPU, 32 GiB)",
      recommendedSpecification: "c6i.2xlarge (8 vCPU, 16 GiB Graviton/Xeon tuned)",
      monthlyCostSavings: 45000,
      reason: "Workload CPU peak utilization is 28.4% and memory average is 22%. Downsizing maintains guaranteed headroom >45% for flash sales.",
      performanceMetrics: {
        cpuAvgUtilization: 14.8,
        cpuPeakUtilization: 28.4,
        memAvgUtilization: 22.1,
        memPeakUtilization: 34.0,
        iopsOrLatencyRisk: "None - latency verified < 12ms"
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    },
    {
      id: "act-turbo-002",
      applicationId: "app-retail",
      targetEntityName: "k8s-pod/retail-catalog-replicas",
      entityType: "ContainerPod",
      cloudProvider: "AWS",
      actionType: "RESIZE_CPU_MEM",
      riskCategory: "PERFORMANCE_ASSURANCE",
      currentSpecification: "Request: 4000m CPU / 8Gi Memory",
      recommendedSpecification: "Request: 1500m CPU / 3.5Gi Memory",
      monthlyCostSavings: 18000,
      reason: "Historical container profiling over 30 days indicates pods overprovisioned by 2.6x against Kubernetes node requests.",
      performanceMetrics: {
        cpuAvgUtilization: 21.3,
        cpuPeakUtilization: 42.1,
        memAvgUtilization: 31.0,
        memPeakUtilization: 48.2
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    },
    {
      id: "act-turbo-003",
      applicationId: "app-retail",
      targetEntityName: "dev-qa-retail-env-vms",
      entityType: "VirtualMachine",
      cloudProvider: "Azure",
      actionType: "PARK_OFFHOURS",
      riskCategory: "COST_EFFICIENCY",
      currentSpecification: "Standard_D8s_v5 (Running 24x7 = 720 hrs/mo)",
      recommendedSpecification: "Scheduled Parking (Mon-Fri 8am-7pm = 220 hrs/mo)",
      monthlyCostSavings: 11000,
      reason: "Zero active network traffic or API hits detected between 8:00 PM and 6:30 AM weekdays and throughout entire weekends.",
      performanceMetrics: {
        cpuAvgUtilization: 2.1,
        cpuPeakUtilization: 7.4,
        memAvgUtilization: 12.0,
        memPeakUtilization: 15.3
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    },
    {
      id: "act-turbo-004",
      applicationId: "app-retail",
      targetEntityName: "retail-aurora-postgres-primary",
      entityType: "DatabaseServer",
      cloudProvider: "AWS",
      actionType: "RIGHTSIZE",
      riskCategory: "PERFORMANCE_ASSURANCE",
      currentSpecification: "db.r5.8xlarge (32 vCPU, 256 GiB)",
      recommendedSpecification: "db.r6g.4xlarge (16 vCPU, 128 GiB)",
      monthlyCostSavings: 6000,
      reason: "IOPS requirement is 1,200 avg, well within r6g bandwidth limits while buffer pool hit ratio remains 99.8%.",
      performanceMetrics: {
        cpuAvgUtilization: 19.5,
        cpuPeakUtilization: 38.0,
        memAvgUtilization: 44.0,
        memPeakUtilization: 52.0
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: false
    },
    {
      id: "act-turbo-005",
      applicationId: "app-banking",
      targetEntityName: "bank-core-payment-gateways (40 VMs)",
      entityType: "VirtualMachine",
      cloudProvider: "Azure",
      actionType: "RIGHTSIZE",
      riskCategory: "PERFORMANCE_ASSURANCE",
      currentSpecification: "Standard_E16ds_v5 (16 vCPU, 128 GiB)",
      recommendedSpecification: "Standard_E8ds_v5 (8 vCPU, 64 GiB)",
      monthlyCostSavings: 90000,
      reason: "Turbonomic analysis shows compute demand is steady; memory contention probability is < 0.001% on 8-core tier.",
      performanceMetrics: {
        cpuAvgUtilization: 18.2,
        cpuPeakUtilization: 39.5,
        memAvgUtilization: 29.4,
        memPeakUtilization: 41.2
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    },
    {
      id: "act-turbo-006",
      applicationId: "app-banking",
      targetEntityName: "aks-cluster-fin-ledger-pods",
      entityType: "ContainerPod",
      cloudProvider: "Azure",
      actionType: "RESIZE_CPU_MEM",
      riskCategory: "PERFORMANCE_ASSURANCE",
      currentSpecification: "CPU Limits 8000m / Requests 6000m",
      recommendedSpecification: "CPU Limits 4000m / Requests 2500m",
      monthlyCostSavings: 45000,
      reason: "Reclaims 140 CPU cores across node pool while preserving sub-millisecond p99 settlement processing latency.",
      performanceMetrics: {
        cpuAvgUtilization: 24.6,
        cpuPeakUtilization: 49.0,
        memAvgUtilization: 38.2,
        memPeakUtilization: 51.0
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    },
    {
      id: "act-turbo-007",
      applicationId: "app-banking",
      targetEntityName: "bank-sql-managed-instance",
      entityType: "DatabaseServer",
      cloudProvider: "Azure",
      actionType: "RIGHTSIZE",
      riskCategory: "PERFORMANCE_ASSURANCE",
      currentSpecification: "Business Critical 32 vCores Gen5",
      recommendedSpecification: "Business Critical 24 vCores Gen5",
      monthlyCostSavings: 45000,
      reason: "Log rate and data IOPS operate at 35% capacity during daily high-water settlements.",
      performanceMetrics: {
        cpuAvgUtilization: 31.0,
        cpuPeakUtilization: 54.0,
        memAvgUtilization: 58.0,
        memPeakUtilization: 68.0
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: false
    },
    {
      id: "act-turbo-008",
      applicationId: "app-analytics",
      targetEntityName: "spark-worker-fleet-emr (50 nodes)",
      entityType: "VirtualMachine",
      cloudProvider: "AWS",
      actionType: "RIGHTSIZE",
      riskCategory: "COST_EFFICIENCY",
      currentSpecification: "r5d.4xlarge On-Demand",
      recommendedSpecification: "r6gd.2xlarge Spot/Savings Mix",
      monthlyCostSavings: 85000,
      reason: "EMR job batch window metrics prove workers finish in 42 mins vs 60 mins SLA; downsizing with modern architecture saves 40%.",
      performanceMetrics: {
        cpuAvgUtilization: 33.0,
        cpuPeakUtilization: 62.0,
        memAvgUtilization: 41.0,
        memPeakUtilization: 58.0
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    },
    {
      id: "act-turbo-009",
      applicationId: "app-analytics",
      targetEntityName: "unattached-ebs-analytics-snapshots-vols",
      entityType: "Volume",
      cloudProvider: "AWS",
      actionType: "PURGE_UNUSED",
      riskCategory: "COST_EFFICIENCY",
      currentSpecification: "48 TB io2 / gp3 unattached volumes > 45 days",
      recommendedSpecification: "Purge unattached volumes & archive snapshot",
      monthlyCostSavings: 28000,
      reason: "Zombie volumes detached since previous quarter migration. Zero read/write ops registered for 45+ days.",
      performanceMetrics: {
        cpuAvgUtilization: 0,
        cpuPeakUtilization: 0,
        memAvgUtilization: 0,
        memPeakUtilization: 0,
        iopsOrLatencyRisk: "Zero active mounts"
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    },
    {
      id: "act-turbo-010",
      applicationId: "app-analytics",
      targetEntityName: "databricks-analytics-k8s-executors",
      entityType: "ContainerPod",
      cloudProvider: "GCP",
      actionType: "RESIZE_CPU_MEM",
      riskCategory: "PERFORMANCE_ASSURANCE",
      currentSpecification: "Executor request: 8 vCPU / 32 GiB",
      recommendedSpecification: "Executor request: 4 vCPU / 16 GiB",
      monthlyCostSavings: 30000,
      reason: "Memory spill to disk rate is 0%. Workload profiles confirm executor memory headroom exceeds 60%.",
      performanceMetrics: {
        cpuAvgUtilization: 27.5,
        cpuPeakUtilization: 48.0,
        memAvgUtilization: 33.0,
        memPeakUtilization: 44.0
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    },
    {
      id: "act-turbo-011",
      applicationId: "app-analytics",
      targetEntityName: "analytics-stage-bigquery-vms",
      entityType: "VirtualMachine",
      cloudProvider: "GCP",
      actionType: "PARK_OFFHOURS",
      riskCategory: "COST_EFFICIENCY",
      currentSpecification: "n2-standard-16 (Always-On)",
      recommendedSpecification: "Automated Off-Hours Workload Parking",
      monthlyCostSavings: 28000,
      reason: "Staging cluster idle after nightly pipeline runs (03:00 to 18:00 idle).",
      performanceMetrics: {
        cpuAvgUtilization: 4.2,
        cpuPeakUtilization: 11.0,
        memAvgUtilization: 16.0,
        memPeakUtilization: 19.0
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    },
    {
      id: "act-turbo-012",
      applicationId: "app-retail",
      targetEntityName: "ebs-gp2-to-gp3-migration",
      entityType: "Volume",
      cloudProvider: "AWS",
      actionType: "SCALE_TIER",
      riskCategory: "SAVINGS_PLAN",
      currentSpecification: "60 TB gp2 storage",
      recommendedSpecification: "60 TB gp3 with 3000 baseline IOPS",
      monthlyCostSavings: 9000,
      reason: "Migrate legacy gp2 volumes to gp3 for immediate 20% price reduction with identical/improved IOPS and throughput.",
      performanceMetrics: {
        cpuAvgUtilization: 0,
        cpuPeakUtilization: 0,
        memAvgUtilization: 0,
        memPeakUtilization: 0
      },
      status: "RECOMMENDED",
      policyAutomationEnabled: true
    }
  ]
};
