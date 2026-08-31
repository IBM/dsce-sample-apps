// Utility function to safely parse JSON responses and handle HTML error pages
async function safeJsonParse(response) {
    const contentType = response.headers.get('content-type');
    
    // If response is not OK, try to get error message
    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
            } else {
                const text = await response.text();
                // Check if it's HTML error page
                if (text.includes('<html') || text.includes('<!DOCTYPE')) {
                    errorMessage = `Server returned HTML error page (${response.status}). Backend may be unavailable.`;
                } else {
                    errorMessage = text.substring(0, 200); // First 200 chars
                }
            }
        } catch (parseError) {
            // Keep the default error message
        }
        
        throw new Error(errorMessage);
    }
    
    // For successful responses, parse JSON
    try {
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            const text = await response.text();
            // Check if it's actually HTML when we expected JSON
            if (text.includes('<html') || text.includes('<!DOCTYPE')) {
                throw new Error('Server returned HTML instead of JSON. Backend may be misconfigured.');
            }
            // Try to parse as JSON anyway
            return JSON.parse(text);
        }
    } catch (error) {
        console.error('Failed to parse response:', error);
        throw new Error(`Invalid JSON response: ${error.message}`);
    }
}

// Global state
let currentMode = 'manual';  // Default to manual mode for safety
let activityLog = [];
let commandHistory = [];
let truckMarkers = {};
let routeLines = {};
let directionLines = {};
let stationMarkers = {};
let showOnlyActiveAlerts = true;

// Truck Filter State
let selectedTruckId = null;
let allTrucks = [];

// Infrastructure Monitor State
let monitorState = {
    isMonitoring: false,
    baseline: null,
    scalingDetected: false,
    lastCheck: null
};

// ============================================================================
// Truck Filter Functions
// ============================================================================

// Apply truck filter
function applyTruckFilter() {
    const select = document.getElementById('truckFilter');
    selectedTruckId = select.value || null;
    
    console.log('=== APPLYING FILTER ===');
    console.log('Selected Truck ID:', selectedTruckId);
    
    // Show/hide clear button
    const clearBtn = document.getElementById('clearFilterBtn');
    
    if (selectedTruckId) {
        clearBtn.style.display = 'block';
        
        // Find truck details
        const truck = allTrucks.find(t => t.truckId === selectedTruckId);
        console.log('Found truck:', truck);
        if (truck) {
            // Update map title
            const mapTitle = document.getElementById('mapTitle');
            if (mapTitle) {
                const statusIcon = getStatusIcon(truck.status);
                mapTitle.innerHTML = `${statusIcon} ${truck.truckId} - Live Tracking (${truck.origin} → ${truck.destination})`;
                console.log('Map title updated:', mapTitle.innerHTML);
            }
            
            // Update fleet title
            const fleetTitle = document.getElementById('fleetTitle');
            if (fleetTitle) {
                const statusIcon = getStatusIcon(truck.status);
                fleetTitle.innerHTML = `${statusIcon} ${truck.truckId} Status`;
                console.log('Fleet title updated:', fleetTitle.innerHTML);
            }
        }
        
        addActivityLog(`Filter applied: ${selectedTruckId}`, 'info');
    } else {
        clearBtn.style.display = 'none';
        
        // Reset titles
        const mapTitle = document.getElementById('mapTitle');
        if (mapTitle) {
            mapTitle.textContent = 'Live Fleet Tracking & Route Visualization';
            console.log('Map title reset');
        }
        
        const fleetTitle = document.getElementById('fleetTitle');
        if (fleetTitle) {
            const truckCount = Object.keys(truckRoutes).length;
            fleetTitle.innerHTML = `🚚 Fleet Status (<span id="fleetCount">${truckCount}</span> Trucks)`;
            console.log('Fleet title reset');
        }
    }
    
    console.log('Calling refreshDashboard()...');
    // Refresh all panels with filter
    refreshDashboard();
}

// Clear truck filter
function clearTruckFilter() {
    console.log('=== CLEARING FILTER ===');
    selectedTruckId = null;
    document.getElementById('truckFilter').value = '';
    document.getElementById('clearFilterBtn').style.display = 'none';
    
    // Reset titles
    const mapTitle = document.getElementById('mapTitle');
    if (mapTitle) {
        mapTitle.textContent = 'Live Fleet Tracking & Route Visualization';
        console.log('Map title reset');
    }
    
    const fleetTitle = document.getElementById('fleetTitle');
    if (fleetTitle) {
        const truckCount = Object.keys(truckRoutes).length;
        fleetTitle.innerHTML = `🚚 Fleet Status (<span id="fleetCount">${truckCount}</span> Trucks)`;
        console.log('Fleet title reset to:', fleetTitle.innerHTML);
    }
    
    addActivityLog('Filter cleared - showing all trucks', 'info');
    
    console.log('Calling refreshDashboard()...');
    // Refresh all panels
    refreshDashboard();
}

// Get status icon for truck
function getStatusIcon(status) {
    switch(status) {
        case 'normal': return '🟢';
        case 'warning': return '🟡';
        case 'critical': return '🔴';
        default: return '⚪';
    }
}

// Populate truck filter dropdown
function populateTruckFilter(trucks) {
    allTrucks = trucks;
    const select = document.getElementById('truckFilter');
    
    // Count active trucks
    const activeCount = trucks.filter(t => t.status !== 'offline').length;
    
    // Build options
    let options = `<option value="">All Trucks (${activeCount} active)</option>`;
    
    trucks.forEach(truck => {
        const statusIcon = getStatusIcon(truck.status);
        const alertText = truck.status === 'critical' ? ' (ALERT!)' : '';
        options += `<option value="${truck.truckId}">${statusIcon} ${truck.truckId} | ${truck.origin} → ${truck.destination}${alertText}</option>`;
    });
    
    select.innerHTML = options;
    
    // Restore previous selection if exists
    if (selectedTruckId) {
        select.value = selectedTruckId;
    }
}

// ============================================================================
// Infrastructure Monitor Functions
// ============================================================================

// Toggle monitor on/off
async function toggleMonitor() {
    const btn = document.getElementById('monitorToggleBtn');
    
    try {
        if (monitorState.isMonitoring) {
            // Stop monitor
            btn.disabled = true;
            btn.textContent = 'Stopping...';
            
            const response = await fetch('/api/monitor/stop', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                btn.textContent = 'Start Monitor';
                addActivityLog('Monitor stopped', 'info');
            }
            
        } else {
            // Start monitor
            btn.disabled = true;
            btn.textContent = 'Starting...';
            
            const response = await fetch('/api/monitor/start', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                btn.textContent = 'Stop Monitor';
                addActivityLog('Monitor started - watching for infrastructure scaling', 'auto');
            } else {
                alert('Failed to start monitor: ' + (data.error || 'Unknown error'));
                btn.textContent = 'Start Monitor';
            }
        }
        
        btn.disabled = false;
        
        // Update status immediately
        await updateMonitorStatus();
        
    } catch (error) {
        console.error('Error toggling monitor:', error);
        btn.disabled = false;
        btn.textContent = monitorState.isMonitoring ? 'Stop Monitor' : 'Start Monitor';
        alert('Error: ' + error.message);
    }
}

// Update monitor status display
async function updateMonitorStatus() {
    try {
        const response = await fetch('/api/monitor/status');
        const data = await response.json();
        
        if (data.success) {
            monitorState = data.data;
            renderMonitorStatus();
        }
    } catch (error) {
        console.error('Error fetching monitor status:', error);
    }
}

// Render monitor status in UI
function renderMonitorStatus() {
    const indicator = document.getElementById('monitorStatusIndicator');
    const statusText = document.getElementById('monitorStatusText');
    const description = document.getElementById('monitorStatusDescription');
    const details = document.getElementById('monitorDetails');
    const baseline = document.getElementById('monitorBaseline');
    const lastCheck = document.getElementById('monitorLastCheck');
    const btn = document.getElementById('monitorToggleBtn');
    
    if (!indicator || !statusText || !description) return;
    
    if (monitorState.isMonitoring) {
        // Running
        if (monitorState.scalingDetected) {
            indicator.style.background = 'var(--cds-support-success)';
            statusText.textContent = 'Scaling Detected!';
            description.textContent = '✅ Cooldown commands sent to critical trucks';
        } else {
            indicator.style.background = 'var(--cds-support-info)';
            statusText.textContent = 'Monitoring';
            description.textContent = 'Watching for infrastructure scaling (10%+ increase)...';
        }
        btn.textContent = 'Stop Monitor';
        
        // Show baseline details
        if (monitorState.baseline && details) {
            details.style.display = 'block';
            baseline.innerHTML = `
                <div>CPU Limit: ${monitorState.baseline.cpuLimit.toFixed(2)} cores</div>
                <div>CPU Request: ${monitorState.baseline.cpuRequest.toFixed(2)} cores</div>
                <div>Memory Limit: ${(monitorState.baseline.memLimit / 1024 / 1024).toFixed(0)} MB</div>
                <div>Memory Request: ${(monitorState.baseline.memRequest / 1024 / 1024).toFixed(0)} MB</div>
            `;
            
            // Show last check info
            if (monitorState.lastCheck && lastCheck) {
                const cpuPct = (monitorState.lastCheck.cpuIncrease * 100).toFixed(1);
                const memPct = (monitorState.lastCheck.memIncrease * 100).toFixed(1);
                const checkTime = new Date(monitorState.lastCheck.timestamp).toLocaleTimeString();
                
                lastCheck.innerHTML = `
                    <div>Last Check: ${checkTime}</div>
                    <div>CPU Change: ${cpuPct > 0 ? '+' : ''}${cpuPct}%</div>
                    <div>Memory Change: ${memPct > 0 ? '+' : ''}${memPct}%</div>
                `;
            }
        }
        
    } else {
        // Stopped
        indicator.style.background = 'var(--cds-border-subtle)';
        statusText.textContent = 'Stopped';
        description.textContent = 'Monitor not running';
        btn.textContent = 'Start Monitor';
        if (details) details.style.display = 'none';
    }
}

