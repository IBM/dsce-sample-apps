export type Role = 'admin' | 'operator' | 'viewer';
export interface User {
  id: string;
  username: string;
  role: Role;
}

export type BobAdapterKind = 'rest-threads' | 'acp';
export type BobAuthMode = 'bearer' | 'header' | 'none';
export type BobConnectionState = 'not_configured' | 'connecting' | 'connected' | 'auth_failed' | 'connection_failed';

export interface BobCapabilities {
  adapter: BobAdapterKind;
  runtimeReady: boolean;
  runtimeReason?: string;
  features: { streaming: boolean; cancellation: boolean; fileDownloads: boolean; threads: boolean; continuation: boolean };
  limits: { timeoutMs: number | null; maxMessageCharacters: number | null; maxConcurrentRuns: number | null; maxDownloadBytes: number | null };
}

export interface BobConnection {
  state: BobConnectionState;
  configured: boolean;
  endpoint: string | null;
  adapter: BobAdapterKind;
  apiBasePath: string;
  authMode: BobAuthMode;
  authHeaderName: string;
  apiKeyHint: string | null;
  message: string | null;
  lastTestedAt: string | null;
  capabilities: BobCapabilities | null;
  mock: boolean;
}

export interface BobConnectInput {
  endpoint: string;
  adapter: BobAdapterKind;
  apiBasePath: string;
  authMode: BobAuthMode;
  authHeaderName: string;
  apiKey?: string;
}

export type RepoStatus = 'pending' | 'validating' | 'validated' | 'cloning' | 'cloned' | 'failed';
export interface Repository {
  id: string;
  url: string;
  name: string;
  owner: string;
  branch: string;
  status: RepoStatus;
  error: string | null;
  hasToken: boolean;
  commit: string | null;
  fileCount: number | null;
  lastClonedAt: string | null;
  createdAt: string;
  workspaceLabel: string | null;
  progress: string[];
}
export interface RepoValidation {
  valid: true;
  url: string;
  owner: string;
  name: string;
  branch: string;
  commit: string;
}

export type QseStatus = 'not_configured' | 'discovered' | 'valid' | 'invalid';
export interface QseConfig {
  status: QseStatus;
  mode: 'auto' | 'manual' | null;
  executablePath: string | null;
  bobVisiblePath: string | null;
  reachableFromBob: boolean;
  version: string | null;
  validatedAt: string | null;
  message: string | null;
  versionArgs: string[];
  strategy: string;
}
export interface QseCandidate {
  path: string;
  source: string;
  executable: boolean;
  allowed: boolean;
}

export type ExecutionStatus = 'queued' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
export interface ExecutionStep {
  key: string;
  label: string;
  source: 'backend' | 'headless-bob';
  status: StepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
}
export interface Execution {
  id: string;
  status: ExecutionStatus;
  currentActivity: string | null;
  prompt: string;
  promptSummary: string;
  repositoryId: string;
  repositoryUrl: string;
  repositoryName: string;
  branch: string;
  commit: string | null;
  qseVersion: string | null;
  adapter: BobAdapterKind;
  mock: boolean;
  bobRunId: string | null;
  bobThreadId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
  warnings: string[];
  steps: ExecutionStep[];
  reportId: string | null;
  usage: Record<string, unknown> | null;
  bobStreamedChars: number;
}
export interface ExecutionLog {
  id: number;
  executionId: string;
  ts: string;
  source: 'backend' | 'headless-bob' | 'system';
  level: 'debug' | 'info' | 'warn' | 'error';
  step: string | null;
  message: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Artifact {
  id: string;
  executionId: string;
  path: string;
  size: number;
  retrieved: boolean;
  contentType: string;
  note: string | null;
}
export interface ReportSection {
  key: 'summary' | 'findings' | 'recommendations' | 'conclusion' | 'other';
  title: string;
  markdown: string;
}
export interface Report {
  id: string;
  executionId: string;
  source: 'headless-bob-file' | 'headless-bob-output' | 'unavailable';
  sourceDetail: string;
  mock: boolean;
  generatedAt: string;
  sections: ReportSection[];
  bobMarkdown: string | null;
  markdown: string;
  execution: Execution;
  artifacts: Artifact[];
}
export interface Settings {
  version: string;
  streamMode: 'mock' | 'realtime';
  executionStrategy: string;
  githubAllowedHosts: string[];
  limits: { maxPromptChars: number; executionTimeoutMs: number; maxConcurrentExecutions: number };
  sharedMounts: Array<{ label: string; bobPath: string }>;
  encryptionKeyId: string;
  session: { ttlMinutes: number; idleMinutes: number };
}
export interface PromptHistoryItem {
  id: number;
  prompt: string;
  createdAt: string;
}
