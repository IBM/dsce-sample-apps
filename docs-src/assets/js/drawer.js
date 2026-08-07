// ==================== CONTACT DRAWER ====================
const drawer = document.getElementById('contactDrawer');
const overlay = document.getElementById('drawerOverlay');

function bindDrawer(options) {
  const trigger = document.getElementById(options.triggerId);
  const panel = document.getElementById(options.drawerId);
  const panelOverlay = document.getElementById(options.overlayId);
  const closeButton = document.getElementById(options.closeId);
  const cancelButton = options.cancelId ? document.getElementById(options.cancelId) : null;

  if (!trigger || !panel || !panelOverlay || !closeButton) return;

  function openDrawer() {
    panel.classList.add('is-open');
    panelOverlay.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    panel.classList.remove('is-open');
    panelOverlay.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', openDrawer);
  closeButton.addEventListener('click', closeDrawer);
  panelOverlay.addEventListener('click', closeDrawer);

  if (cancelButton) {
    cancelButton.addEventListener('click', closeDrawer);
  }
}

bindDrawer({
  triggerId: 'contactBtn',
  drawerId: 'contactDrawer',
  overlayId: 'drawerOverlay',
  closeId: 'drawerClose',
  cancelId: 'drawerCancel'
});

bindDrawer({
  triggerId: 'demoExplainerBtn',
  drawerId: 'demoExplainerDrawer',
  overlayId: 'demoExplainerOverlay',
  closeId: 'demoExplainerClose'
});