// Mock Turbonomic Alerts Functions
// ============================================================================

// Fetch pending mock alerts
async function fetchMockAlerts() {
    try {
        const response = await fetch('/api/mock-alerts');
        const data = await safeJsonParse(response);
        
        if (data.success && data.count > 0) {
            renderMockAlerts(data.data);
        } else {
            // Clear alerts display if none pending
            const container = document.getElementById('mockAlertsContainer');
            if (container) {
                container.innerHTML = '';
            }
        }
    } catch (error) {
        console.error('Error fetching mock alerts:', error);
    }
}

// Render mock alerts in UI (matching Turbonomic style)
function renderMockAlerts(alerts) {
    const container = document.getElementById('mockAlertsContainer');
    if (!container) return;
    
    if (!alerts || alerts.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = alerts.map(alert => {
        const severityColor = 'var(--cds-support-error)'; // CRITICAL
        const severityIcon = '🔴';
        const createDate = new Date(alert.created).toLocaleString();
        
        return `
            <div id="mock-alert-${alert.id}" style="margin-bottom: var(--cds-spacing-05); padding: var(--cds-spacing-05); background: var(--cds-layer-02); border-left: 3px solid ${severityColor};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div style="font-weight: 600; color: var(--cds-text-primary);">
                        ${severityIcon} ${alert.type}
                    </div>
                    <div style="font-size: 0.75rem; color: ${severityColor}; font-weight: 600;">
                        CRITICAL
                    </div>
                </div>
                <div style="font-size: 0.875rem; color: var(--cds-text-secondary); margin-bottom: 0.5rem;">
                    ${alert.description}
                </div>
                <div style="font-size: 0.75rem; color: var(--cds-text-placeholder); margin-bottom: 0.5rem;">
                    <strong>Target:</strong> ${alert.target}<br>
                    <strong>CPU Change:</strong> ${alert.details.cpuChange} | <strong>Memory Change:</strong> ${alert.details.memoryChange}
                </div>
                <div style="font-size: 0.75rem; color: var(--cds-text-placeholder); margin-bottom: var(--cds-spacing-03);">
                    <strong>Recommendation:</strong> ${alert.recommendation} | <strong>Created:</strong> ${createDate}
                </div>
                <div id="mock-alert-buttons-${alert.id}" style="display: flex; gap: 0.5rem;">
                    <button onclick='executeMockAlert("${alert.id}")' style="
                        background: var(--cds-interactive);
                        color: var(--cds-text-on-color);
                        border: none;
                        padding: 0.375rem 0.75rem;
                        font-family: 'IBM Plex Sans', sans-serif;
                        font-size: 0.75rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background 0.11s;
                    " onmouseover="this.style.background='var(--cds-interactive-hover)'" onmouseout="this.style.background='var(--cds-interactive)'">
                        ✓ Execute Action
                    </button>
                    <button onclick="dismissMockAlert('${alert.id}')" style="
                        background: var(--cds-layer-03);
                        color: var(--cds-text-secondary);
                        border: 1px solid var(--cds-border-subtle);
                        padding: 0.375rem 0.75rem;
                        font-family: 'IBM Plex Sans', sans-serif;
                        font-size: 0.75rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.11s;
                    " onmouseover="this.style.background='var(--cds-layer-02)'" onmouseout="this.style.background='var(--cds-layer-03)'">
                        ✕ Dismiss
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Execute mock alert (triggers automation)
async function executeMockAlert(alertId) {
    try {
        const response = await fetch(`/api/mock-alerts/${alertId}/execute`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            const result = data.automationResult;
            const alert = data.alert;
            
            // Add main execution log
            const logMessage = `Mock alert executed: ${alert.type} - ${result.message} (${result.total} truck${result.total !== 1 ? 's' : ''})`;
            addActivityLog(logMessage, result.mode === 'manual' ? 'manual' : 'auto');
            
            // If AUTO mode, add detailed action logs
            if (result.mode === 'auto' && result.actions && result.actions.length > 0) {
                result.actions.forEach(action => {
                    addActivityLog(`  → ${action}`, 'auto');
                });
                
                // Add truck details
                if (result.trucks && result.trucks.length > 0) {
                    result.trucks.forEach(truck => {
                        addActivityLog(`  → ${truck.id} (${truck.name}): $${truck.cargoValue.toLocaleString()}`, 'auto');
                    });
                }
            }
            
            // Add to executed actions history (like Turbonomic actions)
            await saveExecutedAction({
                id: alert.id,
                type: alert.type,
                target: alert.target,
                description: alert.description,
                recommendation: alert.recommendation,
                mode: result.mode,
                result: result.message,
                source: 'Mock Alert'
            });
            
            // Remove alert from display
            await fetchMockAlerts();
            
            // Update monitor status
            await updateMonitorStatus();
            
            console.log('✅ Mock alert executed:', {
                alert: alert.type,
                mode: result.mode,
                trucks: result.total,
                message: result.message,
                actions: result.actions
            });
        } else {
            alert('Failed to execute alert: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error executing mock alert:', error);
        alert('Error: ' + error.message);
    }
}

// Dismiss mock alert
async function dismissMockAlert(alertId) {
    try {
        const response = await fetch(`/api/mock-alerts/${alertId}/dismiss`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            addActivityLog('Mock alert dismissed', 'info');
            
            // Remove alert from display
            await fetchMockAlerts();
        } else {
            alert('Failed to dismiss alert: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error dismissing mock alert:', error);
        alert('Error: ' + error.message);
    }
}

// Truck routes (source to destination) - All 10 trucks
const truckRoutes = {
    'TRUCK-001': {
        origin: { lat: 42.3601, lng: -71.0589, name: 'Boston Distribution Center' },
        destination: { lat: 40.7128, lng: -74.0060, name: 'New York Medical Hub' }
    },
    'TRUCK-002': {
        origin: { lat: 41.8781, lng: -87.6298, name: 'Chicago Warehouse' },
        destination: { lat: 42.3314, lng: -83.0458, name: 'Detroit Medical Center' }
    },
    'TRUCK-003': {
        origin: { lat: 42.3601, lng: -71.0589, name: 'Boston Distribution Center' },
        destination: { lat: 40.7128, lng: -74.0060, name: 'New York Medical Hub' }
    },
    'TRUCK-004': {
        origin: { lat: 41.8781, lng: -87.6298, name: 'Chicago Warehouse' },
        destination: { lat: 42.3314, lng: -83.0458, name: 'Detroit Medical Center' }
    },
    'TRUCK-005': {
        origin: { lat: 39.9526, lng: -75.1652, name: 'Philadelphia Hub' },
        destination: { lat: 39.2904, lng: -76.6122, name: 'Baltimore Center' }
    },
    'TRUCK-006': {
        origin: { lat: 38.9072, lng: -77.0369, name: 'Washington DC Depot' },
        destination: { lat: 37.5407, lng: -77.4360, name: 'Richmond Facility' }
    },
    'TRUCK-007': {
        origin: { lat: 43.0389, lng: -87.9065, name: 'Milwaukee Center' },
        destination: { lat: 43.0731, lng: -89.4012, name: 'Madison Hub' }
    },
    'TRUCK-008': {
        origin: { lat: 41.4993, lng: -81.6944, name: 'Cleveland Depot' },
        destination: { lat: 40.4406, lng: -79.9959, name: 'Pittsburgh Center' }
    },
    'TRUCK-009': {
        origin: { lat: 39.7684, lng: -86.1581, name: 'Indianapolis Hub' },
        destination: { lat: 39.9612, lng: -82.9988, name: 'Columbus Facility' }
    },
    'TRUCK-010': {
        origin: { lat: 42.8864, lng: -78.8784, name: 'Buffalo Center' },
        destination: { lat: 43.1566, lng: -77.6088, name: 'Rochester Hub' }
    }
};

// Truck names mapping
const truckNames = {
    'TRUCK-001': 'Pharma Express Alpha',
    'TRUCK-002': 'Pharma Express Beta',
    'TRUCK-003': 'Pharma Express Gamma',
    'TRUCK-004': 'Pharma Express Delta',
    'TRUCK-005': 'Pharma Express Epsilon',
    'TRUCK-006': 'Pharma Express Zeta',
    'TRUCK-007': 'Pharma Express Eta',
    'TRUCK-008': 'Pharma Express Theta',
    'TRUCK-009': 'Pharma Express Iota',
    'TRUCK-010': 'Pharma Express Kappa'
};

// COMMENTED OUT: Old map initialization - now using operations-new.js with newMap
// const map = L.map('map').setView([41.5, -80], 6);
// L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
//     attribution: '© OpenStreetMap contributors © CARTO',
//     subdomains: 'abcd',
//     maxZoom: 20
// }).addTo(map);

// Placeholder map variable for compatibility
let map = null;

// Custom icons
const truckIcons = {
    normal: L.divIcon({
        html: '<div style="background: #10b981; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">🚚</div>',
        className: '',
        iconSize: [32, 32]
    }),
    critical: L.divIcon({
        html: '<div style="background: #ef4444; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); animation: pulse 1s infinite;">🚨</div>',
        className: '',
        iconSize: [32, 32]
    })
};

const stationIcon = L.divIcon({
    html: '<div style="background: #3b82f6; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">🏥</div>',
    className: '',
    iconSize: [28, 28]
});

// Track last command sent to each truck
const lastCommands = {};
Object.keys(truckRoutes).forEach(truckId => {
    lastCommands[truckId] = 'None';
});

// Track truck data
const truckData = {};

// Update gauge
function updateGauge(gaugeId, temperature) {
    const gauge = document.getElementById(gaugeId);
    if (!gauge) return;
    
    const minTemp = -30;
    const maxTemp = 10;
    const normalizedTemp = ((temperature - minTemp) / (maxTemp - minTemp)) * 100;
    const circumference = 377; // 2 * PI * radius (60)
    const offset = circumference - (normalizedTemp / 100) * circumference;
    
    gauge.style.strokeDashoffset = offset;
    
    // Color based on temperature
    if (temperature > -10) {
        gauge.style.stroke = '#ef4444'; // Red
    } else if (temperature > -15) {
        gauge.style.stroke = '#f59e0b'; // Orange
    } else {
        gauge.style.stroke = '#10b981'; // Green
    }
}

// Create truck card dynamically
function createTruckCard(truckId) {
    const truckNum = truckId.split('-')[1];
    const truckName = truckNames[truckId] || 'Unknown';
    
    return `
        <div class="truck-card" id="${truckId}Card">
            <h3>${truckId} - ${truckName}</h3>
            <div class="truck-temp">
                <svg width="150" height="150">
                    <circle cx="75" cy="75" r="60" fill="none" stroke="rgba(200,200,200,0.3)" stroke-width="12"/>
                    <circle id="gauge${truckNum}" cx="75" cy="75" r="60" fill="none" stroke="#10b981" stroke-width="12"
                            stroke-dasharray="377" stroke-dashoffset="377" stroke-linecap="round"/>
                </svg>
                <div class="temp-value" id="temp${truckNum}">--°C</div>
            </div>
            <div class="truck-status-badge status-ok" id="status${truckNum}">⏳ Waiting...</div>
            <div class="truck-info-line" id="route${truckNum}">Route: Loading...</div>
            <div class="truck-info-line" id="gps${truckNum}">GPS: Loading...</div>
            <div class="truck-info-line" id="coolant${truckNum}">Coolant: --</div>
            <div class="truck-info-line" id="command${truckNum}" style="color: #f59e0b; font-weight: 600;">Command: None</div>
        </div>
    `;
}

// Initialize truck cards
function initializeTruckCards() {
    const container = document.getElementById('truckStatusGrid');
    const truckIds = Object.keys(truckRoutes);
    
    container.innerHTML = truckIds.map(truckId => createTruckCard(truckId)).join('');
    document.getElementById('fleetCount').textContent = truckIds.length;
    
    // Populate truck selector
    const selector = document.getElementById('truckSelector');
    selector.innerHTML = '<option value="">Select a truck...</option>' +
        truckIds.map(truckId => `<option value="${truckId}">${truckId} - ${truckNames[truckId]}</option>`).join('');
    
    // Initialize truck data
    truckIds.forEach(truckId => {
        truckData[truckId] = {
            temperature: null,
            gps: null,
            status: 'waiting',
            lastUpdate: null
        };
    });
}

// Draw route lines for all trucks
function drawRouteLines() {
    Object.keys(truckRoutes).forEach(truckId => {
        const route = truckRoutes[truckId];
        
        if (routeLines[truckId]) {
            map.removeLayer(routeLines[truckId]);
        }

        const line = L.polyline([
            [route.origin.lat, route.origin.lng],
            [route.destination.lat, route.destination.lng]
        ], {
            color: '#94a3b8',
            weight: 3,
            opacity: 0.6,
            dashArray: '10, 10'
        }).addTo(map);

        routeLines[truckId] = line;

        // Add origin marker
        L.marker([route.origin.lat, route.origin.lng], {
            icon: L.divIcon({
                html: '<div style="background: #10b981; padding: 4px 8px; border-radius: 4px; color: white; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">📦 ' + route.origin.name + '</div>',
                className: '',
                iconSize: [120, 20]
            })
        }).addTo(map);

        // Add destination marker
        L.marker([route.destination.lat, route.destination.lng], {
            icon: L.divIcon({
                html: '<div style="background: #ef4444; padding: 4px 8px; border-radius: 4px; color: white; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏁 ' + route.destination.name + '</div>',
                className: '',
                iconSize: [120, 20]
            })
        }).addTo(map);
    });
}

// Load all stations
async function loadAllStations() {
    try {
        const trucks = ['TRUCK-001', 'TRUCK-002'];
        
        for (const truckId of trucks) {
            const response = await fetch(`/api/stations/route/${truckId}`);
            const result = await response.json();
            const data = result.data || result;
            
            if (data && Array.isArray(data)) {
                data.forEach(station => {
                    if (!stationMarkers[station.id]) {
                        const marker = L.marker([station.location.latitude, station.location.longitude], {
                            icon: stationIcon
                        }).addTo(map);
                        
                        marker.bindPopup(`
                            <b>${station.name}</b><br>
                            ${station.address}<br>
                            Type: ${station.type}<br>
                            Services: ${station.services.join(', ')}<br>
                            Capacity: ${station.capacity} trucks
                        `);
                        
                        stationMarkers[station.id] = marker;
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading stations:', error);
    }
}

// Add activity log entry
function addActivityLog(message, type = 'info') {
    const log = document.getElementById('activityLog');
    if (!log) {
        console.log('Activity log element not found (old Operations tab removed)');
        return;
    }
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-time">${time}</span>${message}`;
    
    log.insertBefore(entry, log.firstChild);
    
    // Keep only last 50 entries
    while (log.children.length > 50) {
        log.removeChild(log.lastChild);
    }
}

// Add command status
function addCommandStatus(truckId, command, status, mode) {
    const list = document.getElementById('commandStatusList');
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `command-status-item command-${status}`;
    entry.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">${truckId}: ${command}</div>
        <div style="font-size: 0.8em; color: #666;">
            ${time} | Mode: ${mode} | Status: ${status}
        </div>
    `;
    
    list.insertBefore(entry, list.firstChild);
    
    // Update commands executed counter
    const counter = document.getElementById('commandsExecuted');
    counter.textContent = parseInt(counter.textContent) + 1;
    
    // Keep only last 20 entries
    while (list.children.length > 20) {
        list.removeChild(list.lastChild);
    }
}

// Set mode (manual/auto)
async function setMode(mode) {
    currentMode = mode;
    document.getElementById('manualBtn').classList.toggle('active', mode === 'manual');
    document.getElementById('autoBtn').classList.toggle('active', mode === 'auto');
    document.getElementById('manualControlSection').style.display = mode === 'manual' ? 'block' : 'none';
    
    // Sync mode with backend
    try {
        await fetch('/api/monitor/mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
        console.log(`Mode synced with backend: ${mode}`);
    } catch (error) {
        console.error('Error syncing mode with backend:', error);
    }
    
    const modeLabel = mode === 'manual' ? 'MANUAL' : 'AUTOMATED';
    const modeDesc = mode === 'manual'
        ? 'User must manually send commands to trucks'
        : 'System will automatically respond to critical situations';
    
    addActivityLog(`🔄 Switched to ${modeLabel} mode - ${modeDesc}`, mode === 'auto' ? 'auto' : 'manual');
}

// Send command to truck
async function sendCommand(command) {
    const truckId = document.getElementById('truckSelector').value;
    if (!truckId) {
        alert('Please select a truck first');
        return;
    }
    
    try {
        const response = await fetch(`/api/trucks/${truckId}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        });
        
        const result = await response.json();
        
        if (result.success) {
            addActivityLog(`👤 Manual: ${command} sent to ${truckId}`, 'manual');
            addCommandStatus(truckId, command, 'executed', 'Manual');
            lastCommands[truckId] = command;
        } else {
            addActivityLog(`❌ Failed to send ${command} to ${truckId}`, 'alert');
            addCommandStatus(truckId, command, 'failed', 'Manual');
        }
    } catch (error) {
        console.error('Error sending command:', error);
        addActivityLog(`❌ Error: ${error.message}`, 'alert');
    }
}

