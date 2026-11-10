import { z } from 'zod';
export const loginSchema = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(256) }).strict();
export const changePasswordSchema = z
    .object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(12).max(256) })
    .strict();
export const bobConnectSchema = z
    .object({
    endpoint: z.string().max(300).default(''),
    adapter: z.enum(['rest-threads', 'acp']).default('rest-threads'),
    apiBasePath: z.string().max(100).default('/api/v1'),
    authMode: z.enum(['bearer', 'header', 'none']).default('bearer'),
    authHeaderName: z.string().max(64).default('authorization'),
    apiKey: z.string().max(512).optional()
})
    .strict();
export const repoInputSchema = z
    .object({
    url: z.string().min(1).max(300),
    branch: z.string().min(1).max(200).default('main'),
    token: z.string().max(255).optional()
})
    .strict();
export const recloneSchema = z.object({ branch: z.string().min(1).max(200).optional(), token: z.string().max(255).optional() }).strict();
export const qseConfigureSchema = z
    .object({
    mode: z.enum(['auto', 'manual']),
    path: z.string().max(1024).optional(),
    versionArgs: z.array(z.string().max(40)).max(4).optional()
})
    .strict();
export const executionCreateSchema = z.object({ repositoryId: z.uuid(), prompt: z.string().min(1).max(20000) }).strict();
export const executionListSchema = z.object({
    search: z.string().max(200).optional(),
    status: z.enum(['queued', 'running', 'cancelling', 'completed', 'failed', 'cancelled']).optional(),
    sort: z.enum(['createdAt', 'durationMs', 'status', 'repositoryName']).default('createdAt'),
    direction: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10)
});
export const reportFormatSchema = z.object({ format: z.enum(['markdown', 'pdf', 'json']).default('markdown') });
//# sourceMappingURL=schemas.js.map