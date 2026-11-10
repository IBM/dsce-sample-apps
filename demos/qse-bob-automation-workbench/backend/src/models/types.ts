export type Role = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
}

export type BobAdapterKind = 'rest-threads' | 'acp';
export type BobAuthMode = 'bearer' | 'header' | 'none';
export type BobConnectionState = 'not_configured' | 'connecting' | 'connected' | 'auth_failed' | 'connection_failed';

/** Public (browser-safe) view of the Bob connection. The API key is never included. */
export interface BobConnectionView {
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

export interface BobCapabilities {
  adapter: BobAdapterKind;
  runtimeReady: boolean;
  runtimeReason?: string;
  features: {
    streaming: boolean;
    cancellation: boolean;
    fileDownloads: boolean;
    threads: boolean;
    continuation: boolean;
  };
  limits: {
    timeoutMs: number | null;
    maxMessageCharacters: number | null;
    maxConcurrentRuns: number | null;
    maxDownloadBytes: number | null;
  };
  raw?: unknown;
}

export type RepoStatus = 'pending' | 'validating' | 'validated' | 'cloning' | 'cloned' | 'failed';

export interface RepositoryView {
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

export type QseMode = 'auto' | 'manual';
export type QseStatus = 'not_configured' | 'discovered' | 'valid' | 'invalid';

export interface QseConfigView {
  status: QseStatus;
  mode: QseMode | null;
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
  source: 'QSE_CLI_PATH' | 'PATH' | 'search-dir';
  executable: boolean;
  allowed: boolean;
}

export type ExecutionStatus = 'queued' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
export type StepSource = 'backend' | 'headless-bob';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface ExecutionStep {
  key: string;
  label: string;
  source: StepSource;
  status: StepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
}

export interface ExecutionView {
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

export type LogSource = 'backend' | 'headless-bob' | 'system';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ExecutionLog {
  id: number;
  executionId: string;
  ts: string;
  source: LogSource;
  level: LogLevel;
  step: string | null;
  message: string;
}

export interface ArtifactView {
  id: string;
  executionId: string;
  path: string;
  size: number;
  retrieved: boolean;
  contentType: string;
  note: string | null;
}

export type ReportSource = 'headless-bob-file' | 'headless-bob-output' | 'unavailable';
export type SectionKey = 'summary' | 'findings' | 'recommendations' | 'conclusion' | 'other';

export interface ReportSection {
  key: SectionKey;
  title: string;
  markdown: string;
}

export interface ReportView {
  id: string;
  executionId: string;
  source: ReportSource;
  sourceDetail: string;
  mock: boolean;
  generatedAt: string;
  sections: ReportSection[];
  bobMarkdown: string | null;
  markdown: string;
  execution: ExecutionView;
  artifacts: ArtifactView[];
}
