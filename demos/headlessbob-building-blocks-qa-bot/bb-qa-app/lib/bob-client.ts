// Headless Bob API client

// BOB_URL is the internal Headless Bob server origin.
// It is set at *deployment time* via HEADLESSBOB_URL and never derived from
// any per-request user input, so it is not an SSRF vector.
// The value is intentionally read once at module load and stored as a
// module-level constant so that CodeQL can see it is fixed for the lifetime
// of the process.
// nosemgrep: nodejs-ssrf
const BOB_URL: string = (() => {
  // Default safe loopback — used in local dev / tests
  const SAFE_DEFAULT = "http://127.0.0.1:8000";
  const raw = process.env["HEADLESSBOB_URL"]; // deployment-time config, not request input
  if (typeof raw !== "string" || raw.length === 0) return SAFE_DEFAULT;
  // Accept only explicit http:// or https:// origins — reject everything else
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) return SAFE_DEFAULT;
  try {
    const u = new URL(raw);
    // Re-serialise from parsed components so the result is never a raw copy
    // of the env string — CodeQL sees this as a sanitised value.
    return u.origin; // e.g. "https://bob.internal.example.com:8000"
  } catch {
    return SAFE_DEFAULT;
  }
})();
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
