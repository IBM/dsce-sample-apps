// ── Demo Store ────────────────────────────────────────────────────────────────

// ── Time helpers ──────────────────────────────────────────────────────────────

/**
 * Format a Date as "Today, HH:MM AM/PM".
 */
function _fmtLabel(date) {
  return `Today, ${date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

/**
 * Stamp demo actions with realistic creation times relative to now.
 * DEMO_ACTIONS use hardcoded clock strings that become stale the moment the
 * module is loaded.  Instead we spread them backwards from the current time
 * so the "Created" column always looks fresh when demo mode is toggled on.
 *
 * Each action gets a time = now − offsetMinutes.
 */
function _stampDemoTimes(actions) {
  // Offsets (minutes ago) in the same order the actions appear in demoActions.js
  const offsets = [66, 55, 30, 29, 0];   // INV-004 → ANA-004 → RP-003 → TSK-003 → REC-003
  const now = new Date();
  return actions.map((action, i) => {
    const offset = offsets[i] ?? 0;
    const t = new Date(now.getTime() - offset * 60 * 1000);
    const label = _fmtLabel(t);
    // Also update task-level created times inside Task actions
    const tasks = action.tasks
      ? action.tasks.map(task => ({ ...task, created: label }))
      : action.tasks;
    const activity = action.activity
      ? action.activity.map(ev => ({ ...ev, time: label }))
      : action.activity;
    return { ...action, created: label, ...(tasks   ? { tasks }    : {}),
                                         ...(activity ? { activity } : {}) };
  });
}

// ── Action number generation ──────────────────────────────────────────────────
const TYPE_PREFIX = {
  Investigation:   'INV',
  Analysis:        'ANA',
  Report:          'RP',
  Recommendation:  'REC',
  Task:            'TSK',
};

export function generateActionNumber(type, existingActions) {
  const prefix = TYPE_PREFIX[type] ?? 'ACT';
  const count = existingActions.filter(a => a.type === type).length + 1;
  return `${prefix}-${String(count).padStart(3, '0')}`;
}

// Single mutable module-level store for actions at runtime.
// Both ActionCenter and AgentChat import from here so they share the same array.
//
// Demo mode:
//   ON  → seed store with DEMO_ACTIONS + intercept chat queries with canned responses.
//   OFF → store contains only the original static actions; chat calls the real backend.
//
// localStorage key: 'mkh_demo_mode'  (boolean JSON)

import { ACTIONS as STATIC_ACTIONS } from '../pages/actionCenterData.js';
import { DEMO_ACTIONS } from './demoActions.js';

// ── Subscriber pattern — lets components re-render when the store changes ──────
const _subscribers = new Set();

function _notify() {
  _subscribers.forEach(fn => fn());
}

export function subscribeStore(fn) {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

// ── Internal mutable array ────────────────────────────────────────────────────
let _actions = [...STATIC_ACTIONS];

// ── Demo mode flag ────────────────────────────────────────────────────────────
function _readDemoFlag() {
  try { return JSON.parse(localStorage.getItem('mkh_demo_mode') ?? 'false'); }
  catch { return false; }
}

let _demoMode = _readDemoFlag();

// Seed demo actions if demo mode is already on (e.g. page reload)
if (_demoMode) {
  _actions = [
    ..._stampDemoTimes(DEMO_ACTIONS),
    ...STATIC_ACTIONS.filter(a => !a.demoOnly),
  ];
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns a snapshot of the current actions array. */
export function getActions() {
  return _actions;
}

/** Returns whether demo mode is active. */
export function isDemoMode() {
  return _demoMode;
}

/**
 * Enable demo mode — seeds DEMO_ACTIONS at the top of the store.
 */
export function enableDemoMode() {
  _demoMode = true;
  localStorage.setItem('mkh_demo_mode', 'true');
  // Put demo actions first so they appear at the top of the Action Center.
  // Stamp creation times relative to now so they always look fresh.
  _actions = [
    ..._stampDemoTimes(DEMO_ACTIONS),
    ...STATIC_ACTIONS.filter(a => !a.demoOnly),
  ];
  _notify();
}

/**
 * Disable demo mode — flushes all demoOnly actions, reverts to static data.
 */
export function disableDemoMode() {
  _demoMode = false;
  localStorage.setItem('mkh_demo_mode', 'false');
  _actions = STATIC_ACTIONS.filter(a => !a.demoOnly);
  _notify();
}

/**
 * Toggle demo mode convenience helper.
 */
export function toggleDemoMode() {
  if (_demoMode) disableDemoMode();
  else enableDemoMode();
}

/**
 * Add a single action to the top of the store at runtime.
 * Auto-assigns actionNumber if the action doesn't already have one.
 */
export function addAction(action) {
  const withNumber = action.actionNumber
    ? action
    : { ...action, actionNumber: generateActionNumber(action.type, _actions) };
  // Avoid duplicates by id
  _actions = [withNumber, ..._actions.filter(a => a.id !== action.id)];
  _notify();
}

/**
 * Find an action by id.
 */
export function findAction(id) {
  return _actions.find(a => a.id === id) ?? null;
}