// Find nearby station
async function findNearbyStation() {
    const truckId = document.getElementById('truckSelector').value;
    if (!truckId) {
        alert('Please select a truck first');
        return;
    }
    
    const truck = truckData[truckId];
    if (!truck || !truck.gps) {
        alert('No GPS data available for this truck');
        return;
    }
    
    try {
        const response = await fetch(`/api/stations/nearby?latitude=${truck.gps.latitude}&longitude=${truck.gps.longitude}&radius=100`);
        const result = await response.json();
        const data = result.data || result;
        
        if (data && data.length > 0) {
            const nearest = data[0];
            addActivityLog(`📍 Nearest station: ${nearest.name} (${nearest.distance.toFixed(1)}km)`, 'manual');
            
            // Add station marker if not exists
            if (!stationMarkers[nearest.id]) {
                const marker = L.marker([nearest.location.latitude, nearest.location.longitude], {
                    icon: stationIcon
                }).addTo(map);
                marker.bindPopup(`<b>${nearest.name}</b><br>${nearest.address}<br>Distance: ${nearest.distance.toFixed(1)}km`);
                stationMarkers[nearest.id] = marker;
            }
            
            // Pan map to show both truck and station
            map.fitBounds([
                [truck.gps.latitude, truck.gps.longitude],
                [nearest.location.latitude, nearest.location.longitude]
            ], { padding: [50, 50] });
        } else {
            addActivityLog(`📍 No nearby stations found`, 'manual');
        }
    } catch (error) {
        console.error('Error finding station:', error);
        addActivityLog(`❌ Error finding station: ${error.message}`, 'alert');
    }
}

