import { createInterface } from 'node:readline';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
if (process.env.AUTH_TOKENS || process.env.UNRELATED_SECRET) process.exit(9);
if (!['--trust', '--disable-mcp', '--disable-subagents'].every(flag => process.argv.includes(flag))) process.exit(10);
let resumed = false, sessionId = 'fixture-task', promptId;
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
const chunk = (text, id = sessionId, kind = 'agent_message_chunk') => send({ method: 'session/update', params: { sessionId: id, update: { sessionUpdate: kind, content: { type: 'text', text } } } });
const finish = text => { chunk(text); if (existsSync('executing.lock')) unlinkSync('executing.lock'); send({ id: promptId, result: { stopReason: 'end_turn' } }); };
createInterface({ input: process.stdin }).on('line', async line => {
  const m = JSON.parse(line);
  if (m.method === 'initialize') send({ id: m.id, result: { protocolVersion: 1, agentCapabilities: { sessionCapabilities: { resume: {}, close: {} } } } });
  else if (m.method === 'session/close') { writeFileSync('closed.txt', 'yes'); send({ id: m.id, result: {} }); }
  else if (m.method === 'session/new') { writeFileSync('task.txt', sessionId); send({ id: m.id, result: { sessionId, modes: { currentModeId: 'agent' } } }); }
  else if (m.method === 'session/resume') {
    if (!existsSync('task.txt')) return send({ id: m.id, error: { code: -32602, message: 'secret missing history' } });
    resumed = true; sessionId = m.params.sessionId; send({ id: m.id, result: { modes: { currentModeId: 'agent' } } });
  } else if (m.method === 'session/set_mode') send({ id: m.id, result: {} });
  else if (m.method === 'session/cancel') { writeFileSync('cancelled.txt', 'yes'); send({ id: promptId, result: { stopReason: 'cancelled' } }); }
  else if (m.id === 'permission') { writeFileSync('permission.json', JSON.stringify(m.result)); finish('permitted'); }
  else if (m.id === 'unknown') { writeFileSync('unknown.json', JSON.stringify(m.error)); finish('unsupported'); }
  else if (m.method === 'session/prompt') {
    promptId = m.id;
    const prompt = m.params.prompt[0].text;
    if (prompt.includes('CHILD')) {
      const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], { stdio: 'inherit' });
      writeFileSync('child.pid', String(child.pid)); process.on('SIGTERM', () => {}); return;
    }
    if (prompt.includes('MALFORMED')) return process.stdout.write('{broken\n');
    if (prompt.includes('OVERFLOW')) return process.stdout.write('x'.repeat(10000));
    if (prompt.includes('NO_RESULT')) { chunk('partial'); process.exit(0); }
    if (prompt.includes('NONZERO')) process.exit(7);
    if (prompt.includes('HANG')) { writeFileSync('prompted.txt', 'yes'); return; }
    if (prompt.includes('ERROR_ZERO')) return send({ id: m.id, result: { stopReason: 'max_turn_requests' } });
    if (prompt.includes('RPC_ERROR')) return send({ id: m.id, error: { code: -32603, message: 'secret error' } });
    if (prompt.includes('WRONG_TASK')) return chunk('bad', 'wrong-session');
    if (prompt.includes('EVENT_FLOOD')) { for (let i = 0; i < 30; i++) chunk('hidden', sessionId, 'agent_thought_chunk'); return; }
    if (prompt.includes('PERMISSION')) return send({ id: 'permission', method: 'session/request_permission', params: { sessionId, options: [{ kind: 'allow_always', optionId: 'always' }, { kind: 'allow_once', optionId: 'once' }] } });
    if (prompt.includes('UNKNOWN')) return send({ id: 'unknown', method: 'fs/read_text_file', params: { sessionId, path: '/not-allowed' } });
    if (existsSync('executing.lock')) process.exit(8);
    writeFileSync('executing.lock', 'active');
    if (prompt.includes('SLOW')) await new Promise(r => setTimeout(r, 180));
    chunk('hidden reasoning', sessionId, 'agent_thought_chunk');
    if (prompt.includes('UNICODE')) {
      const data = Buffer.from(JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello 🌍' } } } }) + '\n');
      for (const byte of data) process.stdout.write(Buffer.from([byte]));
      unlinkSync('executing.lock'); send({ id: m.id, result: { stopReason: 'end_turn' } });
    } else finish(resumed ? 'continued' : 'hello');
  }
});
