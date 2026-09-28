// Headless Bob API client

const BOB_URL   = process.env.HEADLESSBOB_URL  ?? "http://127.0.0.1:8000";
const BOB_TOKEN = process.env.HEADLESSBOB_TOKEN ?? "";

function headers(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${BOB_TOKEN}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function createThread(title: string): Promise<{ id: string }> {
  const res = await fetch(`${BOB_URL}/api/v1/threads`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to create thread: ${res.status}`);
  return res.json();
}

export async function listThreads(): Promise<{ items?: Array<{ id: string; title: string; updated_at: string; status: string }>; threads?: Array<{ id: string; title: string; updated_at: string; status: string }> }> {
  const res = await fetch(`${BOB_URL}/api/v1/threads?limit=50`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to list threads: ${res.status}`);
  return res.json();
}

export async function deleteThread(threadId: string): Promise<void> {
  await fetch(`${BOB_URL}/api/v1/threads/${threadId}`, {
    method: "DELETE",
    headers: headers(),
  });
}

export async function sendMessage(
  threadId: string,
  content: string,
  idempotencyKey?: string
): Promise<{ run: { run_id: string }; events_url: string }> {
  const res = await fetch(`${BOB_URL}/api/v1/threads/${threadId}/messages`, {
    method: "POST",
    headers: headers(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to send message: ${res.status} ${body}`);
  }
  return res.json();
}

export async function getRunStatus(runId: string) {
  const res = await fetch(`${BOB_URL}/api/v1/runs/${runId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to get run: ${res.status}`);
  return res.json();
}

export async function getThreadMessages(threadId: string) {
  const res = await fetch(`${BOB_URL}/api/v1/threads/${threadId}/messages`, {
    headers: headers(),
  });
  if (!res.ok) return { turns: [] };
  return res.json();
}

export function streamRunEvents(runId: string): Response {
  return fetch(`${BOB_URL}/api/v1/runs/${runId}/events`, {
    headers: { ...headers(), Accept: "text/event-stream" },
  }) as unknown as Response;
}

export const BOB_BASE = BOB_URL;
export const BOB_AUTH = `Bearer ${BOB_TOKEN}`;
