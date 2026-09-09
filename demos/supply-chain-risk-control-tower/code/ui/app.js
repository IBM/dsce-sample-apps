/**
 * Supply Chain Risk Control Tower — Simulation + Live Kafka Engine
 * IBM Carbon Design UI · Pure JS, no dependencies
 *
 * MODES
 *   SIM  — pure in-browser generator (no server needed)
 *   LIVE — events come from kafka_bridge.py via Server-Sent Events
 *          The bridge also controls scrc.producer + scrc.risk_engine as
 *          sub-processes so every event flows through real Kafka topics.
 */

// ── Risk Scoring (mirrors src/scrc/risk_logic.py exactly) ──────────────────

const RISK_BAND = score =>
  score >= 85 ? 'CRITICAL' : score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';

function calcDaysOfSupply(inv) {
  if (!inv) return 0;
  const avail = Math.max((inv.on_hand_qty || 0) - (inv.reserved_qty || 0), 0);
  const daily = inv.daily_usage_qty || 0;
  if (daily <= 0) return avail > 0 ? 999 : 0;
  return Math.round((avail / daily) * 100) / 100;
}

function chooseTopOrder(orders) {
  if (!orders || !orders.length) return null;
  const rank = { STRATEGIC: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return orders.reduce((best, o) =>
    (rank[o.priority] || 1) > (rank[best.priority] || 1) ||
    ((rank[o.priority] || 1) === (rank[best.priority] || 1) && (o.revenue_at_risk || 0) > (best.revenue_at_risk || 0))
      ? o : best);
}

function findAlternate(componentId, primaryId, suppliers) {
  return Object.values(suppliers)
    .filter(s => s.supplier_id !== primaryId && (s.alternate_for_components || []).includes(componentId))
    .sort((a, b) => (b.reliability_score || 0) - (a.reliability_score || 0))[0] || null;
}

function scoreComponent(componentId, state) {
  const inv = state.inventory[componentId];
  const comp = state.components[componentId] || {};
  const relShipments = Object.values(state.shipments).filter(s => s.component_id === componentId && s.status !== 'DELIVERED');
  const relPOs = Object.values(state.pos).filter(po => po.component_id === componentId);
  const custOrder = chooseTopOrder(state.customerOrders[componentId] || []);

  const daysSupply = calcDaysOfSupply(inv);
  const maxDelayHours = relShipments.length ? Math.max(...relShipments.map(s => s.delay_hours || 0)) : 0;
  const maxDelayDays = maxDelayHours / 24;

  let primarySupplierId = null;
  if (relShipments.length) {
    primarySupplierId = relShipments.reduce((a, b) => (b.delay_hours || 0) > (a.delay_hours || 0) ? b : a).supplier_id;
  } else if (relPOs.length) {
    primarySupplierId = relPOs[relPOs.length - 1].supplier_id;
  }

  const supplier = state.suppliers[primarySupplierId] || {};
  const reliability = supplier.reliability_score != null ? supplier.reliability_score : 100;

  const routeIds = new Set(relShipments.map(s => s.route_id).filter(Boolean));
  const extEvents = state.externalRisk.filter(e => routeIds.has(e.route_id));
  const maxExtSeverity = extEvents.length ? Math.max(...extEvents.map(e => e.severity || 0)) : 0;
  const extDelayHours = extEvents.length ? Math.max(...extEvents.map(e => e.expected_delay_hours || 0)) : 0;

  // ── Factor scoring ──
  let inventoryRisk = 0;
  if (daysSupply <= 0) inventoryRisk = 35;
  else if (daysSupply < Math.max(maxDelayDays, 1)) inventoryRisk = 35;
  else if (daysSupply < 3) inventoryRisk = 25;
  else if (daysSupply < 7) inventoryRisk = 15;

  const shipmentDelayRisk = Math.min(30, Math.floor(maxDelayHours / 3));

  let supplierRisk = 0;
  if (reliability < 70) supplierRisk = 20;
  else if (reliability < 80) supplierRisk = 15;
  else if (reliability < 90) supplierRisk = 8;

  const custPriority = custOrder ? custOrder.priority : 'LOW';
  const revAtRisk = custOrder ? (custOrder.revenue_at_risk || 0) : 0;
  let custImpactRisk = 0;
  if (custPriority === 'STRATEGIC') custImpactRisk = 20;
  else if (custPriority === 'HIGH') custImpactRisk = 15;
  else if (revAtRisk >= 250000) custImpactRisk = 10;

  const externalEventRisk = Math.min(20, maxExtSeverity * 4 + Math.floor(extDelayHours / 12));

  const altSupplier = findAlternate(componentId, primarySupplierId, state.suppliers);
  let mitigationCredit = 0;
  if (altSupplier) mitigationCredit += 10;
  if (['LOW', 'MEDIUM'].includes(comp.criticality)) mitigationCredit += 5;

  const rawScore = inventoryRisk + shipmentDelayRisk + supplierRisk + custImpactRisk + externalEventRisk - mitigationCredit;
  const score = Math.max(0, Math.min(100, rawScore));
  const band = RISK_BAND(score);

  const rootCause = determineRootCause(inventoryRisk, shipmentDelayRisk, supplierRisk, externalEventRisk, daysSupply, maxDelayHours);

  return {
    risk_id: 'RISK-' + Math.random().toString(36).substr(2, 10).toUpperCase(),
    component_id: componentId,
    supplier_id: primarySupplierId,
    customer_order_id: custOrder ? custOrder.customer_order_id : null,
    risk_score: score,
    risk_band: band,
    root_cause: rootCause,
    days_of_supply: daysSupply,
    max_delay_hours: maxDelayHours,
    scoring_factors: { inventoryRisk, shipmentDelayRisk, supplierRisk, custImpactRisk, externalEventRisk, mitigationCredit, reliability, extDelayHours, altSupplier: altSupplier ? altSupplier.supplier_id : null },
    event_time: new Date().toISOString(),
    customer_order: custOrder,
    alt_supplier: altSupplier,
  };
}

function determineRootCause(invR, shipR, supR, extR, days, delayH) {
  if (invR >= 25 && shipR >= 20) return 'Shipment delay exceeds available inventory coverage';
  if (invR >= 25) return `Inventory coverage is low at ${days} days of supply`;
  if (shipR >= 20) return `Shipment ETA has slipped by ${delayH} hours`;
  if (extR >= 12) return 'External route or regional disruption is increasing supply risk';
  if (supR >= 15) return 'Supplier reliability risk is elevated';
  return 'Risk is currently within monitored thresholds';
}

function buildRecommendation(risk, state) {
  const custOrder = risk.customer_order;
  const alt = risk.alt_supplier;
  let customerText = 'No high-priority customer order is currently linked.';
  if (custOrder) {
    customerText = `Customer order ${custOrder.customer_order_id} for ${custOrder.customer_name} is ${custOrder.priority} priority with $${(custOrder.revenue_at_risk || 0).toLocaleString()} revenue at risk.`;
  }
  let action = '';
  if (['CRITICAL', 'HIGH'].includes(risk.risk_band)) {
    if (alt) action = `Allocate current stock to highest-priority demand, source partial quantity from alternate supplier ${alt.supplier_id}, expedite the delayed shipment, and notify procurement and planning.`;
    else action = 'Allocate current stock to highest-priority demand, expedite the delayed shipment, request confirmed supplier recovery ETA, and prepare production schedule adjustment.';
  } else if (risk.risk_band === 'MEDIUM') {
    action = 'Notify planner, monitor ETA changes, and confirm supplier recovery plan.';
  } else {
    action = 'Continue monitoring. No immediate action required.';
  }
  return {
    recommendation_id: 'REC-' + Math.random().toString(36).substr(2, 10).toUpperCase(),
    risk_id: risk.risk_id,
    component_id: risk.component_id,
    customer_order_id: risk.customer_order_id,
    risk_band: risk.risk_band,
    business_impact: customerText,
    recommended_action: action,
    confidence: ['CRITICAL', 'HIGH'].includes(risk.risk_band) ? 0.86 : 0.72,
    event_time: risk.event_time,
  };
}

// ── Simulation State ────────────────────────────────────────────────────────

const SIM = {
  running: false,
  scenario: 'supplier_delay',
  eventBatches: 12,
  batchInterval: 1200,
  timer: null,
  batchIndex: 0,
  totalEvents: 0,
  state: {
    suppliers: {}, components: {}, inventory: {},
    pos: {}, shipments: {}, customerOrders: {}, externalRisk: [],
  },
  latestRisks: {},
  latestRecs: {},
  allRisks: [],
  eventLog: [],
};

// ── Reference Data (base) ───────────────────────────────────────────────────

function baseReferenceEvents() {
  const now = (h = 0) => new Date(Date.now() + h * 3600000).toISOString();
  return [
    ['supplier_profiles', 'SUP-1007', { supplier_id: 'SUP-1007', supplier_name: 'Pacific Motion Components', region: 'APAC', country: 'Taiwan', reliability_score: 74, risk_tier: 'HIGH', preferred: true, alternate_for_components: [], last_updated: now() }],
    ['supplier_profiles', 'SUP-221',  { supplier_id: 'SUP-221',  supplier_name: 'Midwest Precision Supply',   region: 'US-MIDWEST', country: 'United States', reliability_score: 91, risk_tier: 'LOW', preferred: false, alternate_for_components: ['BRG-9004', 'CTRL-4400'], last_updated: now() }],
    ['component_master', 'BRG-9004',  { component_id: 'BRG-9004', component_name: 'High-load bearing assembly',   criticality: 'CRITICAL', lead_time_days: 21, approved_suppliers: ['SUP-1007','SUP-221'], safety_stock_qty: 600, last_updated: now() }],
    ['component_master', 'CTRL-4400', { component_id: 'CTRL-4400', component_name: 'Industrial controller board', criticality: 'HIGH',     lead_time_days: 28, approved_suppliers: ['SUP-221'], safety_stock_qty: 120, last_updated: now() }],
    ['customer_orders',  'CO-10491',  { event_id: 'EVT-REF-001', customer_order_id: 'CO-10491', customer_name: 'NorthStar Energy Systems', component_id: 'BRG-9004', required_qty: 900, committed_ship_date: now(96), priority: 'STRATEGIC', revenue_at_risk: 750000, event_time: now() }],
  ];
}

function* batchGenerator(scenario, count) {
  yield* baseReferenceEvents();
  const now = (h = 0) => new Date(Date.now() + h * 3600000).toISOString();
  const shipStatuses  = ['IN_TRANSIT', 'AT_PORT', 'CUSTOMS_HOLD', 'DELAYED'];
  const delaySeq      = [12, 24, 48, 72, 96];
  const invSeq        = [760, 640, 520, 410, 310, 260];
  const extSevSeq     = [2, 3, 4, 5];

  for (let i = 0; i < count; i++) {
    let delayH, onHand, extSev;
    if (scenario === 'recovery' && i > Math.floor(count / 2)) {
      delayH = 12; onHand = 820; extSev = 1;
    } else if (scenario === 'inventory_drop') {
      delayH = delaySeq[i % delaySeq.length];
      onHand = [480, 360, 240, 180, 120, 80, 40, 20][i % 8];
      extSev = 2;
    } else if (scenario === 'port_congestion') {
      delayH = delaySeq[i % delaySeq.length];
      onHand = invSeq[i % invSeq.length];
      extSev = extSevSeq[i % extSevSeq.length];
    } else {
      delayH = delaySeq[i % delaySeq.length];
      onHand = invSeq[i % invSeq.length];
      extSev = extSevSeq[i % extSevSeq.length];
    }

    yield ['purchase_orders', 'PO-77881', { event_id: 'EVT-' + i + '-PO', po_id: 'PO-77881', component_id: 'BRG-9004', supplier_id: 'SUP-1007', ordered_qty: 1200, committed_eta: now(72), status: delayH >= 48 ? 'DELAYED' : 'IN_TRANSIT', event_time: now() }];
    yield ['shipments', 'SHP-33019', { event_id: 'EVT-' + i + '-SHP', shipment_id: 'SHP-33019', po_id: 'PO-77881', supplier_id: 'SUP-1007', component_id: 'BRG-9004', carrier: 'OceanBridge Logistics', status: shipStatuses[i % shipStatuses.length], current_location: 'Port of Los Angeles', eta: now(72 + delayH), delay_hours: delayH, route_id: 'ROUTE-APAC-LAX-CHI', event_time: now() }];
    yield ['inventory_levels', 'BRG-9004', { event_id: 'EVT-' + i + '-INV', component_id: 'BRG-9004', site_id: 'PLANT-CHICAGO-01', on_hand_qty: onHand, reserved_qty: 180, safety_stock_qty: 600, daily_usage_qty: 150, event_time: now() }];
    if (['supplier_delay', 'port_congestion', 'recovery'].includes(scenario)) {
      yield ['external_risk_events', `EXT-PORT-${i}`, { event_id: 'EVT-' + i + '-EXT', risk_event_id: `EXT-PORT-${String(i).padStart(4,'0')}`, event_type: 'PORT', region: 'US-WEST', country: 'United States', route_id: 'ROUTE-APAC-LAX-CHI', severity: extSev, description: 'Port congestion increasing container dwell time on APAC to Midwest route', expected_delay_hours: extSev * 12, event_time: now() }];
    }
  }
}

// ── State Update ────────────────────────────────────────────────────────────

function processEvent(topic, key, event) {
  const s = SIM.state;
  let affected = new Set();
  switch (topic) {
    case 'supplier_profiles':
      s.suppliers[event.supplier_id] = event;
      (event.alternate_for_components || []).forEach(c => affected.add(c));
      break;
    case 'component_master':
      s.components[event.component_id] = event;
      affected.add(event.component_id); break;
    case 'inventory_levels':
      s.inventory[event.component_id] = event;
      affected.add(event.component_id); break;
    case 'purchase_orders':
      s.pos[event.po_id] = event;
      affected.add(event.component_id); break;
    case 'shipments':
      s.shipments[event.shipment_id] = event;
      affected.add(event.component_id); break;
    case 'customer_orders':
      if (!s.customerOrders[event.component_id]) s.customerOrders[event.component_id] = [];
      s.customerOrders[event.component_id] = s.customerOrders[event.component_id]
        .filter(o => o.customer_order_id !== event.customer_order_id);
      s.customerOrders[event.component_id].push(event);
      affected.add(event.component_id); break;
    case 'external_risk_events':
      s.externalRisk.push(event);
      if (s.externalRisk.length > 100) s.externalRisk.shift();
      const impacted = new Set([event.route_id]);
      Object.values(s.shipments).forEach(sh => { if (impacted.has(sh.route_id)) affected.add(sh.component_id); });
      break;
  }
  return affected;
}

function canScore(componentId) {
  return SIM.state.inventory[componentId] && SIM.state.components[componentId];
}

// ── Simulation Loop ─────────────────────────────────────────────────────────

let _gen = null;
let _genDone = false;

function startSimulation() {
  if (SIM.running) return;
  SIM.running = true;
  SIM.batchIndex = 0;
  SIM.totalEvents = 0;
  SIM.state = { suppliers: {}, components: {}, inventory: {}, pos: {}, shipments: {}, customerOrders: {}, externalRisk: [] };
  SIM.latestRisks = {}; SIM.latestRecs = {}; SIM.allRisks = []; SIM.eventLog = [];
  _gen = batchGenerator(SIM.scenario, SIM.eventBatches);
  _genDone = false;

  updateLiveBadge(true);
  updateKPIs();
  clearEventStream();
  clearControlTower();

  showToast('Simulation started', `Scenario: ${SCENARIOS[SIM.scenario].label} · ${SIM.eventBatches} batches`, 'success');

  SIM.timer = setInterval(tickSimulation, SIM.batchInterval);
}

function stopSimulation() {
  if (SIM.timer) { clearInterval(SIM.timer); SIM.timer = null; }
  SIM.running = false;
  updateLiveBadge(false);
  showToast('Simulation paused', `Processed ${SIM.totalEvents} events`, 'info');
}

function resetSimulation() {
  stopSimulation();
  SIM.state = { suppliers: {}, components: {}, inventory: {}, pos: {}, shipments: {}, customerOrders: {}, externalRisk: [] };
  SIM.latestRisks = {}; SIM.latestRecs = {}; SIM.allRisks = [];
  SIM.eventLog = []; SIM.totalEvents = 0; SIM.batchIndex = 0;
  _gen = null; _genDone = false;
  updateKPIs(); clearEventStream(); clearControlTower();
  renderTrendChart(); renderFactorChart();
  updateScenarioProgress(0);
  showToast('Reset', 'Simulation state cleared', 'info');
}

function tickSimulation() {
  if (_genDone || !_gen) { stopSimulation(); return; }
  const result = _gen.next();
  if (result.done) { _genDone = true; stopSimulation(); showToast('Complete', 'All events processed', 'success'); return; }

  const [topicKey, key, event] = result.value;
  const topic = TOPIC_MAP[topicKey] || topicKey;
  SIM.totalEvents++;

  // Log
  logEvent(topic, key, event);

  // Process
  const affected = processEvent(topicKey, key, event);

  // Score affected components
  for (const compId of [...affected].sort()) {
    if (!canScore(compId)) continue;
    const risk = scoreComponent(compId, SIM.state);
    const rec  = buildRecommendation(risk, SIM.state);
    SIM.latestRisks[compId] = risk;
    SIM.latestRecs[risk.risk_id] = rec;
    SIM.allRisks.push({ ...risk, seq: SIM.totalEvents });

    logOutput(risk, rec);
    renderRiskCard(compId, risk, rec);

    if (['CRITICAL', 'HIGH'].includes(risk.risk_band)) {
      showToast(risk.risk_band, `${compId} · Score ${risk.risk_score} · ${risk.root_cause}`,
        risk.risk_band === 'CRITICAL' ? 'critical' : 'high');
    }
  }

  SIM.batchIndex++;
  updateKPIs();
  renderTrendChart();
  renderFactorChart();
  updateScenarioProgress((SIM.batchIndex / (SIM.eventBatches + 5)) * 100);
}

// ── Topic Map ───────────────────────────────────────────────────────────────
const TOPIC_MAP = {
  supplier_profiles: 'supplier_profiles', component_master: 'component_master',
  purchase_orders: 'purchase_orders', shipments: 'shipments',
  inventory_levels: 'inventory_levels', customer_orders: 'customer_orders',
  external_risk_events: 'external_risk_events',
};

// ── Scenarios ────────────────────────────────────────────────────────────────
const SCENARIOS = {
  supplier_delay: {
    label: 'Supplier Delay + Port Congestion',
    icon: '🚢',
    description: 'Primary supplier shipment delays compound with LA port congestion, draining inventory below safety stock for a $750K strategic customer order.',
    tags: ['Supplier Risk', 'Shipment Delay', 'Port', 'CRITICAL'],
    color: 'var(--risk-critical)',
  },
  port_congestion: {
    label: 'Port Congestion',
    icon: '⚓',
    description: 'Route-level external events at the Port of Los Angeles increase expected transit delay across the APAC-Midwest corridor.',
    tags: ['External Risk', 'Port', 'HIGH'],
    color: 'var(--risk-high)',
  },
  inventory_drop: {
    label: 'Rapid Inventory Drop',
    icon: '📦',
    description: 'Daily consumption outpaces replenishment. Inventory rapidly falls through safety stock while shipment ETA remains uncertain.',
    tags: ['Inventory', 'Safety Stock', 'HIGH'],
    color: 'var(--risk-high)',
  },
  recovery: {
    label: 'Recovery Scenario',
    icon: '✅',
    description: 'Alternate supplier activates, expedited shipment reduces delay. Observe risk band transition from CRITICAL → HIGH → MEDIUM.',
    tags: ['Recovery', 'Alt Supplier', 'MEDIUM'],
    color: 'var(--risk-medium)',
  },
};

// ── DOM Helpers ──────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);

function bandClass(band) {
  return { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' }[band] || 'low';
}
function bandTagHtml(band) {
  return `<span class="tag tag-${bandClass(band)}">${band}</span>`;
}
function bandColor(band) {
  return { CRITICAL: 'var(--risk-critical)', HIGH: 'var(--risk-high)', MEDIUM: 'var(--risk-medium)', LOW: 'var(--risk-low)' }[band] || 'var(--cds-text-secondary)';
}

// ── KPI Panel ────────────────────────────────────────────────────────────────

function updateKPIs() {
  const risks = Object.values(SIM.latestRisks);
  const critical = risks.filter(r => r.risk_band === 'CRITICAL').length;
  const high     = risks.filter(r => r.risk_band === 'HIGH').length;
  const avgScore = risks.length ? Math.round(risks.reduce((a,r)=>a+r.risk_score,0)/risks.length) : 0;
  const maxDelay = Math.max(0, ...Object.values(SIM.state.shipments).map(s => s.delay_hours || 0));
  const inv = SIM.state.inventory['BRG-9004'];
  const dos  = inv ? calcDaysOfSupply(inv) : '—';

  setKPI('kpi-events',   SIM.totalEvents);
  setKPI('kpi-critical', critical);
  setKPI('kpi-high',     high);
  setKPI('kpi-avgscore', avgScore || '—');
  setKPI('kpi-delay',    maxDelay ? `${maxDelay}h` : '—');
  setKPI('kpi-dos',      typeof dos === 'number' ? dos.toFixed(1) : dos);
}

function setKPI(id, val) {
  const el = $(id);
  if (!el) return;
  if (el.textContent !== String(val)) {
    el.textContent = val;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 400);
  }
}

// ── Event Stream Log ─────────────────────────────────────────────────────────

function logEvent(topic, key, event) {
  const feed = $('stream-input');
  if (!feed) return;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const delay = event.delay_hours || event.expected_delay_hours;
  const sClass = ['supply_chain_risk_scores','supply_chain_recommendations','control_tower_alerts'].includes(topic) ? 's-output'
    : event.delay_hours >= 72 ? 's-critical'
    : event.delay_hours >= 48 ? 's-high' : '';

  const entry = document.createElement('div');
  entry.className = `stream-entry ${sClass}`;
  entry.innerHTML = `<span class="st-time">${time}</span><span class="st-topic">${topic}</span><span class="st-key">${key}</span><span class="st-val">${summariseEvent(event)}</span>`;
  feed.appendChild(entry);
  if (feed.children.length > 200) feed.removeChild(feed.firstChild);
  feed.scrollTop = feed.scrollHeight;

  SIM.eventLog.push({ time, topic, key, event, summary: summariseEvent(event) });
}

function logOutput(risk, rec) {
  const feed = $('stream-output');
  if (!feed) return;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const sClass = risk.risk_band === 'CRITICAL' ? 's-critical' : risk.risk_band === 'HIGH' ? 's-high' : 's-output';

  ['supply_chain_risk_scores', 'control_tower_alerts'].forEach(t => {
    const entry = document.createElement('div');
    entry.className = `stream-entry ${sClass}`;
    entry.innerHTML = `<span class="st-time">${time}</span><span class="st-topic">${t}</span><span class="st-key">${risk.risk_id}</span><span class="st-val">${risk.risk_band} score=${risk.risk_score} dos=${risk.days_of_supply}</span>`;
    feed.appendChild(entry);
  });
  if (feed.children.length > 200) feed.removeChild(feed.firstChild);
  feed.scrollTop = feed.scrollHeight;
}

function summariseEvent(ev) {
  const parts = [];
  if (ev.status) parts.push(`status=${ev.status}`);
  if (ev.delay_hours != null) parts.push(`delay=${ev.delay_hours}h`);
  if (ev.on_hand_qty != null) parts.push(`on_hand=${ev.on_hand_qty}`);
  if (ev.severity != null) parts.push(`severity=${ev.severity}`);
  if (ev.reliability_score != null) parts.push(`reliability=${ev.reliability_score}`);
  if (ev.priority) parts.push(`priority=${ev.priority}`);
  if (ev.component_id && !parts.length) parts.push(ev.component_id);
  return parts.length ? parts.join(' ') : JSON.stringify(ev).slice(0, 60);
}

function clearEventStream() {
  const f1 = $('stream-input'); if (f1) f1.innerHTML = '';
  const f2 = $('stream-output'); if (f2) f2.innerHTML = '';
}

// ── Control Tower Cards ──────────────────────────────────────────────────────

function clearControlTower() {
  const grid = $('risk-cards-grid');
  if (grid) grid.innerHTML = '<p class="text-secondary text-sm" style="padding:.5rem">No risk events yet. Start a scenario to begin.</p>';
}

function renderRiskCard(componentId, risk, rec) {
  const grid = $('risk-cards-grid');
  if (!grid) return;

  // Record history for drawer Timeline tab
  drawerRecordHistory(componentId, risk, rec);

  // Remove placeholder
  const placeholder = grid.querySelector('p');
  if (placeholder) placeholder.remove();

  const existing = grid.querySelector(`[data-component="${componentId}"]`);
  const f = risk.scoring_factors;

  const scoreBarColor = bandColor(risk.risk_band);
  const factorHtml = [
    { n: 'Inventory Risk',  v: f.inventoryRisk,      cls: f.inventoryRisk >= 25 ? 'fv-crit' : f.inventoryRisk >= 15 ? 'fv-high' : 'fv-ok' },
    { n: 'Shipment Delay',  v: f.shipmentDelayRisk,  cls: f.shipmentDelayRisk >= 20 ? 'fv-crit' : f.shipmentDelayRisk >= 10 ? 'fv-high' : 'fv-ok' },
    { n: 'Supplier Risk',   v: f.supplierRisk,       cls: f.supplierRisk >= 15 ? 'fv-high' : 'fv-ok' },
    { n: 'Customer Impact', v: f.custImpactRisk,     cls: f.custImpactRisk >= 15 ? 'fv-crit' : 'fv-ok' },
    { n: 'External Risk',   v: f.externalEventRisk,  cls: f.externalEventRisk >= 12 ? 'fv-high' : 'fv-ok' },
    { n: 'Mitigation Credit', v: f.mitigationCredit ? `-${f.mitigationCredit}` : 0, cls: 'fv-credit' },
  ].map(it => `<div class="factor-item"><div class="factor-name">${it.n}</div><div class="factor-val ${it.cls}">${it.v}</div></div>`).join('');

  const html = `
    <div class="risk-card ${bandClass(risk.risk_band)} pulse"
         data-component="${componentId}"
         onclick="openRiskDrawer('${componentId}')"
         title="Click to open risk detail">
      <div class="flex-between mb-1">
        <h3>${componentId}</h3>
        ${bandTagHtml(risk.risk_band)}
      </div>
      <div class="meta">
        <span class="tag tag-blue">Score: ${risk.risk_score}</span>
        ${risk.supplier_id ? `<span class="tag tag-teal">${risk.supplier_id}</span>` : ''}
        ${risk.customer_order_id ? `<span class="tag tag-purple">${risk.customer_order_id}</span>` : ''}
      </div>
      <div class="risk-score-bar-wrap mb-2">
        <div class="risk-score-bar-track">
          <div class="risk-score-bar-fill" style="width:${risk.risk_score}%;background:${scoreBarColor}"></div>
        </div>
        <span class="risk-score-num" style="color:${scoreBarColor}">${risk.risk_score}</span>
      </div>
      <div class="root-cause"><strong>Root cause:</strong> ${risk.root_cause}</div>
      <div class="root-cause"><strong>Days of supply:</strong> ${risk.days_of_supply} &nbsp;·&nbsp; <strong>Max delay:</strong> ${risk.max_delay_hours}h</div>
      <div class="factor-grid">${factorHtml}</div>
      <div class="action-box mt-2">
        <strong>Recommended action:</strong> ${rec.recommended_action}
      </div>
      <div class="flex-between mt-1">
        <span class="card-click-hint">Click to open detail →</span>
        <span class="text-xs text-secondary">${risk.event_time.replace('T',' ').replace('Z','')}</span>
      </div>
    </div>`;

  if (existing) {
    existing.outerHTML = html;
  } else {
    grid.insertAdjacentHTML('afterbegin', html);
  }
}

// ── Charts ───────────────────────────────────────────────────────────────────

let trendChart = null, factorChart = null;

function renderTrendChart() {
  const canvas = $('trend-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const allRisks = SIM.allRisks;
  if (!allRisks.length) { ctx.clearRect(0,0,canvas.width,canvas.height); return; }

  // Group by component
  const byComp = {};
  allRisks.forEach(r => { if (!byComp[r.component_id]) byComp[r.component_id] = []; byComp[r.component_id].push(r); });

  const COMP_COLORS = ['#78a9ff','#42be65','#ff832b','#be95ff','#08bdba'];
  const W = canvas.clientWidth, H = canvas.height;
  canvas.width = W;

  ctx.clearRect(0, 0, W, H);
  const padL = 36, padR = 16, padT = 10, padB = 28;
  const chartW = W - padL - padR, chartH = H - padT - padB;

  // Grid lines
  ctx.strokeStyle = '#393939'; ctx.lineWidth = 1;
  [0, 25, 50, 70, 85, 100].forEach(y => {
    const cy = padT + chartH - (y / 100) * chartH;
    ctx.beginPath(); ctx.moveTo(padL, cy); ctx.lineTo(padL + chartW, cy); ctx.stroke();
    ctx.fillStyle = '#525252'; ctx.font = '10px IBM Plex Mono,monospace';
    ctx.fillText(y, 2, cy + 4);
  });

  // Lines per component
  let colIdx = 0;
  for (const [comp, risks] of Object.entries(byComp)) {
    const color = COMP_COLORS[colIdx++ % COMP_COLORS.length];
    const maxSeq = Math.max(...allRisks.map(r => r.seq));
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
    risks.forEach((r, i) => {
      const x = padL + (r.seq / Math.max(maxSeq, 1)) * chartW;
      const y = padT + chartH - (r.risk_score / 100) * chartH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    risks.slice(-1).forEach(r => {
      const x = padL + (r.seq / Math.max(maxSeq, 1)) * chartW;
      const y = padT + chartH - (r.risk_score / 100) * chartH;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    });
  }

  // Risk band reference lines
  const bands = [{ y: 85, c: 'rgba(250,77,86,.35)', l: 'CRITICAL' }, { y: 70, c: 'rgba(255,131,43,.3)', l: 'HIGH' }, { y: 40, c: 'rgba(241,194,27,.2)', l: 'MEDIUM' }];
  bands.forEach(b => {
    const cy = padT + chartH - (b.y / 100) * chartH;
    ctx.strokeStyle = b.c; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(padL, cy); ctx.lineTo(padL + chartW, cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = b.c.replace(/[\d.]+\)$/, '0.8)'); ctx.font = '9px IBM Plex Sans,sans-serif';
    ctx.fillText(b.l, padL + chartW - 44, cy - 3);
  });
}

function renderFactorChart() {
  const canvas = $('factor-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const latest = Object.values(SIM.latestRisks);
  if (!latest.length) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

  const risk = latest.sort((a,b) => b.risk_score - a.risk_score)[0];
  const f = risk.scoring_factors;
  const factors = [
    { label: 'Inventory', value: f.inventoryRisk, color: '#fa4d56' },
    { label: 'Shipment',  value: f.shipmentDelayRisk, color: '#ff832b' },
    { label: 'Supplier',  value: f.supplierRisk, color: '#f1c21b' },
    { label: 'Customer',  value: f.custImpactRisk, color: '#be95ff' },
    { label: 'External',  value: f.externalEventRisk, color: '#33b1ff' },
    { label: 'Mitigation', value: -(f.mitigationCredit), color: '#08bdba' },
  ];

  const W = canvas.clientWidth, H = canvas.height;
  canvas.width = W;
  ctx.clearRect(0, 0, W, H);
  const padL = 70, padR = 20, padT = 10, padB = 10;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const barH = Math.floor(chartH / factors.length) - 4;
  const maxVal = 35;

  factors.forEach((f, i) => {
    const y = padT + i * (barH + 4);
    const bw = Math.abs(f.value) / maxVal * chartW;

    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(padL, y, chartW, barH);

    ctx.fillStyle = f.color;
    ctx.fillRect(padL, y, Math.max(bw, 2), barH);

    ctx.fillStyle = '#c6c6c6'; ctx.font = '11px IBM Plex Sans,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(f.label, padL - 6, y + barH / 2 + 4);

    ctx.fillStyle = '#f4f4f4'; ctx.textAlign = 'left'; ctx.font = '10px IBM Plex Mono,monospace';
    ctx.fillText(f.value < 0 ? f.value : `+${f.value}`, padL + bw + 4, y + barH / 2 + 4);
  });
}

// ── Navigation ───────────────────────────────────────────────────────────────

let navCollapsed = false;

function navigate(pageId) {
  qsa('.page').forEach(p => p.classList.remove('active'));
  qsa('.nav-item').forEach(n => n.classList.remove('active'));
  qsa('.header-nav a').forEach(a => a.classList.remove('active'));

  const page = $(pageId);
  if (page) page.classList.add('active');

  qsa(`[data-page="${pageId}"]`).forEach(el => el.classList.add('active'));
  qsa(`.header-nav [data-page="${pageId}"]`).forEach(el => el.classList.add('active'));

  // Resize charts when navigating to Analytics
  if (pageId === 'page-analytics') { setTimeout(renderTrendChart, 50); setTimeout(renderFactorChart, 50); }
}

function toggleNav() {
  navCollapsed = !navCollapsed;
  const nav = qs('.side-nav');
  const main = qs('.main-content');
  nav.classList.toggle('collapsed', navCollapsed);
  main.classList.toggle('nav-collapsed', navCollapsed);
}

// ── Tab System ───────────────────────────────────────────────────────────────

function initTabs(containerId) {
  const container = $(containerId);
  if (!container) return;
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === target));
      container.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === target));
    });
  });
}

