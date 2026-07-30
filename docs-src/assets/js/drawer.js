// ==================== CONTACT DRAWER ====================
const drawer  = document.getElementById('contactDrawer');
const overlay = document.getElementById('drawerOverlay');

function openDrawer() {
  drawer.classList.add('is-open');
  overlay.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  drawer.classList.remove('is-open');
  overlay.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
}

document.getElementById('contactBtn').addEventListener('click', openDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawerCancel').addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);
