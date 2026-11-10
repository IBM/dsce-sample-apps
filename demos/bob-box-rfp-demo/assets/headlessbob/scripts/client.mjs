import { readFileSync, existsSync } from 'node:fs';
const info = existsSync('deployment.json') ? JSON.parse(readFileSync('deployment.json', 'utf8')) : {};
const base = process.env.HEADLESSBOB_URL ?? info.url ?? 'http://127.0.0.1:8000';
const token = Object.values(JSON.parse(process.env.AUTH_TOKENS ?? '{}'))[0];
const [path = '/agents', bodyFile] = process.argv.slice(2);
if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Use an API path beginning with /');
const response = await fetch(new URL(path, base), {
  method: bodyFile ? 'POST' : 'GET',
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(bodyFile ? { 'content-type': 'application/json' } : {}) },
  ...(bodyFile ? { body: readFileSync(bodyFile, 'utf8') } : {})
});
if (response.headers.get('content-type')?.includes('text/event-stream')) {
  for await (const chunk of response.body) process.stdout.write(chunk);
} else console.log(JSON.stringify(await response.json(), null, 2));
if (!response.ok) process.exitCode = 1;