// ── Accordion ────────────────────────────────────────────────────────────────

function initAccordions() {
  qsa('.acc-header').forEach(h => {
    h.addEventListener('click', () => {
      h.closest('.acc-item').classList.toggle('open');
    });
  });
}

// ── Toast ────────────────────────────────────────────────────────────────────

function showToast(title, msg, type = 'info') {
  const iconMap = {
    critical: `<svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 2L2 28h28L16 2z" fill="none" stroke="var(--risk-critical)" stroke-width="2"/><line x1="16" y1="12" x2="16" y2="20" stroke="var(--risk-critical)" stroke-width="2"/><circle cx="16" cy="24" r="1" fill="var(--risk-critical)"/></svg>`,
    high:     `<svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M16 2L2 28h28L16 2z" fill="none" stroke="var(--risk-high)" stroke-width="2"/><line x1="16" y1="12" x2="16" y2="20" stroke="var(--risk-high)" stroke-width="2"/><circle cx="16" cy="24" r="1" fill="var(--risk-high)"/></svg>`,
    success:  `<svg width="20" height="20" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="var(--ibm-green-40)" stroke-width="2"/><polyline points="10,16 14,20 22,12" stroke="var(--ibm-green-40)" stroke-width="2" fill="none"/></svg>`,
    info:     `<svg width="20" height="20" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="var(--ibm-blue-40)" stroke-width="2"/><line x1="16" y1="14" x2="16" y2="22" stroke="var(--ibm-blue-40)" stroke-width="2"/><circle cx="16" cy="10" r="1.5" fill="var(--ibm-blue-40)"/></svg>`,
    warning:  `<svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M16 2L2 28h28L16 2z" fill="none" stroke="var(--ibm-yellow-30)" stroke-width="2"/><line x1="16" y1="12" x2="16" y2="20" stroke="var(--ibm-yellow-30)" stroke-width="2"/><circle cx="16" cy="24" r="1" fill="var(--ibm-yellow-30)"/></svg>`,
  };
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<div class="toast-icon">${iconMap[type] || iconMap.info}</div><div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; el.style.transition = '.2s'; setTimeout(() => el.remove(), 200); }, 4000);
}

