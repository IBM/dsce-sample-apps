import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import formatsModule from 'ajv-formats';
import { parse } from 'yaml';
import { ApiError, type CreateRequest } from './types.js';

const source = parse(readFileSync(new URL('../spec/openapi.yaml', import.meta.url), 'utf8'));
// The archived 3.1 spec includes legacy nullable alongside $ref/oneOf. Normalize
// those annotations for Ajv, without changing the checked-in upstream contract.
function normalize(value: any): any {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  const { nullable, ...rest } = value;
  const normalized = Object.fromEntries(Object.entries(rest).map(([key, child]) => [key, normalize(child)]));
  return nullable ? { anyOf: [normalized, { type: 'null' }] } : normalized;
}
const ajv = new Ajv2020({ strict: false, allErrors: false });
const addFormats = formatsModule as unknown as (ajv: Ajv2020) => void;
addFormats(ajv);
ajv.addSchema({ $id: 'acp', components: normalize(source.components) });
export function validator(name: string) { return ajv.getSchema(`acp#/components/schemas/${name}`)!; }
const createValidator = validator('RunCreateRequest');
export function validateCreate(body: unknown): CreateRequest {
  if (!createValidator(body)) throw new ApiError(400, 'invalid_input', `Invalid ACP request: ${ajv.errorsText(createValidator.errors)}`);
  const value = body as CreateRequest & Record<string, unknown>;
  if (Object.keys(value).some(key => !['agent_name', 'input', 'mode', 'session_id'].includes(key))) throw new ApiError(400, 'invalid_input', 'Only agent_name, input, mode and session_id are supported; session import is unavailable');
  if (value.agent_name !== 'headlessbob') throw new ApiError(404, 'not_found', 'Agent not found');
  for (const message of value.input) for (const part of message.parts) {
    const raw = part as Record<string, unknown>;
    if (part.content_type !== 'text/plain' || typeof part.content !== 'string' || 'content_url' in raw || (raw.content_encoding !== undefined && raw.content_encoding !== 'plain') || raw.metadata !== undefined) throw new ApiError(400, 'invalid_input', 'Only inline plain text without metadata is supported', 'unsupported_media');
  }
  if (!value.input.some(m => m.parts.some(p => p.content.trim()))) throw new ApiError(400, 'invalid_input', 'Input must contain text');
  return value;
}
export function manifest(continuation: boolean) {
  return { name: 'headlessbob', description: 'Bob Shell running in managed workspaces for trusted callers.', input_content_types: ['text/plain'], output_content_types: ['text/plain'],
    metadata: { programming_language: 'TypeScript', annotations: { protocol: 'ACP 0.2.0', await_resume: false, task_continuation: continuation, artifact_transfer: false },
      capabilities: [{ name: 'Headless execution', description: 'Synchronous, asynchronous and streamed text runs with cancellation.' }, ...(continuation ? [{ name: 'Sessions', description: 'Continue a Bob task in the same caller-owned workspace and mode.' }] : [])] }
  };
}
