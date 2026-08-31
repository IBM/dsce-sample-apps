// Driver View Module - Handles driver-specific truck visualization and information
// UPDATED to match actual backend API structure

let driverMap = null;
let driverMarkers = [];
let driverRoutePolyline = null;
let currentDriverTruckId = null;
let driverViewRefreshInterval = null;

// Driver to Truck mapping
const driverTruckMap = {
    'mike': 'TRUCK-001',
    'sarah_j': 'TRUCK-002',
    'carlos': 'TRUCK-003',
    'emily': 'TRUCK-004'
};

// Initialize the driver map
function initDriverMap() {
    if (!driverMap) {
        const mapContainer = document.getElementById('driverMapContainer');
        if (!mapContainer) {
            console.error('Driver map container not found');
            return;
        }
        
        driverMap = L.map('driverMapContainer').setView([39.8283, -98.5795], 4);
        // Use CartoDB tile layer which is more reliable and doesn't have strict referrer policies
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(driverMap);
        
        console.log('Driver map initialized successfully');
    }
}

// Clear all markers and routes from the map
function clearDriverMap() {
    if (!driverMap) return;
    
    driverMarkers.forEach(marker => {
        if (driverMap.hasLayer(marker)) {
            driverMap.removeLayer(marker);
        }
    });
    driverMarkers = [];
    
    if (driverRoutePolyline && driverMap.hasLayer(driverRoutePolyline)) {
        driverMap.removeLayer(driverRoutePolyline);
        driverRoutePolyline = null;
    }
}

// Fetch truck data from API
async function fetchTruckData(truckId) {
    try {
        const response = await fetch('/api/trucks');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const trucks = await response.json();
        const truck = trucks.find(t => t.truckId === truckId);
        console.log('Fetched truck data:', truck);
        return truck;
    } catch (error) {
        console.error('Error fetching truck data:', error);
        return null;
    }
}