// ── Live Badge ───────────────────────────────────────────────────────────────

function updateLiveBadge(live) {
  const badge = $('live-badge');
  if (!badge) return;
  if (live) { badge.classList.remove('paused'); badge.querySelector('.live-dot').style.animation = ''; badge.querySelector('.badge-text').textContent = 'LIVE'; }
  else { badge.classList.add('paused'); badge.querySelector('.live-dot').style.animation = 'none'; badge.querySelector('.badge-text').textContent = 'PAUSED'; }
}

// ── Scenario Page ─────────────────────────────────────────────────────────────

function renderScenarioCards() {
  const grid = $('scenario-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(SCENARIOS).map(([key, s]) => `
    <div class="scenario-card ${SIM.scenario === key ? 'selected' : ''}" data-scenario="${key}" onclick="selectScenario('${key}')">
      <div class="sc-icon">${s.icon}</div>
      <h3>${s.label}</h3>
      <p>${s.description}</p>
      <div class="sc-meta">${s.tags.map(t => `<span class="tag tag-${t==='CRITICAL'?'critical':t==='HIGH'?'high':t==='MEDIUM'?'medium':t==='Recovery'?'teal':'blue'}">${t}</span>`).join('')}</div>
      <div class="sc-progress" id="sc-prog-${key}" style="width:0%"></div>
    </div>`).join('');
}

function selectScenario(key) {
  SIM.scenario = key;
  qsa('.scenario-card').forEach(c => c.classList.toggle('selected', c.dataset.scenario === key));
  // Update header nav label
  const label = $('current-scenario-label');
  if (label) label.textContent = SCENARIOS[key].label;
}

function updateScenarioProgress(pct) {
  const bar = $(`sc-prog-${SIM.scenario}`);
  if (bar) bar.style.width = Math.min(100, pct) + '%';
  qsa('.scenario-card').forEach(c => c.classList.toggle('running', c.dataset.scenario === SIM.scenario && SIM.running));
}

// ── Controls ────────────────────────────────────────────────────────────────

function updateControls() {
  const startBtn = $('btn-start');
  const stopBtn  = $('btn-stop');
  const resetBtn = $('btn-reset');
  if (startBtn) startBtn.disabled = SIM.running;
  if (stopBtn)  stopBtn.disabled  = !SIM.running;
}

// ── AI Prompt Panel ──────────────────────────────────────────────────────────

const AI_PROMPTS = {
  executive_summary: (risk, rec) => `
SITUATION
Component ${risk.component_id} is currently at ${risk.risk_band} risk with a score of ${risk.risk_score}/100.
Root cause: ${risk.root_cause}.
Days of supply remaining: ${risk.days_of_supply}.
Maximum shipment delay: ${risk.max_delay_hours} hours.

BUSINESS IMPACT
${rec.business_impact}
Confidence level: ${Math.round(rec.confidence * 100)}%.

RECOMMENDED ACTIONS
1. ${rec.recommended_action}
2. Confirm supplier ${risk.supplier_id} recovery ETA and update procurement system.
3. Review production schedule for downstream assemblies using ${risk.component_id}.
4. Alert customer success team about potential impact to ${risk.customer_order_id || 'open orders'}.
5. Evaluate air freight cost vs. stockout risk.

OWNER
Procurement manager with supply planning. Escalate to VP Supply Chain if score remains CRITICAL after 24 hours.

CONFIDENCE: ${Math.round(rec.confidence * 100)}% — Human approval recommended before modifying production schedule.
`.trim(),

  supplier_email: (risk, rec) => `
Subject: Urgent: Recovery Plan Required — Shipment ${risk.supplier_id} / ${risk.component_id}

Dear ${risk.supplier_id} Account Manager,

We are writing to request an urgent update on the delayed shipment of ${risk.component_id} (High-load bearing assembly) currently showing ${risk.max_delay_hours} hours behind schedule.

This delay is creating a critical supply risk for our operations in Chicago (${risk.days_of_supply} days of stock remaining) and directly impacts a STRATEGIC customer commitment valued at $750,000.

We respectfully request by end of business today:
• Confirmed revised ETA for the shipment
• Recovery plan and any partial shipment options
• Escalation contact if standard lead time cannot be met

We remain committed to our partnership and appreciate your prompt attention.

Best regards,
Supply Chain Control Tower · Risk ID: ${risk.risk_id}
`.trim(),

  procurement_escalation: (risk, rec) => `
PROCUREMENT ESCALATION NOTE
━━━━━━━━━━━━━━━━━━━━━━━━━━
Risk Level:    ${risk.risk_band} (Score: ${risk.risk_score}/100)
Component:     ${risk.component_id}
Supplier:      ${risk.supplier_id || 'Unknown'}
Customer Order: ${risk.customer_order_id || 'N/A'}
Days of Supply: ${risk.days_of_supply}
Max Delay:     ${risk.max_delay_hours} hours

IMPACT
${rec.business_impact}

RECOMMENDED MITIGATION
${rec.recommended_action}

DECISION NEEDED
Approve alternate supplier allocation (SUP-221) and expedited freight. 
Budget impact: approximately $15,000–$40,000 depending on freight mode.

DEADLINE: Within 24 hours to avoid stockout.
Generated: ${new Date().toISOString().replace('T',' ').replace('Z','')}
`.trim()
};

function runAIPrompt(type) {
  const out = $('ai-output');
  const risk = Object.values(SIM.latestRisks).sort((a,b) => b.risk_score - a.risk_score)[0];
  if (!risk) { out.textContent = 'Run a scenario first to generate risk data.'; return; }

  const rec = SIM.latestRecs[risk.risk_id] || { business_impact: '', recommended_action: 'Continue monitoring.', confidence: 0.72 };
  const text = AI_PROMPTS[type] ? AI_PROMPTS[type](risk, rec) : 'Prompt not found.';

  out.textContent = '';
  out.classList.add('typing-cursor');
  let i = 0;
  const speed = 8;
  function type_() {
    if (i < text.length) { out.textContent += text[i++]; out.scrollTop = out.scrollHeight; setTimeout(type_, speed); }
    else out.classList.remove('typing-cursor');
  }
  type_();
}

// ── Flink SQL Viewer ─────────────────────────────────────────────────────────

const FLINK_SQL = {
  enriched_view: `-- 01_enriched_supply_view.sql
CREATE VIEW enriched_supply_risk_context AS
SELECT
  s.component_id,
  s.supplier_id,
  sp.supplier_name,
  sp.reliability_score,
  s.shipment_id,
  s.po_id,
  s.status AS shipment_status,
  s.delay_hours,
  s.route_id,
  i.site_id,
  i.on_hand_qty,
  i.reserved_qty,
  i.daily_usage_qty,
  CASE
    WHEN i.daily_usage_qty <= 0 THEN 999
    ELSE (CAST(i.on_hand_qty - i.reserved_qty AS DOUBLE) / i.daily_usage_qty)
  END AS days_of_supply,
  c.customer_order_id,
  c.customer_name,
  c.priority,
  c.revenue_at_risk,
  cm.criticality,
  cm.safety_stock_qty
FROM shipments s
LEFT JOIN purchase_orders po       ON s.po_id       = po.po_id
LEFT JOIN supplier_profiles sp     ON s.supplier_id = sp.supplier_id
LEFT JOIN inventory_levels i       ON s.component_id = i.component_id
LEFT JOIN customer_orders c        ON s.component_id = c.component_id
LEFT JOIN component_master cm      ON s.component_id = cm.component_id;`,
  risk_scores: `-- 03_calculate_risk_scores.sql
INSERT INTO supply_chain_risk_scores
SELECT
  CONCAT('RISK-', CAST(FLOOR(RAND() * 1e10) AS STRING)) AS risk_id,
  v.component_id,
  v.supplier_id,
  v.customer_order_id,
  -- Inventory risk factor (max 35)
  CASE
    WHEN v.days_of_supply <= 0 THEN 35
    WHEN v.days_of_supply < GREATEST(v.delay_hours / 24.0, 1.0) THEN 35
    WHEN v.days_of_supply < 3 THEN 25
    WHEN v.days_of_supply < 7 THEN 15
    ELSE 0
  END
  -- Shipment delay risk (max 30)
  + LEAST(30, CAST(v.delay_hours / 3 AS INT))
  -- Supplier reliability (max 20)
  + CASE
    WHEN v.reliability_score < 70 THEN 20
    WHEN v.reliability_score < 80 THEN 15
    WHEN v.reliability_score < 90 THEN 8
    ELSE 0
  END
  -- Customer impact (max 20)
  + CASE
    WHEN v.priority = 'STRATEGIC' THEN 20
    WHEN v.priority = 'HIGH'      THEN 15
    WHEN v.revenue_at_risk >= 250000 THEN 10
    ELSE 0
  END AS risk_score,
  CURRENT_TIMESTAMP AS event_time
FROM enriched_supply_risk_context v;`,
};

// ── Architecture SVG ─────────────────────────────────────────────────────────

function renderArchSVG() {
  const container = $('arch-svg-container');
  if (!container) return;
  container.innerHTML = `
<svg viewBox="0 0 900 480" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
      <path d="M0,0 L8,3.5 L0,7 z" fill="#525252"/>
    </marker>
    <marker id="arr-blue" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
      <path d="M0,0 L8,3.5 L0,7 z" fill="#78a9ff"/>
    </marker>
    <marker id="arr-green" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
      <path d="M0,0 L8,3.5 L0,7 z" fill="#42be65"/>
    </marker>
  </defs>

  <!-- Source Systems -->
  <g>
    <rect x="10" y="30"  width="130" height="36" rx="4" fill="#262626" stroke="#525252" stroke-width="1"/>
    <text x="75" y="52"  text-anchor="middle" fill="#c6c6c6" font-size="11" font-family="IBM Plex Sans,sans-serif">ERP / Db2</text>
    <rect x="10" y="80"  width="130" height="36" rx="4" fill="#262626" stroke="#525252" stroke-width="1"/>
    <text x="75" y="102" text-anchor="middle" fill="#c6c6c6" font-size="11" font-family="IBM Plex Sans,sans-serif">IBM MQ / EDI</text>
    <rect x="10" y="130" width="130" height="36" rx="4" fill="#262626" stroke="#525252" stroke-width="1"/>
    <text x="75" y="152" text-anchor="middle" fill="#c6c6c6" font-size="11" font-family="IBM Plex Sans,sans-serif">Supplier APIs</text>
    <rect x="10" y="180" width="130" height="36" rx="4" fill="#262626" stroke="#525252" stroke-width="1"/>
    <text x="75" y="202" text-anchor="middle" fill="#c6c6c6" font-size="11" font-family="IBM Plex Sans,sans-serif">Logistics Feeds</text>
    <rect x="10" y="230" width="130" height="36" rx="4" fill="#262626" stroke="#525252" stroke-width="1"/>
    <text x="75" y="252" text-anchor="middle" fill="#c6c6c6" font-size="11" font-family="IBM Plex Sans,sans-serif">Port / Risk Feeds</text>
    <text x="75" y="295" text-anchor="middle" fill="#6f6f6f" font-size="10" font-family="IBM Plex Sans,sans-serif">Source Systems</text>
  </g>

  <!-- Arrows to Confluent -->
  <line x1="140" y1="48"  x2="248" y2="140" stroke="#393939" stroke-width="1" marker-end="url(#arr)"/>
  <line x1="140" y1="98"  x2="248" y2="150" stroke="#393939" stroke-width="1" marker-end="url(#arr)"/>
  <line x1="140" y1="148" x2="248" y2="160" stroke="#393939" stroke-width="1" marker-end="url(#arr)"/>
  <line x1="140" y1="198" x2="248" y2="170" stroke="#393939" stroke-width="1" marker-end="url(#arr)"/>
  <line x1="140" y1="248" x2="248" y2="180" stroke="#393939" stroke-width="1" marker-end="url(#arr)"/>

  <!-- Confluent Kafka -->
  <rect x="250" y="90" width="160" height="120" rx="4" fill="rgba(15,98,254,.15)" stroke="#78a9ff" stroke-width="1.5"/>
  <text x="330" y="115" text-anchor="middle" fill="#78a9ff" font-size="12" font-weight="600" font-family="IBM Plex Sans,sans-serif">Confluent Cloud</text>
  <text x="330" y="133" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">Kafka Topics</text>
  <text x="330" y="148" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">Schema Registry</text>
  <text x="330" y="163" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">Data Contracts</text>
  <text x="330" y="178" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">7 input topics</text>
  <text x="330" y="200" text-anchor="middle" fill="#6f6f6f" font-size="10" font-family="IBM Plex Sans,sans-serif">Event Backbone</text>

  <!-- Arrow to Flink -->
  <line x1="410" y1="150" x2="488" y2="150" stroke="#78a9ff" stroke-width="1.5" marker-end="url(#arr-blue)"/>

  <!-- Flink / Risk Engine -->
  <rect x="490" y="90" width="150" height="120" rx="4" fill="rgba(8,189,186,.1)" stroke="#08bdba" stroke-width="1.5"/>
  <text x="565" y="115" text-anchor="middle" fill="#08bdba" font-size="12" font-weight="600" font-family="IBM Plex Sans,sans-serif">Flink SQL /</text>
  <text x="565" y="130" text-anchor="middle" fill="#08bdba" font-size="12" font-weight="600" font-family="IBM Plex Sans,sans-serif">Risk Engine</text>
  <text x="565" y="150" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">Join &amp; Enrich</text>
  <text x="565" y="165" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">Score Risk</text>
  <text x="565" y="180" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">Recommend</text>
  <text x="565" y="200" text-anchor="middle" fill="#6f6f6f" font-size="10" font-family="IBM Plex Sans,sans-serif">Processing Layer</text>

  <!-- Arrow to Output -->
  <line x1="640" y1="150" x2="718" y2="150" stroke="#08bdba" stroke-width="1.5" marker-end="url(#arr-blue)"/>

  <!-- Output Topics -->
  <rect x="720" y="90" width="150" height="120" rx="4" fill="rgba(250,77,86,.1)" stroke="#fa4d56" stroke-width="1.5"/>
  <text x="795" y="115" text-anchor="middle" fill="#fa4d56" font-size="12" font-weight="600" font-family="IBM Plex Sans,sans-serif">Output Topics</text>
  <text x="795" y="133" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">risk_scores</text>
  <text x="795" y="148" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">recommendations</text>
  <text x="795" y="163" text-anchor="middle" fill="#c6c6c6" font-size="10" font-family="IBM Plex Sans,sans-serif">control_tower_alerts</text>
  <text x="795" y="200" text-anchor="middle" fill="#6f6f6f" font-size="10" font-family="IBM Plex Sans,sans-serif">Actionable Events</text>

  <!-- Downstream -->
  <g>
    <line x1="870" y1="120" x2="895" y2="120" stroke="#393939" stroke-width="1"/><line x1="895" y1="120" x2="895" y2="330" stroke="#393939" stroke-width="1"/>
    <line x1="895" y1="280" x2="860" y2="280" stroke="#393939" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="895" y1="310" x2="860" y2="310" stroke="#393939" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="895" y1="340" x2="860" y2="340" stroke="#393939" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="895" y1="370" x2="860" y2="370" stroke="#393939" stroke-width="1" marker-end="url(#arr)"/>
  </g>

  <!-- Sink boxes -->
  <rect x="700" y="263" width="155" height="30" rx="4" fill="#262626" stroke="#393939" stroke-width="1"/>
  <text x="778" y="282" text-anchor="middle" fill="#c6c6c6" font-size="11" font-family="IBM Plex Sans,sans-serif">🖥 Control Tower UI</text>
  <rect x="700" y="297" width="155" height="30" rx="4" fill="#262626" stroke="#393939" stroke-width="1"/>
  <text x="778" y="316" text-anchor="middle" fill="#c6c6c6" font-size="11" font-family="IBM Plex Sans,sans-serif">🔍 OpenSearch / Kibana</text>
  <rect x="700" y="331" width="155" height="30" rx="4" fill="#262626" stroke="#393939" stroke-width="1"/>
  <text x="778" y="350" text-anchor="middle" fill="#c6c6c6" font-size="11" font-family="IBM Plex Sans,sans-serif">💬 Slack / Teams Alert</text>
  <rect x="700" y="365" width="155" height="30" rx="4" fill="#262626" stroke="#393939" stroke-width="1"/>
  <text x="778" y="384" text-anchor="middle" fill="#c6c6c6" font-size="11" font-family="IBM Plex Sans,sans-serif">🤖 watsonx.ai</text>

  <!-- IBM label -->
  <rect x="10" y="340" width="830" height="50" rx="4" fill="rgba(15,98,254,.04)" stroke="#393939" stroke-width="1" stroke-dasharray="4,4"/>
  <text x="425" y="360" text-anchor="middle" fill="#6f6f6f" font-size="10" font-family="IBM Plex Sans,sans-serif">IBM Integration: watsonx.ai · watsonx.data · Db2 · MQ · OpenSearch · Maximo · Instana · Terraform · Ansible</text>
  <text x="425" y="378" text-anchor="middle" fill="#525252" font-size="10" font-family="IBM Plex Sans,sans-serif">Confluent Cloud acts as the real-time nervous system · IBM turns streaming signals into governed insights, automation, and operational action</text>
</svg>`;
}

// ── Event Table (topic inspector) ────────────────────────────────────────────

function renderEventTable() {
  const tbody = $('event-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const recent = SIM.eventLog.slice(-30).reverse();
  recent.forEach(({ time, topic, key, summary }, i) => {
    const tr = document.createElement('tr');
    tr.className = i === 0 ? 'new-row' : '';
    tr.innerHTML = `
      <td class="font-mono text-xs">${time}</td>
      <td><span class="tag tag-blue text-xs">${topic}</span></td>
      <td class="mono">${key}</td>
      <td class="text-sm text-secondary">${summary}</td>`;
    tbody.appendChild(tr);
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  renderScenarioCards();
  renderArchSVG();
  initAccordions();
  initTabs('stream-tabs');
  initTabs('analytics-tabs');
  initTabs('topics-tabs');

  // ── Batch slider — sync display from SIM defaults ────────────────────────
  const slider    = $('batch-slider');
  const sliderVal = $('batch-slider-val');
  if (slider) {
    slider.value = SIM.eventBatches;                          // sync input to SIM default
    if (sliderVal) sliderVal.textContent = SIM.eventBatches; // sync label to SIM default
    slider.addEventListener('input', () => {
      SIM.eventBatches = parseInt(slider.value);
      if (sliderVal) sliderVal.textContent = slider.value;
    });
  }

  // ── Speed slider — sync display from SIM defaults ────────────────────────
  const speedSlider = $('speed-slider');
  const speedVal    = $('speed-slider-val');
  if (speedSlider) {
    speedSlider.value = SIM.batchInterval;                                            // sync input
    if (speedVal) speedVal.textContent = (SIM.batchInterval / 1000).toFixed(1) + 's'; // sync label
    speedSlider.addEventListener('input', () => {
      SIM.batchInterval = parseInt(speedSlider.value);
      if (speedVal) speedVal.textContent = (SIM.batchInterval / 1000).toFixed(1) + 's';
      if (SIM.running) { clearInterval(SIM.timer); SIM.timer = setInterval(tickSimulation, SIM.batchInterval); }
    });
  }

  // ── Scenario select — sync to SIM.scenario default ───────────────────────
  const scenarioSel = $('scenario-select');
  if (scenarioSel) {
    scenarioSel.value = SIM.scenario;
  }

  navigate('page-control-tower');
  updateKPIs();
  clearControlTower();

  // Render the mode bar — always starts in SIM mode
  renderModeBar();
  updateLiveBadgeMode();
  uiUpdateControls();
});

window.addEventListener('resize', () => {
  renderTrendChart();
  renderFactorChart();
});

// ═══════════════════════════════════════════════════════════════════════════
// LIVE MODE — Kafka bridge integration (Server-Sent Events)
// ═══════════════════════════════════════════════════════════════════════════

const BRIDGE_URL = 'http://localhost:8765';   // kafka_bridge.py default
const LIVE = {
  mode:      'sim',      // 'sim' | 'live'
  sse:       null,       // EventSource instance
  connected: false,
  eventsRx:  0,
  bridgeStatus: { consumer_running: false, producer_running: false, risk_engine_running: false },
  pollTimer: null,
};

// ── Mode toggle ──────────────────────────────────────────────────────────────

function setMode(mode) {
  if (mode === LIVE.mode) return;

  // ── Leaving live mode ──
  if (LIVE.mode === 'live') {
    disconnectSSE();   // null out handlers + close socket
    stopBridgePoll();  // stop the /status poll
  }

  // ── Stop any running sim timer ──
  if (SIM.running && SIM.timer) {
    clearInterval(SIM.timer);
    SIM.timer = null;
    SIM.running = false;
  }

  LIVE.mode = mode;
  renderModeBar();
  uiUpdateControls();

  if (mode === 'live') {
    // Start status poll first — it will open the SSE if bridge is reachable
    startBridgePoll();
    // Also open SSE immediately (poll also does this but we want instant feedback)
    connectSSE();
    showToast('Live mode', `Connecting to ${BRIDGE_URL} …`, 'info');
  } else {
    showToast('Simulation mode', 'Using in-browser synthetic data generator', 'info');
    updateLiveBadgeMode();
  }
}

// ── SSE connection ───────────────────────────────────────────────────────────
// EventSource reconnects automatically on network drops. We must NOT close it
// on transient errors — only on an explicit mode switch or page unload.
// The _sseWasConnected flag lets us show a toast only on the first connect
// and on recovery after a real disconnection.

let _sseWasConnected = false;

function connectSSE() {
  // Close any stale instance first
  if (LIVE.sse && LIVE.sse.readyState !== EventSource.CLOSED) {
    LIVE.sse.close();
  }
  LIVE.sse = null;
  _sseWasConnected = false;

  const es = new EventSource(`${BRIDGE_URL}/events`);
  LIVE.sse = es;

  es.onopen = () => {
    const wasDown = !_sseWasConnected;
    _sseWasConnected = true;
    LIVE.connected = true;
    updateLiveBadgeMode();
    renderModeBar();
    if (wasDown) showToast('Bridge connected', `SSE stream open · ${BRIDGE_URL}/events`, 'success');
  };

  es.onmessage = (evt) => {
    // Any message means we are connected — clear any transient error state
    if (!LIVE.connected) {
      LIVE.connected = true;
      updateLiveBadgeMode();
      renderModeBar();
    }
    try { handleBridgeMessage(JSON.parse(evt.data)); } catch(e) { /* ignore malformed */ }
  };

  es.onerror = () => {
    // EventSource readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
    // readyState CONNECTING means the browser is already retrying — do not close it.
    // Only mark disconnected if the socket moved to CLOSED state.
    const closed = es.readyState === EventSource.CLOSED;
    if (closed) {
      LIVE.connected = false;
      _sseWasConnected = false;
      LIVE.sse = null;
      // Schedule a manual reconnect attempt every 4 s while in live mode
      setTimeout(() => { if (LIVE.mode === 'live' && !LIVE.sse) connectSSE(); }, 4000);
    } else {
      // Transient error — browser is retrying, just update UI state
      LIVE.connected = false;
    }
    updateLiveBadgeMode();
    renderModeBar();
  };
}

function disconnectSSE() {
  // Full teardown — called only on explicit "← Simulation mode" switch
  if (LIVE.sse) {
    LIVE.sse.onopen = null;
    LIVE.sse.onmessage = null;
    LIVE.sse.onerror = null;
    LIVE.sse.close();
    LIVE.sse = null;
  }
  _sseWasConnected = false;
  LIVE.connected = false;
  updateLiveBadgeMode();
  renderModeBar();
}

// ── Handle incoming bridge messages ─────────────────────────────────────────

const OUTPUT_TOPICS = new Set(['supply_chain_risk_scores','supply_chain_recommendations','control_tower_alerts']);

function handleBridgeMessage(msg) {
  switch (msg.type) {

    case 'kafka_event': {
      LIVE.eventsRx++;
      const { topic, topic_key, key, value, ts } = msg;
      logEventRaw(topic, topic_key, key, value, ts);

      if (OUTPUT_TOPICS.has(topic)) {
        absorbOutputEvent(topic, key, value);
      } else {
        const affected = processEvent(topic_key, key, value);
        SIM.totalEvents++;
        for (const compId of [...affected].sort()) {
          if (!canScore(compId)) continue;
          const risk = scoreComponent(compId, SIM.state);
          const rec  = buildRecommendation(risk, SIM.state);
          SIM.latestRisks[compId] = risk;
          SIM.latestRecs[risk.risk_id] = rec;
          SIM.allRisks.push({ ...risk, seq: SIM.totalEvents });
          renderRiskCard(compId, risk, rec);
          if (['CRITICAL','HIGH'].includes(risk.risk_band)) {
            showToast(risk.risk_band,
              `${compId} · Score ${risk.risk_score} · ${risk.root_cause}`,
              risk.risk_band === 'CRITICAL' ? 'critical' : 'high');
          }
        }
        updateKPIs(); renderTrendChart(); renderFactorChart();
      }
      break;
    }

    case 'simulation_started':
      SIM.running = true;
      updateLiveBadgeMode(); updateControls();
      showToast('Producer started', `Scenario: ${msg.scenario} · ${msg.count} batches`, 'success');
      break;

    case 'simulation_stopped':
      SIM.running = false;
      updateLiveBadgeMode(); updateControls();
      break;

    case 'process_log':
      appendProcessLog(msg.process, msg.line);
      break;

    case 'process_exit':
      appendProcessLog(msg.process, `[EXIT rc=${msg.returncode}]`);
      if (msg.process === 'producer') { SIM.running = false; updateControls(); updateLiveBadgeMode(); }
      break;

    case 'bridge_error':
      showToast('Bridge error', msg.message, 'warning');
      break;
  }
}

// ── Absorb output topic events ────────────────────────────────────────────────

function absorbOutputEvent(topic, key, value) {
  if (topic === 'supply_chain_risk_scores') {
    const r = value;
    const adapted = {
      risk_id:           r.risk_id,
      component_id:      r.component_id,
      supplier_id:       r.supplier_id,
      customer_order_id: r.customer_order_id,
      risk_score:        r.risk_score,
      risk_band:         r.risk_band,
      root_cause:        r.root_cause,
      days_of_supply:    r.days_of_supply,
      max_delay_hours:   r.max_delay_hours,
      scoring_factors: {
        inventoryRisk:     r.scoring_factors?.inventory_risk      ?? 0,
        shipmentDelayRisk: r.scoring_factors?.shipment_delay_risk  ?? 0,
        supplierRisk:      r.scoring_factors?.supplier_risk        ?? 0,
        custImpactRisk:    r.scoring_factors?.customer_impact_risk ?? 0,
        externalEventRisk: r.scoring_factors?.external_event_risk  ?? 0,
        mitigationCredit:  r.scoring_factors?.mitigation_credit    ?? 0,
        reliability:       r.scoring_factors?.supplier_reliability ?? 0,
        extDelayHours:     r.scoring_factors?.external_delay_hours ?? 0,
        altSupplier:       r.scoring_factors?.alternate_supplier_id ?? null,
      },
      event_time:    r.event_time,
      customer_order: null,
      alt_supplier:   null,
    };
    SIM.latestRisks[r.component_id] = adapted;
    SIM.allRisks.push({ ...adapted, seq: ++SIM.totalEvents });
    const rec = buildRecommendation(adapted, SIM.state);
    SIM.latestRecs[r.risk_id] = rec;
    renderRiskCard(r.component_id, adapted, rec);
    updateKPIs(); renderTrendChart(); renderFactorChart();
    if (['CRITICAL','HIGH'].includes(r.risk_band)) {
      showToast(r.risk_band,
        `${r.component_id} · Score ${r.risk_score} from Kafka`,
        r.risk_band === 'CRITICAL' ? 'critical' : 'high');
    }
  }

  if (topic === 'supply_chain_recommendations') {
    SIM.latestRecs[value.risk_id] = {
      recommendation_id:  value.recommendation_id,
      risk_id:            value.risk_id,
      component_id:       value.component_id,
      customer_order_id:  value.customer_order_id,
      risk_band:          value.risk_band,
      business_impact:    value.business_impact,
      recommended_action: value.recommended_action,
      confidence:         value.confidence,
      event_time:         value.event_time,
    };
  }

  if (topic === 'control_tower_alerts') {
    const feed = $('stream-output');
    if (feed) {
      const t = new Date().toLocaleTimeString('en-US',{hour12:false});
      const e = document.createElement('div');
      e.className = 'stream-entry s-alert';
      e.innerHTML = `<span class="st-time">${t}</span><span class="st-topic">control_tower_alerts</span><span class="st-key">${value.alert_id||''}</span><span class="st-val">${value.severity} ${value.title||''}</span>`;
      feed.appendChild(e);
      feed.scrollTop = feed.scrollHeight;
    }
  }
}

// ── logEventRaw — common path for live events ─────────────────────────────────

function logEventRaw(topic, topicKey, key, event, ts) {
  const time = ts || new Date().toLocaleTimeString('en-US', { hour12: false });
  const sClass = OUTPUT_TOPICS.has(topic) ? 's-output'
    : (event.delay_hours >= 72) ? 's-critical'
    : (event.delay_hours >= 48) ? 's-high' : '';
  const targetFeed = OUTPUT_TOPICS.has(topic) ? $('stream-output') : $('stream-input');
  if (!targetFeed) return;
  const entry = document.createElement('div');
  entry.className = `stream-entry ${sClass}`;
  entry.innerHTML = `<span class="st-time">${time}</span><span class="st-topic">${topic}</span><span class="st-key">${key||''}</span><span class="st-val">${summariseEvent(event)}</span>`;
  targetFeed.appendChild(entry);
  if (targetFeed.children.length > 300) targetFeed.removeChild(targetFeed.firstChild);
  targetFeed.scrollTop = targetFeed.scrollHeight;
  SIM.eventLog.push({ time, topic, key, event, summary: summariseEvent(event) });
}

// ── Process log ───────────────────────────────────────────────────────────────

function appendProcessLog(proc, line) {
  const el = $('process-log');
  if (!el) return;
  const e = document.createElement('div');
  e.className = `stream-entry ${proc === 'producer' ? '' : 's-output'}`;
  e.innerHTML = `<span class="st-time">${new Date().toLocaleTimeString('en-US',{hour12:false})}</span><span class="st-key">[${proc}]</span> <span class="st-val">${String(line).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
  el.appendChild(e);
  if (el.children.length > 400) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}

// ── Bridge status polling ─────────────────────────────────────────────────────
// Polls /status every 3 s to update the process badges.
// Also acts as the reconnection trigger: if the HTTP bridge is reachable but the
// SSE socket is closed/absent, we re-open it here.

function startBridgePoll() {
  stopBridgePoll();
  LIVE.pollTimer = setInterval(pollBridgeStatus, 3000);
  pollBridgeStatus();
}
function stopBridgePoll() {
  if (LIVE.pollTimer) { clearInterval(LIVE.pollTimer); LIVE.pollTimer = null; }
}

async function pollBridgeStatus() {
  if (LIVE.mode !== 'live') return;  // don't poll when not in live mode
  try {
    const res = await fetch(`${BRIDGE_URL}/status`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error('non-200');
    LIVE.bridgeStatus = await res.json();

    // Bridge is reachable — if SSE is dead, re-open it now
    const sseDead = !LIVE.sse || LIVE.sse.readyState === EventSource.CLOSED;
    if (sseDead) {
      connectSSE();  // will set connected=true in onopen
    } else {
      LIVE.connected = true;
    }

    renderBridgeStatus(LIVE.bridgeStatus);
    updateLiveBadgeMode();
    renderModeBar();
  } catch {
    // HTTP unreachable — bridge is down
    LIVE.connected = false;
    updateLiveBadgeMode();
    renderBridgeStatus(null);
    renderModeBar();
  }
}

function renderBridgeStatus(s) {
  const el = $('bridge-status-row');
  if (!el) return;
  if (!s) { el.innerHTML = `<span class="tag tag-critical">Bridge offline</span> <span class="text-xs text-secondary">Start kafka_bridge.py first</span>`; return; }
  el.innerHTML = [
    `<span class="tag tag-${s.consumer_running ? 'teal':'medium'}">Consumer ${s.consumer_running?'ON':'OFF'}</span>`,
    `<span class="tag tag-${s.producer_running ? 'teal':'blue'}">Producer ${s.producer_running?'RUNNING':'idle'}</span>`,
    `<span class="tag tag-${s.risk_engine_running?'teal':'blue'}">Risk Engine ${s.risk_engine_running?'RUNNING':'idle'}</span>`,
    `<span class="text-xs text-secondary">${s.events_forwarded||0} fwd</span>`,
  ].join(' ');
}

// ── Bridge HTTP control ───────────────────────────────────────────────────────

async function liveStart() {
  try {
    const res = await fetch(`${BRIDGE_URL}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: SIM.scenario,
        count:    SIM.eventBatches,
        interval: (SIM.batchInterval / 1000).toFixed(1),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      SIM.running = true;
      // Reset state for fresh run
      SIM.state = { suppliers:{}, components:{}, inventory:{}, pos:{}, shipments:{}, customerOrders:{}, externalRisk:[] };
      SIM.latestRisks={}; SIM.latestRecs={}; SIM.allRisks=[]; SIM.totalEvents=0;
      clearEventStream(); clearControlTower();
      updateControls(); updateLiveBadgeMode();
      showToast('Launched', `Producer + Risk Engine running · scenario: ${SIM.scenario}`, 'success');
    } else {
      showToast('Start failed', JSON.stringify(data), 'warning');
    }
  } catch {
    showToast('Bridge unreachable', `Cannot reach ${BRIDGE_URL} — is kafka_bridge.py running?`, 'critical');
  }
}

async function liveStop(target = 'producer') {
  try {
    await fetch(`${BRIDGE_URL}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    });
    SIM.running = false;
    // NOTE: do NOT disconnect SSE or stop bridge poll here.
    // Stopping processes means the producer/engine are done — the bridge and
    // its Kafka consumer stay alive so the SSE stream remains open and the UI
    // can start a new scenario without needing to reconnect.
    uiUpdateControls();
    updateLiveBadgeMode();
    renderModeBar();
    showToast('Stopped', `${target} stopped via bridge`, 'info');
  } catch {
    showToast('Bridge unreachable', `Cannot reach ${BRIDGE_URL}`, 'warning');
  }
}

// ── Mode bar ──────────────────────────────────────────────────────────────────

function renderModeBar() {
  const bar = $('mode-bar');
  if (!bar) return;

  if (LIVE.mode === 'sim') {
    // ── Simulation mode bar ─────────────────────────────────────────────────
    bar.innerHTML = `
      <div class="flex-c gap-2" style="flex-wrap:wrap;align-items:center">
        <span class="tag tag-blue" style="font-size:.7rem;letter-spacing:.04em">🖥&nbsp; SIMULATION MODE</span>
        <span class="text-secondary text-xs">Events generated in-browser — no Kafka connection required.</span>
        <button class="btn btn-secondary btn-sm" onclick="setMode('live')" style="margin-left:auto">
          Switch to Live Kafka →
        </button>
      </div>`;
    bar.style.cssText = 'border:1px solid rgba(69,137,255,.25);background:rgba(69,137,255,.07);border-radius:4px;padding:.625rem 1rem;margin-bottom:1rem;';

  } else if (LIVE.connected) {
    // ── Live mode — bridge reachable ────────────────────────────────────────
    bar.innerHTML = `
      <div class="flex-c gap-2" style="flex-wrap:wrap;align-items:center">
        <span class="tag tag-teal" style="font-size:.7rem;letter-spacing:.04em">⬡&nbsp; KAFKA LIVE — ${BRIDGE_URL}</span>
        <div id="bridge-status-row" class="flex-c gap-1" style="flex:1"></div>
        <div class="flex-c gap-1" style="margin-left:auto">
          <button class="btn btn-ghost btn-sm" onclick="setMode('sim')">← Sim mode</button>
          <button class="btn btn-danger btn-sm" onclick="liveStop('all')">Stop all</button>
        </div>
      </div>`;
    bar.style.cssText = 'border:1px solid rgba(8,189,186,.25);background:rgba(8,189,186,.07);border-radius:4px;padding:.625rem 1rem;margin-bottom:1rem;';
    if (LIVE.bridgeStatus) renderBridgeStatus(LIVE.bridgeStatus);

  } else {
    // ── Live mode — bridge offline / connecting ─────────────────────────────
    bar.innerHTML = `
      <div class="flex-c gap-2" style="flex-wrap:wrap;align-items:center">
        <span class="tag tag-critical" style="font-size:.7rem;letter-spacing:.04em">⬡&nbsp; BRIDGE OFFLINE</span>
        <span class="text-secondary text-xs">
          Start the bridge first:&nbsp;
          <code style="font-family:var(--font-mono);font-size:.75rem;background:rgba(255,255,255,.06);padding:.1rem .35rem;border-radius:3px">python ui_carbon/kafka_bridge.py</code>
        </span>
        <div class="flex-c gap-1" style="margin-left:auto">
          <button class="btn btn-secondary btn-sm" onclick="connectSSE();startBridgePoll()">↺ Retry</button>
          <button class="btn btn-ghost btn-sm" onclick="setMode('sim')">← Sim mode</button>
        </div>
      </div>`;
    bar.style.cssText = 'border:1px solid rgba(250,77,86,.25);background:rgba(250,77,86,.07);border-radius:4px;padding:.625rem 1rem;margin-bottom:1rem;';
  }
}

// ── updateLiveBadgeMode — mode-aware live badge ────────────────────────────────

function updateLiveBadgeMode() {
  const badge = $('live-badge');
  if (!badge) return;
  const dot  = badge.querySelector('.live-dot');
  const text = badge.querySelector('.badge-text');
  if (LIVE.mode === 'sim') {
    badge.classList.toggle('paused', !SIM.running);
    if (dot)  dot.style.animation = SIM.running ? '' : 'none';
    if (text) text.textContent    = SIM.running ? 'SIM LIVE' : 'PAUSED';
  } else {
    const active = LIVE.connected && SIM.running;
    badge.classList.toggle('paused', !LIVE.connected);
    if (dot)  dot.style.animation = LIVE.connected ? '' : 'none';
    if (text) text.textContent    = active ? 'KAFKA LIVE' : (LIVE.connected ? 'CONNECTED' : 'DISCONNECTED');
  }
}

// ── Dispatch: all UI action entry-points route through LIVE.mode ─────────────
// NOTE: function declarations cannot be reassigned. Instead every HTML onclick
// calls these named dispatch wrappers. The original sim-only functions
// (startSimulation, stopSimulation, updateControls, updateLiveBadge) keep their
// original bodies and are called internally by the dispatch functions below.

function uiStart() {
  if (LIVE.mode === 'live') { liveStart(); return; }
  startSimulation();
  updateLiveBadgeMode();
}

function uiStop() {
  if (LIVE.mode === 'live') { liveStop('producer'); return; }
  stopSimulation();
  updateLiveBadgeMode();
}

function uiReset() {
  if (LIVE.mode === 'live') liveStop('all');
  resetSimulation();
  renderModeBar();
  updateLiveBadgeMode();
}

function uiUpdateControls() {
  const startBtn      = $('btn-start');
  const stopBtn       = $('btn-stop');
  const startLabel    = $('btn-start-label');

  if (LIVE.mode === 'live') {
    if (startBtn)   startBtn.disabled  = false;  // always allow re-launch in live mode
    if (stopBtn)    stopBtn.disabled   = !SIM.running;
    if (startLabel) startLabel.textContent = 'Start Live Run';
  } else {
    if (startBtn)   startBtn.disabled  = SIM.running;
    if (stopBtn)    stopBtn.disabled   = !SIM.running;
    if (startLabel) startLabel.textContent = SIM.running ? 'Running…' : 'Start Simulation';
  }
}

// Alias so existing calls to updateControls() and updateLiveBadge() in sim code
// still work — they are var-style assignments on the window object.
window.updateControls = uiUpdateControls;
window.updateLiveBadge = updateLiveBadgeMode;

// ═══════════════════════════════════════════════════════════════════════════
// RISK DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════════════════

// Per-component score history for the Timeline tab
const _drawerHistory = {};   // { componentId: [ {risk, rec, ts}, … ] }

// Currently open component
let _drawerComponentId = null;

// ── Record every score so Timeline always has data ───────────────────────
function drawerRecordHistory(componentId, risk, rec) {
  if (!_drawerHistory[componentId]) _drawerHistory[componentId] = [];
  const arr = _drawerHistory[componentId];
  arr.push({ risk: JSON.parse(JSON.stringify(risk)), rec: JSON.parse(JSON.stringify(rec)), ts: new Date() });
  if (arr.length > 40) arr.shift();   // cap at 40 entries per component
  // Live-update timeline if this component's drawer is open
  if (_drawerComponentId === componentId) _drawerRenderTimeline(componentId);
}

// ── Open drawer ──────────────────────────────────────────────────────────
function openRiskDrawer(componentId) {
  const risk = SIM.latestRisks[componentId];
  const rec  = SIM.latestRecs[componentId];
  if (!risk) return;

  _drawerComponentId = componentId;

  const drawer  = $('risk-drawer');
  const overlay = $('drawer-overlay');
  if (!drawer || !overlay) return;

  // Make visible first (display:flex), then add .open to trigger CSS transform
  drawer.style.display  = 'flex';
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    drawer.classList.add('open');
    overlay.classList.add('open');
  });

  // ── Header ──
  $('drawer-component-id').textContent = componentId;
  $('drawer-band-tag').innerHTML = bandTagHtml(risk.risk_band);

  // ── Score strip ──
  const scoreColor = bandColor(risk.risk_band);
  const scoreNum   = $('drawer-score-num');
  scoreNum.textContent = risk.risk_score;
  scoreNum.style.color = scoreColor;
  $('drawer-dos').textContent   = risk.days_of_supply + 'd';
  $('drawer-delay').textContent = risk.max_delay_hours + 'h';
  const bar = $('drawer-score-bar');
  bar.style.background = scoreColor;
  setTimeout(() => { bar.style.width = risk.risk_score + '%'; }, 50);

  // ── Reset to Overview tab ──
  document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dtab').forEach(p => p.classList.remove('active'));
  const firstTab = document.querySelector('.drawer-tab[data-dtab="dtab-overview"]');
  if (firstTab) firstTab.classList.add('active');
  const overview = $('dtab-overview');
  if (overview) overview.classList.add('active');

  // ── Populate each tab ──
  _drawerPopulateOverview(risk, rec);
  _drawerPopulateActions(risk, rec);
  _drawerRenderTimeline(componentId);
  _drawerClearAI();
  _drawerPopulateRaw(risk, rec);

  // Keyboard close
  document.addEventListener('keydown', _drawerEscHandler);
}

