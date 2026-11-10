import path from 'node:path';
import type { AppConfig } from './config/env.js';
import { Db } from './db/database.js';
import { ExecutionOrchestrator } from './orchestrators/execution.orchestrator.js';
import { BobConnectionRepository } from './repositories/bob-connection.repository.js';
import { ExecutionRepository } from './repositories/execution.repository.js';
import { GitRepositoryRepository } from './repositories/git-repository.repository.js';
import { QseConfigRepository } from './repositories/qse-config.repository.js';
import { SessionRepository, UserRepository } from './repositories/auth.repository.js';
import { BobService } from './services/bob.service.js';
import { ExecutionLogService } from './services/execution-log.service.js';
import { QseService } from './services/qse.service.js';
import { ReportService } from './services/report.service.js';
import { RepositoryService } from './services/repository.service.js';
import { DemoService } from './services/demo.service.js';
import type { AdapterFactoryOptions } from './integrations/headless-bob/factory.js';
import { hashPassword } from './utils/passwords.js';
import { PathMapper } from './utils/paths.js';
import { redactor } from './utils/redact.js';
import { SecretBox } from './utils/secret-box.js';
import type { Logger } from './utils/logger.js';

export interface AppContext {
  config: AppConfig;
  log: Logger;
  db: Db;
  box: SecretBox;
  users: UserRepository;
  sessions: SessionRepository;
  bob: BobService;
  repos: RepositoryService;
  qse: QseService;
  logs: ExecutionLogService;
  reports: ReportService;
  executions: ExecutionRepository;
  orchestrator: ExecutionOrchestrator;
  mapper: PathMapper;
  close(): Promise<void>;
}

export function buildPathMapper(config: AppConfig): PathMapper {
  if (config.execution.strategy === 'colocated') {
    // Headless Bob runs where the backend runs (same filesystem view): identity mapping.
    return new PathMapper([
      { label: 'workspaces', backend: config.workspaceRoot, bob: config.workspaceRoot },
      ...config.qse.allowedDirs.map((d) => ({ label: 'qse-cli', backend: d, bob: d }))
    ]);
  }
  // shared-volume: only explicitly mounted directories are reachable from the Bob container.
  return new PathMapper([
    { label: 'workspaces', backend: config.workspaceRoot, bob: config.execution.bobWorkspaceMountDir },
    { label: 'qse-cli', backend: path.resolve(config.execution.qseMountDir), bob: config.execution.bobQseMountDir }
  ]);
}

export async function createContext(config: AppConfig, log: Logger, options: { adapter?: AdapterFactoryOptions } = {}): Promise<AppContext> {
  const box = new SecretBox(config.secretsKeys);
  redactor.register(config.adminPassword);
  const db = new Db(config.databasePath);
  const users = new UserRepository(db);
  const sessions = new SessionRepository(db);
  if (!users.findByUsername(config.adminUsername)) {
    users.create(config.adminUsername, await hashPassword(config.adminPassword), 'admin');
    log.info({ username: config.adminUsername }, 'bootstrap admin user created');
  }
  const mapper = buildPathMapper(config);
  const executions = new ExecutionRepository(db);
  const logs = new ExecutionLogService(executions);
  // The demo recording is loaded only in STREAM_MODE=mock; in realtime no demo code path has an instance to run.
  const demo = config.streamMode === 'mock' ? new DemoService(config.demo.dataDir) : null;
  const bob = new BobService(new BobConnectionRepository(db), box, config, options.adapter, demo);
  const repos = new RepositoryService(new GitRepositoryRepository(db), executions, box, config, log, demo);
  const qse = new QseService(new QseConfigRepository(db), config, mapper, demo);
  const reports = new ReportService(executions);
  const orchestrator = new ExecutionOrchestrator(executions, logs, bob, repos, qse, reports, mapper, config, log, demo);
  return {
    config,
    log,
    db,
    box,
    users,
    sessions,
    bob,
    repos,
    qse,
    logs,
    reports,
    executions,
    orchestrator,
    mapper,
    async close() {
      await orchestrator.shutdown();
      await repos.shutdown();
      db.close();
    }
  };
}
