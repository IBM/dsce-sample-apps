import { describe, expect, it } from 'vitest';
import { parseRepositoryUrl, validateBranch } from '../../src/integrations/github/url.js';

const hosts = ['github.com'];

describe('repository URL validation', () => {
  it('accepts canonical github URLs and normalises them', () => {
    expect(parseRepositoryUrl('https://github.com/IBM/quantum-safe.git', hosts)).toMatchObject({ owner: 'IBM', name: 'quantum-safe', url: 'https://github.com/IBM/quantum-safe' });
    expect(parseRepositoryUrl(' https://GitHub.com/a/b/ ', hosts).url).toBe('https://github.com/a/b');
  });

  it.each([
    'http://github.com/a/b',
    'git@github.com:a/b.git',
    'ssh://git@github.com/a/b',
    'file:///etc/passwd',
    'https://user:token@github.com/a/b',
    'https://github.com/a/b?x=1',
    'https://github.com/a/b#frag',
    'https://github.com:8443/a/b',
    'https://evil.example.com/a/b',
    'https://github.com.evil.com/a/b',
    'https://github.com/a',
    'https://github.com/a/b/c',
    'https://github.com/a/..',
    'https://github.com/a/b;rm -rf /',
    'https://github.com/a/$(id)',
    'https://github.com/--upload-pack=x/y',
    '-u https://github.com/a/b',
    '',
    'https://github.com/a/b\nhttps://evil.com/x/y'
  ])('rejects %j', (u) => expect(() => parseRepositoryUrl(u, hosts)).toThrow());

  it('supports a configured enterprise host', () => {
    expect(parseRepositoryUrl('https://ghe.corp.example/a/b', ['ghe.corp.example']).host).toBe('ghe.corp.example');
  });

  it('validates branches', () => {
    expect(validateBranch('feature/x-1.2')).toBe('feature/x-1.2');
    for (const b of ['--upload-pack=x', '-x', 'a..b', 'a b', 'a;b', 'a$(x)', 'a/', 'x.lock', '', 'a@{1}']) expect(() => validateBranch(b), b).toThrow();
  });
});