function closeRiskDrawer() {
  const drawer  = $('risk-drawer');
  const overlay = $('drawer-overlay');
  if (!drawer) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  setTimeout(() => {
    drawer.style.display  = 'none';
    overlay.style.display = 'none';
  }, 280);
  _drawerComponentId = null;
  document.removeEventListener('keydown', _drawerEscHandler);
}

function _drawerEscHandler(e) {
  if (e.key === 'Escape') closeRiskDrawer();
}

// ── Tab switching ────────────────────────────────────────────────────────
function switchDrawerTab(btn) {
  document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dtab').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = $(btn.dataset.dtab);
  if (panel) panel.classList.add('active');
}

// ── Overview tab ─────────────────────────────────────────────────────────
function _drawerPopulateOverview(risk, rec) {
  // Root cause
  const rcBox = $('drawer-root-cause');
  if (rcBox) rcBox.textContent = risk.root_cause || '—';

  // Scoring factors — horizontal bar per factor
  const f = risk.scoring_factors;
  const factors = [
    { name: 'Inventory Risk',    val: f.inventoryRisk      || f.inventory_risk      || 0, max: 35 },
    { name: 'Shipment Delay',    val: f.shipmentDelayRisk  || f.shipment_delay_risk || 0, max: 30 },
    { name: 'Supplier Risk',     val: f.supplierRisk       || f.supplier_risk       || 0, max: 20 },
    { name: 'Customer Impact',   val: f.custImpactRisk     || f.customer_impact_risk|| 0, max: 20 },
    { name: 'External Risk',     val: f.externalEventRisk  || f.external_event_risk || 0, max: 20 },
    { name: 'Mitigation Credit', val: -(f.mitigationCredit || f.mitigation_credit   || 0), max: 15, credit: true },
  ];
  const fd = $('drawer-factors-detail');
  if (fd) {
    fd.innerHTML = factors.map(fac => {
      const absVal  = Math.abs(fac.val);
      const pct     = fac.max ? Math.min(100, Math.round(absVal / fac.max * 100)) : 0;
      const barColor = fac.credit
        ? 'var(--ibm-teal-40)'
        : absVal >= fac.max * .85 ? 'var(--risk-critical)'
        : absVal >= fac.max * .55 ? 'var(--risk-high)'
        : absVal >= fac.max * .25 ? 'var(--risk-medium)'
        : 'var(--ibm-green-40)';
      const valDisplay = fac.credit ? (fac.val <= 0 ? fac.val : `+${fac.val}`) : fac.val;
      const valColor   = fac.credit ? 'var(--ibm-teal-40)' : barColor;
      return `<div class="drawer-factor-row">
        <div>
          <div class="dfr-name">${fac.name}</div>
          <div class="dfr-bar-wrap mt-1">
            <div class="dfr-bar-track">
              <div class="dfr-bar-fill" style="width:${pct}%;background:${barColor}"></div>
            </div>
          </div>
        </div>
        <div class="dfr-val" style="color:${valColor}">${valDisplay}</div>
      </div>`;
    }).join('');
  }

  // Context table
  const altId = (f.alternate_supplier_id || f.alternateSupplier || '');
  const ctxEl = $('drawer-context-table');
  if (ctxEl) {
    ctxEl.innerHTML = `
      <table class="data-table" style="font-size:.8125rem">
        <tbody>
          <tr><td class="text-secondary" style="width:140px">Component</td><td class="mono">${risk.component_id || '—'}</td></tr>
          <tr><td class="text-secondary">Primary Supplier</td><td class="mono">${risk.supplier_id || '—'}</td></tr>
          <tr><td class="text-secondary">Alternate Supplier</td><td class="mono" style="color:${altId ? 'var(--ibm-teal-40)' : 'var(--cds-text-secondary)'}">${altId || 'None available'}</td></tr>
          <tr><td class="text-secondary">Supplier Reliability</td><td>${_reliabilityBar(f.supplierReliability || f.supplier_reliability)}</td></tr>
          <tr><td class="text-secondary">Customer Order</td><td class="mono">${risk.customer_order_id || '—'}</td></tr>
          <tr><td class="text-secondary">Event Time</td><td class="text-secondary" style="font-size:.75rem">${(risk.event_time||'').replace('T',' ').replace('Z','')}</td></tr>
        </tbody>
      </table>`;
  }
}

