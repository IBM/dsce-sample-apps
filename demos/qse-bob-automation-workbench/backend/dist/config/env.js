import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
const bool = (fallback) => z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true'));
const list = (fallback) => z
    .string()
    .optional()
    .transform((v) => v === undefined || v.trim() === ''
    ? fallback
    : v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean));
const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(0).max(65535).default(8080),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATA_DIR: z.string().default('./data'),
    WORKSPACE_ROOT: z.string().optional(),
    DATABASE_PATH: z.string().optional(),
    // mock (default): replay a recorded real execution; no Headless Bob, git or QSE CLI is used.
    // realtime: real Headless Bob / git / QSE CLI only; no mock or recorded data is ever served.
    STREAM_MODE: z.enum(['mock', 'realtime']).default('mock'),
    DEMO_DATA_DIR: z.string().optional(),
    DEMO_STEP_DELAY_MS: z.coerce.number().int().min(0).max(30000).default(700),
    DEMO_BOB_WAIT_MS: z.coerce.number().int().min(0).max(120000).default(6000),
    DEMO_REPLAY_SPEED: z.coerce.number().min(0.1).max(1000).default(4),
    SECRETS_KEYS: z.string().min(1, 'SECRETS_KEYS is required (format: kid:base64-32-byte-key[,kid2:...])'),
    ADMIN_USERNAME: z.string().min(3).max(64).default('admin'),
    ADMIN_PASSWORD: z.string().min(12, 'ADMIN_PASSWORD must be at least 12 characters'),
    SESSION_TTL_MINUTES: z.coerce.number().int().min(5).default(480),
    SESSION_IDLE_MINUTES: z.coerce.number().int().min(1).default(60),
    COOKIE_SECURE: bool(false),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    CORS_ALLOWED_ORIGINS: list([]),
    TLS_KEY_FILE: z.string().optional(),
    TLS_CERT_FILE: z.string().optional(),
    BOB_ALLOWED_HOSTS: list([]),
    BOB_ALLOW_PRIVATE_NETWORK: bool(false),
    BOB_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15000),
    GITHUB_ALLOWED_HOSTS: list(['github.com']),
    GIT_BIN: z.string().default('git'),
    CLONE_TIMEOUT_MS: z.coerce.number().int().min(10000).default(600000),
    QSE_CLI_PATH: z.string().optional(),
    QSE_CLI_SEARCH_DIRS: list(['/opt/qse-cli', '/usr/local/bin/qse-cli-artifacts']),
    QSE_CLI_ALLOWED_DIRS: list(['/opt', '/usr/local/bin', '/usr/bin']),
    QSE_CLI_EXECUTABLE_NAMES: list(['qse-cli', 'cli.sh']),
    QSE_CLI_VERSION_ARGS: list(['-v']),
    QSE_VALIDATION_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
    QSE_USAGE_HINT: z
        .string()
        .default('Run the CLI from its own directory using absolute paths, for example: cd <qse-dir> && ./cli.sh -i <repository-dir> -l <.ext> [-cf <class-files-dir>] [-da]. Run it with --help first if you are unsure of the flags.'),
    EXECUTION_STRATEGY: z.enum(['shared-volume', 'colocated']).default('shared-volume'),
    QSE_MOUNT_DIR: z.string().default('/opt/qse-cli'),
    BOB_QSE_MOUNT_DIR: z.string().default('/opt/qse-cli'),
    BOB_WORKSPACE_MOUNT_DIR: z.string().default('/shared/workspaces'),
    EXECUTION_TIMEOUT_MS: z.coerce.number().int().min(10000).default(1800000),
    MAX_CONCURRENT_EXECUTIONS: z.coerce.number().int().min(1).max(16).default(1),
    MAX_PROMPT_CHARS: z.coerce.number().int().min(100).max(15000).default(8000),
    MAX_ARTIFACT_BYTES: z.coerce.number().int().min(1024).default(25 * 1024 * 1024),
    MAX_ARTIFACTS: z.coerce.number().int().min(1).default(200),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10)
});
export function loadConfig(env = process.env) {
    const parsed = schema.safeParse(env);
    if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`).join('\n  ');
        throw new Error(`Invalid configuration:\n  ${issues}`);
    }
    const e = parsed.data;
    const dataDir = path.resolve(e.DATA_DIR);
    const cfg = {
        env: e.NODE_ENV,
        host: e.HOST,
        port: e.PORT,
        logLevel: e.LOG_LEVEL,
        dataDir,
        workspaceRoot: path.resolve(e.WORKSPACE_ROOT ?? path.join(dataDir, 'workspaces')),
        // Demo and real data never share a database unless DATABASE_PATH is set explicitly.
        databasePath: path.resolve(e.DATABASE_PATH ?? path.join(dataDir, 'db', e.STREAM_MODE === 'mock' ? 'workbench-demo.sqlite' : 'workbench.sqlite')),
        streamMode: e.STREAM_MODE,
        demo: {
            dataDir: path.resolve(e.DEMO_DATA_DIR ?? fileURLToPath(new URL('../../demo-data', import.meta.url))),
            stepDelayMs: e.DEMO_STEP_DELAY_MS,
            bobWaitMs: e.DEMO_BOB_WAIT_MS,
            replaySpeed: e.DEMO_REPLAY_SPEED
        },
        secretsKeys: e.SECRETS_KEYS,
        adminUsername: e.ADMIN_USERNAME,
        adminPassword: e.ADMIN_PASSWORD,
        sessionTtlMinutes: e.SESSION_TTL_MINUTES,
        sessionIdleMinutes: e.SESSION_IDLE_MINUTES,
        cookieSecure: e.NODE_ENV === 'production' ? true : e.COOKIE_SECURE,
        trustProxy: e.TRUST_PROXY,
        corsAllowedOrigins: e.CORS_ALLOWED_ORIGINS,
        tls: e.TLS_KEY_FILE && e.TLS_CERT_FILE ? { keyFile: e.TLS_KEY_FILE, certFile: e.TLS_CERT_FILE } : undefined,
        bob: {
            allowedHosts: e.BOB_ALLOWED_HOSTS.map((h) => h.toLowerCase()),
            allowPrivateNetwork: e.BOB_ALLOW_PRIVATE_NETWORK,
            requestTimeoutMs: e.BOB_REQUEST_TIMEOUT_MS
        },
        github: {
            allowedHosts: e.GITHUB_ALLOWED_HOSTS.map((h) => h.toLowerCase()),
            gitBin: e.GIT_BIN,
            cloneTimeoutMs: e.CLONE_TIMEOUT_MS
        },
        qse: {
            envPath: e.QSE_CLI_PATH,
            searchDirs: e.QSE_CLI_SEARCH_DIRS,
            allowedDirs: e.QSE_CLI_ALLOWED_DIRS,
            executableNames: e.QSE_CLI_EXECUTABLE_NAMES,
            versionArgs: e.QSE_CLI_VERSION_ARGS,
            validationTimeoutMs: e.QSE_VALIDATION_TIMEOUT_MS,
            usageHint: e.QSE_USAGE_HINT
        },
        execution: {
            strategy: e.EXECUTION_STRATEGY,
            qseMountDir: e.QSE_MOUNT_DIR,
            bobQseMountDir: e.BOB_QSE_MOUNT_DIR,
            bobWorkspaceMountDir: e.BOB_WORKSPACE_MOUNT_DIR,
            timeoutMs: e.EXECUTION_TIMEOUT_MS,
            maxConcurrent: e.MAX_CONCURRENT_EXECUTIONS,
            maxPromptChars: e.MAX_PROMPT_CHARS,
            maxArtifactBytes: e.MAX_ARTIFACT_BYTES,
            maxArtifacts: e.MAX_ARTIFACTS
        },
        rateLimit: { windowMs: e.RATE_LIMIT_WINDOW_MS, max: e.RATE_LIMIT_MAX, loginMax: e.LOGIN_RATE_LIMIT_MAX }
    };
    return cfg;
}
//# sourceMappingURL=env.js.map