// Automated response system
const automatedResponseTriggered = new Set();

async function automatedResponse(truckId, temperature, gps) {
    if (currentMode !== 'auto') return;
    
    addActivityLog(`🤖 Automated: Temperature breach detected for ${truckId} (${temperature}°C)`, 'auto');
    
    // Step 1: Emergency cooling
    try {
        await fetch(`/api/trucks/${truckId}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'Emergency_Cooling_On' })
        });
        
        addActivityLog(`🤖 Automated: Emergency cooling activated for ${truckId}`, 'auto');
        addCommandStatus(truckId, 'Emergency_Cooling_On', 'executed', 'Auto');
        lastCommands[truckId] = 'Emergency_Cooling_On';
    } catch (error) {
        console.error('Error activating cooling:', error);
    }
    
    // Step 2: Find nearest station
    try {
        const stationsRes = await fetch(`/api/stations/nearby?latitude=${gps.latitude}&longitude=${gps.longitude}&radius=100`);
        const stationsResult = await stationsRes.json();
        const stationsData = stationsResult.data || stationsResult;
        
        if (stationsData && stationsData.length > 0) {
            const nearest = stationsData[0];
            addActivityLog(`🤖 Automated: Nearest station - ${nearest.name} (${nearest.distance.toFixed(1)}km)`, 'auto');
            
            // Add station marker
            if (!stationMarkers[nearest.id]) {
                const marker = L.marker([nearest.location.latitude, nearest.location.longitude], {
                    icon: stationIcon
                }).addTo(map);
                marker.bindPopup(`<b>${nearest.name}</b><br>${nearest.address}<br>Distance: ${nearest.distance.toFixed(1)}km`);
                stationMarkers[nearest.id] = marker;
            }
        } else {
            addActivityLog(`🤖 Automated: No nearby stations found for ${truckId}`, 'auto');
        }
    } catch (error) {
        console.error('Error finding station:', error);
    }
    
    // Step 3: Pull over command
    setTimeout(async () => {
        try {
            await fetch(`/api/trucks/${truckId}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'Pull_Over' })
            });
            
            addActivityLog(`🤖 Automated: Pull over command sent to ${truckId}`, 'auto');
            addCommandStatus(truckId, 'Pull_Over', 'executed', 'Auto');
            lastCommands[truckId] = 'Pull_Over';
        } catch (error) {
            console.error('Error sending pull over:', error);
        }
    }, 2000);
}

// Refresh dashboard (called when filter changes)
function refreshDashboard() {
    fetchData();
}

// Fetch and update data
async function fetchData() {
    try {
        // Fetch trucks and alerts in parallel (telemetry endpoint removed - not available in fleetops-backend)
        const [trucksRes, alertsRes] = await Promise.all([
            fetch('/api/trucks'),
            // fetch('/api/telemetry?limit=50'),  // COMMENTED OUT - Not available in fleetops-backend
            fetch('/api/alerts?limit=20&active_only=true')  // Fetch only active (unacknowledged) alerts
        ]);
        
        const trucksResult = await trucksRes.json();
        const telemetryResult = { items: [] }; // Empty telemetry data
        const alertsResult = await alertsRes.json();
        
        // Extract data from response wrapper
        const trucksData = trucksResult.data || trucksResult;
        const telemetryData = telemetryResult.data || telemetryResult;
        const alertsData = alertsResult.data || alertsResult;
        
        // Build truck list for filter dropdown
        const truckList = [];
        if (Array.isArray(telemetryData)) {
            Object.keys(truckRoutes).forEach(truckId => {
                const record = telemetryData.find(t => t.truckId === truckId);
                if (record) {
                    const isCritical = record.temperature > -10;
                    const route = truckRoutes[truckId];
                    truckList.push({
                        truckId: truckId,
                        origin: route.origin.name.split(' ')[0], // Short name
                        destination: route.destination.name.split(' ')[0], // Short name
                        status: isCritical ? 'critical' : 'normal',
                        temperature: record.temperature
                    });
                }
            });
        }
        populateTruckFilter(truckList);
        
        // Populate agents truck dropdown if AgentsModule is available
        // For v2 backend, fetch truck data directly from /api/trucks
        // Store trucksData globally for agents.js to access
        window.trucksData = trucksData;
        
        if (typeof AgentsModule !== 'undefined' && AgentsModule.populateAgentTruckDropdown) {
            // Check if trucksData is available and has the v2 structure (with nested telemetry)
            if (Array.isArray(trucksData) && trucksData.length > 0 && trucksData[0].telemetry) {
                // v2 backend: Build truck list from TruckState objects
                const agentTruckList = trucksData.map(truck => ({
                    truckId: truck.truckId,
                    origin: truck.currentTrip?.origin?.name?.split(' ')[0] || 'Unknown',
                    destination: truck.currentTrip?.destination?.name?.split(' ')[0] || 'Unknown',
                    status: (truck.telemetry?.temperature > -10) ? 'critical' : 'normal',
                    temperature: truck.telemetry?.temperature
                }));
                AgentsModule.populateAgentTruckDropdown(agentTruckList);
            } else {
                // v1 backend or fallback: Use the truckList built from telemetry
                AgentsModule.populateAgentTruckDropdown(truckList);
            }
        }
        
        // Apply filter to data
        let filteredTelemetry = telemetryData;
        let filteredAlerts = alertsData;
        
        if (selectedTruckId) {
            filteredTelemetry = Array.isArray(telemetryData)
                ? telemetryData.filter(t => t.truckId === selectedTruckId)
                : [];
            filteredAlerts = Array.isArray(alertsData)
                ? alertsData.filter(a => a.truckId === selectedTruckId)
                : [];
        }
        
        // Update stats (use filtered or all data)
        const displayTruckCount = selectedTruckId ? 1 : (Array.isArray(trucksData) ? trucksData.length : 0);
        document.getElementById('totalTrucks').textContent = displayTruckCount;
        // Display only active (unacknowledged) alerts count
        document.getElementById('totalAlerts').textContent = Array.isArray(filteredAlerts) ? filteredAlerts.length : 0;
        
        const criticalCount = Array.isArray(alertsData) 
            ? alertsData.filter(a => a.severity === 'critical' && a.status === 'active').length 
            : 0;
        document.getElementById('criticalAlerts').textContent = criticalCount;
        
        const totalValue = Array.isArray(trucksData) 
            ? trucksData.reduce((sum, t) => sum + (t.cargoValue || 0), 0) 
            : 0;
        document.getElementById('cargoValue').textContent = '$' + (totalValue / 1000).toFixed(0) + 'k';
        
        // Create telemetry lookup by truckId
        const telemetryByTruck = {};
        if (Array.isArray(telemetryData)) {
            telemetryData.forEach(record => {
                if (!telemetryByTruck[record.truckId]) {
                    telemetryByTruck[record.truckId] = record;
                }
            });
        }
        
        // Update map and truck cards
        Object.keys(truckRoutes).forEach(truckId => {
            const record = telemetryByTruck[truckId];
            if (!record) return;
            
            const isCritical = record.temperature > -10;
            const truckNum = truckId.split('-')[1];
            
            // Check if truck should be visible based on filter
            const isVisible = !selectedTruckId || truckId === selectedTruckId;
            
            // Update or create marker
            if (truckMarkers[truckId]) {
                truckMarkers[truckId].setLatLng([record.gps.latitude, record.gps.longitude]);
                truckMarkers[truckId].setIcon(isCritical ? truckIcons.critical : truckIcons.normal);
                // Highlight filtered truck or dim others
                if (selectedTruckId) {
                    truckMarkers[truckId].setOpacity(isVisible ? 1.0 : 0.3);
                } else {
                    truckMarkers[truckId].setOpacity(1.0);
                }
            } else {
                const marker = L.marker([record.gps.latitude, record.gps.longitude], {
                    icon: isCritical ? truckIcons.critical : truckIcons.normal,
                    zIndexOffset: 1000
                }).addTo(map);
                marker.bindPopup(`<b>${truckId}</b><br>Temp: ${record.temperature}°C<br>Coolant: ${record.coolantStatus}`);
                truckMarkers[truckId] = marker;
            }
            
            // Show/hide truck card based on filter
            const truckCard = document.getElementById(`${truckId}Card`);
            if (truckCard) {
                truckCard.style.display = isVisible ? 'block' : 'none';
                console.log(`Truck ${truckId}: isVisible=${isVisible}, display=${truckCard.style.display}`);
            } else {
                console.warn(`Truck card not found: ${truckId}Card`);
            }
            
            // Update truck card
            const tempEl = document.getElementById(`temp${truckNum}`);
            const statusEl = document.getElementById(`status${truckNum}`);
            const routeEl = document.getElementById(`route${truckNum}`);
            const gpsEl = document.getElementById(`gps${truckNum}`);
            const coolantEl = document.getElementById(`coolant${truckNum}`);
            const commandEl = document.getElementById(`command${truckNum}`);
            
            if (tempEl) tempEl.textContent = record.temperature.toFixed(2) + '°C';
            updateGauge(`gauge${truckNum}`, record.temperature);
            
            if (statusEl) {
                statusEl.textContent = isCritical ? '🚨 CRITICAL' : '✓ Normal';
                statusEl.className = 'truck-status-badge ' + (isCritical ? 'status-critical' : 'status-ok');
            }
            
            const route = truckRoutes[truckId];
            if (route && routeEl) {
                routeEl.textContent = `Route: ${route.origin.name} → ${route.destination.name}`;
            }
            
            if (gpsEl) gpsEl.textContent = `GPS: ${record.gps.latitude.toFixed(4)}, ${record.gps.longitude.toFixed(4)}`;
            if (coolantEl) coolantEl.textContent = `Coolant: ${record.coolantStatus}`;
            if (commandEl) commandEl.textContent = `Command: ${lastCommands[truckId] || 'None'}`;
            
            // Store truck data
            truckData[truckId] = {
                temperature: record.temperature,
                gps: record.gps,
                status: isCritical ? 'critical' : 'normal',
                lastUpdate: new Date()
            };
            
            // Trigger automated response if critical
            if (isCritical && !automatedResponseTriggered.has(truckId)) {
                automatedResponseTriggered.add(truckId);
                automatedResponse(truckId, record.temperature, record.gps);
            } else if (!isCritical && automatedResponseTriggered.has(truckId)) {
                automatedResponseTriggered.delete(truckId);
                addActivityLog(`✅ ${truckId} temperature returned to normal`, 'auto');
            }
        });
        
        // Update alerts (apply active filter on top of truck filter)
        const alertsContainer = document.getElementById('alertsContainer');
        let displayAlerts = showOnlyActiveAlerts && Array.isArray(filteredAlerts)
            ? filteredAlerts.filter(a => a.status === 'active')
            : filteredAlerts;
        
        if (!Array.isArray(displayAlerts) || displayAlerts.length === 0) {
            alertsContainer.innerHTML = showOnlyActiveAlerts
                ? '<div class="loading">No active alerts</div>'
                : '<div class="loading">No alerts</div>';
        } else {
            alertsContainer.innerHTML = displayAlerts.map(alert => {
                const statusBadge = alert.status === 'resolved'
                    ? '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7em; margin-left: 8px;">✓ Resolved</span>'
                    : alert.status === 'acknowledged'
                    ? '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7em; margin-left: 8px;">⚠ Ack</span>'
                    : '';
                
                const cardClass = alert.status === 'resolved'
                    ? 'alert-card'
                    : `alert-card alert-${alert.severity}`;
                
                const cardStyle = alert.status === 'resolved'
                    ? 'opacity: 0.6; border-color: #94a3b8; background: #f1f5f9;'
                    : '';
                
                return `
                    <div class="${cardClass}" style="${cardStyle}">
                        <div class="alert-header">
                            <span class="alert-severity">${alert.severity}${statusBadge}</span>
                            <span class="alert-time">${new Date(alert.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div class="alert-message">
                            <strong>${alert.truckId}</strong>: ${alert.message}
                        </div>
                        ${alert.resolvedAt ? `<div style="font-size: 0.75em; color: #666; margin-top: 4px;">Resolved: ${new Date(alert.resolvedAt).toLocaleTimeString()} by ${alert.resolvedBy}</div>` : ''}
                    </div>
                `;
            }).join('');
        }
        
        // Update connection status
        document.getElementById('connectionStatus').textContent = '🟢 Live Data';
        document.getElementById('connectionStatus').className = 'connection-status connected';
        
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('connectionStatus').textContent = '🔴 Server Error';
        document.getElementById('connectionStatus').className = 'connection-status disconnected';
    }
}

