import { createApp } from './app.js';
import { loadConfig } from './config.js';

if (process.platform === 'win32') throw new Error('HeadlessBob requires POSIX process groups; use Linux, macOS, or WSL');
process.umask(0o077);
const config = loadConfig();
const app = await createApp(config);
try {
  const address = await app.listen();
  console.log(`HeadlessBob listening on ${typeof address === 'object' && address ? `${address.address}:${address.port}` : address}`);
} catch (error) { await app.close(); throw error; }
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (closing) return;
  closing = true;
  void app.close().catch(() => { process.exitCode = 1; });
});
