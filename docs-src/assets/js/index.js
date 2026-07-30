// ==================== HOMEPAGE FILTER ====================
// Cards are rendered at build time by Hugo. JS only handles show/hide filtering.
const wrapper = document.getElementById('demo-cards-wrapper');
const checkboxes = document.querySelectorAll('.filter-cb');
const allCards = Array.from(wrapper.querySelectorAll('.card-item'));

// Asset-type values are resolved from JSON fields at build time, not from tags.
const ASSET_TYPE_VALUES = new Set(['specifications', 'code', 'conceptual']);

function getActiveFilters() {
  return Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value.toLowerCase());
}

function applyFilter() {
  const active = getActiveFilters();
  const activeAssetTypes = active.filter(f => ASSET_TYPE_VALUES.has(f));
  const activeTags = active.filter(f => !ASSET_TYPE_VALUES.has(f));
  let anyVisible = false;

  allCards.forEach(card => {
    const cardBuildingBlocks = (card.dataset.buildingBlocks || '').split(' ');
    const cardAssetTypes = (card.dataset.assetTypes || '').split(' ');

    const tagsMatch = activeTags.length === 0 || activeTags.every(f => cardBuildingBlocks.includes(f));
    const assetMatch = activeAssetTypes.length === 0 || activeAssetTypes.some(f => cardAssetTypes.includes(f));

    const visible = tagsMatch && assetMatch;
    card.style.display = visible ? '' : 'none';
    if (visible) anyVisible = true;
  });

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

checkboxes.forEach(cb => cb.addEventListener('change', applyFilter));

const clearBtn = document.getElementById('clearAllBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    checkboxes.forEach(cb => { cb.checked = false; });
    applyFilter();
  });
}