function _reliabilityBar(val) {
  if (val == null) return '<span class="text-secondary">—</span>';
  const pct   = Math.min(100, Math.max(0, val));
  const color = pct >= 90 ? 'var(--ibm-green-40)' : pct >= 80 ? 'var(--risk-medium)' : pct >= 70 ? 'var(--risk-high)' : 'var(--risk-critical)';
  return `<div style="display:flex;align-items:center;gap:.5rem">
    <div style="width:80px;height:4px;background:#393939;border-radius:999px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:999px"></div>
    </div>
    <span style="color:${color};font-family:'IBM Plex Mono',monospace;font-size:.8125rem">${val}</span>
  </div>`;
}

// ── Actions tab ──────────────────────────────────────────────────────────
function _drawerPopulateActions(risk, rec) {
  const ra = $('drawer-rec-action');
  if (ra) ra.innerHTML = `<strong>Recommended action:</strong> ${rec ? rec.recommended_action : risk.root_cause}`;
  const bi = $('drawer-biz-impact');
  if (bi) bi.textContent = rec ? (rec.business_impact || rec.businessImpact || '—') : '—';
  const log = $('drawer-action-log');
  if (log) log.innerHTML = '';  // clear on each open
}

// One-click action handler
function drawerAction(type) {
  const risk = SIM.latestRisks[_drawerComponentId];
  if (!risk) return;
  const ts   = new Date().toLocaleTimeString();
  const log  = $('drawer-action-log');

  const messages = {
    acknowledge: { text: `Risk acknowledged for ${_drawerComponentId} — score ${risk.risk_score} (${risk.risk_band}). Monitoring continues.`, cls: 'log-success' },
    escalate:    { text: `Escalation triggered → Procurement team notified for ${_drawerComponentId}. Supplier: ${risk.supplier_id || '—'}. Root cause: ${risk.root_cause}`, cls: '' },
    alternate:   { text: `Alternate supplier activation requested for ${_drawerComponentId}. Alternate: ${(risk.scoring_factors.alternate_supplier_id || risk.scoring_factors.alternateSupplier) || 'None on file'}.`, cls: 'log-success' },
    expedite:    { text: `Expedite request sent for shipment to ${_drawerComponentId}. Max current delay: ${risk.max_delay_hours}h. Freight upgrade requested.`, cls: 'log-warn' },
    slack:       { text: `🔔 Slack alert dispatched — ${risk.risk_band} risk on ${_drawerComponentId}. Score: ${risk.risk_score}. Root cause: ${risk.root_cause}`, cls: '' },
    watsonx:     { text: `🤖 watsonx.ai prompt queued for ${_drawerComponentId}. Switch to AI Brief tab for the generated output.`, cls: '' },
  };

  const m = messages[type] || { text: `Action '${type}' triggered.`, cls: '' };
  if (log) {
    const entry = document.createElement('div');
    entry.className = `drawer-log-entry ${m.cls}`;
    entry.innerHTML = `<span class="dlog-time">${ts}</span><span class="dlog-text">${m.text}</span>`;
    log.prepend(entry);
  }

  showToast(
    type === 'acknowledge' ? 'Risk Acknowledged' :
    type === 'escalate'    ? 'Escalated to Procurement' :
    type === 'alternate'   ? 'Alternate Supplier Activated' :
    type === 'expedite'    ? 'Expedite Request Sent' :
    type === 'slack'       ? 'Slack Alert Sent' : 'watsonx.ai Queued',
    m.text.substring(0, 80) + (m.text.length > 80 ? '…' : ''),
    type === 'expedite' ? 'warning' : type === 'watsonx' ? 'info' : 'success'
  );

  // Auto-generate AI brief if watsonx was clicked
  if (type === 'watsonx') {
    switchDrawerTab(document.querySelector('.drawer-tab[data-dtab="dtab-ai"]'));
    drawerGenerateAI('exec');
  }
}

