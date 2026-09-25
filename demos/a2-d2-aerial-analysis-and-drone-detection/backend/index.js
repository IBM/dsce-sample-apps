'use strict';

/**
 * A2-D2 — Aerial Analysis & Drone Detection
 * Demo-Mode Backend
 * ─────────────────────────────────────────────────────────────────────────────
 * Fully offline: no MongoDB, no AirSight WebSocket, no WatsonX.ai,
 * no Twilio, no SendGrid.  All data is served from demo-data/ CSV/JSON files.
 *
 * Start: node index.js   (no .env required)
 * Port:  process.env.PORT || 4000
 */

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const csv       = require('csv-parser');
require('dotenv').config();

// ── Config ────────────────────────────────────────────────────────────────────
const PORT          = process.env.PORT || 4000;
const TICK_INTERVAL = parseInt(process.env.DEMO_TICK_MS, 10) || 2000; // ms between WS frames
const LOOP_TAIL     = parseInt(process.env.DEMO_LOOP_TAIL, 10) || 10; // rows to orbit at end

const DEMO_DIR  = path.join(__dirname, 'demo-data');
const HIST_DIR  = path.join(DEMO_DIR, 'flight_history');

// ── Startup banner ────────────────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  🚀  A2-D2  |  Aerial Analysis & Drone Detection            ║');
console.log('║      DEMO MODE — No external connections required            ║');
console.log(`║      Port ${PORT}  |  Tick ${TICK_INTERVAL}ms  |  Loop tail ${LOOP_TAIL} rows          ║`);
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

