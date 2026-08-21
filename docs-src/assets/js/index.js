// ==================== HOMEPAGE FILTER ====================
// Cards are rendered at build time by Hugo. JS only handles show/hide filtering.

const DEBUG_KEY = 'dsce_isDebugMode';
function isDebugMode() { return localStorage.getItem(DEBUG_KEY) === 'true'; }

function segmentTrack(event, props) {
  if (window.analytics) {
    window.analytics.track(event, Object.assign(
      { productCodeType: 'ibm build engineering', productCode: 'dsce2' },
      props
    ));
  }
}

const wrapper = document.getElementById('demo-cards-wrapper');
const resultsCount = document.getElementById('demo-results-count');
const checkboxes = document.querySelectorAll('.filter-cb');
const allCards = Array.from(wrapper.querySelectorAll('.card-item'));

function getActiveFilters() {
  return Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value.toLowerCase());
}

function applyFilter() {
  const active = getActiveFilters();
  const debugOn = isDebugMode();
  let visibleCount = 0;

  allCards.forEach(card => {
    const cardBuildingBlocks = (card.dataset.buildingBlocks || '').split(' ');
    const isLive = card.dataset.islive === 'true';

    // In normal mode hide non-live cards; in debug mode show all
    if (!isLive && !debugOn) {
      card.style.display = 'none';
      return;
    }

    const visible = active.length === 0 || active.every(f => cardBuildingBlocks.includes(f));
    card.style.display = visible ? '' : 'none';
    if (visible) visibleCount += 1;
  });

  if (resultsCount) {
    resultsCount.textContent = `Showing ${visibleCount} demo${visibleCount === 1 ? '' : 's'}`;
  }

  const anyVisible = visibleCount > 0;
  let empty = document.getElementById('cards-empty-state');
  if (!anyVisible) {
    if (!empty) {
      empty = document.createElement('p');
      empty.id = 'cards-empty-state';
      empty.className = 'cards-empty-state';
      empty.textContent = 'No results found. Try changing or clearing some filters.';
      wrapper.after(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}

checkboxes.forEach(cb => cb.addEventListener('change', () => {
  applyFilter();
  const active = getActiveFilters();
  segmentTrack('Filter Applied', { filter_values: active, result_count: parseInt(resultsCount?.textContent) || 0 });
}));

const clearBtn = document.getElementById('clearAllBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    checkboxes.forEach(cb => { cb.checked = false; });
    applyFilter();
    segmentTrack('Filter Cleared', {});
  });
}

// Demo card click tracking
allCards.forEach(card => {
  card.addEventListener('click', () => {
    const name = card.querySelector('.card-item-description div')?.textContent?.trim();
    const href = card.getAttribute('href') || '';
    const slug = href.replace(/.*\/demos\//, '').replace(/\/$/, '');
    const buildingBlocks = (card.dataset.buildingBlocks || '').split(' ').filter(Boolean);
    segmentTrack('Demo Card Clicked', { demo_name: name, demo_slug: slug, building_blocks: buildingBlocks });
  });
});

// Re-run filter when debug mode is toggled from any page
window.addEventListener('dsce:debugModeChange', applyFilter);

applyFilter();