// Toggle alert filter
function toggleAlertFilter() {
    showOnlyActiveAlerts = !showOnlyActiveAlerts;
    document.getElementById('filterBtnText').textContent = showOnlyActiveAlerts ? 'Show All' : 'Active Only';
    fetchData();
    addActivityLog(showOnlyActiveAlerts ? 'Showing active alerts only' : 'Showing all alerts', 'info');
}
// ============================================================================
// INSTANA METRICS INTEGRATION
// ============================================================================

// Global variable for current timeframe
let currentTimeframe = 3600000; // Default: 1 hour

// Manual refresh button (kept for backward compatibility)
function refreshInstanaMetrics() {
    console.log('Manual refresh triggered');
    fetchInstanaMetrics();
}

// Fetch and display Instana service metrics
async function fetchInstanaServiceMetrics() {
    const loadingEl = document.getElementById('serviceMetricsLoading');
    const contentEl = document.getElementById('serviceMetricsContent');
    const errorEl = document.getElementById('serviceMetricsError');
    
    try {
        const response = await fetch(`/api/instana/service-metrics?windowSize=${currentTimeRange}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Hide loading, show content
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        if (errorEl) errorEl.style.display = 'none';
        
        // Process metrics
        if (data.items && data.items.length > 0) {
            // Calculate aggregate metrics
            let totalCalls = 0;
            let totalErrors = 0;
            let totalLatency = 0;
            let endpointCount = 0;
            
            data.items.forEach(item => {
                if (item.metrics) {
                    // Metrics are in format: [[timestamp, value]]
                    const calls = item.metrics['calls.per_second'] ? item.metrics['calls.per_second'][0][1] : 0;
                    const errors = item.metrics['errors.mean'] ? item.metrics['errors.mean'][0][1] : 0;
                    const latency = item.metrics['latency.mean'] ? item.metrics['latency.mean'][0][1] : 0;
                    
                    totalCalls += calls;
                    totalErrors += errors;
                    totalLatency += latency;
                    endpointCount++;
                }
            });
            
            // Update service metrics display
            const callsPerSec = totalCalls.toFixed(2);
            const errorRate = totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(2) : '0.00';
            const avgLatency = endpointCount > 0 ? (totalLatency / endpointCount).toFixed(2) : '0';
            
            document.getElementById('callsPerSecond').textContent = callsPerSec;
            document.getElementById('errorRate').textContent = `${errorRate}%`;
            document.getElementById('avgLatency').textContent = avgLatency;
            
            // Update endpoints list
            updateEndpointsList(data.items);
        } else {
            document.getElementById('callsPerSecond').textContent = '0';
            document.getElementById('errorRate').textContent = '0%';
            document.getElementById('avgLatency').textContent = '0';
        }
        
    } catch (error) {
        console.error('Error fetching Instana service metrics:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = `⚠️ Failed to load service metrics: ${error.message}`;
        }
    }
}

// Update endpoints list
function updateEndpointsList(items) {
    const listEl = document.getElementById('endpointsList');
    const loadingEl = document.getElementById('endpointsLoading');
    const contentEl = document.getElementById('endpointsContent');
    
    if (!listEl) return;
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
    
    // Sort by calls descending
    const sortedItems = items
        .filter(item => item.metrics && item.metrics['calls.per_second'])
        .sort((a, b) => {
            const aVal = a.metrics['calls.per_second'][0][1] || 0;
            const bVal = b.metrics['calls.per_second'][0][1] || 0;
            return bVal - aVal;
        })
        .slice(0, 10); // Top 10
    
    if (sortedItems.length === 0) {
        listEl.innerHTML = '<div style="padding: 1rem; color: var(--cds-text-secondary);">No endpoint data available</div>';
        return;
    }
    
    listEl.innerHTML = sortedItems.map(item => {
        const endpoint = item.name || 'Unknown';
        const calls = item.metrics['calls.per_second'][0][1].toFixed(2);
        const errors = item.metrics['errors.mean'][0][1] || 0;
        const latency = item.metrics['latency.mean'][0][1].toFixed(2);
        const errorRate = calls > 0 ? ((errors / calls) * 100).toFixed(1) : '0.0';
        
        return `
            <div style="padding: var(--cds-spacing-05); border-bottom: 1px solid var(--cds-border-subtle);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="font-weight: 600; color: var(--cds-text-primary); font-size: 0.875rem;">${endpoint}</div>
                    <div style="font-size: 0.75rem; color: var(--cds-text-secondary);">${calls} calls/s</div>
                </div>
                <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: var(--cds-text-secondary);">
                    <span>Latency: ${latency}ms</span>
                    <span style="color: ${errorRate > 1 ? 'var(--cds-support-error)' : 'var(--cds-support-success)'}">
                        Errors: ${errorRate}%
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// Fetch and display Instana infrastructure metrics
async function fetchInstanaInfraMetrics() {
    console.log('fetchInstanaInfraMetrics called');
    const loadingEl = document.getElementById('infraMetricsLoading');
    const contentEl = document.getElementById('infraMetricsContent');
    const errorEl = document.getElementById('infraMetricsError');
    
    console.log('Elements found:', {
        loadingEl: !!loadingEl,
        contentEl: !!contentEl,
        errorEl: !!errorEl
    });
    
    try {
        const url = `/api/instana/infra-metrics?windowSize=${currentTimeRange}`;
        console.log('Fetching from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Received data:', JSON.stringify(data, null, 2));
        
        // Hide loading, show content
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        if (errorEl) errorEl.style.display = 'none';
        
        // Process metrics
        if (data.items && data.items.length > 0) {
            const item = data.items[0]; // First deployment
            console.log('Processing item:', item);
            console.log('Item metrics:', item.metrics);
            
            if (item.metrics) {
                // CPU metrics - already in cores (not millicores in this API response)
                // Support both formats: with and without .MEAN suffix
                console.log('Available metrics keys:', Object.keys(item.metrics));
                
                const cpuRequestMetric = item.metrics['pods.required_cpu.MEAN'] || item.metrics['pods.required_cpu'];
                const cpuLimitMetric = item.metrics['pods.limit_cpu.MEAN'] || item.metrics['pods.limit_cpu'];
                const memRequestMetric = item.metrics['pods.required_mem.MEAN'] || item.metrics['pods.required_mem'];
                const memLimitMetric = item.metrics['pods.limit_mem.MEAN'] || item.metrics['pods.limit_mem'];
                
                console.log('CPU required metric:', cpuRequestMetric);
                console.log('CPU limit metric:', cpuLimitMetric);
                console.log('Memory required metric:', memRequestMetric);
                console.log('Memory limit metric:', memLimitMetric);
                
                const cpuRequests = cpuRequestMetric
                    ? cpuRequestMetric[0][1].toFixed(2)
                    : '0';
                const cpuLimits = cpuLimitMetric
                    ? cpuLimitMetric[0][1].toFixed(2)
                    : '0';
                
                // Memory metrics (convert from bytes to MB)
                const memRequests = memRequestMetric
                    ? (memRequestMetric[0][1] / (1024 * 1024)).toFixed(0)
                    : '0';
                const memLimits = memLimitMetric
                    ? (memLimitMetric[0][1] / (1024 * 1024)).toFixed(0)
                    : '0';
                
                console.log('Parsed values:', { cpuRequests, cpuLimits, memRequests, memLimits });
                
                // Update display
                document.getElementById('cpuRequests').textContent = `${cpuRequests} cores`;
                document.getElementById('cpuLimits').textContent = `${cpuLimits} cores`;
                document.getElementById('memRequests').textContent = `${memRequests} MB`;
                document.getElementById('memLimits').textContent = `${memLimits} MB`;
                
                // Calculate usage percentages
                const cpuUsagePercent = cpuLimits > 0 ? ((parseFloat(cpuRequests) / parseFloat(cpuLimits)) * 100).toFixed(1) : 0;
                const memUsagePercent = memLimits > 0 ? ((parseFloat(memRequests) / parseFloat(memLimits)) * 100).toFixed(1) : 0;
                
                // Update usage display with color coding
                const cpuUsageEl = document.getElementById('cpuUsage');
                const memUsageEl = document.getElementById('memUsage');
                
                if (cpuUsageEl) {
                    cpuUsageEl.textContent = `${cpuUsagePercent}%`;
                    cpuUsageEl.style.color = cpuUsagePercent > 80 ? 'var(--cds-support-error)' :
                                             cpuUsagePercent > 60 ? 'var(--cds-support-warning)' :
                                             'var(--cds-support-success)';
                }
                
                if (memUsageEl) {
                    memUsageEl.textContent = `${memUsagePercent}%`;
                    memUsageEl.style.color = memUsagePercent > 80 ? 'var(--cds-support-error)' :
                                             memUsagePercent > 60 ? 'var(--cds-support-warning)' :
                                             'var(--cds-support-success)';
                }
            }
        } else {
            document.getElementById('cpuRequests').textContent = 'N/A';
            document.getElementById('cpuLimits').textContent = 'N/A';
            document.getElementById('memRequests').textContent = 'N/A';
            document.getElementById('memLimits').textContent = 'N/A';
        }
        
    } catch (error) {
        console.error('Error fetching Instana infra metrics:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = `⚠️ Failed to load infrastructure metrics: ${error.message}`;
        }
    }
}

// ============================================================================
// INSTANA PERFORMANCE CHARTS
// ============================================================================

// Chart instances
let callsLatencyChart = null;
let cpuChart = null;
let memoryChart = null;
let currentTimeRange = 1800000; // Default: 30 minutes for all metrics and charts

// Helper function to format timestamps based on time range
function formatTimestamp(date, timeRange) {
    const hours = timeRange / 3600000;
    
    if (hours <= 1) {
        // For 1h: show time with seconds (HH:MM:SS)
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } else if (hours <= 6) {
        // For 6h: show time (HH:MM)
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } else if (hours <= 24) {
        // For 24h: show time (HH:MM)
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } else {
        // For 7d: show date and time (MM/DD HH:MM)
        const dateStr = date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit'
        });
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        return `${dateStr} ${timeStr}`;
    }
}

// Change time range for all metrics and charts (unified control)
function changeTimeRange(windowSize, buttonId) {
    currentTimeRange = windowSize;
    
    // Update button styles - reset all
    ['btn-5m', 'btn-30m', 'btn-1h', 'btn-6h', 'btn-24h'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.background = 'var(--cds-layer-02)';
            btn.style.color = 'var(--cds-text-secondary)';
            btn.style.border = '1px solid var(--cds-border-subtle)';
        }
    });
    
    // Highlight active button
    const activeBtn = document.getElementById(buttonId);
    if (activeBtn) {
        activeBtn.style.background = 'var(--cds-interactive)';
        activeBtn.style.color = 'var(--cds-text-on-color)';
        activeBtn.style.border = 'none';
    }
    
    // Fetch and update everything (metrics + charts)
    fetchInstanaMetrics();
}