// ── CSV / JSON loaders ────────────────────────────────────────────────────────
function loadCSV(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return resolve([]);
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ── Demo data (loaded at startup) ─────────────────────────────────────────────
let liveFeedRows   = [];  // all rows from live_feed.csv
let liveFeedByDrone = {}; // { demoId: [ row, ... ] }
let assessments    = {};  // { demoId: assessmentObject }
let incidents      = {};  // { demoId: [ incident, ... ] }
let flightHistoryCache = {}; // { demoId: [ row, ... ] }

// Per-drone cursor for live simulation
const cursors = {};

async function loadDemoData() {
  console.log('📂 Loading demo fixture data…');

  liveFeedRows = await loadCSV(path.join(DEMO_DIR, 'live_feed.csv'));
  assessments  = loadJSON(path.join(DEMO_DIR, 'assessments.json'));
  incidents    = loadJSON(path.join(DEMO_DIR, 'incidents.json'));

  // Group live feed by drone_id
  for (const row of liveFeedRows) {
    if (!liveFeedByDrone[row.drone_id]) liveFeedByDrone[row.drone_id] = [];
    liveFeedByDrone[row.drone_id].push(row);
  }

  // Initialise cursors at 0
  for (const demoId of Object.keys(liveFeedByDrone)) {
    cursors[demoId] = 0;
  }

  // Pre-load all flight_history CSVs
  if (fs.existsSync(HIST_DIR)) {
    for (const file of fs.readdirSync(HIST_DIR)) {
      if (!file.endsWith('.csv')) continue;
      const demoId = file.replace('.csv', '');
      flightHistoryCache[demoId] = await loadCSV(path.join(HIST_DIR, file));
    }
  }

  const droneCount = Object.keys(liveFeedByDrone).length;
  const histCount  = Object.keys(flightHistoryCache).length;
  console.log(`✓ Live feed: ${liveFeedRows.length} rows across ${droneCount} demo drones`);
  console.log(`✓ Flight history: ${histCount} drone CSV files loaded`);
  console.log(`✓ Assessments: ${Object.keys(assessments).length} entries`);
  console.log(`✓ Incidents: ${Object.keys(incidents).length} drone profiles`);
}

// ── Helper: convert a CSV row into the normalised drone object the frontend
//    expects (mirrors the shape produced by the production backend) ──────────
function csvRowToDroneFrame(row) {
  const hasHome  = row.home_lat  && row.home_lat  !== '';
  const hasPilot = row.pilot_lat && row.pilot_lat !== '';
  return {
    drone_id:       row.drone_id,
    flight_id:      row.flight_id,
    lat:            parseFloat(row.lat)  || 0,
    lng:            parseFloat(row.lng)  || 0,
    altitude:       parseFloat(row.altitude) || 0,
    speed:          parseFloat(row.speed)    || 0,
    azimuth:        parseFloat(row.azimuth)  || 0,
    drone_type:     row.drone_type || 'Unknown',
    droneType:      row.drone_type || 'Unknown',
    has_payload:    row.has_payload === 'true',
    imagePath:      row.imagePath || `drone_images/${row.drone_type || 'Unknown'}.png`,
    timestamp:      row.timestamp  || Date.now(),
    detection_time: row.timestamp  || Date.now(),
    detection_type: row.detection_type || 'apolloshield_dji',
    sensor_type:    row.sensor_type    || 'dji',
    angle:          parseFloat(row.angle)    || null,
    error:          parseFloat(row.error)    || null,
    frequency_hz:   row.frequency_hz   || null,
    device_id:      row.device_id      || null,
    device_name:    row.device_name    || null,
    aboveGroundLevel: parseFloat(row.aboveGroundLevel) || null,
    threatLevel:    row.threatLevel    || null,
    zone:           row.zone           || null,
    type:           'drone',
    home:  hasHome  ? { lat: parseFloat(row.home_lat),  lng: parseFloat(row.home_lng)  } : null,
    pilot: hasPilot ? { lat: parseFloat(row.pilot_lat), lng: parseFloat(row.pilot_lng) } : null,
  };
}

// ── Express setup ─────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, mode: 'demo' }));

// ── GET /api/drone-flights/:droneId ──────────────────────────────────────────
// Returns a list of flight summaries for a given demo drone.
app.get('/api/drone-flights/:droneId', (req, res) => {
  const { droneId } = req.params;
  const rows = flightHistoryCache[droneId] || [];

  if (!rows.length) {
    return res.json({ success: false, error: 'Drone not found in demo data', drone_id: droneId, flights: [] });
  }

  // Group rows by flight_id and build a summary per flight
  const flightMap = {};
  for (const row of rows) {
    const fid = row.flight_id;
    if (!flightMap[fid]) {
      flightMap[fid] = {
        flight_id:      fid,
        drone_id:       droneId,
        start_time:     row.timestamp,
        end_time:       row.timestamp,
        drone_type:     row.drone_type || 'Unknown',
        sensor_type:    row.sensor_type || 'dji',
        detection_type: row.detection_type || '',
        point_count:    0,
      };
    }
    flightMap[fid].end_time = row.timestamp;
    flightMap[fid].point_count++;
  }

  const flights = Object.values(flightMap);
  return res.json({ success: true, drone_id: droneId, count: flights.length, flights });
});

// ── GET /api/flight-history/:flightId ────────────────────────────────────────
// Returns the full route for a specific flight_id.
app.get('/api/flight-history/:flightId', (req, res) => {
  const { flightId } = req.params;

  // Find which demo drone owns this flight_id
  let matchedRows = null;
  for (const [demoId, rows] of Object.entries(flightHistoryCache)) {
    const filtered = rows.filter(r => r.flight_id === flightId);
    if (filtered.length) { matchedRows = filtered; break; }
  }

  if (!matchedRows) {
    return res.status(404).json({ success: false, error: 'Flight not found' });
  }

  const route = matchedRows.map(r => ({
    lat:       parseFloat(r.lat)      || 0,
    lng:       parseFloat(r.lng)      || 0,
    altitude:  parseFloat(r.altitude) || 0,
    speed:     parseFloat(r.speed)    || 0,
    timestamp: r.timestamp,
  }));

  return res.json({
    success:   true,
    flight_id: flightId,
    count:     route.length,
    data:      { flight_id: flightId, route },
  });
});

// ── GET /api/drone-history/:droneId ──────────────────────────────────────────
app.get('/api/drone-history/:droneId', (req, res) => {
  const { droneId } = req.params;
  const rows = flightHistoryCache[droneId] || [];
  return res.json({ success: true, drone_id: droneId, count: rows.length, data: rows });
});

// ── GET /api/inactive-drones ─────────────────────────────────────────────────
// Returns static, non-moving inactive drones (speed: 0, altitude: 0, threat: 0)
let inactiveDronesData = [];
try {
  inactiveDronesData = loadJSON(path.join(DEMO_DIR, 'inactive_drones.json'));
} catch (_) {}

app.get('/api/inactive-drones', (_req, res) => {
  return res.json({ success: true, count: inactiveDronesData.length, data: inactiveDronesData });
});

// ── GET /api/drone-incidents/:droneId ────────────────────────────────────────
app.get('/api/drone-incidents/:droneId', (req, res) => {
  const { droneId } = req.params;
  const droneIncidents = incidents[droneId] || [];
  return res.json({
    success:  true,
    drone_id: droneId,
    count:    droneIncidents.length,
    incidents: droneIncidents,
  });
});

// ── POST /api/assess-threat ───────────────────────────────────────────────────
// Returns threat assessment: 0 for inactive/stationary drones, canned assessment for active.
app.post('/api/assess-threat', (req, res) => {
  const { drone_id, speed, altitude } = req.body || {};

  // Check if this is an inactive drone
  const isInactive = (drone_id && drone_id.includes('INACT')) || (speed === 0 && altitude === 0);

  if (isInactive || !assessments[drone_id]) {
    return res.json({
      success: true,
      assessment: {
        drone_id:                   drone_id || 'unknown',
        threat_level:               'LOW',
        threat_score:               0,
        distance_to_center:         0,
        bearing_to_center:          0,
        is_heading_towards_center:  false,
        eta_minutes:                null,
        current_speed:              0,
        current_altitude:           0,
        current_direction:          0,
        has_historical_breaches:    false,
        has_payload:                false,
        risk_factors:               ['Drone is inactive / grounded', 'No motion or operational threat detected'],
        recommendations:            ['Telemetry archived — no active response needed'],
        ai_powered:                 false,
        demo_mode:                  true,
      }
    });
  }

  const assessment = assessments[drone_id];
  return res.json({ success: true, assessment });
});

// ── POST /api/send-zone-alert ─────────────────────────────────────────────────
// Silently stubs Twilio SMS and SendGrid email — returns success so the UI
// alert flow works visually.  Voice alert is handled purely in the browser.
app.post('/api/send-zone-alert', (req, res) => {
  const { drone_id, zone, assessment } = req.body || {};
  const level = zone || (assessment && assessment.threat_level) || 'UNKNOWN';
  console.log(`[DEMO ALERT] Zone alert triggered: drone=${drone_id}  zone=${level}  (SMS/Email stubbed in demo mode)`);
  return res.json({
    success:  true,
    message:  `Alert sent (demo mode) — ${level} zone breach logged`,
    drone_id,
    zone:     level,
    channels: ['console_log'],
    note:     'SMS and email are stubbed in demo mode. Voice alert active in browser.',
  });
});

// ── POST /api/refresh-drone-lists ────────────────────────────────────────────
// Resets the live-feed cursors back to 0 so the simulation restarts.
app.post('/api/refresh-drone-lists', (_req, res) => {
  const previousCount = Object.keys(cursors).length;
  for (const demoId of Object.keys(cursors)) cursors[demoId] = 0;
  console.log('[DEMO] Live feed cursors reset to start.');
  return res.json({
    success:       true,
    message:       'Demo feed reset — playback will restart from beginning',
    previousCount,
    note:          'Active list will rebuild from demo CSV data',
  });
});

// ── POST /api/fetch-flight-history ───────────────────────────────────────────
app.post('/api/fetch-flight-history', (req, res) => {
  const { flight_id } = req.body || {};
  let matchedRows = [];
  for (const rows of Object.values(flightHistoryCache)) {
    const filtered = rows.filter(r => r.flight_id === flight_id);
    if (filtered.length) { matchedRows = filtered; break; }
  }
  const data = matchedRows.map(r => ({
    drone_id:   r.drone_id,
    flight_id:  r.flight_id,
    lat:        parseFloat(r.lat)      || 0,
    lng:        parseFloat(r.lng)      || 0,
    altitude:   parseFloat(r.altitude) || 0,
    speed:      parseFloat(r.speed)    || 0,
    timestamp:  r.timestamp,
    event:      'historical',
  }));
  return res.json({ success: true, flight_id, count: data.length, data, source: 'demo_csv' });
});

// ── WebSocket server & Staggered Live Simulation ──────────────────────────────
const wss = new WebSocket.Server({ server, path: '/ws' });

// Stagger delays per drone relative to when client connects (in seconds)
// Range: 0s to 36s so drones appear gradually one by one as they are "detected"
const DRONE_ARRIVAL_DELAYS = {
  'A2D2-3A8C': 0,    // Appears immediately on page load
  'A2D2-F3A1': 6,    // Appears at 6s
  'A2D2-C9B2': 12,   // Appears at 12s
  'A2D2-7E4D': 18,   // Appears at 18s
  'A2D2-B2F6': 24,   // Appears at 24s (With Payload)
  'A2D2-E5B7': 29,   // Appears at 29s (With Payload)
  'A2D2-9D1E': 34,   // Appears at 34s (With Payload)
  'A2D2-4F2A': 38,   // Appears at 38s (Critical with Payload)
};

/** Get the active frame for a client based on elapsed connection time. */
function getClientFrame(connectTimestamp) {
  const elapsedSec = (Date.now() - connectTimestamp) / 1000;
  const frame = [];
  for (const [demoId, rows] of Object.entries(liveFeedByDrone)) {
    if (!rows.length) continue;
    const arrivalDelay = DRONE_ARRIVAL_DELAYS[demoId] ?? 0;
    if (elapsedSec >= arrivalDelay) {
      const cursor = cursors[demoId] || 0;
      frame.push(csvRowToDroneFrame(rows[cursor]));
    }
  }
  return frame;
}

/** Advance each drone's cursor by 1; clamp to last LOOP_TAIL positions. */
function advanceCursors() {
  for (const [demoId, rows] of Object.entries(liveFeedByDrone)) {
    const cur   = cursors[demoId] || 0;
    const limit = Math.max(0, rows.length - LOOP_TAIL);
    cursors[demoId] = cur < rows.length - 1 ? cur + 1 : limit;
  }
}

wss.on('connection', (ws) => {
  console.log('[DEMO WS] Frontend client connected');
  const connectTimestamp = Date.now();
  ws._connectTimestamp = connectTimestamp;

  // Send initial frame (drones active at t=0)
  try {
    ws.send(JSON.stringify(getClientFrame(connectTimestamp)));
  } catch (_) {}

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (_) {}
  });

  ws.on('close', () => console.log('[DEMO WS] Frontend client disconnected'));
});

// ── Ticker: advance and broadcast at every TICK_INTERVAL ────────────────────
let tickerStarted = false;
function startTicker() {
  if (tickerStarted) return;
  tickerStarted = true;
  setInterval(() => {
    advanceCursors();
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          const connectTime = client._connectTimestamp || (Date.now() - 60000);
          client.send(JSON.stringify(getClientFrame(connectTime)));
        } catch (_) {}
      }
    });
  }, TICK_INTERVAL);
  console.log(`[DEMO] Live-feed ticker started (${TICK_INTERVAL}ms interval, staggered arrivals 0-38s)`);
}

// ── Static frontend build ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — must come after all API routes
app.use((req, res, next) => {
  if (path.extname(req.path)) return next();
  if (req.path.startsWith('/health') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) next(); // No built frontend present — that's fine in dev
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[DEMO] Server listening on http://0.0.0.0:${PORT}`);
  await loadDemoData();
  startTicker();
  console.log('[DEMO] Ready — open the frontend to see A2-D2 demo feed\n');
});
