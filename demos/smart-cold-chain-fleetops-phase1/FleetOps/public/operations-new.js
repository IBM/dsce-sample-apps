// FleetOps Operations (New) - Using fleetops-backend APIs
// Matches archive tab layout with map, gauges, and truck cards

let newMap;
let newTruckMarkers = {};
let currentAlertFilter = 'active'; // 'active' or 'acknowledged'
let allAlertsCache = {}; // Cache all alerts by truck for modal display

// Initialize when tab is loaded
function initOperationsNew() {
    console.log('Initializing new Operations tab...');
    
    // Use delay to ensure DOM is ready (like Observe tab)
    setTimeout(() => {
        // Initialize map if not already done
        if (!newMap) {
            initNewMap();
        }
        
        // Load initial data
        loadNewFleetData();
        loadNewAlertsData();
    }, 1000);
    
    // Refresh data every 10 seconds
    setInterval(() => {
        loadNewFleetData();
        loadNewAlertsData();
    }, 10000);
}

// Initialize Leaflet map
function initNewMap() {
    try {
        const mapElement = document.getElementById('newMap');
        if (!mapElement) {
            console.error('Map element not found');
            return;
        }
        
        newMap = L.map('newMap').setView([39.8283, -98.5795], 5); // Center of USA
        
        // Use CartoDB tiles as alternative (less likely to be blocked)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO',
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(newMap);
        
        // Force map to resize after initialization
        setTimeout(() => {
            if (newMap) {
                newMap.invalidateSize();
            }
        }, 500);
        
        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Load fleet data from fleetops-backend
async function loadNewFleetData() {
    try {
        const response = await fetch('/api/trucks');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const trucks = await response.json();
        
        // Update stats
        document.getElementById('newTotalTrucks').textContent = trucks.length;
        
        // Check if newFleetCount exists (it might be in a different section)
        const fleetCountEl = document.getElementById('newFleetCount');
        if (fleetCountEl) {
            fleetCountEl.textContent = trucks.length;
        }
        
        // Calculate cargo value
        let totalCargoValue = 0;
        trucks.forEach(truck => {
            if (truck.cargo?.value) {
                totalCargoValue += truck.cargo.value;
            }
        });
        
        // Check if newCargoValue exists
        const cargoValueEl = document.getElementById('newCargoValue');
        if (cargoValueEl) {
            cargoValueEl.textContent = `$${(totalCargoValue / 1000000).toFixed(1)}M`;
        }
        
        // Note: Critical alerts count is now calculated in loadNewAlertsData()
        
        // Render truck cards
        renderNewTruckCards(trucks);
        
        // Update map markers
        updateNewMapMarkers(trucks);
        
        // Log activity
        logNewActivity(`Updated ${trucks.length} trucks`);
        
    } catch (error) {
        console.error('Error loading fleet data:', error);
        document.getElementById('newTruckStatusGrid').innerHTML = `
            <div style="color: var(--cds-text-error); padding: 1rem;">
                ⚠️ Error loading fleet data: ${error.message}
            </div>
        `;
    }
}

// Update gauge visualization
function updateNewGauge(gaugeId, temperature) {
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
        gauge.style.stroke = '#ef4444'; // Red - Critical
    } else if (temperature > -15) {
        gauge.style.stroke = '#f59e0b'; // Orange - Warning
    } else {
        gauge.style.stroke = '#42be65'; // Green - Good
    }
}

// Render truck status cards with gauge charts
function renderNewTruckCards(trucks) {
    const container = document.getElementById('newTruckStatusGrid');
    
    if (!trucks || trucks.length === 0) {
        container.innerHTML = '<div class="loading">No trucks available</div>';
        return;
    }
    
    container.innerHTML = trucks.map(truck => {
        const truckNum = truck.truckId.split('-')[1];
        const statusColor = getStatusColor(truck.status);
        const location = truck.telemetry?.currentLocation;
        const cargo = truck.cargo;
        const temp = cargo?.currentTemperature; // Use cargo temp for gauge
        const telemetry = truck.telemetry;
        
        // Get city from current trip destination or current location
        const city = truck.currentTrip?.destination?.name?.split(',')[0] || 'En Route';
        const origin = truck.currentTrip?.origin?.name?.split(',')[0] || 'Unknown';
        
        // Only show status badge if CRITICAL or EMERGENCY
        const showStatus = truck.status === 'CRITICAL' || truck.status === 'EMERGENCY';
        
        return `
            <div class="truck-card" style="padding: 0.75rem; min-height: auto;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <h3 style="margin: 0; font-size: 0.95rem;">${truck.truckId} - ${cargo?.type?.replace(/_/g, ' ') || 'Unknown'}</h3>
                    ${showStatus ? `<div class="truck-status-badge status-critical" style="margin: 0;">${truck.status}</div>` : ''}
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                    <div class="truck-temp" style="flex-shrink: 0;">
                        <svg width="140" height="140">
                            <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(200,200,200,0.3)" stroke-width="12"/>
                            <circle id="newGauge${truckNum}" cx="70" cy="70" r="60" fill="none" stroke="#10b981" stroke-width="12"
                                    stroke-dasharray="377" stroke-dashoffset="377" stroke-linecap="round"
                                    style="transform: rotate(-90deg); transform-origin: center;"/>
                        </svg>
                        <div class="temp-value" style="font-size: 1.5rem;">${temp !== null && temp !== undefined ? temp.toFixed(1) + '°C' : '--°C'}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; width: 100%; text-align: center;">
                        <div class="truck-info-line">📍 ${origin} → ${city}</div>
                        <div class="truck-info-line">⛽ ${telemetry?.fuelLevel !== null && telemetry?.fuelLevel !== undefined ? telemetry.fuelLevel + '%' : 'N/A'} &nbsp;&nbsp; 🚗 ${telemetry?.speed !== null && telemetry?.speed !== undefined ? telemetry.speed + ' km/h' : 'N/A'}</div>
                        ${truck.incidentType ? `<div class="truck-info-line" style="color: #f59e0b; font-weight: 600;">⚠️ ${truck.incidentType.replace(/_/g, ' ')}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update gauges after rendering
    setTimeout(() => {
        trucks.forEach(truck => {
            const truckNum = truck.truckId.split('-')[1];
            const temp = truck.cargo?.currentTemperature;
            if (temp !== null && temp !== undefined) {
                updateNewGauge(`newGauge${truckNum}`, temp);
            }
        });
    }, 100);
}

// Update map markers (uses truckIcons from app.js)
function updateNewMapMarkers(trucks) {
    if (!newMap) {
        console.log('Map not initialized');
        return;
    }
    
    console.log(`Updating map with ${trucks.length} trucks`);
    
    // Clear existing markers
    Object.values(newTruckMarkers).forEach(item => {
        if (item.marker) newMap.removeLayer(item.marker);
        if (item.route) newMap.removeLayer(item.route);
        if (item.originMarker) newMap.removeLayer(item.originMarker);
        if (item.destMarker) newMap.removeLayer(item.destMarker);
    });
    newTruckMarkers = {};
    
    // Add new markers and routes
    trucks.forEach(truck => {
        const location = truck.telemetry?.currentLocation;
        console.log(`Truck ${truck.truckId} location:`, location);
        
        if (location && location.latitude && location.longitude) {
            const isCritical = truck.status === 'CRITICAL' || truck.status === 'EMERGENCY';
            const icon = isCritical ? truckIcons.critical : truckIcons.normal;
            
            // Add truck marker with custom icon
            const marker = L.marker([location.latitude, location.longitude], {
                icon: icon
            }).addTo(newMap);
            
            // Get origin and destination from currentTrip
            const origin = truck.currentTrip?.origin;
            const destination = truck.currentTrip?.destination;
            const plannedRoute = truck.currentTrip?.plannedRoute || [];
            
            marker.bindPopup(`
                <div style="font-family: 'IBM Plex Sans', sans-serif;">
                    <strong>${truck.truckId}</strong><br>
                    Status: ${truck.status}<br>
                    Temp: ${truck.telemetry?.temperature?.toFixed(1) || 'N/A'}°C<br>
                    Speed: ${truck.telemetry?.speed || 'N/A'} km/h<br>
                    ${origin ? `From: ${origin.name}<br>` : ''}
                    ${destination ? `To: ${destination.name}` : ''}
                </div>
            `);
            
            // Add origin marker
            let originMarker = null;
            if (origin && origin.latitude && origin.longitude) {
                originMarker = L.marker([origin.latitude, origin.longitude], {
                    icon: L.divIcon({
                        html: '<div style="background: #10b981; padding: 4px 8px; border-radius: 4px; color: white; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">📦 ' + origin.name + '</div>',
                        className: '',
                        iconSize: [100, 20],
                        iconAnchor: [50, 10]
                    })
                }).addTo(newMap);
            }
            
            // Add destination marker
            let destMarker = null;
            if (destination && destination.latitude && destination.longitude) {
                destMarker = L.marker([destination.latitude, destination.longitude], {
                    icon: L.divIcon({
                        html: '<div style="background: #ef4444; padding: 4px 8px; border-radius: 4px; color: white; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏁 ' + destination.name + '</div>',
                        className: '',
                        iconSize: [100, 20],
                        iconAnchor: [50, 10]
                    })
                }).addTo(newMap);
            }
            
            // Draw route if available
            let routePolyline = null;
            if (plannedRoute && plannedRoute.length > 1) {
                const routeCoords = plannedRoute.map(wp => [wp.latitude, wp.longitude]);
                const routeColor = isCritical ? '#ef4444' : '#10b981';
                routePolyline = L.polyline(routeCoords, {
                    color: routeColor,
                    weight: 3,
                    opacity: 0.6,
                    dashArray: '10, 10'
                }).addTo(newMap);
            }
            
            newTruckMarkers[truck.truckId] = {
                marker: marker,
                route: routePolyline,
                originMarker: originMarker,
                destMarker: destMarker
            };
            
            console.log(`Added markers for ${truck.truckId}`);
        } else {
            console.log(`Truck ${truck.truckId} has no valid location`);
        }
    });
    
    console.log(`Total markers added: ${Object.keys(newTruckMarkers).length}`);
}

// Toggle alert filter between active and acknowledged
function toggleAlertFilter(filter) {
    currentAlertFilter = filter;
    
    // Update button styles
    const activeBtn = document.getElementById('activeAlertsBtn');
    const acknowledgedBtn = document.getElementById('acknowledgedAlertsBtn');
    
    if (filter === 'active') {
        activeBtn.style.background = 'var(--cds-interactive)';
        activeBtn.style.color = 'var(--cds-text-on-color)';
        activeBtn.style.border = 'none';
        
        acknowledgedBtn.style.background = 'var(--cds-layer-03)';
        acknowledgedBtn.style.color = 'var(--cds-text-primary)';
        acknowledgedBtn.style.border = '1px solid var(--cds-border-subtle)';
    } else {
        acknowledgedBtn.style.background = 'var(--cds-interactive)';
        acknowledgedBtn.style.color = 'var(--cds-text-on-color)';
        acknowledgedBtn.style.border = 'none';
        
        activeBtn.style.background = 'var(--cds-layer-03)';
        activeBtn.style.color = 'var(--cds-text-primary)';
        activeBtn.style.border = '1px solid var(--cds-border-subtle)';
    }
    
    // Reload alerts with new filter
    loadNewAlertsData();
}

// Load alerts data
async function loadNewAlertsData() {
    try {
        // Fetch both active and acknowledged alerts for metrics
        const [activeResponse, acknowledgedResponse] = await Promise.all([
            fetch('/api/alerts?active_only=true'),
            fetch('/api/alerts?active_only=false')
        ]);
        
        if (!activeResponse.ok || !acknowledgedResponse.ok) {
            throw new Error('HTTP error fetching alerts');
        }
        
        const activeAlerts = await activeResponse.json();
        const allAlerts = await acknowledgedResponse.json();
        
        // Calculate metrics
        const acknowledgedAlerts = allAlerts.filter(a => a.acknowledged);
        
        // Group active alerts by truck to count unique trucks
        const alertsByTruck = {};
        activeAlerts.forEach(alert => {
            if (!alertsByTruck[alert.truckId]) {
                alertsByTruck[alert.truckId] = [];
            }
            alertsByTruck[alert.truckId].push(alert);
        });
        
        // Count trucks by severity (based on their highest severity alert)
        let criticalTrucks = 0;
        let warningTrucks = 0;
        
        Object.values(alertsByTruck).forEach(truckAlerts => {
            const hasCritical = truckAlerts.some(a => a.severity === 'CRITICAL');
            if (hasCritical) {
                criticalTrucks++;
            } else {
                warningTrucks++;
            }
        });
        
        // Count acknowledged alerts from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const acknowledgedToday = acknowledgedAlerts.filter(a => {
            const ackDate = new Date(a.acknowledgedAt || a.timestamp);
            return ackDate >= today;
        }).length;
        
        // Update metrics (only update elements that exist)
        const criticalEl = document.getElementById('newCriticalTrucks');
        const warningEl = document.getElementById('newWarningTrucks');
        
        if (criticalEl) criticalEl.textContent = criticalTrucks;
        if (warningEl) warningEl.textContent = warningTrucks;
        
        // Use the appropriate alerts based on current filter
        const displayAlerts = currentAlertFilter === 'active' ? activeAlerts : acknowledgedAlerts;
        
        // Cache all alerts by truck for modal display
        allAlertsCache = {};
        displayAlerts.forEach(alert => {
            if (!allAlertsCache[alert.truckId]) {
                allAlertsCache[alert.truckId] = [];
            }
            allAlertsCache[alert.truckId].push(alert);
        });
        
        // Render alerts
        renderNewAlerts(displayAlerts);
        
    } catch (error) {
        console.error('Error loading alerts:', error);
        document.getElementById('newAlertsContainer').innerHTML = `
            <div style="color: var(--cds-text-error); padding: 1rem;">
                ⚠️ Error loading alerts: ${error.message}
            </div>
        `;
    }
}

// Render alerts - Show ONLY the LATEST alert per truck with "+X more" button
function renderNewAlerts(alerts) {
    const container = document.getElementById('newAlertsContainer');
    
    if (!alerts || alerts.length === 0) {
        const emptyMessage = currentAlertFilter === 'active'
            ? 'No active alerts'
            : 'No acknowledged alerts';
        const emptySubtext = currentAlertFilter === 'active'
            ? 'All alerts have been acknowledged or resolved'
            : 'No alerts have been acknowledged yet';
            
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--cds-text-secondary);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">✓</div>
                <div style="font-size: 0.875rem;">${emptyMessage}</div>
                <div style="font-size: 0.75rem; margin-top: 0.25rem;">${emptySubtext}</div>
            </div>
        `;
        return;
    }
    
    // Group alerts by truck
    const alertsByTruck = {};
    alerts.forEach(alert => {
        if (!alertsByTruck[alert.truckId]) {
            alertsByTruck[alert.truckId] = [];
        }
        alertsByTruck[alert.truckId].push(alert);
    });
    
    // Sort trucks by highest severity and most recent alert
    const sortedTrucks = Object.entries(alertsByTruck).sort((a, b) => {
        const severityOrder = { 'CRITICAL': 3, 'WARNING': 2, 'INFO': 1 };
        const maxSeverityA = Math.max(...a[1].map(alert => severityOrder[alert.severity] || 0));
        const maxSeverityB = Math.max(...b[1].map(alert => severityOrder[alert.severity] || 0));
        
        if (maxSeverityA !== maxSeverityB) {
            return maxSeverityB - maxSeverityA;
        }
        
        const latestA = Math.max(...a[1].map(alert => new Date(alert.timestamp).getTime()));
        const latestB = Math.max(...b[1].map(alert => new Date(alert.timestamp).getTime()));
        return latestB - latestA;
    });
    
    container.innerHTML = sortedTrucks.map(([truckId, truckAlerts]) => {
        // Sort alerts by timestamp (most recent first)
        const sortedAlerts = truckAlerts.sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        // Get ONLY the latest alert
        const latestAlert = sortedAlerts[0];
        const additionalCount = truckAlerts.length - 1;
        
        const severityColor = getSeverityColor(latestAlert.severity);
        const timestamp = new Date(latestAlert.timestamp).toLocaleTimeString();
        
        return `
            <div class="alert-item" style="border-left: 3px solid ${severityColor};">
                <div class="alert-header">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                        <span class="alert-type" style="font-weight: 600;">${truckId}</span>
                        <span style="background: ${severityColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">
                            ${latestAlert.severity}
                        </span>
                        ${additionalCount > 0 ? `
                            <button onclick="showAlertHistory('${truckId}')" style="
                                background: var(--cds-layer-03);
                                color: var(--cds-text-primary);
                                border: 1px solid var(--cds-border-subtle);
                                padding: 2px 8px;
                                border-radius: 3px;
                                font-size: 0.75rem;
                                cursor: pointer;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='var(--cds-layer-02)'"
                               onmouseout="this.style.background='var(--cds-layer-03)'">
                                +${additionalCount} more
                            </button>
                        ` : ''}
                    </div>
                    <span class="alert-time">${timestamp}</span>
                </div>
                <div class="alert-message" style="margin-top: 0.5rem;">
                    ${latestAlert.message}
                </div>
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-top: 0.5rem;">
                    ${latestAlert.type.replace(/_/g, ' ')}
                </div>
            </div>
        `;
    }).join('');
}

// Show alert history modal
function showAlertHistory(truckId) {
    const modal = document.getElementById('alertHistoryModal');
    const title = document.getElementById('modalTruckTitle');
    const content = document.getElementById('alertHistoryContent');
    
    const truckAlerts = allAlertsCache[truckId] || [];
    
    if (truckAlerts.length === 0) {
        content.innerHTML = '<div style="text-align: center; color: var(--cds-text-secondary);">No alerts found</div>';
        return;
    }
    
    // Sort by timestamp (most recent first)
    const sortedAlerts = truckAlerts.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    title.textContent = `${truckId} - Alert History (${truckAlerts.length} total)`;
    
    content.innerHTML = sortedAlerts.map((alert, index) => {
        const severityColor = getSeverityColor(alert.severity);
        const isLatest = index === 0;
        
        return `
            <div style="
                padding: 1rem;
                background: var(--cds-layer-02);
                margin-bottom: 0.75rem;
                border-radius: 4px;
                border-left: 4px solid ${severityColor};
                ${isLatest ? 'box-shadow: 0 0 0 2px ' + severityColor + '40;' : ''}
            ">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="
                            background: ${severityColor};
                            color: white;
                            padding: 4px 8px;
                            border-radius: 3px;
                            font-size: 0.75rem;
                            font-weight: 600;
                        ">${alert.severity}</span>
                        ${isLatest ? `
                            <span style="
                                background: var(--cds-interactive);
                                color: white;
                                padding: 4px 8px;
                                border-radius: 3px;
                                font-size: 0.75rem;
                                font-weight: 600;
                            ">LATEST</span>
                        ` : `
                            <span style="
                                background: var(--cds-layer-03);
                                color: var(--cds-text-secondary);
                                padding: 4px 8px;
                                border-radius: 3px;
                                font-size: 0.75rem;
                            ">#${index + 1}</span>
                        `}
                        ${alert.acknowledged ? `
                            <span style="
                                background: var(--cds-support-success);
                                color: white;
                                padding: 4px 8px;
                                border-radius: 3px;
                                font-size: 0.75rem;
                            ">✓ Acknowledged</span>
                        ` : ''}
                    </div>
                    <span style="font-size: 0.8125rem; color: var(--cds-text-secondary);">
                        ${new Date(alert.timestamp).toLocaleString()}
                    </span>
                </div>
                <div style="font-size: 0.875rem; color: var(--cds-text-primary); margin-bottom: 0.5rem; line-height: 1.5;">
                    ${alert.message}
                </div>
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary);">
                    Type: ${alert.type.replace(/_/g, ' ')}
                </div>
            </div>
        `;
    }).join('');
    
    modal.style.display = 'flex';
}

// Close alert history modal
function closeAlertHistoryModal(event) {
    const modal = document.getElementById('alertHistoryModal');
    if (!event || event.target === modal) {
        modal.style.display = 'none';
    }
}

// Log activity
function logNewActivity(message) {
    const container = document.getElementById('newActivityLog');
    if (!container) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'activity-entry';
    entry.innerHTML = `
        <span class="activity-time">${timestamp}</span>
        <span class="activity-message">${message}</span>
    `;
    
    container.insertBefore(entry, container.firstChild);
    
    // Keep only last 20 entries
    while (container.children.length > 20) {
        container.removeChild(container.lastChild);
    }
}

// Load stations data for count
async function loadNewStationsData() {
    try {
        const response = await fetch('/api/stations');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const stations = await response.json();
        
        document.getElementById('newActiveStations').textContent = stations.length;
        
    } catch (error) {
        console.error('Error loading stations:', error);
    }
}

// Helper: Get status color
function getStatusColor(status) {
    const colors = {
        'ACTIVE': '#24a148',
        'IN_TRANSIT': '#0f62fe',
        'DELAYED': '#f1c21b',
        'CRITICAL': '#ff832b',
        'EMERGENCY': '#da1e28',
        'MAINTENANCE': '#8a3ffc'
    };
    return colors[status] || '#525252';
}

// Helper: Get severity color
function getSeverityColor(severity) {
    const colors = {
        'CRITICAL': '#da1e28',
        'HIGH': '#ff832b',
        'MEDIUM': '#f1c21b',
        'LOW': '#0f62fe',
        'INFO': '#525252'
    };
    return colors[severity] || '#525252';
}

// Load stations count on init
setTimeout(() => {
    loadNewStationsData();
}, 1000);

// Made with Bob
