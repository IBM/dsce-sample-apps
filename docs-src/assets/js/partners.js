/**
 * Partner Solution Hub — catalog search, dropdown filters and URL state.
 * No framework dependencies. Runs after DOM is ready (defer).
 */
(function () {
  'use strict';

  var grid = document.getElementById('ps-grid');
  var searchInput = document.getElementById('ps-search');
  var countEl = document.getElementById('ps-count');
  var emptyEl = document.getElementById('ps-empty');
  var clearBtn = document.getElementById('ps-clear');
  var clearInlineBtn = document.getElementById('ps-clear-inline');
  var activeFiltersEl = document.getElementById('ps-active-filters');

  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.partner-card'));
  var filterSelects = Array.prototype.slice.call(
    document.querySelectorAll('.partners-inline-select')
  );

  // ── URL state helpers ──────────────────────────────────────────────────────

  function getParams() {
    return new URLSearchParams(location.search);
  }

  function pushParams(params) {
    var str = params.toString();
    var url = str ? location.pathname + '?' + str : location.pathname;
    history.replaceState(null, '', url);
  }

  // ── Read / write state ─────────────────────────────────────────────────────

  function readState() {
    var params = getParams();
    var state = { search: params.get('q') || '', filters: {} };
    filterSelects.forEach(function (sel) {
      var type = sel.dataset.filterType;
      var val = params.get(type) || '';
      state.filters[type] = val;
    });
    return state;
  }

  function applyStateToUI(state) {
    searchInput.value = state.search;
    filterSelects.forEach(function (sel) {
      var type = sel.dataset.filterType;
      sel.value = state.filters[type] || '';
    });
  }

  function writeStateToURL(state) {
    var params = new URLSearchParams();
    if (state.search) params.set('q', state.search);
    Object.keys(state.filters).forEach(function (type) {
      if (state.filters[type]) params.set(type, state.filters[type]);
    });
    pushParams(params);
  }

  // ── Filter and render ──────────────────────────────────────────────────────

  function normalise(str) {
    return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function cardMatchesSearch(card, q) {
    if (!q) return true;
    var searchable = [
      card.dataset.partnerName,
      card.dataset.solutionTitle,
      card.dataset.businessProblem,
      card.dataset.industries,
      card.dataset.products
    ].join(' ');
    return normalise(searchable).indexOf(q) !== -1;
  }

  function cardMatchesFilters(card, filters) {
    return Object.keys(filters).every(function (type) {
      var val = filters[type];
      if (!val) return true;

      if (type === 'industry') {
        var cardIndustries = (card.dataset.industries || '').split(' ');
        return cardIndustries.indexOf(val) !== -1;
      }
      if (type === 'product') {
        var cardProducts = (card.dataset.products || '').split(' ');
        return cardProducts.indexOf(val) !== -1;
      }
      if (type === 'offering') {
        return card.dataset.offering === val;
      }
      return true;
    });
  }

  function hasAnyFilter(state) {
    if (state.search) return true;
    return Object.keys(state.filters).some(function (k) { return !!state.filters[k]; });
  }

  function render(state) {
    var q = normalise(state.search);
    var visible = 0;

    cards.forEach(function (card) {
      var show = cardMatchesSearch(card, q) && cardMatchesFilters(card, state.filters);
      card.hidden = !show;
      if (show) visible++;
    });

    // Update count
    if (countEl) {
      countEl.textContent = visible + (visible === 1 ? ' illustrative solution' : ' illustrative solutions');
    }

    // Empty state
    if (emptyEl) {
      emptyEl.hidden = visible > 0;
    }

    // Clear link visibility
    if (clearBtn) {
      clearBtn.style.display = hasAnyFilter(state) ? '' : 'none';
    }
  }

  // ── Collect current state from UI ──────────────────────────────────────────

  function collectState() {
    var state = { search: searchInput.value, filters: {} };
    filterSelects.forEach(function (sel) {
      var type = sel.dataset.filterType;
      state.filters[type] = sel.value;
    });
    return state;
  }

  function onChange() {
    var state = collectState();
    writeStateToURL(state);
    render(state);
  }

  function clearAll(e) {
    if (e) e.preventDefault();
    searchInput.value = '';
    filterSelects.forEach(function (sel) { sel.value = ''; });
    onChange();
    searchInput.focus();
  }

  // ── Event listeners ────────────────────────────────────────────────────────

  searchInput.addEventListener('input', onChange);

  filterSelects.forEach(function (sel) {
    sel.addEventListener('change', onChange);
  });

  if (clearBtn) clearBtn.addEventListener('click', clearAll);
  if (clearInlineBtn) clearInlineBtn.addEventListener('click', clearAll);

  // Browser back / forward restores filter state
  window.addEventListener('popstate', function () {
    var state = readState();
    applyStateToUI(state);
    render(state);
  });

  // ── Initialise from URL ────────────────────────────────────────────────────

  var initialState = readState();
  applyStateToUI(initialState);
  render(initialState);

})();