// Fetch station data from API
async function fetchStationData(stationId) {
    try {
        const response = await fetch(`/api/stations/${stationId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const station = await response.json();
        console.log('Fetched station data:', station);
        return station;
    } catch (error) {
        console.error('Error fetching station data:', error);
        return null;
    }
}

// Update the driver view with selected truck information
async function updateDriverView(truckId) {
    if (!truckId) {
        document.getElementById('driverTruckInfo').innerHTML = '<p class="placeholder-text">Select a driver to view truck information</p>';
        document.getElementById('driverStationInfo').innerHTML = '<p class="placeholder-text">Select a driver to view destination</p>';
        clearDriverMap();
        return;
    }

    currentDriverTruckId = truckId;
    console.log('Updating driver view for truck:', truckId);
    
    // Fetch truck data
    const truck = await fetchTruckData(truckId);
    if (!truck) {
        console.error('Truck not found:', truckId);
        document.getElementById('driverTruckInfo').innerHTML = '<p class="placeholder-text">Truck data not available</p>';
        return;
    }

    // Update map with truck location and route
    updateDriverMapWithTruck(truck);
    
    // Update "My Truck" panel
    updateTruckInfoPanel(truck);
    
    // Update "Destination Station" panel
    // Logic based on truck status:
    // - DIVERTED: Show diverted station (currentTrip.destination)
    // - RECOVERING: Show original destination (currentTrip.destination - backend restores it)
    // - Otherwise: Show current destination (currentTrip.destination)
    // Note: When status is RECOVERING, backend has already restored originalRoute to currentTrip
    let destinationToShow = null;
    
    if (truck.currentTrip && truck.currentTrip.destination) {
        // Use current trip destination for all statuses
        // When RECOVERING, backend has already restored original route to currentTrip
        destinationToShow = truck.currentTrip.destination;
        console.log(`${truck.status || 'ACTIVE'}: Using current trip destination:`, destinationToShow.name);
    }
    
    if (destinationToShow) {
        const destName = destinationToShow.name;
        // Try to find station by name
        try {
            const stationsResponse = await fetch('/api/stations');
            if (stationsResponse.ok) {
                const stations = await stationsResponse.json();
                const station = stations.find(s => s.name === destName);
                if (station) {
                    updateStationInfoPanel(station);
                } else {
                    // Use destination info from trip
                    updateStationInfoPanel(destinationToShow);
                }
            }
        } catch (error) {
            console.error('Error fetching stations:', error);
            updateStationInfoPanel(destinationToShow);
        }
    } else {
        document.getElementById('driverStationInfo').innerHTML = '<p class="placeholder-text">No destination assigned</p>';
    }
    
    // Fetch and update notifications
    const notifications = await fetchNotifications(truckId);
    updateNotificationsPanel(notifications);
}

// Update the map with truck location and route
function updateDriverMapWithTruck(truck) {
    clearDriverMap();
    
    // Check if truck has telemetry with current location
    if (!truck.telemetry || !truck.telemetry.currentLocation || 
        !truck.telemetry.currentLocation.latitude || !truck.telemetry.currentLocation.longitude) {
        console.error('Truck has no valid location in telemetry');
        return;
    }
    
    const currentLat = truck.telemetry.currentLocation.latitude;
    const currentLng = truck.telemetry.currentLocation.longitude;
    
    // Determine truck color based on status
    let truckColor = '#0f62fe'; // default blue
    const status = truck.status ? truck.status.toLowerCase() : 'unknown';
    if (status === 'critical' || status === 'error') {
        truckColor = '#da1e28'; // red
    } else if (status === 'warning') {
        truckColor = '#f1c21b'; // yellow
    } else if (status === 'active') {
        truckColor = '#24a148'; // green
    }
    
    // Add truck marker
    const truckIcon = L.divIcon({
        className: 'truck-marker',
        html: `<div style="background-color: ${truckColor}; color: white; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🚛 ${truck.truckId}</div>`,
        iconSize: [120, 30],
        iconAnchor: [60, 15]
    });
    
    const temp = truck.cargo && truck.cargo.currentTemperature !== undefined ? truck.cargo.currentTemperature : 'N/A';
    const truckMarker = L.marker([currentLat, currentLng], { icon: truckIcon })
        .bindPopup(`<b>${truck.truckId}</b><br>Status: ${status}<br>Temp: ${temp}°C`)
        .addTo(driverMap);
    driverMarkers.push(truckMarker);
    
    // Add origin marker if available
    if (truck.currentTrip && truck.currentTrip.origin && 
        truck.currentTrip.origin.latitude && truck.currentTrip.origin.longitude) {
        const origin = truck.currentTrip.origin;
        const originIcon = L.divIcon({
            className: 'origin-marker',
            html: `<div style="background-color: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">📦 ${origin.name || 'Origin'}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 10]
        });
        const originMarker = L.marker([origin.latitude, origin.longitude], { icon: originIcon })
            .bindPopup(`<b>Origin:</b> ${origin.name || 'Unknown'}`)
            .addTo(driverMap);
        driverMarkers.push(originMarker);
    }
    
    // Add destination marker if available
    if (truck.currentTrip && truck.currentTrip.destination && 
        truck.currentTrip.destination.latitude && truck.currentTrip.destination.longitude) {
        const dest = truck.currentTrip.destination;
        const destIcon = L.divIcon({
            className: 'destination-marker',
            html: `<div style="background-color: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏁 ${dest.name || 'Destination'}</div>`,
            iconSize: [120, 20],
            iconAnchor: [60, 10]
        });
        const destMarker = L.marker([dest.latitude, dest.longitude], { icon: destIcon })
            .bindPopup(`<b>Destination:</b> ${dest.name || 'Unknown'}`)
            .addTo(driverMap);
        driverMarkers.push(destMarker);
    }
    
    // Draw route if available
    if (truck.currentTrip && truck.currentTrip.plannedRoute && truck.currentTrip.plannedRoute.length > 0) {
        const routeCoords = truck.currentTrip.plannedRoute.map(point => [point.latitude, point.longitude]);
        driverRoutePolyline = L.polyline(routeCoords, {
            color: truckColor,
            weight: 3,
            opacity: 0.6,
            dashArray: '10, 10'
        }).addTo(driverMap);
        
        // Fit map to show entire route
        const bounds = L.latLngBounds(routeCoords);
        driverMap.fitBounds(bounds, { padding: [50, 50] });
    } else {
        // Center on truck location
        driverMap.setView([currentLat, currentLng], 8);
    }
}

