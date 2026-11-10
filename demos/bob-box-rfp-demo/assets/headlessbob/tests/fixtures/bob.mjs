#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('2.0.1'); process.exit(0); }
if (args[0] === 'acp') { await import('./bob-client.mjs'); await new Promise(() => {}); }
const prompt = readFileSync(0, 'utf8');
const emit = value => console.log(JSON.stringify(value));
if (process.env.AUTH_TOKENS || process.env.UNRELATED_SECRET) { console.error('Environment was not filtered'); process.exit(9); }
if (prompt.includes('CHILD')) {
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], { stdio: 'inherit' });
  writeFileSync('child.pid', String(child.pid));
  process.on('SIGTERM', () => {});
  setInterval(() => {}, 1000);
} else if (prompt.includes('MALFORMED')) { console.log('{broken'); }
else if (prompt.includes('NO_RESULT')) { emit({ type: 'message', role: 'assistant', content: 'partial' }); }
else if (prompt.includes('ERROR_ZERO')) { emit({ type: 'error', severity: 'error', message: 'Maximum turns limit reached: 3' }); }
else if (prompt.includes('OVERFLOW')) { console.log('x'.repeat(10000)); }
else if (prompt.includes('NONZERO')) { console.error('secret error detail'); process.exit(7); }
else if (prompt.includes('HANG')) { process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); }
else {
  const index = args.indexOf('--resume');
  if (index >= 0 && !existsSync('task.txt')) { console.error(`No task found with id '${args[index + 1]}'.`); process.exit(1); }
  const task = index >= 0 ? args[index + 1] : 'fixture-task';
  writeFileSync('task.txt', task);
  if (existsSync('executing.lock')) { console.error('Concurrent workspace execution'); process.exit(8); }
  writeFileSync('executing.lock', 'active');
  if (prompt.includes('SLOW')) await new Promise(r => setTimeout(r, 180));
  emit({ type: 'message', role: 'assistant', isReasoning: true, content: 'hidden reasoning' });
  emit({ type: 'message', role: 'assistant', isReasoning: false, content: index >= 0 ? 'continued' : 'hello' });
  const { unlinkSync } = await import('node:fs'); unlinkSync('executing.lock');
  emit({ type: 'result', status: 'success', stats: { ...(prompt.includes('USAGE') ? { duration_ms: 1000, session_costs: 0.01, tool_calls: 0, input_tokens: 100, output_tokens: 20 } : {}), task_id: prompt.includes('WRONG_TASK') ? 'unexpected-task' : task } });
}