// ── Timeline tab ─────────────────────────────────────────────────────────
function _drawerRenderTimeline(componentId) {
  const tl    = $('drawer-timeline-list');
  const label = $('drawer-tl-component');
  if (!tl) return;
  if (label) label.textContent = componentId;

  const history = _drawerHistory[componentId] || [];
  if (!history.length) {
    tl.innerHTML = '<p class="text-secondary text-xs" style="padding:.5rem 0">No history yet — start a scenario first.</p>';
    return;
  }

  tl.innerHTML = [...history].reverse().map((entry, i) => {
    const r      = entry.risk;
    const color  = bandColor(r.risk_band);
    const isLast = i === 0;
    return `<div class="drawer-tl-entry">
      <div class="drawer-tl-dot" style="background:${isLast ? color : 'transparent'};border-color:${color}"></div>
      <div class="drawer-tl-score" style="color:${color}">${r.risk_score}</div>
      <div class="drawer-tl-band">${bandTagHtml(r.risk_band)}</div>
      <div class="drawer-tl-cause">${r.root_cause || '—'}</div>
      <div class="drawer-tl-time">${entry.ts.toLocaleTimeString()}</div>
    </div>`;
  }).join('');
}

// ── AI Brief tab ─────────────────────────────────────────────────────────
function _drawerClearAI() {
  const el = $('drawer-ai-output');
  if (el) el.textContent = 'Click a button below to generate a brief from current risk data.';
}

