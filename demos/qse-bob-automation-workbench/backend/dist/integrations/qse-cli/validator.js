import fs from 'node:fs';
import path from 'node:path';
import { AppError } from '../../utils/errors.js';
import { redact } from '../../utils/redact.js';
import { minimalEnv, runFile } from '../../utils/safe-exec.js';
import { isAllowedLocation, isAllowedName, isExecutableFile } from './discovery.js';
const LICENSE_NOT_ACCEPTED = /license agreement (has|have) not been accepted/i;
// A real version has a number after the label; this skips usage lines such as "-app_ver <app_ver> app_version : Version of ...".
const VERSION_LINE = /\bversion\s*[:=]\s*v?\d/i;
/** Prefers a line that looks like a version ("App Version : 2.3.1.0"); otherwise falls back to the first non-empty line. */
export function extractVersion(text) {
    const lines = text.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean);
    return lines.find((l) => VERSION_LINE.test(l)) ?? lines[0] ?? '';
}
const ARG = /^[A-Za-z0-9._=-]{1,40}$/;
export function validateVersionArgs(args) {
    if (args.length > 4 || args.some((a) => !ARG.test(a))) {
        throw new AppError(400, 'invalid_version_args', 'Version arguments must be at most 4 simple flags such as -v');
    }
    return args;
}
export function normalizeQsePath(input) {
    const value = input.trim();
    if (!value || value.length > 1024 || value.includes('\0'))
        throw new AppError(400, 'invalid_qse_path', 'Provide the absolute path to the QSE CLI executable');
    if (!path.isAbsolute(value))
        throw new AppError(400, 'invalid_qse_path', 'The QSE CLI path must be absolute');
    return path.normalize(value);
}
/** Runs the version command using a safe, shell-free invocation with an argument array. */
export async function validateQseCli(cfg, executable, versionArgs, strategyOk) {
    let real;
    try {
        real = fs.realpathSync(executable);
    }
    catch {
        return { valid: false, version: null, message: 'File does not exist.', realPath: null };
    }
    if (!isAllowedName(real, cfg.executableNames)) {
        return { valid: false, version: null, message: `Executable name must be one of: ${cfg.executableNames.join(', ')}.`, realPath: real };
    }
    if (!isAllowedLocation(real, cfg.allowedDirs)) {
        return { valid: false, version: null, message: `Executable must be inside one of: ${cfg.allowedDirs.join(', ')} (QSE_CLI_ALLOWED_DIRS).`, realPath: real };
    }
    if (!isExecutableFile(real)) {
        return { valid: false, version: null, message: 'File exists but is not executable by the backend user.', realPath: real };
    }
    const result = await runFile(real, versionArgs, {
        cwd: path.dirname(real),
        // The CLI keeps its licence-acceptance state under $HOME/qs-explorer, so it must run with the service user's real HOME.
        env: minimalEnv(),
        timeoutMs: cfg.validationTimeoutMs,
        maxBytes: 64 * 1024
    });
    if (result.spawnError)
        return { valid: false, version: null, message: `Could not start the executable: ${redact(result.spawnError)}`, realPath: real };
    if (result.timedOut)
        return { valid: false, version: null, message: `Version command timed out after ${cfg.validationTimeoutMs} ms.`, realPath: real };
    const text = redact(`${result.stdout}\n${result.stderr}`).trim();
    if (result.code !== 0) {
        return {
            valid: false,
            version: null,
            message: `Version command "${versionArgs.join(' ')}" exited with code ${result.code}. Output: ${text.slice(0, 300) || '(none)'}. Adjust the version arguments if this CLI uses a different flag.`,
            realPath: real
        };
    }
    if (LICENSE_NOT_ACCEPTED.test(text)) {
        return {
            valid: false,
            version: null,
            message: 'The QSE CLI reports that its licence agreement has not been accepted for the user running the backend. Accept it yourself by running the CLI interactively as that user (the state is stored in $HOME/qs-explorer/license). The Workbench never accepts the licence for you.',
            realPath: real
        };
    }
    const version = extractVersion(text);
    if (!version) {
        return { valid: false, version: null, message: 'Version command produced no output.', realPath: real };
    }
    const reach = strategyOk.reachableFromBob
        ? ''
        : ` Warning: this path is not under a directory shared with Headless Bob (strategy: ${strategyOk.strategy}); executions will be refused.`;
    return { valid: true, version: version.slice(0, 200), message: `QSE CLI is usable.${reach}`, realPath: real };
}
//# sourceMappingURL=validator.js.map