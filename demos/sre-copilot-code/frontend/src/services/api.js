/**
 * api.js — Fetch wrappers for the SRE Copilot backend API.
 * All calls use relative /api paths — proxied by Vite (dev) or Nginx (Docker).
 */

const BASE = '/api';

/**
 * Fetch all incidents from the backend.
 * @returns {Promise<Array>}
 */
export async function getIncidents() {
  const res = await fetch(`${BASE}/incidents`);
  if (!res.ok) throw new Error(`Failed to load incidents: ${res.statusText}`);
  return res.json();
}

/**
 * Generate a new random incident and return it.
 * @returns {Promise<Object>}
 */
export async function generateIncident() {
  const res = await fetch(`${BASE}/incidents/generate`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to generate incident: ${res.statusText}`);
  return res.json();
}

/**
 * Analyze an incident using the watsonx Orchestrate agent.
 * @param {string} incidentId
 * @returns {Promise<Object>} AnalysisResult
 */
export async function analyzeIncident(incidentId) {
  const res = await fetch(`${BASE}/incidents/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ incident_id: incidentId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Analysis failed: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Verify admin password.
 * @param {string} password
 * @returns {Promise<{status: string}>}
 */
export async function adminLogin(password) {
  const res = await fetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Login failed');
  }
  return res.json();
}

/**
 * Get current admin config (control toggle states).
 * @returns {Promise<{pii_filter: bool, guardrails: bool, secrets_detection: bool}>}
 */
export async function getAdminConfig() {
  const res = await fetch(`${BASE}/admin/config`);
  if (!res.ok) throw new Error(`Failed to load admin config: ${res.statusText}`);
  return res.json();
}

/**
 * Update agent control toggles.
 * @param {object} config  — {pii_filter, guardrails, secrets_detection}
 * @param {string} password — admin password
 * @returns {Promise<object>}
 */
export async function updateAdminConfig(config, password) {
  const res = await fetch(`${BASE}/admin/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': password,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Config update failed');
  }
  return res.json();
}

/**
 * Reset the incident board to the 8 seed incidents.
 * @returns {Promise<{message: string, count: number}>}
 */
export async function resetBoard() {
  const res = await fetch(`${BASE}/incidents/reset`, { method: 'POST' });
  if (!res.ok) throw new Error(`Reset failed: ${res.statusText}`);
  return res.json();
}

/**
 * Send a follow-up chat message about a specific incident.
 * @param {string} incidentId
 * @param {string} message
 * @param {Array}  history  — [{role, content}, ...]
 * @param {Object} analysis — prior AnalysisResult for context
 * @returns {Promise<{reply: string}>}
 */
export async function chatWithAgent(incidentId, message, history = [], analysis = null) {
  const res = await fetch(`${BASE}/incidents/${incidentId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, analysis }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Chat failed: ${res.statusText}`);
  }
  return res.json();
}
