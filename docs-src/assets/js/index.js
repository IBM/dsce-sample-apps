// ==================== HOMEPAGE FILTER ====================
// Cards are rendered at build time by Hugo. JS only handles show/hide filtering.
const wrapper = document.getElementById('demo-cards-wrapper');
const checkboxes = document.querySelectorAll('.filter-cb');
const allCards = Array.from(wrapper.querySelectorAll('.card-item'));

function getActiveFilters() {
  return Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value.toLowerCase());
}

function applyFilter() {
  const active = getActiveFilters();
  let anyVisible = false;

  allCards.forEach(card => {
    const cardTags = card.dataset.tags || '';
    const visible =
      active.length === 0 ||
      active.every(f => cardTags.split(' ').includes(f));
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