function drawerGenerateAI(type) {
  const risk = SIM.latestRisks[_drawerComponentId];
  const rec  = SIM.latestRecs[_drawerComponentId];
  if (!risk) return;
  const el = $('drawer-ai-output');
  if (!el) return;

  const f = risk.scoring_factors;
  const altId = f.alternate_supplier_id || f.alternateSupplier || 'not on file';

  const texts = {
    exec: `EXECUTIVE BRIEF — Supply Chain Risk Alert
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Component:      ${risk.component_id}
Risk Band:      ${risk.risk_band}  (Score: ${risk.risk_score}/100)
Root Cause:     ${risk.root_cause}
Days of Supply: ${risk.days_of_supply}d  |  Max Delay: ${risk.max_delay_hours}h
Customer Order: ${risk.customer_order_id || 'N/A'}
Supplier:       ${risk.supplier_id || 'N/A'} (reliability: ${f.supplierReliability || f.supplier_reliability || '—'})
Alternate:      ${altId}

SUMMARY
A ${risk.risk_band.toLowerCase()} supply chain risk has been detected for component
${risk.component_id}. ${risk.root_cause}. Current inventory
covers ${risk.days_of_supply} days of supply against a ${risk.max_delay_hours}-hour
maximum shipment delay.

RECOMMENDED ACTION
${rec ? rec.recommended_action : risk.root_cause}

SCORING BREAKDOWN
  Inventory Risk:    ${f.inventoryRisk      || f.inventory_risk      || 0} / 35
  Shipment Delay:    ${f.shipmentDelayRisk  || f.shipment_delay_risk || 0} / 30
  Supplier Risk:     ${f.supplierRisk       || f.supplier_risk       || 0} / 20
  Customer Impact:   ${f.custImpactRisk     || f.customer_impact_risk|| 0} / 20
  External Events:   ${f.externalEventRisk  || f.external_event_risk || 0} / 20
  Mitigation Credit: -${f.mitigationCredit  || f.mitigation_credit   || 0}
  ──────────────────────────────────────────
  TOTAL SCORE:       ${risk.risk_score} / 100`,

    email: `Subject: URGENT — Supply Disruption Alert: ${risk.component_id}

Dear Supplier Team (${risk.supplier_id || '[Supplier]'}),

We are writing to flag a developing supply disruption for component
${risk.component_id}. Our control tower has detected a ${risk.risk_band}
risk (score ${risk.risk_score}/100) based on the following signals:

• Current shipment delay: ${risk.max_delay_hours} hours
• Available inventory coverage: ${risk.days_of_supply} days
• Root cause: ${risk.root_cause}

${altId !== 'not on file' ? `We are evaluating partial fulfilment from our alternate supplier
(${altId}) to bridge the gap while the primary shipment is in transit.` : ''}

We request an updated ETA confirmation and recovery plan within 4 hours.
Please escalate this to your logistics and planning teams immediately.

Regards,
Supply Chain Risk Control Tower — Automated Alert
Generated: ${new Date().toISOString()}`,

    slack: `🚨 *${risk.risk_band} Risk Alert — ${risk.component_id}*

> *Score:* ${risk.risk_score}/100  |  *Delay:* ${risk.max_delay_hours}h  |  *Days of Supply:* ${risk.days_of_supply}d
> *Root Cause:* ${risk.root_cause}
> *Customer Order:* ${risk.customer_order_id || 'N/A'}  |  *Supplier:* ${risk.supplier_id || 'N/A'}

*Recommended Action:*
${rec ? rec.recommended_action : '—'}

_Powered by Supply Chain Risk Control Tower + Confluent Cloud_`,
  };

  const text = texts[type] || '';
  el.textContent = '';
  el.classList.add('typing-cursor');

  // Typewriter effect
  let i = 0;
  const tick = () => {
    if (i < text.length) {
      el.textContent += text[i++];
      setTimeout(tick, i < 80 ? 12 : 4);
    } else {
      el.classList.remove('typing-cursor');
    }
  };
  tick();
}

// ── Raw JSON tab ─────────────────────────────────────────────────────────
function _drawerPopulateRaw(risk, rec) {
  const rr = $('drawer-raw-risk');
  const rp = $('drawer-raw-rec');
  if (rr) rr.textContent = JSON.stringify(risk, null, 2);
  if (rp) rp.textContent = JSON.stringify(rec  || {}, null, 2);
}