// Update "My Truck" panel
function updateTruckInfoPanel(truck) {
    const truckInfoDiv = document.getElementById('driverTruckInfo');
    if (!truckInfoDiv) return;
    
    const status = truck.status || 'UNKNOWN';
    const statusLower = status.toLowerCase();
    const statusColor = statusLower === 'active' ? '#24a148' :
                       statusLower === 'warning' ? '#f1c21b' : '#da1e28';
    const statusText = status.toUpperCase();
    
    // Extract data from actual API structure
    const cargoTemp = truck.cargo && truck.cargo.currentTemperature !== undefined ? 
                     truck.cargo.currentTemperature : null;
    const fuelLevel = truck.telemetry && truck.telemetry.fuelLevel !== undefined ? 
                     truck.telemetry.fuelLevel : null;
    const speed = truck.telemetry && truck.telemetry.speed !== undefined ? 
                 truck.telemetry.speed : null;
    
    // Calculate progress from currentTrip
    let progress = 0;
    if (truck.currentTrip && truck.currentTrip.distanceTraveled !== undefined && 
        truck.currentTrip.distanceRemaining !== undefined) {
        const totalDistance = truck.currentTrip.distanceTraveled + truck.currentTrip.distanceRemaining;
        if (totalDistance > 0) {
            progress = (truck.currentTrip.distanceTraveled / totalDistance) * 100;
        }
    }
    
    const totalDistance = truck.currentTrip ? 
        (truck.currentTrip.distanceTraveled + truck.currentTrip.distanceRemaining) : null;
    const eta = truck.currentTrip && truck.currentTrip.estimatedArrival ? 
        new Date(truck.currentTrip.estimatedArrival).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A';
    
    truckInfoDiv.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-weight: 600; font-size: 1.125rem;">${truck.truckId}</span>
                <span class="status-badge status-${statusLower}" style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${statusText}</span>
            </div>
            <div style="font-size: 0.875rem; color: var(--cds-text-secondary);">
                Driver assigned to ${truck.truckId}
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: 0.25rem;">CARGO TEMP</div>
                <div style="font-size: 1.25rem; font-weight: 600; color: ${cargoTemp !== null && (cargoTemp < -15 || cargoTemp > -10) ? '#da1e28' : '#24a148'};">
                    ${cargoTemp !== null ? cargoTemp.toFixed(1) + '°C' : 'N/A'}
                </div>
            </div>
            <div>
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: 0.25rem;">FUEL LEVEL</div>
                <div style="font-size: 1.25rem; font-weight: 600; color: ${fuelLevel !== null && fuelLevel < 20 ? '#da1e28' : '#24a148'};">
                    ${fuelLevel !== null ? fuelLevel.toFixed(0) + '%' : 'N/A'}
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: 0.25rem;">PROGRESS</div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="flex: 1; background: var(--cds-layer-02); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div class="progress-bar" style="background: #0f62fe; height: 100%; width: ${progress.toFixed(0)}%; transition: width 0.3s;"></div>
                </div>
                <span style="font-weight: 600; font-size: 0.875rem;">${progress.toFixed(0)}%</span>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.75rem;">
            <div>
                <div style="color: var(--cds-text-secondary);">Distance</div>
                <div style="font-weight: 600; margin-top: 0.25rem;">${totalDistance !== null ? totalDistance.toFixed(0) + ' mi' : 'N/A'}</div>
            </div>
            <div>
                <div style="color: var(--cds-text-secondary);">ETA</div>
                <div style="font-weight: 600; margin-top: 0.25rem;">${eta}</div>
            </div>
            <div>
                <div style="color: var(--cds-text-secondary);">Speed</div>
                <div style="font-weight: 600; margin-top: 0.25rem;">${speed !== null ? speed.toFixed(0) + ' mph' : 'N/A'}</div>
            </div>
            <div>
                <div style="color: var(--cds-text-secondary);">Cargo Status</div>
                <div style="font-weight: 600; margin-top: 0.25rem; color: ${truck.cargo && truck.cargo.condition === 'SPOILED' ? '#da1e28' : '#24a148'};">
                    ${truck.cargo && truck.cargo.condition ? truck.cargo.condition : 'OK'}
                </div>
            </div>
        </div>
    `;
}

// Update "Destination Station" panel
function updateStationInfoPanel(station) {
    const stationInfoDiv = document.getElementById('driverStationInfo');
    if (!stationInfoDiv) return;
    
    // Handle both Station objects (with nested location) and Location objects (from trip destination)
    const lat = station.location ? station.location.latitude : station.latitude;
    const lon = station.location ? station.location.longitude : station.longitude;
    const address = station.location ? station.location.address : null;
    
    stationInfoDiv.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 0.25rem;">${station.name || 'Unknown Station'}</div>
            ${address || [station.city, station.state].filter(Boolean).join(', ') ? `
            <div style="font-size: 0.875rem; color: var(--cds-text-secondary);">
                ${address || [station.city, station.state].filter(Boolean).join(', ')}
            </div>
            ` : ''}
        </div>
        
        <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: 0.25rem;">STATION TYPE</div>
            <div style="font-weight: 600;">${station.type || 'Distribution Center'}</div>
        </div>
        
        ${station.currentLoad !== undefined ? `
        <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: 0.25rem;">CAPACITY</div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="flex: 1; background: var(--cds-layer-02); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div class="progress-bar" style="background: ${station.currentLoad > 80 ? '#da1e28' : '#24a148'}; height: 100%; width: ${station.currentLoad}%; transition: width 0.3s;"></div>
                </div>
                <span style="font-weight: 600; font-size: 0.875rem;">${station.currentLoad}%</span>
            </div>
        </div>
        ` : ''}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.75rem;">
            ${station.temperature !== undefined ? `
            <div>
                <div style="color: var(--cds-text-secondary);">Temperature</div>
                <div style="font-weight: 600; margin-top: 0.25rem;">${station.temperature.toFixed(1)}°C</div>
            </div>
            ` : ''}
            ${station.humidity !== undefined ? `
            <div>
                <div style="color: var(--cds-text-secondary);">Humidity</div>
                <div style="font-weight: 600; margin-top: 0.25rem;">${station.humidity}%</div>
            </div>
            ` : ''}
            ${station.activeTrucks !== undefined ? `
            <div>
                <div style="color: var(--cds-text-secondary);">Active Trucks</div>
                <div style="font-weight: 600; margin-top: 0.25rem;">${station.activeTrucks}</div>
            </div>
            ` : ''}
            ${station.status ? `
            <div>
                <div style="color: var(--cds-text-secondary);">Status</div>
                <div style="font-weight: 600; margin-top: 0.25rem; color: ${station.status === 'operational' ? '#24a148' : '#da1e28'};">
                    ${station.status.toUpperCase()}
                </div>
            </div>
            ` : ''}
            <div>
                <div style="color: var(--cds-text-secondary);">Coordinates</div>
                <div style="font-weight: 600; margin-top: 0.25rem; font-size: 0.7rem;">
                    ${lat && lon ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : 'Coordinates unavailable'}
                </div>
            </div>
        </div>
    `;
}

