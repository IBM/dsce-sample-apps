declare global {
  interface Window {
    wxOConfiguration: {
      orchestrationID: string;
      hostURL: string;
      rootElementID: string;
      deploymentPlatform?: string;
      crn?: string;
      token?: string;
      chatOptions: {
        agentId: string;
        agentEnvironmentId?: string;
      };
    };
    wxoLoader: {
      init: (options?: Record<string, any>) => {
        on: (event: string, handler: (...args: any[]) => any) => void;
        [key: string]: any;
      };
    };
  }
}

export interface StageConfig {
  key: string;
  label: string;
  agentName?: string;
  agentId: string;
  instruction: string;
  tools?: string[];
  stepLabel?: string;
  color?: 'blue' | 'violet' | 'teal' | 'amber' | 'rose' | 'indigo';
}

export interface TraceItem {
  type?: string;
  event_type?: string;
  name?: string;
  content?: any;
  timestamp?: string;
  [key: string]: any;
}

export interface AnalyticsData {
  status: 'completed' | 'failed' | 'cancelled' | 'running' | 'idle' | string;
  durationMs: number | null;
  toolCalls: number;
  traceCount: number;
  startedAt: string;
  updatedAt?: string | null;
}

export interface RunDetails {
  threadId: string | null;
  runId: string;
  taskId?: string | null;
  messageId?: string | null;
  status: string;
  outputText: string;
  analytics: AnalyticsData;
  traces: TraceItem[];
  raw?: any;
}

export interface StageState {
  prompt?: string;
  loading?: boolean;
  run?: RunDetails;
  error?: string;
}

export interface ConfigResponse {
  success: boolean;
  serviceConfigured: boolean;
  stages: StageConfig[];
  error?: string;
}

export interface SampleOffense {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  sourceIp: string;
  destinationIp: string;
  category: string;
  eventCount: number;
  prompt: string;
}


export interface PocOffense {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  module: string;
  sourceIp: string;
  destinationIp: string;
  category: string;
  eventCount: number;
  expectedOutcome: 'True Positive' | 'Non-Issue';
  closeNote: string;
  prompt: string;
}

export interface PocConfigResponse {
  success: boolean;
  serviceConfigured: boolean;
  stages: StageConfig[];
  error?: string;
}
