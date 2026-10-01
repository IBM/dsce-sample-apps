import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const namespace = process.env.OPENSHIFT_PROJECT ?? 'binb';
if (!process.env.BOB_API_KEY || !process.env.AUTH_TOKENS) throw new Error('Load BOB_API_KEY and AUTH_TOKENS from .env first');
const settings = JSON.parse(readFileSync(join(homedir(), '.bob/settings/settings.json'), 'utf8'));
if (settings.licenseConsent !== true) throw new Error('Review and accept the Bob license using Bob Shell before deployment');
for (const resource of [
  { apiVersion: 'v1', kind: 'Secret', metadata: { name: 'headlessbob-credentials', labels: { app: 'headlessbob' } }, type: 'Opaque', stringData: { BOB_API_KEY: process.env.BOB_API_KEY, AUTH_TOKENS: process.env.AUTH_TOKENS } },
  { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'headlessbob-bob-config', labels: { app: 'headlessbob' } }, data: { 'settings.json': JSON.stringify({ licenseConsent: true }) } }
]) {
  // stdin keeps credentials out of argv and build context; never print manifests.
  const result = spawnSync('oc', ['apply', '-n', namespace, '-f', '-'], { input: JSON.stringify(resource), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Could not apply ${resource.kind}/${resource.metadata.name}; check project permissions`);
  console.log(`${resource.kind}/${resource.metadata.name} configured in ${namespace}`);
}
