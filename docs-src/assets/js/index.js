// ==================== DEMOS PAGE FILTER ====================
// Cards are rendered at build time by Hugo. JS handles show/hide via pill buttons.

const ADMIN_KEY = 'dsce_isAdminMode';
function isAdminMode() { return localStorage.getItem(ADMIN_KEY) === 'true'; }

const wrapper = document.getElementById('demo-cards-wrapper');
const resultsCount = document.getElementById('demo-results-count');
const allCards = wrapper ? Array.from(wrapper.querySelectorAll('.card-item, .demos-featured-card')) : [];

// Pill filter buttons
const pillContainer = document.getElementById('demoFilterPills');
const pills = pillContainer ? Array.from(pillContainer.querySelectorAll('.demos-filter-pill')) : [];

function getActiveBB() {
  const active = pills.find(p => p.classList.contains('is-active'));
  return active ? (active.dataset.bb || '') : '';
}

function applyFilter() {
  const activeBB = getActiveBB();
  const debugOn = isAdminMode();
  let visibleCount = 0;

  allCards.forEach(card => {
    const cardBuildingBlocks = (card.dataset.buildingBlocks || '').split(' ');
    const isLive = card.dataset.islive === 'true';

    if (!isLive && !debugOn) {
      card.style.display = 'none';
      return;
    }

    const visible = !activeBB || cardBuildingBlocks.includes(activeBB);
    card.style.display = visible ? '' : 'none';
    if (visible) visibleCount += 1;
  });

  if (resultsCount) {
    resultsCount.textContent = visibleCount
      ? `Showing ${visibleCount} demo${visibleCount === 1 ? '' : 's'}`
      : '';
  }
}

pills.forEach(pill => {
  pill.addEventListener('click', () => {
    pills.forEach(p => p.classList.remove('is-active'));
    pill.classList.add('is-active');
    applyFilter();
  });
});

// Re-run filter when debug mode is toggled from any page
window.addEventListener('dsce:debugModeChange', applyFilter);

applyFilter();
