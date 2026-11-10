import type { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Threads } from './threads.js';
import type { RunManager } from './runs.js';
import { ApiError } from './types.js';

// Each HTTP request has its own server and authenticated owner. Bob's durable
// threads/runs are independent of MCP transport sessions and client disconnects.
export async function handleMcp(request: IncomingMessage, response: ServerResponse, body: unknown,
  owner: string, threads: Threads, manager: RunManager, checkReady: () => void) {
  const server = new McpServer({ name: 'headlessbob', version: '0.4.0' });
  const result = (action: () => object): CallToolResult => {
    try {
      const data = action() as Record<string, unknown>;
      return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
    } catch (error) {
      const data = error instanceof ApiError
        ? { code: error.reason ?? error.code, message: error.message }
        : { code: 'server_error', message: 'Internal server error' };
      return { isError: true, content: [{ type: 'text', text: JSON.stringify(data) }] };
    }
  };
  server.registerTool('bob_create_thread', {
    description: 'Create a persistent Bob conversation. Save its id for messages and follow-ups. Visible in the HeadlessBob UI.',
    inputSchema: { title: z.string().trim().min(1).max(120).optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, ({ title }) => result(() => threads.create(title === undefined ? {} : { title }, owner)));
  server.registerTool('bob_send_message', {
    description: 'Start Bob work in a thread. Bob can execute shell commands and modify server workspace files. Returns immediately; poll bob_get_run until terminal. Reuse request_id with identical content when retrying. Disconnecting does not cancel the run.',
    inputSchema: { thread_id: z.string().uuid(), content: z.string().trim().min(1).max(20000), request_id: z.string().regex(/^[a-zA-Z0-9._:-]{1,128}$/) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
  }, ({ thread_id, content, request_id }) => result(() => {
    checkReady();
    return threads.send(thread_id, { content }, owner, request_id);
  }));
  server.registerTool('bob_get_run', {
    description: 'Get Bob run status, completed output and reported usage. Poll every few seconds until completed, failed or cancelled.',
    inputSchema: { run_id: z.string().uuid() },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, ({ run_id }) => result(() => manager.get(run_id, owner)));
  server.registerTool('bob_cancel_run', {
    description: 'Request cancellation of a queued or active Bob run. Poll bob_get_run for terminal status. Interrupted work may require a new thread.',
    inputSchema: { run_id: z.string().uuid() },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }, ({ run_id }) => result(() => manager.cancel(run_id, owner)));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const cleanup = () => { void server.close().catch(() => {}); };
  response.once('close', cleanup);
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, body);
  } catch (error) {
    await server.close();
    throw error;
  }
}
