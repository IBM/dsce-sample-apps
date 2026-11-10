import { discoverCandidates } from '../integrations/qse-cli/discovery.js';
import { normalizeQsePath, validateQseCli, validateVersionArgs } from '../integrations/qse-cli/validator.js';
import { AppError } from '../utils/errors.js';
import { DEMO_BANNER } from './demo.service.js';
export class QseService {
    repo;
    config;
    mapper;
    demo;
    constructor(repo, config, mapper, demo = null) {
        this.repo = repo;
        this.config = config;
        this.mapper = mapper;
        this.demo = demo;
    }
    /** STREAM_MODE=mock: reports the recorded CLI; nothing on this machine is searched or executed. */
    demoView(rec) {
        const q = this.demo.recording.qse;
        const configured = Boolean(rec?.executablePath);
        return {
            status: configured ? 'valid' : 'not_configured',
            mode: rec?.mode ?? null,
            executablePath: configured ? q.executablePath : null,
            bobVisiblePath: configured ? q.executablePath : null,
            reachableFromBob: configured,
            version: configured ? q.version : null,
            validatedAt: rec?.validatedAt ?? null,
            message: configured ? `${DEMO_BANNER} The QSE CLI was not executed; the version was recorded from a real run.` : 'QSE CLI is not configured. Run discovery or enter the executable path.',
            versionArgs: q.versionArgs,
            strategy: this.config.execution.strategy
        };
    }
    discover() {
        if (this.demo)
            return [{ path: this.demo.recording.qse.executablePath, source: 'search-dir', executable: true, allowed: true }];
        return discoverCandidates(this.config.qse);
    }
    bobPath(p) {
        return p ? this.mapper.toBob(p) : null;
    }
    view() {
        const rec = this.repo.get();
        if (this.demo)
            return this.demoView(rec);
        const base = {
            versionArgs: rec?.versionArgs ?? this.config.qse.versionArgs,
            strategy: this.config.execution.strategy
        };
        if (!rec || !rec.executablePath) {
            return {
                status: 'not_configured',
                mode: null,
                executablePath: null,
                bobVisiblePath: null,
                reachableFromBob: false,
                version: null,
                validatedAt: null,
                message: 'QSE CLI is not configured. Run discovery or enter the executable path.',
                ...base
            };
        }
        const bob = this.bobPath(rec.executablePath);
        return {
            status: rec.status,
            mode: rec.mode,
            executablePath: rec.executablePath,
            bobVisiblePath: bob,
            reachableFromBob: bob !== null,
            version: rec.version,
            validatedAt: rec.validatedAt,
            message: rec.message,
            ...base
        };
    }
    /** Returns the saved record (internal use by the orchestrator). */
    record() {
        return this.repo.get();
    }
    async configure(input) {
        if (this.demo) {
            const q = this.demo.recording.qse;
            this.repo.save({ mode: input.mode, executablePath: q.executablePath, versionArgs: q.versionArgs, status: 'valid', version: q.version, message: 'demo', validatedAt: new Date().toISOString() });
            return this.view();
        }
        const versionArgs = validateVersionArgs(input.versionArgs ?? this.config.qse.versionArgs);
        let executable;
        if (input.mode === 'auto') {
            const candidates = this.discover().filter((c) => c.allowed && c.executable);
            if (input.path) {
                const wanted = normalizeQsePath(input.path);
                const match = candidates.find((c) => c.path === wanted);
                if (!match)
                    throw new AppError(400, 'not_a_candidate', 'The selected path was not found by discovery. Run discovery again or use manual configuration.');
                executable = match.path;
            }
            else {
                if (!candidates.length) {
                    throw new AppError(404, 'qse_not_found', 'No QSE CLI was found in QSE_CLI_PATH, PATH or the configured search directories.');
                }
                executable = candidates[0].path;
            }
        }
        else {
            if (!input.path)
                throw new AppError(400, 'path_required', 'Provide the absolute path to the QSE CLI executable');
            executable = normalizeQsePath(input.path);
        }
        this.repo.save({ mode: input.mode, executablePath: executable, versionArgs, status: 'discovered', version: null, message: 'Validating…', validatedAt: null });
        return this.validate();
    }
    async validate() {
        const rec = this.repo.get();
        if (!rec?.executablePath)
            throw new AppError(409, 'qse_not_configured', 'QSE CLI is not configured');
        if (this.demo) {
            this.repo.save({ ...rec, status: 'valid', version: this.demo.recording.qse.version, message: 'demo', validatedAt: new Date().toISOString() });
            return this.view();
        }
        const reachable = this.bobPath(rec.executablePath) !== null;
        const result = await validateQseCli(this.config.qse, rec.executablePath, rec.versionArgs, {
            reachableFromBob: reachable,
            strategy: this.config.execution.strategy
        });
        this.repo.save({
            ...rec,
            executablePath: result.realPath ?? rec.executablePath,
            status: result.valid ? 'valid' : 'invalid',
            version: result.version,
            message: result.message,
            validatedAt: new Date().toISOString()
        });
        return this.view();
    }
    isUsable() {
        const v = this.view();
        return v.status === 'valid' && v.reachableFromBob;
    }
}
//# sourceMappingURL=qse.service.js.map