// Handle driver profile change
function onDriverProfileChange() {
    const dropdown = document.getElementById('driverProfileSelector');
    if (!dropdown) return;
    
    const selectedDriver = dropdown.value;
    console.log('Driver profile changed to:', selectedDriver);
    
    const truckId = driverTruckMap[selectedDriver];
    if (truckId) {
        updateDriverView(truckId);
        renderDriverTripHistory(selectedDriver);
        startDriverViewAutoRefresh();
    } else {
        updateDriverView(null);
        // Clear trip history
        const tbody = document.querySelector('#driverPastTripsTable tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 2rem; text-align: center; color: var(--cds-text-secondary); font-size: 0.875rem;">
                        Select a driver to view trip history
                    </td>
                </tr>
            `;
        }
        stopDriverViewAutoRefresh();
    }
}

// Start auto-refresh for driver view
function startDriverViewAutoRefresh() {
    stopDriverViewAutoRefresh(); // Clear any existing interval
    
    driverViewRefreshInterval = setInterval(() => {
        if (currentDriverTruckId) {
            console.log('Auto-refreshing driver view for:', currentDriverTruckId);
            updateDriverView(currentDriverTruckId);
        }
    }, 5000); // Refresh every 5 seconds
}

// Stop auto-refresh
function stopDriverViewAutoRefresh() {
    if (driverViewRefreshInterval) {
        clearInterval(driverViewRefreshInterval);
        driverViewRefreshInterval = null;
    }
}

// Render driver trip history
function renderDriverTripHistory(driverKey) {
    const tbody = document.querySelector('#driverPastTripsTable tbody');
    if (!tbody) return;
    
    // Mock trip history data - in production this would come from backend API
    const mockTripHistory = {
        'mike': [
            { date: '2026-05-14', route: 'Boston, MA → New York, NY', cargo: 'Pharmaceuticals', distance: '215 mi', duration: '4h 30m', status: 'Completed' },
            { date: '2026-05-13', route: 'New York, NY → Philadelphia, PA', cargo: 'Vaccines', distance: '95 mi', duration: '2h 15m', status: 'Completed' },
            { date: '2026-05-12', route: 'Philadelphia, PA → Baltimore, MD', cargo: 'Medical Supplies', distance: '106 mi', duration: '2h 30m', status: 'Completed' }
        ],
        'sarah_j': [
            { date: '2026-05-14', route: 'Chicago, IL → Detroit, MI', cargo: 'Frozen Foods', distance: '283 mi', duration: '5h 15m', status: 'Completed' },
            { date: '2026-05-13', route: 'Detroit, MI → Cleveland, OH', cargo: 'Dairy Products', distance: '170 mi', duration: '3h 20m', status: 'Completed' },
            { date: '2026-05-12', route: 'Cleveland, OH → Pittsburgh, PA', cargo: 'Fresh Produce', distance: '133 mi', duration: '2h 45m', status: 'Completed' }
        ],
        'carlos': [
            { date: '2026-05-14', route: 'Los Angeles, CA → San Diego, CA', cargo: 'Seafood', distance: '120 mi', duration: '2h 30m', status: 'Completed' },
            { date: '2026-05-13', route: 'San Diego, CA → Phoenix, AZ', cargo: 'Frozen Meats', distance: '355 mi', duration: '6h 15m', status: 'Completed' },
            { date: '2026-05-12', route: 'Phoenix, AZ → Tucson, AZ', cargo: 'Dairy Products', distance: '116 mi', duration: '2h 15m', status: 'Completed' }
        ],
        'emily': [
            { date: '2026-05-14', route: 'Seattle, WA → Portland, OR', cargo: 'Pharmaceuticals', distance: '173 mi', duration: '3h 30m', status: 'Completed' },
            { date: '2026-05-13', route: 'Portland, OR → Eugene, OR', cargo: 'Medical Supplies', distance: '110 mi', duration: '2h 15m', status: 'Completed' },
            { date: '2026-05-12', route: 'Eugene, OR → Sacramento, CA', cargo: 'Vaccines', distance: '345 mi', duration: '6h 45m', status: 'Completed' }
        ]
    };
    
    const trips = mockTripHistory[driverKey] || [];
    
    if (trips.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 2rem; text-align: center; color: var(--cds-text-secondary); font-size: 0.875rem;">
                    No trip history available
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = trips.map(trip => `
        <tr style="border-bottom: 1px solid var(--cds-border-subtle);">
            <td style="padding: 0.75rem; font-size: 0.875rem; color: var(--cds-text-primary);">${trip.date}</td>
            <td style="padding: 0.75rem; font-size: 0.875rem; color: var(--cds-text-primary);">${trip.route}</td>
            <td style="padding: 0.75rem; font-size: 0.875rem; color: var(--cds-text-primary);">${trip.cargo}</td>
            <td style="padding: 0.75rem; font-size: 0.875rem; color: var(--cds-text-primary);">${trip.distance}</td>
            <td style="padding: 0.75rem; font-size: 0.875rem; color: var(--cds-text-primary);">${trip.duration}</td>
            <td style="padding: 0.75rem;">
                <span style="
                    display: inline-block;
                    padding: 0.25rem 0.75rem;
                    background: var(--cds-support-success);
                    color: white;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                ">${trip.status}</span>
            </td>
        </tr>
    `).join('');
    
    console.log('Rendered trip history for driver:', driverKey, 'with', trips.length, 'trips');
}

// Initialize driver view when tab is activated
function initDriverViewTab() {
    console.log('Initializing driver view tab...');
    initDriverMap();
    
    // Set up dropdown change handler
    const dropdown = document.getElementById('driverTruckFilter');
    if (dropdown) {
        dropdown.addEventListener('change', onDriverProfileChange);
        
        // Trigger initial load if a driver is already selected
        if (dropdown.value) {
            onDriverProfileChange();
        }
    }
}

// Cleanup when leaving driver view
function cleanupDriverView() {
    stopDriverViewAutoRefresh();
}

// Made with Bob


// Fetch notifications for a specific truck
async function fetchNotifications(truckId) {
    try {
        const response = await fetch(`/api/agents/notifications/${truckId}`);
        if (!response.ok) {
            console.error(`Failed to fetch notifications for ${truckId}: ${response.status}`);
            return [];
        }
        const data = await response.json();
        return data.notifications || [];
    } catch (error) {
        console.error(`Error fetching notifications for ${truckId}:`, error);
        return [];
    }
}

// Update notifications panel with fetched notifications
function updateNotificationsPanel(notifications) {
    const container = document.getElementById('driverNotificationsContainer');
    if (!container) {
        console.error('Notifications container not found');
        return;
    }
    
    if (!notifications || notifications.length === 0) {
        container.innerHTML = '<p class="text-muted">No notifications yet</p>';
        return;
    }
    
    // Sort notifications by timestamp (newest first)
    const sortedNotifications = [...notifications].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    // Build HTML for notifications
    let html = '<div class="list-group">';
    sortedNotifications.forEach(notification => {
        const timestamp = new Date(notification.timestamp).toLocaleString();
        const urgencyClass = notification.urgency === 'HIGH' ? 'danger' :
                            notification.urgency === 'MEDIUM' ? 'warning' : 'info';
        const decisionBadge = notification.decision || 'UNKNOWN';
        
        // Extract message text - handle both string and object formats
        let messageText = '';
        if (typeof notification.message === 'string') {
            messageText = notification.message;
        } else if (notification.message && typeof notification.message === 'object') {
            // Message is an object with action, reasoning, etc.
            messageText = notification.message.action || 'No action specified';
            
            // Add reasoning if available
            if (notification.message.reasoning && Array.isArray(notification.message.reasoning)) {
                messageText += '<ul class="mt-2 mb-0">';
                notification.message.reasoning.forEach(reason => {
                    messageText += `<li>${reason}</li>`;
                });
                messageText += '</ul>';
            }
        }
        
        html += `
            <div class="list-group-item">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">
                        <span class="badge badge-${urgencyClass}">${notification.urgency}</span>
                        <span class="badge badge-secondary">${decisionBadge}</span>
                    </h6>
                    <small class="text-muted">${timestamp}</small>
                </div>
                <p class="mb-1">${messageText}</p>
                ${notification.facility ? `<small class="text-muted">Facility: ${notification.facility}</small>` : ''}
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}