// Initialize all charts
function initializeCharts() {
    // Calls & Latency Chart (Dual Y-axis)
    const callsLatencyCtx = document.getElementById('callsLatencyChart');
    if (callsLatencyCtx) {
        // Set canvas background to white
        callsLatencyCtx.style.backgroundColor = '#ffffff';
        
        callsLatencyChart = new Chart(callsLatencyCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Calls/sec',
                        data: [],
                        borderColor: '#0f62fe', // IBM Blue
                        backgroundColor: 'rgba(15, 98, 254, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#0f62fe',
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2,
                        yAxisID: 'y-calls',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Latency (ms)',
                        data: [],
                        borderColor: '#ff832b', // IBM Orange
                        backgroundColor: 'rgba(255, 131, 43, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#ff832b',
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2,
                        yAxisID: 'y-latency',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: '#161616',
                            font: {
                                size: 12,
                                family: "'IBM Plex Sans', sans-serif",
                                weight: '500'
                            },
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8
                        }
                    },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#161616',
                        bodyColor: '#161616',
                        borderColor: '#e0e0e0',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true
                    }
                },
                layout: {
                    padding: {
                        top: 10,
                        right: 15,
                        bottom: 10,
                        left: 10
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#e0e0e0',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#525252',
                            font: {
                                size: 11,
                                family: "'IBM Plex Sans', sans-serif"
                            }
                        }
                    },
                    'y-calls': {
                        type: 'linear',
                        position: 'left',
                        grid: {
                            color: '#e0e0e0',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#0f62fe',
                            font: {
                                size: 11,
                                family: "'IBM Plex Sans', sans-serif",
                                weight: '500'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Calls/sec',
                            color: '#0f62fe',
                            font: {
                                size: 12,
                                family: "'IBM Plex Sans', sans-serif",
                                weight: '600'
                            }
                        }
                    },
                    'y-latency': {
                        type: 'linear',
                        position: 'right',
                        grid: { display: false },
                        ticks: {
                            color: '#ff832b',
                            font: {
                                size: 11,
                                family: "'IBM Plex Sans', sans-serif",
                                weight: '500'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Latency (ms)',
                            color: '#ff832b',
                            font: {
                                size: 12,
                                family: "'IBM Plex Sans', sans-serif",
                                weight: '600'
                            }
                        }
                    }
                }
            }
        });
    }

    // Initial data fetch
    fetchAndUpdateCharts();
}

// Fetch and update all charts
async function fetchAndUpdateCharts() {
    try {
        console.log('Fetching chart data with time range:', currentTimeRange);
        
        // Update time range label
        const timeRangeLabel = document.getElementById('chart-time-range');
        if (timeRangeLabel) {
            const hours = currentTimeRange / 3600000;
            if (hours < 24) {
                timeRangeLabel.textContent = `${hours}h`;
            } else {
                const days = hours / 24;
                timeRangeLabel.textContent = `${days}d`;
            }
        }
        
        // Fetch service time-series data
        const serviceResponse = await fetch(`/api/instana/service-timeseries?windowSize=${currentTimeRange}`);
        const serviceData = await serviceResponse.json();
        console.log('Service data:', serviceData);
        
        // Update chart
        updateCallsLatencyChart(serviceData);
        
    } catch (error) {
        console.error('Error fetching chart data:', error);
    }
}

