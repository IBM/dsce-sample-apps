/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/api.ts
export type SearchJobsRequest = { query: string; top_k?: number };
export type SearchResumesRequest = { query: string; top_k?: number };

export type JobSummary = { job_id: string; title: string; details: string };
export type ResumeSummary = { resume_id: string; title: string; summary: string };

const BASE = import.meta.env.VITE_PUBLIC_API_URL || "/api"; // e.g. http://localhost:8000
const API_TOKEN = import.meta.env.VITE_API_TOKEN; // define in .env: VITE_API_TOKEN=yourtoken

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${API_TOKEN}`, // inject token
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async uploadResume(file: File) {
    const fd = new FormData();
    fd.append("resume_file", file);
    // POST /resumes -> { resume_id, summary }
    return jsonFetch<{ resume_id: string; summary: string }>(`${BASE}/resumes`, {
      method: "POST",
      body: fd,
      headers: {
        // FormData: don't set Content-Type manually; still pass token
        Authorization: `Bearer ${API_TOKEN}`,
      },
    });
  },

  async searchJobs(query = "", top_k = 100) {
    const body: SearchJobsRequest = { query, top_k } as any;
    return jsonFetch<JobSummary[]>(`${BASE}/search/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  async searchResumes(query = "", top_k = 100) {
    const body: SearchResumesRequest = { query, top_k } as any;
    return jsonFetch<ResumeSummary[]>(`${BASE}/search/resumes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  // NEW: list all jobs (paginated) -> GET /jobs?page=1&size=50
  async listJobs(page = 1, size = 50) {
    const url = new URL(`${BASE}/jobs`, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", String(size));
    return jsonFetch<JobSummary[]>(url.toString(), { method: "GET" });
  },

  // NEW: list all resumes (paginated) -> GET /resumes?page=1&size=50
  async listResumes(page = 1, size = 50) {
    const url = new URL(`${BASE}/resumes`, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", String(size));
    return jsonFetch<ResumeSummary[]>(url.toString(), { method: "GET" });
  },
};
