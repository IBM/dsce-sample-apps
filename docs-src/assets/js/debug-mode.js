// ==================== DEBUG MODE ====================
// Triple-click the IBM logo within 2 seconds to toggle debug mode.
// State is stored in localStorage so it persists across all pages.

const ADMIN_KEY = 'dsce_isAdminMode';
const CLICK_WINDOW_MS = 2000;
const CLICKS_REQUIRED = 3;

// ── State helpers ────────────────────────────────────────────────────────────
export function isAdminMode() {
  return localStorage.getItem(ADMIN_KEY) === 'true';
}

function setDebugMode(value) {
  localStorage.setItem(ADMIN_KEY, String(value));
  applyAdminMode(value);
}

// ── Badge ────────────────────────────────────────────────────────────────────
function applyAdminMode(active) {
  let badge = document.getElementById('admin-mode-badge');
  if (active) {
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'admin-mode-badge';
      badge.className = 'admin-mode-badge';
      badge.textContent = 'Admin Mode';
      // Insert immediately after the Contact us link (last child of .header-actions)
      const headerActions = document.querySelector('.header-actions');
      if (headerActions) {
        const divider = document.createElement('span');
        divider.className = 'header-actions-divider';
        divider.setAttribute('aria-hidden', 'true');
        divider.id = 'admin-mode-divider';
        divider.textContent = '|';
        headerActions.appendChild(divider);
        headerActions.appendChild(badge);
      }
    }
    badge.style.display = '';
    document.getElementById('admin-mode-divider')?.style.setProperty('display', '');
  } else {
    if (badge) {
      badge.style.display = 'none';
      document.getElementById('admin-mode-divider')?.style.setProperty('display', 'none');
    }
  }
}

// ── Logo click tracker ───────────────────────────────────────────────────────
let clickTimes = [];

function handleAdminModeClick() {
  const now = Date.now();
  // Drop clicks older than the window
  clickTimes = clickTimes.filter(t => now - t < CLICK_WINDOW_MS);
  clickTimes.push(now);

  if (clickTimes.length >= CLICKS_REQUIRED) {
    clickTimes = [];
    const next = !isAdminMode();
    setDebugMode(next);
    console.info(`[DSCE] Debug mode ${next ? 'enabled' : 'disabled'}`);
    // Dispatch a custom event so other modules (e.g. index.js) can react
    window.dispatchEvent(new CustomEvent('dsce:debugModeChange', { detail: { active: next } }));
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const titleEl = document.getElementById('admin-mode-trigger');
  if (titleEl) {
    titleEl.addEventListener('click', () => handleAdminModeClick());
    titleEl.style.cursor = 'pointer';
  }
  // Reflect persisted state on every page load
  applyAdminMode(isAdminMode());
});
