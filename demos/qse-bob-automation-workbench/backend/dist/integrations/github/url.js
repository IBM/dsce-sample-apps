import { AppError } from '../../utils/errors.js';
const SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
export function parseRepositoryUrl(raw, allowedHosts) {
    const input = raw.trim();
    if (!input || input.length > 300 || /[\s\0-\x1f\x7f]/.test(input)) {
        throw new AppError(400, 'invalid_repository_url', 'Enter a repository URL such as https://github.com/owner/repo');
    }
    let url;
    try {
        url = new URL(input);
    }
    catch {
        throw new AppError(400, 'invalid_repository_url', 'Repository URL is not a valid URL');
    }
    if (url.protocol !== 'https:')
        throw new AppError(400, 'invalid_repository_url', 'Only https:// repository URLs are supported');
    if (url.username || url.password) {
        throw new AppError(400, 'invalid_repository_url', 'Do not embed credentials in the URL; use the access token field instead');
    }
    if (url.search || url.hash)
        throw new AppError(400, 'invalid_repository_url', 'Repository URL must not contain a query string or fragment');
    if (url.port)
        throw new AppError(400, 'invalid_repository_url', 'Custom ports are not supported');
    const host = url.hostname.toLowerCase();
    if (!allowedHosts.includes(host)) {
        throw new AppError(400, 'repository_host_not_allowed', `Host "${host}" is not allowed. Allowed hosts: ${allowedHosts.join(', ')}`);
    }
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length !== 2)
        throw new AppError(400, 'invalid_repository_url', 'URL must be in the form https://github.com/<owner>/<repo>');
    const owner = parts[0];
    const name = parts[1].replace(/\.git$/i, '');
    if (!SEGMENT.test(owner) || !SEGMENT.test(name) || name === '.' || name === '..' || name.includes('..')) {
        throw new AppError(400, 'invalid_repository_url', 'Repository owner or name contains invalid characters');
    }
    return { url: `https://${host}/${owner}/${name}`, host, owner, name };
}
export function validateBranch(branch) {
    const value = branch.trim();
    if (!BRANCH.test(value) || value.includes('..') || value.endsWith('/') || value.endsWith('.lock') || value.includes('//') || value.includes('@{')) {
        throw new AppError(400, 'invalid_branch', 'Branch name contains invalid characters');
    }
    return value;
}
//# sourceMappingURL=url.js.map