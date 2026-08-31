// FleetOps - IBM Carbon Design System Application
// Backend server that proxies to the existing cold-chain API

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const fs = require('fs').promises;
const k8s = require('@kubernetes/client-node');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Kubernetes client (for in-cluster API access)
const kc = new k8s.KubeConfig();
let k8sAppsApi;
try {
  kc.loadFromCluster(); // Load in-cluster config
  k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
  console.log('✓ Kubernetes API client initialized (in-cluster)');
} catch (error) {
  console.log('⚠️  Kubernetes API not available (running outside cluster)');
  k8sAppsApi = null;
}

// Cold-chain API base URL (existing backend)
const COLDCHAIN_API_URL = process.env.COLDCHAIN_API_URL || 'https://fleetops-api-fleetops-backend.apps.itz-uv3vvn.hub01-lb.techzone.ibm.com';

// Forecast API base URL
const FORECAST_API_URL = process.env.FORECAST_API_URL || 'https://fleetops-forecasting-fleetops-backend.apps.itz-uv3vvn.hub01-lb.techzone.ibm.com';

// Turbonomic API base URL (for widget)
const TURBONOMIC_API_URL = process.env.TURBONOMIC_API_URL || COLDCHAIN_API_URL;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],  // Allow inline event handlers (onclick, etc.)
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      // Allow connections to self (for /api/* endpoints) and external APIs
      connectSrc: ["'self'", "https:", COLDCHAIN_API_URL, FORECAST_API_URL, TURBONOMIC_API_URL],
      upgradeInsecureRequests: null  // Disable upgrade-insecure-requests for local development
    }
  },
  hsts: false  // Disable HSTS for local development (prevents HTTPS redirect)
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Serve static files (Carbon UI)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'fleetops-carbon-app',
    coldchainApi: COLDCHAIN_API_URL
  });
});

// Configuration endpoint - Returns frontend configuration
app.get('/api/config', (req, res) => {
  res.status(200).json({
    instanaUrl: process.env.INSTANA_URL,
    turbonomicUrl: process.env.TURBONOMIC_URL
  });
});

// API Proxy Routes - Forward to cold-chain backend

// COMMENTED OUT: /api/telemetry - Not available in fleetops-backend, only used by Archive tab
// app.use('/api/telemetry', async (req, res) => {
//   try {
//     const response = await axios({
//       method: req.method,
//       url: `${COLDCHAIN_API_URL}/api/telemetry${req.url}`,
//       data: req.body,
//       params: req.query
//     });
//     res.status(response.status).json(response.data);
//   } catch (error) {
//     console.error('Telemetry API error:', error.message);
//     res.status(error.response?.status || 500).json({
//       error: 'API Error',
//       message: error.message
//     });
//   }
// });

app.use('/api/trucks', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${COLDCHAIN_API_URL}/api/trucks${req.url}`,
      data: req.body,
      params: req.query
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Trucks API error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'API Error',
      message: error.message
    });
  }
});

app.use('/api/alerts', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${COLDCHAIN_API_URL}/api/alerts${req.url}`,
      data: req.body,
      params: req.query
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Alerts API error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'API Error',
      message: error.message
    });
  }
});

app.use('/api/stations', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${COLDCHAIN_API_URL}/api/stations${req.url}`,
      data: req.body,
      params: req.query
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Stations API error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'API Error',
      message: error.message
    });
  }
});
// Proxy for Agents API (watsonx Orchestrate integration)
app.use('/api/agents', async (req, res) => {
  const targetUrl = `${COLDCHAIN_API_URL}/api/agents${req.url}`;
  console.log('=== AGENTS PROXY REQUEST ===');
  console.log('Method:', req.method);
  console.log('Original URL:', req.url);
  console.log('Target URL:', targetUrl);
  console.log('COLDCHAIN_API_URL:', COLDCHAIN_API_URL);
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const startTime = Date.now();
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000  // 120 seconds timeout for agent workflow execution
    });
    const endTime = Date.now();
    
    console.log(`Proxy request completed in ${endTime - startTime}ms`);
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    console.log('=== AGENTS PROXY SUCCESS ===');
    
    res.json(response.data);
  } catch (error) {
    console.error('=== AGENTS PROXY ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error response status:', error.response?.status);
    console.error('Error response data:', JSON.stringify(error.response?.data, null, 2));
    console.error('=== PROXY ERROR END ===');
    
    res.status(error.response?.status || 500).json({
      error: 'Agents API request failed',
      message: error.message
    });
  }
});


app.use('/api/weather', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${COLDCHAIN_API_URL}/api/weather${req.url}`,
      data: req.body,
      params: req.query
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Weather API error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'API Error',
      message: error.message
    });
  }
});

app.use('/api/routes', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${COLDCHAIN_API_URL}/api/routes${req.url}`,
      data: req.body,
      params: req.query
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Routes API error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'API Error',
      message: error.message
    });
  }
});

// Forecast API Proxy Routes
app.use('/api/forecast', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${FORECAST_API_URL}/api/forecast${req.url}`,
      data: req.body,
      params: req.query,
      timeout: 30000 // 30 second timeout for ML operations
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Forecast API error:', error.message);
    console.error('Forecast API URL:', `${FORECAST_API_URL}/api/forecast${req.url}`);
    res.status(error.response?.status || 500).json({
      error: 'Forecast API Error',
      message: error.message,
      details: error.response?.data || 'No additional details'
    });
  }
});

// Instana API Routes
const INSTANA_BASE_URL = process.env.INSTANA_BASE_URL || 'https://ibmdevsandbox-instanaibm.instana.io';
const INSTANA_API_TOKEN = process.env.INSTANA_API_TOKEN;
const INSTANA_SERVICE_NAME = process.env.INSTANA_SERVICE_NAME || 'coldchain-customer-app';
const INSTANA_DEPLOYMENT_NAME = process.env.INSTANA_DEPLOYMENT_NAME || 'coldchain-nodejs';
const INSTANA_NAMESPACE = process.env.INSTANA_NAMESPACE || 'cold-chain';
const INSTANA_CLUSTER = process.env.INSTANA_CLUSTER || 'itz-c4dpa2-qb44h';