// Update Calls & Latency Chart
function updateCallsLatencyChart(data) {
    if (!callsLatencyChart) {
        console.log('Chart not initialized');
        return;
    }
    
    // Always clear existing data first
    callsLatencyChart.data.labels = [];
    callsLatencyChart.data.datasets[0].data = [];
    callsLatencyChart.data.datasets[1].data = [];
    
    if (!data.items || data.items.length === 0) {
        console.log('No data for calls/latency chart - displaying empty chart');
        // Force update to show empty chart
        callsLatencyChart.update('active');
        return;
    }
    
    console.log(`Processing ${data.items.length} endpoints for chart`);
    
    // Aggregate data from ALL endpoints using a Map for timestamp-based aggregation
    const aggregatedData = new Map();
    
    // Process each endpoint
    data.items.forEach((item, idx) => {
        const metrics = item.metrics;
        if (!metrics) return;
        
        // Find the metric keys dynamically (granularity varies: 30, 60, 180, 600, 1800)
        const callsKey = Object.keys(metrics).find(k => k.startsWith('calls.per_second.'));
        const latencyKey = Object.keys(metrics).find(k => k.startsWith('latency.mean.'));
        
        if (!callsKey) {
            console.log(`Endpoint ${idx}: No calls metric found. Available keys:`, Object.keys(metrics));
            return;
        }
        
        const callsPerSecond = metrics[callsKey];
        const latencyMean = latencyKey ? metrics[latencyKey] : null;
        
        if (!callsPerSecond || !Array.isArray(callsPerSecond)) return;
        
        console.log(`Endpoint ${idx}: Using ${callsKey} with ${callsPerSecond.length} data points`);
        
        // Aggregate calls and latency by timestamp
        callsPerSecond.forEach((callPoint, i) => {
            const timestamp = callPoint[0];
            const calls = callPoint[1] || 0;
            const latency = (latencyMean && latencyMean[i]) ? latencyMean[i][1] || 0 : 0;
            
            if (!aggregatedData.has(timestamp)) {
                aggregatedData.set(timestamp, {
                    calls: 0,
                    latencySum: 0,
                    latencyCount: 0
                });
            }
            
            const agg = aggregatedData.get(timestamp);
            agg.calls += calls;
            if (latency > 0) {
                agg.latencySum += latency * calls; // Weighted by calls
                agg.latencyCount += calls;
            }
        });
    });
    
    // Convert aggregated data to arrays, sorted by timestamp
    const sortedTimestamps = Array.from(aggregatedData.keys()).sort((a, b) => a - b);
    
    let timeLabels = [];
    let callsData = [];
    let latencyData = [];
    
    sortedTimestamps.forEach(timestamp => {
        const agg = aggregatedData.get(timestamp);
        const date = new Date(timestamp);
        const formattedTime = formatTimestamp(date, currentTimeRange);
        
        timeLabels.push(formattedTime);
        callsData.push(agg.calls);
        
        // Calculate weighted average latency
        const avgLatency = agg.latencyCount > 0 ? agg.latencySum / agg.latencyCount : 0;
        latencyData.push(avgLatency);
    });
    
    console.log(`Aggregated chart data: ${timeLabels.length} time points from ${data.items.length} endpoints`);
    
    // Sample data if too many points (keep every Nth point)
    const maxPoints = 100;
    if (timeLabels.length > maxPoints) {
        const step = Math.ceil(timeLabels.length / maxPoints);
        timeLabels = timeLabels.filter((_, i) => i % step === 0);
        callsData = callsData.filter((_, i) => i % step === 0);
        latencyData = latencyData.filter((_, i) => i % step === 0);
        console.log(`Sampled to ${timeLabels.length} points (step: ${step})`);
    }
    
    // Update chart with animation
    callsLatencyChart.data.labels = timeLabels;
    callsLatencyChart.data.datasets[0].data = callsData;
    callsLatencyChart.data.datasets[1].data = latencyData;
    callsLatencyChart.update('active'); // Use 'active' mode for smooth animation
}


// Update fetchInstanaMetrics to include charts
function fetchInstanaMetrics() {
    // Only fetch if we're on the Observe & Optimize tab
    const observeTab = document.getElementById('observe-tab');
    if (observeTab && observeTab.classList.contains('active')) {
        fetchInstanaServiceMetrics();
        fetchInstanaInfraMetrics();
        
        // Update charts if they exist
        if (callsLatencyChart) {
            fetchAndUpdateCharts();
        }
    }
}

// Update initInstanaMetrics to initialize charts
function initInstanaMetrics() {
    // Fetch immediately if on the tab
    fetchInstanaMetrics();
    
    // Initialize charts
    setTimeout(() => {
        initializeCharts();
    }, 1000); // Small delay to ensure DOM is ready
    
    // Set up periodic refresh (every 30 seconds)
    setInterval(fetchInstanaMetrics, 30000);
}

// ============================================================================
// TURBONOMIC ACTIONS INTEGRATION WITH EXECUTION HISTORY
// ============================================================================

// Get executed actions from server
async function getExecutedActions() {
    try {
        const response = await fetch('/api/execution-history');
        return await safeJsonParse(response);
    } catch (error) {
        console.error('Error fetching execution history:', error);
        return [];
    }
}

// Save executed action to server
async function saveExecutedAction(action) {
    try {
        const actionData = {
            ...action,
            executedAt: new Date().toISOString(),
            executedBy: 'FleetOps User'
        };
        
        console.log('💾 Saving action to history:', actionData);
        
        const response = await fetch('/api/execution-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(actionData)
        });
        
        console.log('📥 Save history response:', response.status, response.statusText);
        
        if (!response.ok) {
            let errorText = '';
            let errorData = null;
            
            try {
                // Try to parse as JSON first
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json();
                    errorText = errorData.message || errorData.error || JSON.stringify(errorData);
                } else {
                    errorText = await response.text();
                    // If it's HTML, extract a meaningful message
                    if (errorText.includes('<html')) {
                        errorText = `Server returned HTML error (${response.status}). Backend may be temporarily unavailable.`;
                    }
                }
            } catch (parseError) {
                errorText = `Unable to parse error response (${response.status})`;
            }
            
            console.error('❌ Failed to save history:', errorText);
            throw new Error(`Failed to save history: ${response.status} ${errorText}`);
        }
        
        const result = await safeJsonParse(response);
        console.log('✅ History saved successfully:', result);
        
        // Refresh display after saving
        await displayExecutedActions();
    } catch (error) {
        console.error('❌ Error saving execution history:', error);
        // Show error to user
        alert(`Warning: Failed to save execution history: ${error.message}`);
    }
}

