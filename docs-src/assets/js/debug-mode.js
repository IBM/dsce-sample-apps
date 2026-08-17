// ==================== DEBUG MODE ====================
// Triple-click the IBM logo within 2 seconds to toggle debug mode.
// State is stored in localStorage so it persists across all pages.

const DEBUG_KEY = 'dsce_isDebugMode';
const CLICK_WINDOW_MS = 2000;
const CLICKS_REQUIRED = 3;

// ── State helpers ────────────────────────────────────────────────────────────
export function isDebugMode() {
  return localStorage.getItem(DEBUG_KEY) === 'true';
}

function setDebugMode(value) {
  localStorage.setItem(DEBUG_KEY, String(value));
  applyDebugMode(value);
}

// ── Badge ────────────────────────────────────────────────────────────────────
function applyDebugMode(active) {
  let badge = document.getElementById('debug-mode-badge');
  if (active) {
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'debug-mode-badge';
      badge.className = 'debug-mode-badge';
      badge.textContent = 'Debug Mode';
      // Insert immediately after the Contact us link (last child of .header-actions)
      const headerActions = document.querySelector('.header-actions');
      if (headerActions) {
        const divider = document.createElement('span');
        divider.className = 'header-actions-divider';
        divider.setAttribute('aria-hidden', 'true');
        divider.id = 'debug-mode-divider';
        divider.textContent = '|';
        headerActions.appendChild(divider);
        headerActions.appendChild(badge);
      }
    }
    badge.style.display = '';
    document.getElementById('debug-mode-divider')?.style.setProperty('display', '');
  } else {
    if (badge) {
      badge.style.display = 'none';
      document.getElementById('debug-mode-divider')?.style.setProperty('display', 'none');
    }
  }
}

// ── Logo click tracker ───────────────────────────────────────────────────────
let clickTimes = [];

function handleLogoClick() {
  const now = Date.now();
  // Drop clicks older than the window
  clickTimes = clickTimes.filter(t => now - t < CLICK_WINDOW_MS);
  clickTimes.push(now);

  if (clickTimes.length >= CLICKS_REQUIRED) {
    clickTimes = [];
    const next = !isDebugMode();
    setDebugMode(next);
    console.info(`[DSCE] Debug mode ${next ? 'enabled' : 'disabled'}`);
    // Dispatch a custom event so other modules (e.g. index.js) can react
    window.dispatchEvent(new CustomEvent('dsce:debugModeChange', { detail: { active: next } }));
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const titleEl = document.getElementById('debug-trigger');
  if (titleEl) {
    titleEl.addEventListener('click', () => handleLogoClick());
    titleEl.style.cursor = 'pointer';
  }
  // Reflect persisted state on every page load
  applyDebugMode(isDebugMode());
});