// Get Service Metrics (calls, errors, latency)
app.get('/api/instana/service-metrics', async (req, res) => {
  try {
    const windowSize = parseInt(req.query.windowSize) || 3600000; // 1 hour default
    const now = Date.now();
    
    const response = await axios.post(
      `${INSTANA_BASE_URL}/api/application-monitoring/analyze/call-groups`,
      {
        timeFrame: {
          to: now,
          focusedMoment: now,
          autoRefresh: false,
          windowSize: windowSize
        },
        tagFilterExpression: {
          type: 'EXPRESSION',
          logicalOperator: 'AND',
          elements: [
            {
              type: 'TAG_FILTER',
              name: 'service.name',
              operator: 'EQUALS',
              entity: 'DESTINATION',
              value: INSTANA_SERVICE_NAME
            },
            {
              type: 'EXPRESSION',
              logicalOperator: 'OR',
              elements: [
                {
                  type: 'TAG_FILTER',
                  name: 'call.type',
                  operator: 'EQUALS',
                  entity: 'NOT_APPLICABLE',
                  value: 'HTTP'
                },
                {
                  type: 'TAG_FILTER',
                  name: 'call.type',
                  operator: 'EQUALS',
                  entity: 'NOT_APPLICABLE',
                  value: 'OPENTELEMETRY'
                }
              ]
            }
          ]
        },
        metrics: [
          { metric: 'calls', aggregation: 'PER_SECOND' },
          { metric: 'errors', aggregation: 'MEAN' },
          { metric: 'latency', aggregation: 'MEAN' }
        ],
        order: { by: 'calls', direction: 'DESC' },
        group: { groupbyTag: 'endpoint.name', groupbyTagEntity: 'DESTINATION' }
      },
      {
        headers: {
          'Authorization': `apiToken ${INSTANA_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Instana service metrics error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch service metrics',
      message: error.message
    });
  }
});

// Get Infrastructure Metrics Overview
app.get('/api/instana/infra-metrics', async (req, res) => {
  try {
    const windowSize = parseInt(req.query.windowSize) || 3600000; // 1 hour default
    const now = Date.now();
    
    const response = await axios.post(
      `${INSTANA_BASE_URL}/api/infrastructure-monitoring/analyze/entities`,
      {
        timeFrame: { to: now, windowSize: windowSize },
        tagFilterExpression: {
          type: 'TAG_FILTER',
          name: 'kubernetes.deployment.name',
          operator: 'EQUALS',
          entity: 'NOT_APPLICABLE',
          value: INSTANA_DEPLOYMENT_NAME
        },
        pagination: { retrievalSize: 20 },
        type: 'kubernetesDeployment',
        metrics: [
          { metric: 'pods.required_cpu', aggregation: 'MEAN', label: 'CPU Requests' },
          { metric: 'pods.required_mem', aggregation: 'MEAN', label: 'Memory Requests' },
          { metric: 'pods.limit_cpu', aggregation: 'MEAN', label: 'CPU Limits' },
          { metric: 'pods.limit_mem', aggregation: 'MEAN', label: 'Memory Limits' }
        ],
        order: { by: 'label', direction: 'ASC' }
      },
      {
        headers: {
          'Authorization': `apiToken ${INSTANA_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Instana infra metrics error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch infrastructure metrics',
      message: error.message
    });
  }
});

// Get Service Metrics Time-Series (for charts)
app.get('/api/instana/service-timeseries', async (req, res) => {
  try {
    const windowSize = parseInt(req.query.windowSize) || 86400000; // 24 hours default
    const now = Date.now();
    
    // Calculate dynamic granularity based on window size
    // Goal: ~10-20 data points for good visualization
    let granularity;
    if (windowSize <= 300000) {        // 5 minutes
      granularity = 30;                 // 30 seconds -> 10 points
    } else if (windowSize <= 1800000) { // 30 minutes
      granularity = 60;                 // 1 minute -> 30 points
    } else if (windowSize <= 3600000) { // 1 hour
      granularity = 180;                // 3 minutes -> 20 points
    } else if (windowSize <= 21600000) {// 6 hours
      granularity = 300;                // 5 minutes -> 72 points (try smaller interval)
    } else {                            // 24 hours+
      granularity = 1800;               // 30 minutes -> 48 points for 24h
    }
    
    console.log(`Window: ${windowSize}ms, Granularity: ${granularity}s`);
    
    const response = await axios.post(
      `${INSTANA_BASE_URL}/api/application-monitoring/analyze/call-groups`,
      {
        timeFrame: {
          to: now,
          focusedMoment: now,
          autoRefresh: false,
          windowSize: windowSize
        },
        tagFilterExpression: {
          type: 'EXPRESSION',
          logicalOperator: 'AND',
          elements: [
            {
              type: 'TAG_FILTER',
              name: 'service.name',
              operator: 'EQUALS',
              entity: 'DESTINATION',
              value: INSTANA_SERVICE_NAME
            },
            {
              type: 'EXPRESSION',
              logicalOperator: 'OR',
              elements: [
                {
                  type: 'TAG_FILTER',
                  name: 'call.type',
                  operator: 'EQUALS',
                  entity: 'NOT_APPLICABLE',
                  value: 'HTTP'
                },
                {
                  type: 'TAG_FILTER',
                  name: 'call.type',
                  operator: 'EQUALS',
                  entity: 'NOT_APPLICABLE',
                  value: 'OPENTELEMETRY'
                }
              ]
            }
          ]
        },
        metrics: [
          { metric: 'calls', aggregation: 'PER_SECOND', granularity: granularity },
          { metric: 'latency', aggregation: 'MEAN', granularity: granularity }
        ],
        group: {
          groupbyTag: 'endpoint.name',
          groupbyTagEntity: 'DESTINATION'
        }
      },
      {
        headers: {
          'Authorization': `apiToken ${INSTANA_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Instana service timeseries error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch service timeseries',
      message: error.message
    });
  }
});

// Get Infrastructure Metrics Time-Series (for charts)
app.get('/api/instana/infra-timeseries', async (req, res) => {
  try {
    const windowSize = parseInt(req.query.windowSize) || 86400000; // 24 hours default
    const now = Date.now();
    
    const response = await axios.post(
      `${INSTANA_BASE_URL}/api/infrastructure-monitoring/analyze/entities`,
      {
        metrics: [
          { metric: 'pods.limit_cpu', aggregation: 'MEAN', granularity: 300 },
          { metric: 'pods.required_cpu', aggregation: 'MEAN', granularity: 300 },
          { metric: 'pods.limit_mem', aggregation: 'MEAN', granularity: 300 },
          { metric: 'pods.required_mem', aggregation: 'MEAN', granularity: 300 }
        ],
        timeFrame: {
          to: now,
          windowSize: windowSize
        },
        tagFilterExpression: {
          type: 'EXPRESSION',
          logicalOperator: 'AND',
          elements: [
            {
              type: 'TAG_FILTER',
              name: 'kubernetes.deployment.name',
              operator: 'EQUALS',
              entity: 'NOT_APPLICABLE',
              value: INSTANA_DEPLOYMENT_NAME
            },
            {
              type: 'TAG_FILTER',
              name: 'kubernetes.namespace.name',
              operator: 'EQUALS',
              entity: 'NOT_APPLICABLE',
              value: INSTANA_NAMESPACE
            },
            {
              type: 'TAG_FILTER',
              name: 'kubernetes.cluster.name',
              operator: 'EQUALS',
              entity: 'NOT_APPLICABLE',
              value: INSTANA_CLUSTER
            }
          ]
        },
        pagination: {
          page: 1,
          pageSize: 200
        }
      },
      {
        headers: {
          'Authorization': `apiToken ${INSTANA_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Instana infra timeseries error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch infrastructure timeseries',
      message: error.message
    });
  }
});

// Get Infrastructure Metrics Detailed (time series)
app.get('/api/instana/infra-metrics-detailed', async (req, res) => {
  try {
    const windowSize = parseInt(req.query.windowSize) || 86400000; // 24 hours default
    
    const response = await axios.post(
      `${INSTANA_BASE_URL}/api/infrastructure-monitoring/analyze/entities`,
      {
        metrics: [
          { metric: 'pods.limit_cpu', aggregation: 'MEAN', granularity: 300 },
          { metric: 'pods.required_cpu', aggregation: 'MEAN', granularity: 300 },
          { metric: 'pods.limit_mem', aggregation: 'MEAN', granularity: 300 },
          { metric: 'pods.required_mem', aggregation: 'MEAN', granularity: 300 }
        ],
        timeFrame: { to: null, windowSize: windowSize },
        tagFilterExpression: {
          type: 'EXPRESSION',
          logicalOperator: 'AND',
          elements: [
            {
              type: 'TAG_FILTER',
              name: 'kubernetes.deployment.name',
              operator: 'EQUALS',
              entity: 'NOT_APPLICABLE',
              value: INSTANA_DEPLOYMENT_NAME
            },
            {
              type: 'TAG_FILTER',
              name: 'kubernetes.namespace.name',
              operator: 'EQUALS',
              entity: 'NOT_APPLICABLE',
              value: INSTANA_NAMESPACE
            },
            {
              type: 'TAG_FILTER',
              name: 'kubernetes.cluster.name',
              operator: 'EQUALS',
              entity: 'NOT_APPLICABLE',
              value: INSTANA_CLUSTER
            }
          ]
        },
        pagination: { page: 1, pageSize: 200 }
      },
      {
        headers: {
          'Authorization': `apiToken ${INSTANA_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Instana detailed metrics error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch detailed metrics',
      message: error.message
    });
  }
});

// Turbonomic API Routes
// Note: Login uses nginx-turbonomic, but get/execute use turbonomic-api (different domains)
const TURBONOMIC_LOGIN_URL = process.env.TURBONOMIC_LOGIN_URL;
const TURBONOMIC_USERNAME = process.env.TURBONOMIC_USERNAME || 'administrator';
const TURBONOMIC_PASSWORD = process.env.TURBONOMIC_PASSWORD; // Must be set via environment variable
const TURBONOMIC_DISPLAY_NAME = process.env.TURBONOMIC_DISPLAY_NAME;

// OpenShift Configuration for Mock Action Execution
const OPENSHIFT_DEPLOYMENT = process.env.OPENSHIFT_DEPLOYMENT || 'fleetops-backend';
const OPENSHIFT_NAMESPACE = process.env.OPENSHIFT_NAMESPACE || 'fleetops-backend';
const OPENSHIFT_CPU_INCREMENT = process.env.OPENSHIFT_CPU_INCREMENT || '100m'; // Default 100 millicores

// Store session cookies in memory (separate for each domain)
let turbonomicLoginCookie = null;
let turbonomicApiCookie = null;
let cookieExpiry = null;

// Function to login to Turbonomic and get session cookies for both domains
async function getTurbonomicCookies() {
  // Return cached cookies if still valid (valid for 30 minutes)
  if (turbonomicLoginCookie && turbonomicApiCookie && cookieExpiry && Date.now() < cookieExpiry) {
    return { loginCookie: turbonomicLoginCookie, apiCookie: turbonomicApiCookie };
  }

  try {
    console.log('🔐 Logging in to Turbonomic...');
    const params = new URLSearchParams();
    params.append('username', TURBONOMIC_USERNAME);
    params.append('password', TURBONOMIC_PASSWORD);

    const response = await axios.post(TURBONOMIC_LOGIN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Extract cookies from response headers
    const setCookie = response.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      // Parse all cookies
      turbonomicLoginCookie = setCookie.map(c => c.split(';')[0]).join('; ');
      turbonomicApiCookie = turbonomicLoginCookie; // Try using same cookies for API
      
      // Set expiry to 30 minutes from now
      cookieExpiry = Date.now() + (30 * 60 * 1000);
      console.log('Turbonomic login successful, cookies cached');
      console.log('Login cookie:', turbonomicLoginCookie);
      return { loginCookie: turbonomicLoginCookie, apiCookie: turbonomicApiCookie };
    } else {
      throw new Error('No cookie received from Turbonomic login');
    }
  } catch (error) {
    console.error('Turbonomic login failed:', error.message);
    throw error;
  }
}

// ============================================================================
// Mock Turbonomic Action Generator
// ============================================================================

/**
 * Track mock action state
 * - mockActionGenerated: Whether a mock action has been created
 * - mockActionExecuted: Whether the mock action has been executed
 */
let mockActionState = {
  generated: false,
  executed: false,
  uuid: null,
  action: null
};

/**
 * Generate a mock Turbonomic action for demo purposes
 * This action simulates a vCPU shortage recommendation
 * Only generates once per server session
 */
function generateMockTurbonomicAction() {
  // If already generated and not executed, return the existing one
  if (mockActionState.generated && !mockActionState.executed && mockActionState.action) {
    console.log('   📋 Returning existing mock action:', mockActionState.uuid);
    return mockActionState.action;
  }
  
  // If already executed, don't generate a new one
  if (mockActionState.executed) {
    console.log('   ⛔ Mock action already executed - not generating new one');
    return null;
  }
  
  // Generate new mock action
  const uuid = `mock-action-${Date.now()}`;
  const mockAction = {
    uuid: uuid,
    actionType: 'SCALE',
    actionMode: 'RECOMMEND',
    severity: 'CRITICAL',
    target: {
      uuid: `${OPENSHIFT_DEPLOYMENT}-deployment`,
      displayName: TURBONOMIC_DISPLAY_NAME || 'fleetops',
      className: 'Container',
      aspects: {
        virtualMachineAspect: {
          numVCPUs: 0.1 // Current: 100m (0.1 cores)
        }
      }
    },
    currentEntity: {
      displayName: TURBONOMIC_DISPLAY_NAME || 'fleetops',
      className: 'Container'
    },
    newEntity: {
      aspects: {
        virtualMachineAspect: {
          numVCPUs: 0.2 // Recommended: 200m (0.2 cores)
        }
      }
    },
    details: `Container ${TURBONOMIC_DISPLAY_NAME || 'fleetops'} is experiencing vCPU shortage. Increase vCPU allocation by ${OPENSHIFT_CPU_INCREMENT} to improve performance.`,
    risk: {
      severity: 'CRITICAL',
      subCategory: 'Performance',
      description: 'vCPU shortage detected - application performance degraded'
    },
    stats: [
      {
        name: 'vCPU',
        units: 'cores',
        value: 0.1,
        capacity: 0.1,
        utilization: 95.0
      }
    ],
    createTime: Date.now(),
    acceptanceState: 'PENDING_ACCEPT',
    executionDescription: `Increase vCPU allocation for ${OPENSHIFT_DEPLOYMENT} deployment in ${OPENSHIFT_NAMESPACE} namespace by ${OPENSHIFT_CPU_INCREMENT}`,
    isMock: true // Flag to identify mock actions
  };

  // Store the mock action state
  mockActionState.generated = true;
  mockActionState.uuid = uuid;
  mockActionState.action = mockAction;
  
  console.log('   🎭 Generated NEW mock action:', uuid);
  return mockAction;
}

// Get Pending Actions from Turbonomic (with mock action)
app.get('/api/turbonomic/actions/pending', async (req, res) => {
  try {
    const displayName = req.query.displayName || TURBONOMIC_DISPLAY_NAME;
    const cookies = await getTurbonomicCookies();
    
    console.log('📡 Fetching pending actions from:', `${TURBONOMIC_API_URL}/markets/Market/actions`);
    console.log('   Display name filter:', displayName);
    const response = await axios.get(
      `${TURBONOMIC_API_URL}/markets/Market/actions`,
      {
        params: { displayName },
        headers: {
          'Cookie': cookies.apiCookie
        }
      }
    );
    
    console.log('✅ Pending actions fetched successfully');
    console.log('   Response type:', typeof response.data);
    console.log('   Is array:', Array.isArray(response.data));
    console.log('   Total action count:', Array.isArray(response.data) ? response.data.length : 'N/A');
    
    // Turbonomic API returns an array of actions directly
    const allActions = Array.isArray(response.data) ? response.data : [];
    
    // Filter actions to only include those related to the displayName (exact match)
    // Check multiple possible fields where the target name might appear
    const filteredActions = allActions.filter(action => {
      const targetName = action.target?.displayName ||
                        action.target?.name ||
                        action.currentEntity?.displayName ||
                        action.currentEntity?.name ||
                        '';
      
      // Exact match (case-insensitive) - not partial match
      // This ensures "fleetops" matches only "fleetops", not "fleetops-backend" or "fleetops-forecasting"
      const matches = targetName.toLowerCase() === displayName.toLowerCase();
      
      if (matches) {
        console.log(`   ✓ Matched action: ${action.actionType} for ${targetName}`);
      }
      
      return matches;
    });
    
    console.log(`   Filtered: ${filteredActions.length} actions (from ${allActions.length} total) matching "${displayName}"`);
    
    // Return only real actions (no automatic mock generation)
    // Mock actions are only included when explicitly injected via /api/turbonomic/actions/inject-mock
    let finalActions = filteredActions;
    
    // If mock action exists and hasn't been executed, include it
    if (mockActionState.generated && !mockActionState.executed && mockActionState.action) {
      console.log('   🎭 Including existing mock action:', mockActionState.uuid);
      finalActions = [...filteredActions, mockActionState.action];
    }
    
    console.log(`   Returning ${finalActions.length} actions (${filteredActions.length} real, ${finalActions.length - filteredActions.length} mock)`);
    
    // Transform to the format expected by frontend
    const formattedResponse = {
      count: finalActions.length,
      actions: finalActions
    };
    
    console.log(`   Final response: ${finalActions.length} total actions`);
    
    res.json(formattedResponse);
  } catch (error) {
    console.error('Turbonomic pending actions error:', error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch pending actions',
      message: error.message
    });
  }
});

// Inject Mock Action - Create a mock Turbonomic action on demand
app.get('/api/turbonomic/actions/inject-mock', (req, res) => {
  try {
    console.log('🎭 Mock action injection requested');
    
    // Check if mock action already exists and hasn't been executed
    if (mockActionState.generated && !mockActionState.executed && mockActionState.action) {
      console.log('   ⚠️  Mock action already exists:', mockActionState.uuid);
      return res.json({
        success: false,
        message: 'Mock action already exists and has not been executed',
        action: mockActionState.action
      });
    }
    
    // If mock action was already executed, reset state to allow new injection
    if (mockActionState.executed) {
      console.log('   🔄 Resetting executed mock action state to allow new injection');
      mockActionState.generated = false;
      mockActionState.executed = false;
      mockActionState.uuid = null;
      mockActionState.action = null;
    }
    
    // Generate new mock action
    const mockAction = generateMockTurbonomicAction();
    
    if (mockAction) {
      console.log('   ✅ Mock action created successfully:', mockAction.uuid);
      res.json({
        success: true,
        message: 'Mock action created successfully',
        action: mockAction
      });
    } else {
      console.log('   ❌ Failed to create mock action');
      res.status(500).json({
        success: false,
        message: 'Failed to create mock action'
      });
    }
  } catch (error) {
    console.error('❌ Error injecting mock action:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to inject mock action',
      message: error.message
    });
  }
});

// Delete existing mock action (only if not executed)
app.delete('/api/turbonomic/actions/delete-mock', (req, res) => {
  try {
    console.log('🗑️  Mock action deletion requested');
    
    // Check if mock action exists
    if (!mockActionState.generated || !mockActionState.action) {
      console.log('   ⚠️  No mock action exists to delete');
      return res.json({
        success: false,
        message: 'No mock action exists to delete'
      });
    }
    
    // Check if mock action has already been executed
    if (mockActionState.executed) {
      console.log('   ⛔ Cannot delete executed mock action:', mockActionState.uuid);
      return res.json({
        success: false,
        message: 'Cannot delete mock action that has already been executed',
        action: mockActionState.action
      });
    }
    
    // Store the deleted action info for response
    const deletedAction = {
      uuid: mockActionState.uuid,
      actionType: mockActionState.action.actionType,
      target: mockActionState.action.target.displayName
    };
    
    // Reset mock action state
    console.log('   ✅ Deleting mock action:', mockActionState.uuid);
    mockActionState.generated = false;
    mockActionState.executed = false;
    mockActionState.uuid = null;
    mockActionState.action = null;
    
    res.json({
      success: true,
      message: 'Mock action deleted successfully',
      deletedAction: deletedAction
    });
  } catch (error) {
    console.error('❌ Error deleting mock action:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete mock action',
      message: error.message
    });
  }
});

// Get Pending Actions - Alias endpoint for frontend compatibility
// Frontend calls /api/turbonomic/actions, so we provide this alias
app.get('/api/turbonomic/actions', async (req, res) => {
  try {
    const displayName = req.query.displayName || TURBONOMIC_DISPLAY_NAME;
    const cookies = await getTurbonomicCookies();
    
    console.log('📡 Fetching actions from alias endpoint:', `${TURBONOMIC_API_URL}/markets/Market/actions`);
    console.log('   Display name filter:', displayName);
    
    const response = await axios.get(
      `${TURBONOMIC_API_URL}/markets/Market/actions`,
      {
        params: { displayName },
        headers: {
          'Cookie': cookies.apiCookie
        }
      }
    );
    
    console.log('✅ Actions fetched successfully via alias endpoint');
    console.log('   Total action count:', Array.isArray(response.data) ? response.data.length : 'N/A');
    
    // Turbonomic API returns an array of actions directly
    const allActions = Array.isArray(response.data) ? response.data : [];
    
    // Filter actions to only include those related to the displayName
    const filteredActions = allActions.filter(action => {
      const targetName = action.target?.displayName ||
                        action.target?.name ||
                        action.currentEntity?.displayName ||
                        action.currentEntity?.name ||
                        '';
      
      const matches = targetName.toLowerCase() === displayName.toLowerCase();
      
      if (matches) {
        console.log(`   ✓ Matched action: ${action.actionType} for ${targetName}`);
      }
      
      return matches;
    });
    
    console.log(`   Filtered: ${filteredActions.length} actions matching "${displayName}"`);
    
    // Return only real actions (no automatic mock generation)
    // Mock actions are only included when explicitly injected via /api/turbonomic/actions/inject-mock
    const finalActions = filteredActions;
    
    console.log(`   Returning ${finalActions.length} real actions`);
    
    // Transform to the format expected by frontend
    const formattedResponse = {
      count: finalActions.length,
      actions: finalActions
    };
    
    console.log(`   Final response: ${finalActions.length} total actions`);
    
    res.json(formattedResponse);
  } catch (error) {
    console.error('Turbonomic actions error:', error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch actions',
      message: error.message
    });
  }
});

// Execute Single Action - Alias endpoint for frontend compatibility
// Frontend calls /api/turbonomic/actions/:actionId/execute
app.post('/api/turbonomic/actions/:actionId/execute', async (req, res) => {
  try {
    const { actionId } = req.params;
    console.log('🔧 Execute single action request received (alias endpoint)');
    console.log('Action ID:', actionId);
    
    // Convert single actionId to array format expected by main execute endpoint
    const action_uuids = [actionId];
    
    // Check if this is a mock action
    const isMockAction = actionId.startsWith('mock-action-');
    
    const results = {
      executed: [],
      failed: []
    };
    
    // Execute mock action (scale deployment via Kubernetes API)
    if (isMockAction) {
      console.log('🎭 Executing mock action - scaling deployment via Kubernetes API');
      
      if (!k8sAppsApi) {
        console.error('❌ Kubernetes API not available');
        results.failed.push({
          uuid: actionId,
          error: 'Kubernetes API not available',
          details: 'Running outside cluster or API client not initialized'
        });
      } else {
        try {
          // Get current deployment
          const deployment = await k8sAppsApi.readNamespacedDeployment(
            OPENSHIFT_DEPLOYMENT,
            OPENSHIFT_NAMESPACE
          );
          
          const currentCPU = deployment.body.spec.template.spec.containers[0].resources.limits.cpu || '500m';
          console.log('Current CPU limit:', currentCPU);
          
          // Calculate new CPU value
          const currentMillicores = parseInt(currentCPU) || 500;
          const incrementMillicores = parseInt(OPENSHIFT_CPU_INCREMENT) || 100;
          const newMillicores = currentMillicores + incrementMillicores;
          const newCPU = `${newMillicores}m`;
          
          console.log(`Scaling CPU limit: ${currentCPU} → ${newCPU} (+${OPENSHIFT_CPU_INCREMENT})`);
          
          // Patch deployment with new CPU limit at deployment level
          // This ensures Instana sees the deployment-level resource changes
          const patch = [
            {
              op: 'replace',
              path: '/spec/template/spec/containers/0/resources/limits/cpu',
              value: newCPU
            }
          ];
          
          console.log('Patching deployment-level CPU limit for Instana observability...');
          await k8sAppsApi.patchNamespacedDeployment(
            OPENSHIFT_DEPLOYMENT,
            OPENSHIFT_NAMESPACE,
            patch,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { headers: { 'Content-Type': 'application/json-patch+json' } }
          );
          
          console.log('✅ Deployment-level resources updated (visible to Instana)');
          
          console.log('✅ Deployment patched successfully');
          
          // Clear mock action state after execution
          // Keep executed=true to prevent automatic generation
          console.log('   🗑️  Clearing mock action state after execution');
          mockActionState.generated = false;
          mockActionState.executed = true;  // Keep true to prevent auto-generation
          mockActionState.uuid = null;
          mockActionState.action = null;
          console.log('   ✅ Mock action executed - use inject-mock API for new action');
          
          results.executed.push({
            uuid: actionId,
            type: 'MOCK_SCALE',
            target: `${OPENSHIFT_DEPLOYMENT} (${OPENSHIFT_NAMESPACE})`,
            action: `Increased CPU from ${currentCPU} to ${newCPU}`,
            status: 'SUCCESS',
            timestamp: new Date().toISOString()
          });
          
          console.log('✅ Mock action executed successfully');
        } catch (error) {
          console.error('❌ Mock action execution failed:', error.message);
          results.failed.push({
            uuid: actionId,
            error: error.message,
            details: error.response?.body || error.stack
          });
        }
      }
    } else {
      // Execute real Turbonomic action
      console.log('🔧 Executing real Turbonomic action:', actionId);
      try {
        const cookies = await getTurbonomicCookies();
        
        // Turbonomic API v3 execute endpoint: POST /api/v3/actions/{uuid}?accept=true&forMaintenanceWindow=false
        const executeUrl = `${TURBONOMIC_API_URL}/actions/${actionId}`;
        console.log('   Execute URL:', executeUrl);
        console.log('   Query params: accept=true, forMaintenanceWindow=false');
        
        const response = await axios.post(
          executeUrl,
          {}, // Empty body - action UUID is in URL
          {
            params: {
              accept: true,
              forMaintenanceWindow: false
            },
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookies.apiCookie
            }
          }
        );
        
        console.log('✅ Turbonomic execute response:', response.status, response.statusText);
        console.log('   Response data:', JSON.stringify(response.data, null, 2));
        
        results.executed.push({
          uuid: actionId,
          status: 'SUCCESS',
          response: response.data,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Real action execution failed:', error.message);
        if (error.response) {
          console.error('   Error status:', error.response.status);
          console.error('   Error data:', JSON.stringify(error.response.data, null, 2));
        }
        results.failed.push({
          uuid: actionId,
          error: error.message,
          details: error.response?.data,
          status: error.response?.status
        });
      }
    }
    
    // Return results
    const responseData = {
      success: results.failed.length === 0,
      executed: results.executed,
      failed: results.failed,
      message: results.failed.length === 0
        ? 'Action executed successfully'
        : 'Action execution failed'
    };
    
    console.log('Execute response:', JSON.stringify(responseData, null, 2));
    res.json(responseData);
    
  } catch (error) {
    console.error('Execute action error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to execute action',
      message: error.message
    });
  }
});

// Execute Actions in Turbonomic (handles both real and mock actions)
app.post('/api/turbonomic/actions/execute', async (req, res) => {
  try {
    console.log('🔧 Execute action request received');
    const { action_uuids } = req.body;
    console.log('Action UUIDs:', action_uuids);
    
    if (!action_uuids || !Array.isArray(action_uuids)) {
      console.error('Invalid request: action_uuids must be an array');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'action_uuids must be an array'
      });
    }
    
    // Check if any of the actions are mock actions
    const mockActionUUIDs = action_uuids.filter(uuid => uuid.startsWith('mock-action-'));
    const realActionUUIDs = action_uuids.filter(uuid => !uuid.startsWith('mock-action-'));
    
    const results = {
      executed: [],
      failed: []
    };
    
    // Execute mock actions (scale OpenShift deployment)
    if (mockActionUUIDs.length > 0) {
      console.log('🎭 Executing mock action - scaling deployment via Kubernetes API');
      
      if (!k8sAppsApi) {
        console.error('❌ Kubernetes API not available');
        results.failed.push({
          uuid: mockActionUUIDs[0],
          error: 'Kubernetes API not available',
          details: 'Running outside cluster or API client not initialized'
        });
      } else {
        try {
          // Get current deployment
          const deployment = await k8sAppsApi.readNamespacedDeployment(
            OPENSHIFT_DEPLOYMENT,
            OPENSHIFT_NAMESPACE
          );
          
          const currentCPU = deployment.body.spec.template.spec.containers[0].resources.limits.cpu || '500m';
          console.log('Current CPU limit:', currentCPU);
          
          // Calculate new CPU value
          const currentMillicores = parseInt(currentCPU) || 500;
          const incrementMillicores = parseInt(OPENSHIFT_CPU_INCREMENT) || 100;
          const newMillicores = currentMillicores + incrementMillicores;
          const newCPU = `${newMillicores}m`;
          
          console.log(`Scaling CPU limit: ${currentCPU} → ${newCPU} (+${OPENSHIFT_CPU_INCREMENT})`);
          
          // Patch deployment with new CPU limit
          const patch = [
            {
              op: 'replace',
              path: '/spec/template/spec/containers/0/resources/limits/cpu',
              value: newCPU
            }
          ];
          
          await k8sAppsApi.patchNamespacedDeployment(
            OPENSHIFT_DEPLOYMENT,
            OPENSHIFT_NAMESPACE,
            patch,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { headers: { 'Content-Type': 'application/json-patch+json' } }
          );
          
          console.log('✅ Deployment patched successfully');
          
          // Mark mock action as executed
          mockActionState.executed = true;
          console.log('   ✅ Mock action marked as executed - will not generate new ones');
          
          results.executed.push({
            uuid: mockActionUUIDs[0],
            type: 'MOCK_SCALE',
            target: `${OPENSHIFT_DEPLOYMENT} (${OPENSHIFT_NAMESPACE})`,
            action: `Increased CPU from ${currentCPU} to ${newCPU}`,
            status: 'SUCCESS',
            timestamp: new Date().toISOString()
          });
          
          console.log('✅ Mock action executed successfully');
        } catch (error) {
          console.error('❌ Mock action execution failed:', error.message);
          results.failed.push({
            uuid: mockActionUUIDs[0],
            error: error.message,
            details: error.response?.body || error.stack
          });
        }
      }
    }
    
    // Execute real Turbonomic actions
    if (realActionUUIDs.length > 0) {
      console.log('Executing real Turbonomic actions...');
      try {
        const cookies = await getTurbonomicCookies();
        
        const response = await axios.post(
          `${TURBONOMIC_API_URL}/api/actions/execute`,
          '',
          {
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookies.apiCookie
            }
          }
        );
        
        console.log('Turbonomic execute response:', response.status);
        results.executed.push(...(response.data.executed || []));
        results.failed.push(...(response.data.failed || []));
      } catch (error) {
        console.error('Real action execution error:', error.message);
        realActionUUIDs.forEach(uuid => {
          results.failed.push({
            uuid,
            error: error.message
          });
        });
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Turbonomic execute actions error:', error.message);
    res.status(500).json({
      error: 'Failed to execute actions',
      message: error.message
    });
  }
});

// Execution History API Routes
const HISTORY_FILE = path.join(__dirname, 'data', 'execution-history.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
    console.log('✓ Data directory exists:', dataDir);
    
    // Verify write permissions
    try {
      await fs.access(dataDir, fs.constants.W_OK);
      console.log('✓ Data directory is writable');
    } catch (permError) {
      console.error('⚠️ Warning: Data directory exists but is not writable:', dataDir);
      console.error('Permission error:', permError.message);
      throw new Error(`Data directory is not writable: ${permError.message}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Creating data directory:', dataDir);
      try {
        await fs.mkdir(dataDir, { recursive: true });
        console.log('✓ Data directory created');
        
        // Verify the newly created directory is writable
        await fs.access(dataDir, fs.constants.W_OK);
        console.log('✓ New data directory is writable');
      } catch (createError) {
        console.error('❌ Failed to create or access data directory:', createError);
        throw new Error(`Cannot create writable data directory: ${createError.message}`);
      }
    } else {
      throw error;
    }
  }
}

// Read history from file
async function readHistory() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(HISTORY_FILE, 'utf8');
    const history = JSON.parse(data);
    console.log(`✓ Read ${history.length} history entries from file`);
    return history;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('History file does not exist yet, returning empty array');
      return []; // File doesn't exist yet
    }
    console.error('Error reading history file:', error);
    throw error;
  }
}

// Write history to file
async function writeHistory(history) {
  try {
    await ensureDataDir();
    console.log(`Writing ${history.length} entries to history file:`, HISTORY_FILE);
    
    // Check if directory is writable
    try {
      await fs.access(path.dirname(HISTORY_FILE), fs.constants.W_OK);
    } catch (accessError) {
      console.error('❌ Data directory is not writable:', path.dirname(HISTORY_FILE));
      throw new Error(`Data directory is not writable: ${accessError.message}`);
    }
    
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    console.log('✓ History file written successfully');
  } catch (error) {
    console.error('❌ Error writing history file:', error);
    console.error('File path:', HISTORY_FILE);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw error;
  }
}

// GET /api/execution-history/status - Check storage status
app.get('/api/execution-history/status', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    const status = {
      dataDir,
      historyFile: HISTORY_FILE,
      checks: {}
    };
    
    // Check if directory exists
    try {
      await fs.access(dataDir);
      status.checks.directoryExists = true;
    } catch (error) {
      status.checks.directoryExists = false;
      status.checks.directoryError = error.message;
    }
    
    // Check if directory is writable
    try {
      await fs.access(dataDir, fs.constants.W_OK);
      status.checks.directoryWritable = true;
    } catch (error) {
      status.checks.directoryWritable = false;
      status.checks.writeError = error.message;
    }
    
    // Check if history file exists
    try {
      await fs.access(HISTORY_FILE);
      status.checks.historyFileExists = true;
      const stats = await fs.stat(HISTORY_FILE);
      status.checks.fileSize = stats.size;
      status.checks.fileModified = stats.mtime;
    } catch (error) {
      status.checks.historyFileExists = false;
    }
    
    // Try to read history
    try {
      const history = await readHistory();
      status.checks.canRead = true;
      status.checks.recordCount = history.length;
    } catch (error) {
      status.checks.canRead = false;
      status.checks.readError = error.message;
    }
    
    res.json(status);
  } catch (error) {
    console.error('Error checking storage status:', error);
    res.status(500).json({ error: 'Failed to check storage status', message: error.message });
  }
});

// GET /api/execution-history - Get all execution history
app.get('/api/execution-history', async (req, res) => {
  try {
    const history = await readHistory();
    res.json(history);
  } catch (error) {
    console.error('Error reading execution history:', error);
    res.status(500).json({ error: 'Failed to read execution history', message: error.message });
  }
});

// POST /api/execution-history - Add new execution record
app.post('/api/execution-history', async (req, res) => {
  try {
    const newRecord = req.body;
    const history = await readHistory();
    history.unshift(newRecord); // Add to beginning
    await writeHistory(history);
    res.json({ success: true, record: newRecord });
  } catch (error) {
    console.error('Error saving execution history:', error);
    console.error('Error stack:', error.stack);
    
    // Ensure we always return JSON, never HTML
    res.status(500).json({
      error: 'Failed to save execution history',
      message: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
});

// DELETE /api/execution-history - Clear all history
app.delete('/api/execution-history', async (req, res) => {
  try {
    await writeHistory([]);
    res.json({ success: true, message: 'Execution history cleared' });
  } catch (error) {
    console.error('Error clearing execution history:', error);
    res.status(500).json({ error: 'Failed to clear execution history' });
  }
});

// ============================================================================
// Infrastructure Monitor - Automated Cooldown After Scaling
// ============================================================================

let monitorState = {
  isMonitoring: false,
  baseline: null,
  scalingDetected: false,
  checkInterval: null,
  lastCheck: null,
  automationMode: 'manual'  // Default to manual mode
};

// Store mock Turbonomic-style alerts (created when infrastructure scaling detected)
let mockTurbonomicAlerts = [];

// Create mock alert when infrastructure scaling is detected
function createMockTurbonomicAlert(cpuIncrease, memIncrease, baseline, current) {
  // Handle manual creation (no baseline/current provided)
  const isManual = !baseline || !current;
  
  const alert = {
    id: `alert_${Date.now()}`,
    type: 'SCALE',
    target: 'coldchain-nodejs-cold-chain',
    actionType: 'Infrastructure Scaling Detected',
    description: `Infrastructure scaling detected - Emergency action required`,
    details: isManual ? {
      cpuChange: `+${cpuIncrease.toFixed(1)}%`,
      memoryChange: `+${memIncrease.toFixed(1)}%`
    } : {
      cpuChange: `+${(cpuIncrease * 100).toFixed(1)}%`,
      memoryChange: `+${(memIncrease * 100).toFixed(1)}%`,
      cpuBefore: `${baseline.cpuLimit.toFixed(2)} cores`,
      cpuAfter: `${current.cpuLimit.toFixed(2)} cores`,
      memBefore: `${(baseline.memLimit / 1024 / 1024).toFixed(0)} MB`,
      memAfter: `${(current.memLimit / 1024 / 1024).toFixed(0)} MB`
    },
    recommendation: 'Activate emergency cooling for critical trucks to prevent cargo loss',
    created: new Date().toISOString(),
    status: 'pending'
  };
  
  mockTurbonomicAlerts.push(alert);
  console.log('🎯 Mock Turbonomic alert created:', alert.id);
  return alert;
}

const MONITOR_INTERVAL = 10000; // Check every 10 seconds
const SCALING_THRESHOLD = 0.10;  // 10% increase (configurable)
// Note: Turbonomic typically scales by 20-50%, so 15% is a safe detection threshold
// Set to 0.01 for "any change" detection, but may cause false positives

// Helper function to extract metric value from Instana response
function getMetricValue(metrics, metricName) {
  if (!metrics || !metricName) return 0;
  
  // Try exact match first
  let metric = metrics[metricName];
  
  // If not found, try with .MEAN suffix (Instana returns metrics with aggregation suffix)
  if (!metric) {
    metric = metrics[`${metricName}.MEAN`];
  }
  
  // Handle array format [[timestamp, value], ...]
  if (Array.isArray(metric) && metric.length > 0) {
    // Get the first data point
    const dataPoint = metric[0];
    if (Array.isArray(dataPoint) && dataPoint.length > 1) {
      return dataPoint[1] || 0;
    }
  }
  
  // Handle direct number
  if (typeof metric === 'number') {
    return metric;
  }
  
  return 0;
}

// Capture baseline infrastructure metrics
async function captureBaseline() {
  try {
    console.log('📊 Capturing baseline infrastructure metrics...');
    
    // Use the SAME endpoint that works in Observe tab with 5-minute window
    const response = await axios.get(
      `http://localhost:${PORT}/api/instana/infra-metrics`,
      { params: { windowSize: 300000 } } // 5 minutes (same as Observe tab uses)
    );

    console.log('📊 Instana API response items:', response.data.items?.length || 0);

    if (response.data && response.data.items && response.data.items.length > 0) {
      const item = response.data.items[0];
      const metrics = item.metrics;
      
      console.log('📊 Available metrics:', Object.keys(metrics));

      const cpuLimit = getMetricValue(metrics, 'pods.limit_cpu');
      const cpuRequest = getMetricValue(metrics, 'pods.required_cpu');
      const memLimit = getMetricValue(metrics, 'pods.limit_mem');
      const memRequest = getMetricValue(metrics, 'pods.required_mem');

      console.log('📊 Extracted values:', { cpuLimit, cpuRequest, memLimit, memRequest });

      // Only set baseline if we have valid data
      if (cpuLimit > 0 || memLimit > 0) {
        monitorState.baseline = {
          cpuLimit,
          cpuRequest,
          memLimit,
          memRequest,
          timestamp: Date.now()
        };

        console.log('✅ Baseline captured:', {
          cpuLimit: monitorState.baseline.cpuLimit.toFixed(2) + ' cores',
          cpuRequest: monitorState.baseline.cpuRequest.toFixed(2) + ' cores',
          memLimit: (monitorState.baseline.memLimit / 1024 / 1024).toFixed(0) + ' MB',
          memRequest: (monitorState.baseline.memRequest / 1024 / 1024).toFixed(0) + ' MB'
        });
        
        return true;
      } else {
        console.warn('⚠️  Metrics returned zero values - no pods found or no data available');
        return false;
      }
    }
    
    console.warn('⚠️  No infrastructure data available for baseline (empty items array)');
    return false;
    
  } catch (error) {
    console.error('❌ Error capturing baseline:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data).substring(0, 200));
    }
    return false;
  }
}

// Check if infrastructure has scaled up
async function checkForScaling() {
  if (!monitorState.baseline || monitorState.scalingDetected) {
    return;
  }

  try {
    console.log('🔍 Checking for infrastructure scaling...');
    
    // If baseline is zero, try to capture it now
    if (monitorState.baseline.cpuLimit === 0 && monitorState.baseline.memLimit === 0) {
      console.log('   Attempting to capture baseline...');
      const captured = await captureBaseline();
      if (!captured) {
        console.warn('   ⚠️  Still unable to capture baseline, will retry next check');
        return;
      }
    }

    const response = await axios.get(
      `http://localhost:${PORT}/api/instana/infra-metrics`,
      { params: { windowSize: 300000 } } // 5 minutes - same as Observe tab
    );

    if (response.data && response.data.items && response.data.items.length > 0) {
      const item = response.data.items[0];
      const metrics = item.metrics;

      const current = {
        cpuLimit: getMetricValue(metrics, 'pods.limit_cpu'),
        cpuRequest: getMetricValue(metrics, 'pods.required_cpu'),
        memLimit: getMetricValue(metrics, 'pods.limit_mem'),
        memRequest: getMetricValue(metrics, 'pods.required_mem')
      };

      // Calculate percentage increase (avoid division by zero)
      const cpuLimitIncrease = monitorState.baseline.cpuLimit > 0
        ? (current.cpuLimit - monitorState.baseline.cpuLimit) / monitorState.baseline.cpuLimit
        : 0;
      const memLimitIncrease = monitorState.baseline.memLimit > 0
        ? (current.memLimit - monitorState.baseline.memLimit) / monitorState.baseline.memLimit
        : 0;

      monitorState.lastCheck = {
        timestamp: Date.now(),
        cpuIncrease: cpuLimitIncrease,
        memIncrease: memLimitIncrease
      };

      console.log(`   CPU: ${(cpuLimitIncrease * 100).toFixed(1)}% change (${current.cpuLimit.toFixed(2)} cores)`);
      console.log(`   Memory: ${(memLimitIncrease * 100).toFixed(1)}% change (${(current.memLimit / 1024 / 1024).toFixed(0)} MB)`);

      // Check if scaled up by at least 15%
      if (cpuLimitIncrease >= SCALING_THRESHOLD || memLimitIncrease >= SCALING_THRESHOLD) {
        console.log('🎯 SCALING DETECTED!');
        console.log(`   CPU Limit: ${monitorState.baseline.cpuLimit.toFixed(2)} → ${current.cpuLimit.toFixed(2)} (+${(cpuLimitIncrease * 100).toFixed(1)}%)`);
        console.log(`   Memory Limit: ${(monitorState.baseline.memLimit / 1024 / 1024).toFixed(0)}MB → ${(current.memLimit / 1024 / 1024).toFixed(0)}MB (+${(memLimitIncrease * 100).toFixed(1)}%)`);

        monitorState.scalingDetected = true;
        
        // Create mock Turbonomic alert
        const alert = createMockTurbonomicAlert(cpuLimitIncrease, memLimitIncrease, monitorState.baseline, current);
        console.log(`   📋 Mock alert created: ${alert.id}`);
        
        // Note: Do NOT trigger automation here - wait for user to click Execute button
        // This gives users control over when automation runs
        console.log('   ⏸️  Waiting for user action (Execute or Dismiss)');
      }
    }
  } catch (error) {
    console.error('❌ Error checking for scaling:', error.message);
  }
}

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// Find nearest emergency station for a truck
async function findNearestStation(truckId, currentLat, currentLon) {
  try {
    // Get stations along truck's route
    const routeResponse = await axios.get(`${COLDCHAIN_API_URL}/api/stations/route/${truckId}`);
    let stations = routeResponse.data.data || [];
    
    // If no route stations, get all emergency stations
    if (stations.length === 0) {
      const allStationsResponse = await axios.get(`${COLDCHAIN_API_URL}/api/stations?type=emergency`);
      stations = allStationsResponse.data.data || [];
    }
    
    // Calculate distance to each station
    const stationsWithDistance = stations.map(station => ({
      ...station,
      distance: calculateDistance(
        currentLat, currentLon,
        station.location.latitude,
        station.location.longitude
      )
    }));
    
    // Sort by distance and return nearest
    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    return stationsWithDistance[0] || null;
    
  } catch (error) {
    console.error(`❌ Error finding nearest station for ${truckId}:`, error.message);
    return null;
  }
}

// Full automation: Emergency cooling + Reroute + Resume
// Now mode-aware: checks automation mode before executing
async function sendCooldownCommands(automationMode = 'auto') {
  try {
    // Get all trucks
    const trucksResponse = await axios.get(`${COLDCHAIN_API_URL}/api/trucks`);
    const trucks = trucksResponse.data.data || [];

    // Filter critical trucks based on temperature (> -10°C is critical)
    const criticalTrucks = trucks.filter(t => {
      return t.lastTemperature !== null &&
             t.lastTemperature !== undefined &&
             t.lastTemperature > -10;
    });

    if (criticalTrucks.length === 0) {
      console.log('ℹ️  No critical trucks found (temperature > -10°C)');
      return {
        sent: 0,
        total: 0,
        mode: automationMode,
        message: 'No critical trucks requiring intervention'
      };
    }

    console.log(`🚨 Found ${criticalTrucks.length} critical trucks requiring intervention`);
    
    // ═══════════════════════════════════════════════════════════════
    // MODE CHECK: Manual vs Automated
    // ═══════════════════════════════════════════════════════════════
    if (automationMode === 'manual') {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  MANUAL MODE: Critical trucks detected - awaiting manual intervention');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   ${criticalTrucks.length} truck(s) require attention:`);
      criticalTrucks.forEach(truck => {
        console.log(`   - ${truck.id} (${truck.name}): $${truck.cargoValue.toLocaleString()} ${truck.cargoType}`);
      });
      console.log('   User must manually send commands via dashboard');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      return {
        sent: 0,
        total: criticalTrucks.length,
        mode: 'manual',
        message: 'Manual intervention required',
        criticalTrucks: criticalTrucks.map(t => ({ id: t.id, name: t.name, cargoValue: t.cargoValue }))
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTOMATED MODE: Execute full automation sequence
    // ═══════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 AUTOMATED MODE: Starting FULL AUTOMATION SEQUENCE...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    let successCount = 0;
    
    // Process each critical truck with full automation
    for (const truck of criticalTrucks) {
      try {
        console.log(`\n🚛 Processing ${truck.id} (${truck.name})`);
        console.log(`   Cargo: $${truck.cargoValue.toLocaleString()} ${truck.cargoType}`);
        console.log(`   Driver: ${truck.driver.name}`);
        
        // Get latest telemetry for GPS coordinates
        const telemetryResponse = await axios.get(
          `${COLDCHAIN_API_URL}/api/telemetry?truckId=${truck.id}&limit=1`
        );
        
        const latestTelemetry = telemetryResponse.data.data?.[0];
        const currentLat = latestTelemetry?.gps?.latitude || 42.3601;
        const currentLon = latestTelemetry?.gps?.longitude || -71.0589;
        
        console.log(`   Current Location: ${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}`);
        
        // ═══════════════════════════════════════════════════════════════
        // STEP 1: EMERGENCY COOLING ON
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n   ❄️  STEP 1: Activating Emergency Cooling...`);
        await axios.post(
          `${COLDCHAIN_API_URL}/api/trucks/${truck.id}/command`,
          {
            command: 'Emergency_Cooling_On',
            triggeredBy: 'auto_infra_monitor',
            reason: 'Infrastructure scaled up - temperature breach detected'
          }
        );
        console.log(`   ✅ Emergency cooling activated`);
        
        // ═══════════════════════════════════════════════════════════════
        // STEP 2: FIND NEAREST EMERGENCY STATION
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n   🔍 STEP 2: Finding nearest emergency station...`);
        const nearestStation = await findNearestStation(truck.id, currentLat, currentLon);
        
        if (!nearestStation) {
          console.log(`   ⚠️  No emergency station found, skipping reroute`);
          continue;
        }
        
        console.log(`   📍 Nearest Station: ${nearestStation.name}`);
        console.log(`      Location: ${nearestStation.location.city}`);
        console.log(`      Distance: ${nearestStation.distance.toFixed(1)} km`);
        console.log(`      Services: ${nearestStation.services.join(', ')}`);
        
        // ═══════════════════════════════════════════════════════════════
        // STEP 3: REROUTE TO EMERGENCY STATION
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n   🔀 STEP 3: Rerouting to emergency station...`);
        await axios.post(
          `${COLDCHAIN_API_URL}/api/trucks/${truck.id}/reroute`,
          {
            destination: {
              name: nearestStation.name,
              latitude: nearestStation.location.latitude,
              longitude: nearestStation.location.longitude
            },
            reason: 'Emergency cooling activated - proceeding to nearest station for inspection'
          }
        );
        console.log(`   ✅ Truck rerouted to ${nearestStation.name}`);
        
        // ═══════════════════════════════════════════════════════════════
        // STEP 4: SIMULATE ARRIVAL & INSPECTION (5 minutes)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n   ⏳ STEP 4: Simulating arrival and inspection (5 min)...`);
        console.log(`      Truck will arrive at station in ~${Math.round(nearestStation.distance / 80 * 60)} minutes`);
        console.log(`      Inspection and cooling system check: 5 minutes`);
        
        // Schedule resume after 5 minutes
        setTimeout(async () => {
          try {
            console.log(`\n   🔄 STEP 5: Resuming original route for ${truck.id}...`);
            
            // Resume original route
            await axios.post(
              `${COLDCHAIN_API_URL}/api/trucks/${truck.id}/resume-original-route`
            );
            
            console.log(`   ✅ ${truck.id} resumed original route to ${truck.route.destination}`);
            console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
          } catch (error) {
            console.error(`   ❌ Failed to resume route for ${truck.id}:`, error.message);
          }
        }, 5 * 60 * 1000); // 5 minutes
        
        console.log(`   ✅ Full automation sequence initiated for ${truck.id}`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Failed automation for ${truck.id}:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ AUTOMATION COMPLETE: ${successCount}/${criticalTrucks.length} trucks processed`);
    console.log(`   - Emergency cooling activated`);
    console.log(`   - Rerouted to nearest stations`);
    console.log(`   - Will resume original routes in 5 minutes`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return {
      sent: successCount,
      total: criticalTrucks.length,
      mode: 'auto',
      message: 'Full automation executed',
      actions: [
        `Emergency cooling activated for ${successCount} truck${successCount !== 1 ? 's' : ''}`,
        `Rerouted to nearest emergency stations`,
        `Will resume original routes in 5 minutes`
      ],
      trucks: criticalTrucks.slice(0, successCount).map(t => ({
        id: t.id,
        name: t.name,
        cargoValue: t.cargoValue
      }))
    };

  } catch (error) {
    console.error('❌ Error in full automation sequence:', error.message);
    return { sent: 0, total: 0, mode: automationMode, error: error.message };
  }
}

// POST /api/monitor/start - Start infrastructure monitoring
app.post('/api/monitor/start', async (req, res) => {
  try {
    if (monitorState.isMonitoring) {
      return res.status(200).json({
        success: true,
        message: 'Monitor already running',
        state: monitorState
      });
    }

    console.log('🔍 Starting infrastructure monitor...');
    
    // Try to capture baseline (but don't fail if it doesn't work immediately)
    const baselineCaptured = await captureBaseline();
    
    if (!baselineCaptured) {
      console.warn('⚠️  Baseline capture failed, but starting monitor anyway');
      console.warn('   Monitor will attempt to capture baseline on first check');
      
      // Set a placeholder baseline so monitor can start
      monitorState.baseline = {
        cpuLimit: 0,
        cpuRequest: 0,
        memLimit: 0,
        memRequest: 0,
        timestamp: Date.now()
      };
    }

    // Start periodic checks
    monitorState.isMonitoring = true;
    monitorState.scalingDetected = false;
    // Keep existing automation mode or default to manual
    if (!monitorState.automationMode) {
      monitorState.automationMode = 'manual';
    }
    
    monitorState.checkInterval = setInterval(() => {
      checkForScaling();
    }, MONITOR_INTERVAL);

    res.status(200).json({
      success: true,
      message: baselineCaptured ? 'Infrastructure monitoring started' : 'Monitor started (baseline will be captured on first check)',
      state: {
        isMonitoring: monitorState.isMonitoring,
        baseline: monitorState.baseline,
        scalingDetected: monitorState.scalingDetected,
        lastCheck: monitorState.lastCheck
      }
    });

  } catch (error) {
    console.error('Error starting monitor:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// POST /api/monitor/stop - Stop infrastructure monitoring
app.post('/api/monitor/stop', (req, res) => {
  try {
    if (monitorState.checkInterval) {
      clearInterval(monitorState.checkInterval);
      monitorState.checkInterval = null;
    }
    
    monitorState.isMonitoring = false;
    console.log('🛑 Infrastructure monitor stopped');

    res.status(200).json({
      success: true,
      message: 'Infrastructure monitoring stopped',
      state: {
        isMonitoring: monitorState.isMonitoring,
        baseline: monitorState.baseline,
        scalingDetected: monitorState.scalingDetected,
        lastCheck: monitorState.lastCheck
      }
    });

  } catch (error) {
    console.error('Error stopping monitor:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// GET /api/monitor/status - Get monitor status
app.get('/api/monitor/status', (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        isMonitoring: monitorState.isMonitoring,
        baseline: monitorState.baseline,
        scalingDetected: monitorState.scalingDetected,
        lastCheck: monitorState.lastCheck
      }
    });
  } catch (error) {
    console.error('Error getting monitor status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// POST /api/monitor/mode - Update automation mode
app.post('/api/monitor/mode', (req, res) => {
  try {
    const { mode } = req.body;
    
    if (!mode || !['manual', 'auto'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "manual" or "auto"'
      });
    }
    
    monitorState.automationMode = mode;
    console.log(`🔄 Automation mode changed to: ${mode.toUpperCase()}`);
    
    res.json({
      success: true,
      mode: mode,
      message: `Automation mode set to ${mode}`
    });
  } catch (error) {
    console.error('Error updating automation mode:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// Mock Turbonomic Alerts API
// ============================================================================

// GET /api/mock-alerts - Get all pending mock alerts
app.get('/api/mock-alerts', (req, res) => {
  try {
    // Return only pending alerts
    const pendingAlerts = mockTurbonomicAlerts.filter(a => a.status === 'pending');
    
    res.status(200).json({
      success: true,
      count: pendingAlerts.length,
      data: pendingAlerts
    });
  } catch (error) {
    console.error('Error fetching mock alerts:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// POST /api/mock-alerts/:id/execute - Execute mock alert (triggers automation)
app.post('/api/mock-alerts/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const alert = mockTurbonomicAlerts.find(a => a.id === id);
    
    if (!alert) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Alert ${id} not found`
      });
    }
    
    if (alert.status !== 'pending') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Alert has already been processed'
      });
    }
    
    console.log(`🚀 Executing mock alert: ${id}`);
    console.log(`   Alert: ${alert.type} - ${alert.target}`);
    console.log(`   Mode: ${monitorState.automationMode}`);
    
    // Mark alert as executed
    alert.status = 'executed';
    alert.executedAt = new Date().toISOString();
    
    // Remove from pending alerts array
    const alertIndex = mockTurbonomicAlerts.findIndex(a => a.id === id);
    if (alertIndex > -1) {
      mockTurbonomicAlerts.splice(alertIndex, 1);
    }
    
    // Trigger automation workflow (respects manual/auto mode)
    const result = await sendCooldownCommands(monitorState.automationMode || 'manual');
    
    // Create execution history entry (like Turbonomic actions)
    const executionRecord = {
      id: alert.id,
      type: alert.type,
      target: alert.target,
      description: alert.description,
      recommendation: alert.recommendation,
      executedAt: alert.executedAt,
      mode: result.mode,
      result: result.message,
      trucksProcessed: result.total,
      source: 'mock_alert'
    };
    
    console.log(`✅ Mock alert executed successfully`);
    console.log(`   Mode: ${result.mode}`);
    console.log(`   Result: ${result.message}`);
    console.log(`   Trucks: ${result.total}`);
    
    res.status(200).json({
      success: true,
      message: 'Mock alert executed successfully',
      alert: executionRecord,
      automationResult: result
    });
    
  } catch (error) {
    console.error('Error executing mock alert:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// POST /api/mock-alerts/:id/dismiss - Dismiss mock alert
app.post('/api/mock-alerts/:id/dismiss', (req, res) => {
  try {
    const { id } = req.params;
    const alert = mockTurbonomicAlerts.find(a => a.id === id);
    
    if (!alert) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Alert ${id} not found`
      });
    }
    
    if (alert.status !== 'pending') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Alert has already been processed'
      });
    }
    
    console.log(`❌ Dismissing mock alert: ${id}`);
    
    // Mark alert as dismissed
    alert.status = 'dismissed';
    alert.dismissedAt = new Date().toISOString();
    
    res.status(200).json({
      success: true,
      message: 'Mock alert dismissed',
      alert: alert
    });
    
  } catch (error) {
    console.error('Error dismissing mock alert:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// DELETE /api/mock-alerts - Clear all mock alerts
app.delete('/api/mock-alerts', (req, res) => {
  try {
    const count = mockTurbonomicAlerts.length;
    mockTurbonomicAlerts.length = 0; // Clear array
    
    console.log(`🗑️  Cleared ${count} mock alerts`);
    
    res.status(200).json({
      success: true,
      message: `Cleared ${count} mock alerts`,
      cleared: count
    });
    
  } catch (error) {
    console.error('Error clearing mock alerts:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// POST /api/mock-alerts/create - Manually create a mock alert for testing
app.post('/api/mock-alerts/create', (req, res) => {
  try {
    const { cpuChange, memoryChange } = req.body;
    
    // Use provided values or defaults
    const cpu = cpuChange || 15.5;
    const mem = memoryChange || 12.3;
    
    // Create the mock alert
    const alert = createMockTurbonomicAlert(cpu, mem);
    
    console.log(`🧪 Manually created mock alert: ${alert.id}`);
    console.log(`   CPU: +${cpu}%, Memory: +${mem}%`);
    
    res.status(201).json({
      success: true,
      message: 'Mock alert created successfully',
      alert: alert
    });
    
  } catch (error) {
    console.error('Error creating mock alert:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// GET /api/monitor/debug - Debug endpoint to test baseline capture
app.get('/api/monitor/debug', async (req, res) => {
  try {
    console.log('\n🔧 DEBUG: Testing baseline capture...');
    
    // Test the infra-metrics endpoint
    const response = await axios.get(
      `http://localhost:${PORT}/api/instana/infra-metrics`,
      { params: { windowSize: 300000 } }
    );
    
    const debugInfo = {
      hasData: !!response.data,
      itemsCount: response.data?.items?.length || 0,
      firstItem: response.data?.items?.[0] || null,
      metrics: response.data?.items?.[0]?.metrics || null,
      metricKeys: response.data?.items?.[0]?.metrics ? Object.keys(response.data.items[0].metrics) : []
    };
    
    if (debugInfo.metrics) {
      debugInfo.extractedValues = {
        cpuLimit: getMetricValue(debugInfo.metrics, 'pods.limit_cpu'),
        cpuRequest: getMetricValue(debugInfo.metrics, 'pods.required_cpu'),
        memLimit: getMetricValue(debugInfo.metrics, 'pods.limit_mem'),
        memRequest: getMetricValue(debugInfo.metrics, 'pods.required_mem')
      };
    }
    
    console.log('🔧 DEBUG Results:', JSON.stringify(debugInfo, null, 2));
    
    res.json({
      success: true,
      debug: debugInfo,
      currentBaseline: monitorState.baseline
    });
    
  } catch (error) {
    console.error('🔧 DEBUG Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// POST /api/monitor/reset - Reset monitor state
app.post('/api/monitor/reset', (req, res) => {
  try {
    // Stop monitoring if running
    if (monitorState.checkInterval) {
      clearInterval(monitorState.checkInterval);
    }
    
    // Reset state
    monitorState = {
      isMonitoring: false,
      baseline: null,
      scalingDetected: false,
      checkInterval: null,
      lastCheck: null
    };
    
    console.log('🔄 Monitor reset successfully');

    res.status(200).json({
      success: true,
      message: 'Monitor reset successfully'
    });

  } catch (error) {
    console.error('Error resetting monitor:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Root route - serve Carbon UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// DEMO HELPER ENDPOINTS
// ============================================================================

/**
 * Force a truck into critical state for demo purposes
 * POST /api/demo/force-critical/:truckId
 */
app.post('/api/demo/force-critical/:truckId', async (req, res) => {
  try {
    const { truckId } = req.params;
    
    console.log(`🎬 DEMO: Forcing ${truckId} to critical state`);
    
    // Inject critical telemetry data to the cold-chain API
    const criticalTelemetry = {
      truckId: truckId,
      temperature: -5.0, // Critical temperature (above -10°C threshold)
      gps: {
        latitude: 42.3601,
        longitude: -71.0589
      },
      coolantStatus: 'failure',
      timestamp: new Date().toISOString()
    };
    
    // Send to cold-chain API
    const response = await axios.post(
      `${COLDCHAIN_API_URL}/api/telemetry`,
      criticalTelemetry
    );
    
    console.log(`✅ DEMO: ${truckId} is now critical`);
    
    res.json({
      success: true,
      message: `${truckId} forced to critical state`,
      telemetry: criticalTelemetry,
      apiResponse: response.data
    });
    
  } catch (error) {
    console.error('Demo force-critical error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to force critical state',
      message: error.message
    });
  }
});

/**
 * Reset a truck to normal state
 * POST /api/demo/reset-truck/:truckId
 */
app.post('/api/demo/reset-truck/:truckId', async (req, res) => {
  try {
    const { truckId } = req.params;
    
    console.log(`🔄 DEMO: Resetting ${truckId} to normal state`);
    
    // Get current truck data to preserve GPS location
    let currentGPS = { latitude: 42.3601, longitude: -71.0589 }; // Default fallback
    
    try {
      const truckResponse = await axios.get(`${COLDCHAIN_API_URL}/api/trucks/${truckId}`);
      if (truckResponse.data && truckResponse.data.data && truckResponse.data.data.lastTelemetry) {
        currentGPS = truckResponse.data.data.lastTelemetry.gps;
        console.log(`  📍 Preserving GPS: ${currentGPS.latitude}, ${currentGPS.longitude}`);
      }
    } catch (err) {
      console.log(`  ⚠️  Could not get current GPS, using default`);
    }
    
    // Inject normal telemetry data with preserved GPS
    const normalTelemetry = {
      truckId: truckId,
      temperature: -16.0, // Normal temperature
      gps: currentGPS, // Preserve current location
      coolantStatus: 'normal',
      timestamp: new Date().toISOString()
    };
    
    // Send to cold-chain API
    const response = await axios.post(
      `${COLDCHAIN_API_URL}/api/telemetry`,
      normalTelemetry
    );
    
    console.log(`✅ DEMO: ${truckId} reset to normal at GPS ${currentGPS.latitude}, ${currentGPS.longitude}`);
    
    res.json({
      success: true,
      message: `${truckId} reset to normal state`,
      telemetry: normalTelemetry,
      apiResponse: response.data
    });
    
  } catch (error) {
    console.error('Demo reset-truck error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to reset truck',
      message: error.message
    });
  }
});

/**
 * Get demo helper info
 * GET /api/demo/info
 */
app.get('/api/demo/info', (req, res) => {
  res.json({
    message: 'Demo Helper Endpoints',
    endpoints: {
      forceCritical: {
        method: 'POST',
        path: '/api/demo/force-critical/:truckId',
        description: 'Force a truck into critical state (-5°C)',
        example: `curl -X POST http://localhost:${PORT}/api/demo/force-critical/TRUCK-003`
      },
      resetTruck: {
        method: 'POST',
        path: '/api/demo/reset-truck/:truckId',
        description: 'Reset a truck to normal state (-16°C)',
        example: `curl -X POST http://localhost:${PORT}/api/demo/reset-truck/TRUCK-003`
      }
    },
    recommendedTrucks: ['TRUCK-003', 'TRUCK-004'],
    note: 'These trucks have stations along their routes for rerouting demos'
  });
});

// ============================================================================
// START SERVER
// ============================================================================

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FleetOps Carbon App running on port ${PORT}`);
  console.log(`Proxying to Cold-Chain API: ${COLDCHAIN_API_URL}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Carbon UI: http://localhost:${PORT}`);
  console.log(`Demo helpers: http://localhost:${PORT}/api/demo/info`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;

// Made with Bob