// Clear all executed actions
async function clearExecutedActions() {
    if (confirm('Are you sure you want to clear all executed action history?')) {
        try {
            const response = await fetch('/api/execution-history', {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to clear history');
            
            await displayExecutedActions();
            console.log('✓ Executed actions history cleared');
        } catch (error) {
            console.error('Error clearing execution history:', error);
        }
    }
}

// Display executed actions history
async function displayExecutedActions() {
    const historyContainer = document.getElementById('turboExecutedHistory');
    if (!historyContainer) return;
    
    const executed = await getExecutedActions();
    
    if (executed.length === 0) {
        historyContainer.innerHTML = `
            <div style="padding: var(--cds-spacing-05); text-align: center; color: var(--cds-text-secondary);">
                <div style="font-size: 0.875rem;">No actions executed yet</div>
            </div>
        `;
        return;
    }
    
    // Add header with clear button
    const headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--cds-spacing-03); padding-bottom: var(--cds-spacing-03); border-bottom: 1px solid var(--cds-border-subtle);">
            <div style="font-size: 0.875rem; font-weight: 600; color: var(--cds-text-primary);">
                Executed Actions (${executed.length})
            </div>
            <button onclick="clearExecutedActions()" style="
                background: transparent;
                color: var(--cds-text-secondary);
                border: 1px solid var(--cds-border-subtle);
                padding: 0.25rem 0.5rem;
                font-family: 'IBM Plex Sans', sans-serif;
                font-size: 0.625rem;
                font-weight: 600;
                cursor: pointer;
                border-radius: 2px;
                transition: all 0.11s;
            " onmouseover="this.style.background='var(--cds-layer-02)'" onmouseout="this.style.background='transparent'">
                🗑️ Clear All
            </button>
        </div>
    `;
    
    const actionsHtml = executed.slice(0, 10).map(action => {
        const executedDate = new Date(action.executedAt).toLocaleString();
        // Safely access risk.severity with fallback
        const severity = action.risk?.severity || action.severity || 'INFO';
        const severityColor = severity === 'CRITICAL' ? 'var(--cds-support-error)' :
                             severity === 'MAJOR' ? 'var(--cds-support-warning)' :
                             'var(--cds-support-info)';
        
        return `
            <div style="margin-bottom: var(--cds-spacing-03); padding: var(--cds-spacing-04); background: var(--cds-layer-01); border-left: 2px solid ${severityColor};">
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--cds-text-primary); margin-bottom: 0.25rem;">
                    ${action.actionType}
                </div>
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: 0.25rem;">
                    ${action.details}
                </div>
                <div style="font-size: 0.625rem; color: var(--cds-text-placeholder);">
                    ✓ Executed: ${executedDate}
                </div>
            </div>
        `;
    }).join('');
    
    historyContainer.innerHTML = headerHtml + actionsHtml;
    
    // Show note if there are more than 10 actions
    if (executed.length > 10) {
        historyContainer.innerHTML += `
            <div style="padding: var(--cds-spacing-03); text-align: center; color: var(--cds-text-placeholder); font-size: 0.75rem;">
                Showing 10 of ${executed.length} executed actions
            </div>
        `;
    }
}

// Fetch and display Turbonomic pending actions
// Update connection status based on Turbonomic actions
function updateConnectionStatus(hasActions) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;
    
    if (hasActions) {
        statusEl.classList.remove('connected');
        statusEl.classList.add('disconnected');
        statusEl.textContent = 'Disconnected';
    } else {
        statusEl.classList.remove('disconnected');
        statusEl.classList.add('connected');
        statusEl.textContent = 'Connected';
    }
}

async function fetchTurbonomicActions() {
    const loadingEl = document.getElementById('turboActionsLoading');
    const contentEl = document.getElementById('turboActionsContent');
    const errorEl = document.getElementById('turboActionsError');
    const listEl = document.getElementById('turboActionsList');
    const countEl = document.getElementById('turboActionCount');
    
    try {
        const response = await fetch('/api/turbonomic/actions/pending');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Hide loading, show content
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        if (errorEl) errorEl.style.display = 'none';
        
        // Update count
        if (countEl) {
            countEl.textContent = `${data.count || 0} pending action${data.count !== 1 ? 's' : ''}`;
        }
        
        // Update connection status based on action count
        updateConnectionStatus(data.actions && data.actions.length > 0);
        
        // Display actions
        if (data.actions && data.actions.length > 0) {
            listEl.innerHTML = data.actions.map(action => {
                const severityColor = action.risk.severity === 'CRITICAL' ? 'var(--cds-support-error)' :
                                     action.risk.severity === 'MAJOR' ? 'var(--cds-support-warning)' :
                                     'var(--cds-support-info)';
                
                const severityIcon = action.risk.severity === 'CRITICAL' ? '🔴' :
                                    action.risk.severity === 'MAJOR' ? '🟡' : '🔵';
                
                const createDate = new Date(action.createTime).toLocaleString();
                const actionDataStr = JSON.stringify(action).replace(/"/g, '"');
                
                return `
                    <div id="action-${action.uuid}" style="margin-bottom: var(--cds-spacing-05); padding: var(--cds-spacing-05); background: var(--cds-layer-02); border-left: 3px solid ${severityColor};">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <div style="font-weight: 600; color: var(--cds-text-primary);">
                                ${severityIcon} ${action.actionType}
                            </div>
                            <div style="font-size: 0.75rem; color: ${severityColor}; font-weight: 600;">
                                ${action.risk.severity}
                            </div>
                        </div>
                        <div style="font-size: 0.875rem; color: var(--cds-text-secondary); margin-bottom: 0.5rem;">
                            ${action.details}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--cds-text-placeholder); margin-bottom: 0.5rem;">
                            <strong>Risk:</strong> ${action.risk.description}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--cds-text-placeholder); margin-bottom: var(--cds-spacing-03);">
                            <strong>Category:</strong> ${action.risk.subCategory} | <strong>Created:</strong> ${createDate}
                        </div>
                        <div id="action-buttons-${action.uuid}" style="display: flex; gap: 0.5rem;">
                            <button onclick='executeTurboAction("${action.uuid}", ${actionDataStr})' style="
                                background: var(--cds-interactive);
                                color: var(--cds-text-on-color);
                                border: none;
                                padding: 0.375rem 0.75rem;
                                font-family: 'IBM Plex Sans', sans-serif;
                                font-size: 0.75rem;
                                font-weight: 600;
                                cursor: pointer;
                                transition: background 0.11s;
                            " onmouseover="this.style.background='var(--cds-interactive-hover)'" onmouseout="this.style.background='var(--cds-interactive)'">
                                ✓ Execute Action
                            </button>
                            <button onclick="dismissTurboAction('${action.uuid}')" style="
                                background: var(--cds-layer-03);
                                color: var(--cds-text-secondary);
                                border: 1px solid var(--cds-border-subtle);
                                padding: 0.375rem 0.75rem;
                                font-family: 'IBM Plex Sans', sans-serif;
                                font-size: 0.75rem;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.11s;
                            " onmouseover="this.style.background='var(--cds-layer-02)'" onmouseout="this.style.background='var(--cds-layer-03)'">
                                ✕ Dismiss
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            listEl.innerHTML = `
                <div style="padding: var(--cds-spacing-05); text-align: center; color: var(--cds-text-secondary);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">✓</div>
                    <div>No pending optimization actions</div>
                    <div style="font-size: 0.75rem; margin-top: 0.5rem;">Your application is running optimally</div>
                </div>
            `;
        }
        
        // Display executed actions history
        displayExecutedActions();
        
    } catch (error) {
        console.error('Error fetching Turbonomic actions:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = `⚠️ Failed to load optimization actions: ${error.message}`;
        }
    }
}

// Execute a Turbonomic action - show inline confirmation
function executeTurboAction(uuid, actionData) {
    console.log('🔧 executeTurboAction called with UUID:', uuid);
    
    const buttonContainer = document.getElementById(`action-buttons-${uuid}`);
    if (!buttonContainer) return;
    
    const actionDataStr = JSON.stringify(actionData).replace(/"/g, '"');
    
    // Show inline confirmation
    buttonContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.75rem; background: var(--cds-layer-01); border-radius: 2px;">
            <span style="font-size: 0.75rem; color: var(--cds-text-secondary);">Confirm execution?</span>
            <button onclick='confirmExecuteTurboAction("${uuid}", ${actionDataStr})' style="
                background: #24a148;
                color: white;
                border: none;
                padding: 0.25rem 0.5rem;
                font-family: 'IBM Plex Sans', sans-serif;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                border-radius: 2px;
            ">Yes</button>
            <button onclick="fetchTurbonomicActions()" style="
                background: var(--cds-layer-03);
                color: var(--cds-text-secondary);
                border: 1px solid var(--cds-border-subtle);
                padding: 0.25rem 0.5rem;
                font-family: 'IBM Plex Sans', sans-serif;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                border-radius: 2px;
            ">No</button>
        </div>
    `;
}

// Confirm and execute action
async function confirmExecuteTurboAction(uuid, actionData) {
    console.log('✅ User confirmed, executing action...');
    
    const buttonContainer = document.getElementById(`action-buttons-${uuid}`);
    const actionElement = document.getElementById(`action-${uuid}`);
    
    if (buttonContainer) {
        buttonContainer.innerHTML = `
            <div style="padding: 0.375rem 0.75rem; color: var(--cds-text-secondary); font-size: 0.75rem;">
                ⏳ Executing...
            </div>
        `;
    }
    
    try {
        console.log('📤 Sending POST request to /api/turbonomic/actions/execute');
        const response = await fetch('/api/turbonomic/actions/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action_uuids: [uuid]
            })
        });
        
        console.log('📥 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ Action executed successfully:', result);
        
        // Save to execution history
        await saveExecutedAction(actionData);
        
        // Remove the action from UI immediately
        if (actionElement) {
            actionElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            actionElement.style.opacity = '0';
            actionElement.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                actionElement.remove();
                
                // Update the action count
                const listEl = document.getElementById('turboActionsList');
                const remainingActions = listEl ? listEl.querySelectorAll('[id^="action-"]').length : 0;
                const countEl = document.getElementById('turboActionCount');
                if (countEl) {
                    countEl.textContent = remainingActions > 0 ? `${remainingActions} pending` : '-';
                }
                
                // If no actions remain, show the "no pending actions" message
                if (remainingActions === 0 && listEl) {
                    listEl.innerHTML = `
                        <div style="padding: var(--cds-spacing-05); text-align: center; color: var(--cds-text-secondary);">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem;">✓</div>
                            <div>No pending optimization actions</div>
                            <div style="font-size: 0.75rem; margin-top: 0.5rem;">Your application is running optimally</div>
                        </div>
                    `;
                    
                    // Wait 10 seconds before changing status back to Connected
                    setTimeout(() => {
                        updateConnectionStatus(false);
                    }, 10000);
                }
            }, 300);
        }
        
        // No need to refresh - the action has been removed from UI immediately
        // and the backend will not generate a new mock action after execution
        console.log('✅ Action removed from UI - no refresh needed');
        
    } catch (error) {
        console.error('❌ Error executing action:', error);
        if (buttonContainer) {
            buttonContainer.innerHTML = `
                <div style="padding: 0.375rem 0.75rem; color: #da1e28; font-size: 0.75rem;">
                    ❌ Failed: ${error.message}
                </div>
            `;
        }
        // Restore buttons after 3 seconds
        setTimeout(() => fetchTurbonomicActions(), 3000);
    }
}

// Dismiss action (placeholder - would need API endpoint)
function dismissTurboAction(uuid) {
    console.log('Dismiss action:', uuid);
    alert('Dismiss functionality would be implemented here');
}

// Fetch Turbonomic actions when on Observe & Optimize tab
function fetchOptimizeMetrics() {
    const observeTab = document.getElementById('observe-tab');
    if (observeTab && observeTab.classList.contains('active')) {
        fetchTurbonomicActions();
    }
}

// Initialize Turbonomic actions
function initTurbonomicActions() {
    fetchOptimizeMetrics();
    // Refresh every 60 seconds
    setInterval(fetchOptimizeMetrics, 60000);
}


// COMMENTED OUT: Old Operations tab initialization - now using operations-new.js
// initializeTruckCards();
// drawRouteLines();
// loadAllStations();
// fetchData();
// setInterval(fetchData, 5000); // Update every 5 seconds

// Initialize Instana metrics
initInstanaMetrics();

// Initialize Turbonomic actions
initTurbonomicActions();

// COMMENTED OUT: Initial log entry (activityLog element removed with old Operations tab)
// addActivityLog('Dashboard initialized in MANUAL mode', 'manual');

// Made with Bob


// Initialize Infrastructure Monitor status polling (added at end of file)
updateMonitorStatus(); // Initial call
setInterval(updateMonitorStatus, 5000); // Update every 5 seconds

// Initialize Mock Alerts polling
fetchMockAlerts(); // Initial call
setInterval(fetchMockAlerts, 5000); // Check for alerts every 5 seconds
