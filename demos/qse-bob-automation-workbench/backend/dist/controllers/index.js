import { cookieOptions, SESSION_COOKIE } from '../middleware/auth.js';
import { bobConnectSchema, changePasswordSchema, executionCreateSchema, executionListSchema, loginSchema, qseConfigureSchema, recloneSchema, reportFormatSchema, repoInputSchema } from '../models/schemas.js';
import { markdownToPdf } from '../services/pdf.service.js';
import { AppError, notFound, unauthorized } from '../utils/errors.js';
import { hashPassword, verifyPassword } from '../utils/passwords.js';
import { toExecutionView } from '../services/report.service.js';
const param = (req, name) => {
    const v = req.params[name];
    if (typeof v !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(v))
        throw new AppError(400, 'invalid_parameter', `Invalid ${name}`);
    return v;
};
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
export function controllers(ctx) {
    const { config } = ctx;
    const auth = {
        async login(req, res) {
            const body = loginSchema.parse(req.body);
            const user = ctx.users.findByUsername(body.username);
            const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
            if (!user || !ok) {
                req.log.warn({ username: body.username.slice(0, 64) }, 'failed login');
                throw new AppError(401, 'invalid_credentials', 'Invalid username or password');
            }
            const s = ctx.sessions.create(user.id, config.sessionTtlMinutes);
            res.cookie(SESSION_COOKIE, s.id, cookieOptions(config, config.sessionTtlMinutes * 60_000));
            res.json({ user: { id: user.id, username: user.username, role: user.role }, csrfToken: s.csrfToken });
        },
        logout(req, res) {
            if (req.auth)
                ctx.sessions.delete(req.auth.sessionId);
            res.clearCookie(SESSION_COOKIE, cookieOptions(config));
            res.status(204).end();
        },
        me(req, res) {
            if (!req.auth)
                throw unauthorized();
            const { user, csrfToken } = req.auth;
            res.json({ user: { id: user.id, username: user.username, role: user.role }, csrfToken });
        },
        async changePassword(req, res) {
            const body = changePasswordSchema.parse(req.body);
            const user = ctx.users.findByUsername(req.auth.user.username);
            if (!(await verifyPassword(body.currentPassword, user.passwordHash)))
                throw new AppError(403, 'invalid_credentials', 'Current password is incorrect');
            ctx.users.updatePassword(user.id, await hashPassword(body.newPassword));
            ctx.sessions.deleteForUser(user.id);
            res.clearCookie(SESSION_COOKIE, cookieOptions(config));
            res.status(204).end();
        }
    };
    const bob = {
        status: (_req, res) => res.json(ctx.bob.view()),
        async connect(req, res) {
            res.json(await ctx.bob.save(bobConnectSchema.parse(req.body)));
        },
        async test(_req, res) {
            res.json(await ctx.bob.test());
        },
        disconnect: (_req, res) => {
            if (ctx.orchestrator.hasActive())
                throw new AppError(409, 'execution_active', 'Cancel the active execution before disconnecting.');
            res.json(ctx.bob.disconnect());
        }
    };
    const repositories = {
        list: (_req, res) => res.json({ items: ctx.repos.list() }),
        async validate(req, res) {
            res.json(await ctx.repos.validate(repoInputSchema.parse(req.body)));
        },
        async clone(req, res) {
            res.status(202).json(await ctx.repos.clone(repoInputSchema.parse(req.body), req.auth.user.id));
        },
        get: (req, res) => res.json(ctx.repos.get(param(req, 'id'))),
        async reclone(req, res) {
            res.status(202).json(await ctx.repos.reclone(param(req, 'id'), recloneSchema.parse(req.body ?? {})));
        },
        async remove(req, res) {
            await ctx.repos.remove(param(req, 'id'));
            res.status(204).end();
        }
    };
    const qse = {
        discover: (_req, res) => res.json({ candidates: ctx.qse.discover(), searched: { envPath: config.qse.envPath ? 'QSE_CLI_PATH' : null, dirs: config.qse.searchDirs } }),
        async configure(req, res) {
            res.json(await ctx.qse.configure(qseConfigureSchema.parse(req.body)));
        },
        async validate(_req, res) {
            res.json(await ctx.qse.validate());
        },
        status: (_req, res) => res.json(ctx.qse.view())
    };
    const executions = {
        create(req, res) {
            const body = executionCreateSchema.parse(req.body);
            res.status(202).json(ctx.orchestrator.start({ repositoryId: body.repositoryId, prompt: body.prompt }, req.auth.user.id));
        },
        list(req, res) {
            const q = executionListSchema.parse(req.query);
            res.json(ctx.orchestrator.list(q));
        },
        get: (req, res) => res.json(ctx.orchestrator.get(param(req, 'id'))),
        async cancel(req, res) {
            res.status(202).json(await ctx.orchestrator.cancel(param(req, 'id')));
        },
        logs(req, res) {
            const after = Number(req.query.after ?? 0);
            res.json({ items: ctx.orchestrator.logsFor(param(req, 'id'), Number.isInteger(after) && after > 0 ? after : 0) });
        },
        report(req, res) {
            const e = ctx.orchestrator.get(param(req, 'id'));
            if (!e.reportId)
                throw notFound('No report is available for this execution');
            res.json(ctx.reports.view(e.reportId));
        },
        artifacts: (req, res) => res.json({ items: ctx.orchestrator.artifacts(param(req, 'id')) }),
        async artifact(req, res) {
            const file = await ctx.orchestrator.downloadArtifact(param(req, 'id'), param(req, 'artifactId'));
            const name = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
            res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.send(file.data);
        },
        prompts: (_req, res) => res.json({ items: ctx.executions.prompts() }),
        /** Server-Sent Events: snapshot, then incremental log + state events. */
        stream(req, res) {
            const id = param(req, 'id');
            const exec = ctx.executions.get(id);
            if (!exec)
                throw notFound('Execution not found');
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no'
            });
            res.flushHeaders();
            const send = (event, data, lid) => {
                res.write(`${lid ? `id: ${lid}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            };
            const last = Number(req.header('last-event-id') ?? req.query.after ?? 0);
            let lastLog = Number.isInteger(last) && last > 0 ? last : 0;
            let closed = false;
            const snapshot = () => send('execution', toExecutionView(ctx.executions.get(id), ctx.executions));
            const flushLogs = () => {
                for (const l of ctx.logs.list(id, lastLog)) {
                    lastLog = l.id;
                    send('log', l, l.id);
                }
            };
            let pending = false;
            const onEvent = (e) => {
                if (closed)
                    return;
                if (e.type === 'log') {
                    if (e.log.id > lastLog) {
                        lastLog = e.log.id;
                        send('log', e.log, e.log.id);
                    }
                }
                else if (!pending) {
                    pending = true;
                    setTimeout(() => {
                        pending = false;
                        if (!closed)
                            snapshot();
                    }, 150).unref();
                }
            };
            const unsubscribe = ctx.logs.subscribe(id, onEvent);
            snapshot();
            flushLogs();
            const heartbeat = setInterval(() => {
                res.write(': heartbeat\n\n');
                flushLogs(); // covers any events missed between persistence and emit
                snapshot();
            }, 15000);
            req.on('close', () => {
                closed = true;
                clearInterval(heartbeat);
                unsubscribe();
            });
        }
    };
    const reports = {
        get(req, res) {
            const r = ctx.reports.view(param(req, 'id'));
            if (!r)
                throw notFound('Report not found');
            res.json(r);
        },
        async download(req, res) {
            const { format } = reportFormatSchema.parse(req.query);
            const r = ctx.reports.view(param(req, 'id'));
            if (!r)
                throw notFound('Report not found');
            const base = `qse-report-${r.executionId.slice(0, 8)}${r.mock ? '-DEMO' : ''}`;
            res.setHeader('X-Content-Type-Options', 'nosniff');
            if (format === 'pdf') {
                const pdf = await markdownToPdf(r.markdown, `QSE report ${r.executionId}`);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
                res.send(pdf);
            }
            else if (format === 'json') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${base}.json"`);
                res.send(JSON.stringify(r, null, 2));
            }
            else {
                res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${base}.md"`);
                res.send(r.markdown);
            }
        },
        /** Structured results (JSON) including the execution record, steps, logs and artifacts. */
        export(req, res) {
            const r = ctx.reports.view(param(req, 'id'));
            if (!r)
                throw notFound('Report not found');
            const logs = ctx.orchestrator.logsFor(r.executionId);
            res.setHeader('Content-Disposition', `attachment; filename="qse-results-${r.executionId.slice(0, 8)}.json"`);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.json({ report: r, logs });
        }
    };
    const system = {
        settings(_req, res) {
            res.json({
                version: '1.0.0',
                streamMode: config.streamMode,
                executionStrategy: config.execution.strategy,
                githubAllowedHosts: config.github.allowedHosts,
                limits: { maxPromptChars: config.execution.maxPromptChars, executionTimeoutMs: config.execution.timeoutMs, maxConcurrentExecutions: config.execution.maxConcurrent },
                sharedMounts: ctx.mapper.list().map((m) => ({ label: m.label, bobPath: m.bob })),
                encryptionKeyId: ctx.box.activeKeyId,
                session: { ttlMinutes: config.sessionTtlMinutes, idleMinutes: config.sessionIdleMinutes }
            });
        },
        rotateSecrets(_req, res) {
            const bobRotated = ctx.bob.reencrypt();
            const tokens = ctx.repos.reencrypt();
            res.json({ activeKeyId: ctx.box.activeKeyId, bobApiKeyReencrypted: bobRotated, repositoryTokensReencrypted: tokens });
        }
    };
    return { auth, bob, repositories, qse, executions, reports, system };
}
//# sourceMappingURL=index.js.map