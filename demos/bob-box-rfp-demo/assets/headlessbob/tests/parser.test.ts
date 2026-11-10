import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BobParser } from '../src/runtime/parser.js';

test('parses arbitrary byte boundaries, UTF-8, and filters reasoning/tool records', () => {
  const bytes = readFileSync(new URL('./fixtures/bob-stream.jsonl', import.meta.url));
  const chunks: string[] = [];
  const parser = new BobParser(10000, text => chunks.push(text));
  for (const byte of bytes) parser.push(Buffer.from([byte]));
  assert.deepEqual(parser.finish(), { text: 'Hello 🌍', taskId: 'fixture-task', usage: { duration_ms: 6, max_cost: 1, session_costs: 0, tool_calls: 1 } });
  assert.equal(chunks.join(''), 'Hello 🌍');
});
test('accepts final record without newline and rejects truncated/malformed records', () => {
  const parser = new BobParser(1000, () => {});
  parser.push(Buffer.from('{"type":"result","status":"success","stats":{"task_id":"task-1"}}'));
  assert.equal(parser.finish().taskId, 'task-1');
  const broken = new BobParser(1000, () => {});
  broken.push(Buffer.from('{"type":'));
  assert.throws(() => broken.finish(), /malformed/);
  assert.throws(() => new BobParser(1000, () => {}).finish(), /without a completion/);
});
test('enforces byte limit and treats Bob limit events as failures', () => {
  assert.throws(() => new BobParser(2, () => {}).push(Buffer.from('abc')), /byte limit/);
  assert.throws(() => new BobParser(1000, () => {}).push(Buffer.from('{"type":"error","message":"Maximum cost limit reached"}\n')), /cost or turn/);
});
test('parses the recorded live Bob Shell 2.0.1 stream', () => {
  const parser = new BobParser(10000, () => {});
  parser.push(readFileSync(new URL('./fixtures/bob-live-stream.jsonl', import.meta.url)));
  assert.deepEqual(parser.finish(), { text: 'HEADLESSBOB_OK', taskId: 'redacted-live-task', usage: { duration_ms: 1558, session_costs: 0.010432, max_cost: 0.1, tool_calls: 0 } });
});

test('usage preserves reported zeroes and rejects invalid or unrecognized fields', () => {
  const parser = new BobParser(10000, () => {});
  parser.push(Buffer.from(JSON.stringify({type:'result',status:'success',stats:{task_id:'task',input_tokens:100,output_tokens:0,total_tokens:100,cache_read_tokens:40,cache_write_tokens:0,cache_ratio:0.4,session_costs:0,duration_ms:-1,tool_calls:1.5,max_cost:'1',secret:'discard',extra:123}})));
  assert.deepEqual(parser.finish().usage,{input_tokens:100,output_tokens:0,total_tokens:100,cache_read_tokens:40,cache_write_tokens:0,cache_ratio:0.4,session_costs:0});
});
