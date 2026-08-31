// ============================================================================
// FORECASTING TAB FUNCTIONALITY
// ============================================================================

// Use local proxy to avoid CSP issues
const FORECAST_API_BASE = '';

let tempChart, weatherChart, stationChart;
let autoRefreshInterval = null;

// Initialize forecasting when tab is loaded
function initForecasting() {
    console.log('Initializing forecasting tab...');
    
    // Fetch trucks and populate selector
    fetch('/api/trucks')
        .then(response => response.json())
        .then(trucks => {
            const selector = document.getElementById('forecastTruckSelector');
            if (selector) {
                selector.innerHTML = '<option value="">Select a truck...</option>';
                trucks.forEach(truck => {
                    const option = document.createElement('option');
                    option.value = truck.truckId;
                    option.textContent = `${truck.truckId} - ${truck.cargo?.type || 'Unknown'}`;
                    selector.appendChild(option);
                });
                console.log('Truck selector populated with', trucks.length, 'trucks');
                
                // Add change event listener to enable "View Driver" button
                selector.addEventListener('change', function() {
                    const viewDriverBtn = document.getElementById('viewDriverFromForecast');
                    if (viewDriverBtn) {
                        viewDriverBtn.disabled = !this.value;
                    }
                });
                
                // Auto-select first truck and load forecasts
                if (trucks.length > 0) {
                    selector.value = trucks[2].truckId;
                    console.log('Auto-selected first truck:', trucks[2].truckId);
                    
                    // Load forecasts for first truck after a short delay
                    setTimeout(() => {
                        loadForecastsForSelectedTruck();
                        startAutoRefresh();
                    }, 500);
                }
            }
        })
        .catch(error => {
            console.error('Error loading trucks:', error);
        });
    
    // Use 1000ms delay like Observe tab to ensure DOM is ready
    setTimeout(() => {
        console.log('Loading forecasts after delay...');
        loadStationForecast().then(() => {
            console.log('Station forecast loaded');
            return loadFleetOptimization();
        }).then(() => {
            console.log('Fleet optimization loaded');
        }).catch(error => {
            console.error('Error loading forecasts:', error);
        });
    }, 1000);
}

// Function to load forecasts for currently selected truck
async function loadForecastsForSelectedTruck() {
    const truckId = document.getElementById('forecastTruckSelector').value;
    const frequency = document.getElementById('forecastFrequency').value;
    
    if (!truckId) {
        console.log('No truck selected, skipping forecast load');
        return;
    }
    
    console.log('Loading forecasts for truck:', truckId, 'frequency:', frequency);
    
    // Show loading state
    document.getElementById('tempRecommendations').innerHTML = '<div style="color: var(--cds-text-secondary); font-size: 0.875rem;">Loading...</div>';
    document.getElementById('weatherRecommendations').innerHTML = '<div style="color: var(--cds-text-secondary); font-size: 0.875rem;">Loading...</div>';
    
    // Load forecasts
    await Promise.all([
        loadTemperatureForecast(truckId, frequency),
        loadWeatherForecast(truckId, frequency)
    ]);
}

// Auto-refresh functionality
function startAutoRefresh() {
    // Clear any existing interval
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Set up 2-minute auto-refresh
    autoRefreshInterval = setInterval(() => {
        console.log('Auto-refreshing forecasts...');
        loadForecastsForSelectedTruck();
    }, 120000); // 120000ms = 2 minutes
    
    console.log('Auto-refresh enabled (every 2 minutes)');
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('Auto-refresh disabled');
    }
}

// Load all forecasts for selected truck
if (document.getElementById('loadForecastsBtn')) {
    document.getElementById('loadForecastsBtn').addEventListener('click', async () => {
        await loadForecastsForSelectedTruck();
        // Restart auto-refresh when manually loading
        startAutoRefresh();
    });
}

// Stop auto-refresh when truck selection changes (will restart on manual load)
if (document.getElementById('forecastTruckSelector')) {
    document.getElementById('forecastTruckSelector').addEventListener('change', () => {
        stopAutoRefresh();
    });
}

// Add event listener for "Show All Points" toggle
// Removed showAllPointsToggle event listener - now displaying all data points by default

// Temperature Forecast
async function loadTemperatureForecast(truckId, frequency) {
    try {
        const cacheBuster = `&_t=${Date.now()}`;
        console.log('Fetching temperature forecast:', `${FORECAST_API_BASE}/api/forecast/temperature/${truckId}?frequency=${frequency}${cacheBuster}`);
        
        // Fetch both temperature forecast and fleet data to get temperature_risk
        const [tempResponse, fleetResponse] = await Promise.all([
            fetch(`${FORECAST_API_BASE}/api/forecast/temperature/${truckId}?frequency=${frequency}${cacheBuster}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            }),
            fetch(`${FORECAST_API_BASE}/api/forecast/fleet?frequency=${frequency}${cacheBuster}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            }).catch(() => ({ json: async () => ({ truck_insights: [] }) }))
        ]);
        
        const data = await tempResponse.json();
        const fleetData = await fleetResponse.json();
        
        // Check if API returned an error
        if (!data.historical || !data.forecast) {
            console.error('Invalid forecast data structure:', data);
            throw new Error(data.error || 'Invalid forecast data received from API');
        }
        
        // Find temperature_risk for this truck from fleet data
        const truckInsight = fleetData.truck_insights?.find(t => t.truck_id === truckId);
        data.temperature_risk = truckInsight?.temperature_risk;
        
        console.log('Temperature forecast data:', data);
        console.log('Temperature risk from fleet:', data.temperature_risk);
        
        const ctx = document.getElementById('tempForecastChart');
        if (tempChart) {
            tempChart.destroy();
            tempChart = null;
        }
        
        // IDEAL APPROACH: Show a fixed window (last 40 points) instead of 50%
        // This ensures the "past" doesn't overwhelm the "future" on the X-axis
        const contextWindow = 40;
        const sampledHistTimestamps = data.historical.timestamps.slice(-contextWindow);
        const sampledHistTemperatures = data.historical.temperatures.slice(-contextWindow);
        
        const sampledForecastTimestamps = data.forecast.timestamps;
        const sampledForecastTemperatures = data.forecast.temperatures;
        
        console.log('Chart data prepared:', {
            historical: { count: sampledHistTimestamps.length, sample: sampledHistTimestamps[0] },
            forecast: { count: sampledForecastTimestamps.length, sample: sampledForecastTimestamps[0] }
        });
        
        const allTimestamps = [...sampledHistTimestamps, ...sampledForecastTimestamps];
        
        // Pad datasets for alignment
        const historicalData = [
            ...sampledHistTemperatures,
            ...Array(sampledForecastTemperatures.length).fill(null)
        ];
        
        const forecastData = [
            ...Array(sampledHistTemperatures.length).fill(null),
            ...sampledForecastTemperatures
        ];
        
        console.log('Creating temperature chart with', allTimestamps.length, 'timestamps');
        
        try {
            tempChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: allTimestamps,
                    datasets: [{
                    label: 'Past Trend',
                    data: historicalData,
                    borderColor: 'rgba(69, 137, 255, 0.4)',
                    backgroundColor: 'rgba(69, 137, 255, 0.05)',
                    fill: true,       // Area chart for history
                    pointRadius: 0,   // Remove noise
                    borderWidth: 1
                }, {
                    label: 'Forecast',
                    data: forecastData,
                    borderColor: '#4589ff',
                    backgroundColor: 'rgba(69, 137, 255, 0.1)',
                    borderDash: [5, 5],
                    pointRadius: 3,   // Match weather chart
                    spanGaps: true,   // Connect line across null values
                    tension: 0.4      // Smooth curve
                }, {
                    label: `Critical (${data.critical_threshold}°C)`,
                    data: Array(allTimestamps.length).fill(data.critical_threshold),
                    borderColor: '#ff8389',
                    borderDash: [2, 2],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'category',  // CRITICAL: Prevent Chart.js from parsing as time
                        ticks: {
                            color: '#c6c6c6',
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8, // Force high spacing
                            callback: function(val, index) {
                                const fullLabel = this.getLabelForValue(val);
                                // Returns only "HH:MM" for cleaner look
                                if (fullLabel && fullLabel.includes(' ')) {
                                    return fullLabel.split(' ')[1].substring(0, 5);
                                }
                                return fullLabel;
                            }
                        },
                        grid: { display: false }
                    },
                    y: {
                        grid: { color: '#393939' },
                        ticks: {
                            color: '#c6c6c6',
                            callback: function(value) {
                                return value.toFixed(1) + '°C';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { color: '#f4f4f4' }
                    },
                    title: {
                        display: true,
                        text: `${truckId} - ${data.cargo_type}`,
                        color: '#f4f4f4'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2) + '°C';
                                }
                                return label;
                            }
                        }
                    }
                    }
                }
            });
            console.log('✅ Temperature chart created successfully');
        } catch (chartError) {
            console.error('❌ Chart creation failed:', chartError);
            throw chartError;
        }
        
        // Calculate CURRENT breach severity (different from forecast risk)
        const currentTemp = data.current_temperature;
        const threshold = data.critical_threshold;
        let currentBreachSeverity = 0;
        
        if (threshold < 0) {
            // Frozen cargo: breach if temp > threshold
            if (currentTemp > threshold) {
                currentBreachSeverity = Math.min(100, Math.round(((currentTemp - threshold) / Math.abs(threshold)) * 100));
            }
        } else {
            // Fresh cargo: breach if temp > threshold
            if (currentTemp > threshold) {
                currentBreachSeverity = Math.min(100, Math.round(((currentTemp - threshold) / threshold) * 100));
            }
        }
        
        const currentBreachColor = currentBreachSeverity > 70 ? '#ff8389' : currentBreachSeverity > 40 ? '#f1c21b' : '#42be65';
        
        // Update recommendations
        const risk = data.risk_assessment;
        const riskColor = risk.risk_score > 70 ? '#ff8389' : risk.risk_score > 40 ? '#f1c21b' : '#42be65';
        
        document.getElementById('tempRecommendations').innerHTML = `
            <div style="margin-bottom: var(--cds-spacing-05);">
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">CURRENT BREACH SEVERITY</div>
                <div style="font-size: 2rem; font-weight: 600; color: ${currentBreachColor};">${currentBreachSeverity}</div>
                <div style="font-size: 0.6875rem; color: var(--cds-text-secondary); margin-top: 0.25rem; font-style: italic;">
                    How bad the breach is RIGHT NOW (${currentTemp}°C vs ${threshold}°C threshold)
                </div>
            </div>
            <div style="margin-bottom: var(--cds-spacing-05); padding: 0.5rem; background: var(--cds-layer-02); border-radius: 2px; border-left: 3px solid ${data.temperature_risk > 70 ? '#da1e28' : data.temperature_risk > 40 ? '#f1c21b' : '#0f62fe'};">
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">FUTURE RISK PREDICTION</div>
                <div style="font-size: 1.25rem; font-weight: 600; color: ${data.temperature_risk > 70 ? '#da1e28' : data.temperature_risk > 40 ? '#f1c21b' : '#42be65'};">${data.temperature_risk || 'N/A'}%</div>
                <div style="font-size: 0.6875rem; color: var(--cds-text-secondary); margin-top: 0.25rem; font-style: italic;">
                    ${data.temperature_risk ?
                        (data.temperature_risk > 70
                            ? `AI Forecast: ${data.temperature_risk}% risk of continued breach in next 8 hours`
                            : data.temperature_risk > 40
                                ? `AI Forecast: ${data.temperature_risk}% risk of breach, ${100 - data.temperature_risk}% chance of stabilization`
                                : `AI Forecast: ${100 - data.temperature_risk}% confidence temperature will stay safe`)
                        : 'Probability of breach in next 8 hours'}
                </div>
            </div>
            <div style="margin-bottom: var(--cds-spacing-05);">
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">ACTION</div>
                <div style="
                    padding: 0.5rem;
                    background: ${riskColor}22;
                    border-left: 3px solid ${riskColor};
                    color: var(--cds-text-primary);
                    font-size: 0.875rem;
                    font-weight: 600;
                ">${risk.action}</div>
            </div>
            <div style="margin-bottom: var(--cds-spacing-05);">
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">STATUS</div>
                <div style="color: var(--cds-text-primary); font-size: 0.875rem;">${
                    // Improve message clarity for immediate breaches
                    risk.message.includes('0 minutes')
                        ? risk.message.replace('Breach predicted in 0 minutes', 'BREACH IN PROGRESS - Immediate action required')
                        : risk.message
                }</div>
            </div>
            <div>
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">RECOMMENDATIONS</div>
                ${risk.recommendations.map(rec => `
                    <div style="
                        padding: 0.5rem;
                        background: var(--cds-layer-02);
                        margin-bottom: 0.5rem;
                        border-radius: 2px;
                        color: var(--cds-text-primary);
                        font-size: 0.875rem;
                    ">${rec}</div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Temperature forecast error:', error);
        document.getElementById('tempRecommendations').innerHTML = `
            <div style="color: var(--cds-support-error); font-size: 0.875rem;">
                Failed to load temperature forecast<br>
                ${error.message}
            </div>
        `;
    }
}

// Weather Forecast
async function loadWeatherForecast(truckId, frequency) {
    try {
        const cacheBuster = `&_t=${Date.now()}`;
        console.log('Fetching weather forecast:', `${FORECAST_API_BASE}/api/forecast/weather/${truckId}?frequency=${frequency}${cacheBuster}`);
        const response = await fetch(`${FORECAST_API_BASE}/api/forecast/weather/${truckId}?frequency=${frequency}${cacheBuster}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        const data = await response.json();
        console.log('Weather forecast data:', data);
        
        // Update chart
        const ctx = document.getElementById('weatherForecastChart');
        if (weatherChart) weatherChart.destroy();
        
        // Filter to show only 1-hour intervals for cleaner X-axis
        const hourlyData = data.weather_forecast.hourly.filter((h, index) => index % 1 === 0);
        
        weatherChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hourlyData.map(h => {
                    // Display timestamp as-is from API
                    return h.timestamp;
                }),
                datasets: [{
                    label: 'Temperature (°C)',
                    data: hourlyData.map(h => h.temperature),
                    borderColor: '#ff8389',
                    backgroundColor: 'rgba(255, 131, 137, 0.1)',
                    borderDash: [5, 5],
                    yAxisID: 'y',
                    tension: 0.4,
                    pointRadius: 3
                }, {
                    label: 'Precipitation (%)',
                    data: hourlyData.map(h => h.precipitation_chance),
                    borderColor: '#4589ff',
                    backgroundColor: 'rgba(69, 137, 255, 0.1)',
                    borderDash: [5, 5],
                    yAxisID: 'y1',
                    tension: 0.4,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#f4f4f4' } },
                    title: {
                        display: true,
                        text: 'Weather along route',
                        color: '#f4f4f4'
                    }
                },
                scales: {
                    y: { 
                        type: 'linear',
                        position: 'left',
                        ticks: { color: '#c6c6c6' },
                        grid: { color: '#525252' },
                        title: { display: true, text: 'Temperature (°C)', color: '#c6c6c6' }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        ticks: { color: '#c6c6c6' },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Precipitation (%)', color: '#c6c6c6' }
                    },
                    x: {
                        type: 'category',  // Treat labels as categories, not dates
                        ticks: {
                            color: '#c6c6c6',
                            autoSkip: true,
                            maxTicksLimit: 20
                        },
                        grid: { color: '#525252' }
                    }
                }
            }
        });
        
        // Update recommendations
        const impact = data.impact_assessment;
        const impactColor = impact.impact_level === 'HIGH' ? '#ff8389' : impact.impact_level === 'MEDIUM' ? '#f1c21b' : '#42be65';
        
        document.getElementById('weatherRecommendations').innerHTML = `
            <div style="margin-bottom: var(--cds-spacing-05);">
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">IMPACT LEVEL</div>
                <div style="font-size: 2rem; font-weight: 600; color: ${impactColor};">${impact.impact_level}</div>
            </div>
            <div style="margin-bottom: var(--cds-spacing-05);">
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">CONDITIONS</div>
                ${impact.has_rain ? '<div style="padding: 0.25rem 0.5rem; background: #4589ff22; color: #4589ff; font-size: 0.75rem; display: inline-block; margin-right: 0.5rem; margin-bottom: 0.5rem;">Rain</div>' : ''}
                ${impact.high_wind ? '<div style="padding: 0.25rem 0.5rem; background: #f1c21b22; color: #f1c21b; font-size: 0.75rem; display: inline-block; margin-right: 0.5rem; margin-bottom: 0.5rem;">High Wind</div>' : ''}
                ${impact.extreme_temperature ? '<div style="padding: 0.25rem 0.5rem; background: #ff838922; color: #ff8389; font-size: 0.75rem; display: inline-block; margin-bottom: 0.5rem;">Extreme Temp</div>' : ''}
            </div>
            <div>
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">RECOMMENDATIONS</div>
                ${impact.recommendations.map(rec => `
                    <div style="
                        padding: 0.5rem;
                        background: var(--cds-layer-02);
                        margin-bottom: 0.5rem;
                        border-radius: 2px;
                        color: var(--cds-text-primary);
                        font-size: 0.875rem;
                    ">${rec}</div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Weather forecast error:', error);
        document.getElementById('weatherRecommendations').innerHTML = `
            <div style="color: var(--cds-support-error); font-size: 0.875rem;">
                Failed to load weather forecast<br>
                ${error.message}
            </div>
        `;
    }
}

// Station Forecast
let stationData = null; // Store all station data

async function loadStationForecast() {
    try {
        const frequency = document.getElementById('forecastFrequency')?.value || '5min';
        const cacheBuster = `&_t=${Date.now()}`;
        console.log('Fetching station forecast:', `${FORECAST_API_BASE}/api/forecast/station?frequency=${frequency}${cacheBuster}`);
        const response = await fetch(`${FORECAST_API_BASE}/api/forecast/station?frequency=${frequency}${cacheBuster}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        const data = await response.json();
        console.log('Station forecast data:', data);
        
        // Store data globally
        stationData = data;
        
        // Populate station selector
        const selector = document.getElementById('stationSelector');
        selector.innerHTML = data.stations.map((station, index) =>
            `<option value="${index}">${station.station_name} - ${station.region}</option>`
        ).join('');
        
        // Add change event listener
        selector.onchange = () => updateStationChart(parseInt(selector.value));
        
        // Display first station by default
        updateStationChart(0);
    } catch (error) {
        console.error('Station forecast error:', error);
        document.getElementById('stationRecommendations').innerHTML = `
            <div style="color: var(--cds-support-error); font-size: 0.875rem;">
                Failed to load station forecast<br>
                ${error.message}
            </div>
        `;
    }
}

function updateStationChart(stationIndex) {
    if (!stationData || !stationData.stations[stationIndex]) return;
    
    const station = stationData.stations[stationIndex];
    
    // Update chart
        const ctx = document.getElementById('stationForecastChart');
        if (stationChart) stationChart.destroy();
        
        stationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: station.forecast.timestamps.map(t => {
                    // Display timestamp as-is from API
                    return t;
                }),
                datasets: [{
                    label: 'Available Bays',
                    data: station.forecast.available_bays,
                    borderColor: '#42be65',
                    backgroundColor: 'rgba(66, 190, 101, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Utilization %',
                    data: station.forecast.utilization_percent,
                    borderColor: '#f1c21b',
                    backgroundColor: 'rgba(241, 194, 27, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#f4f4f4' } },
                    title: {
                        display: true,
                        text: `${station.station_name} - ${station.region}`,
                        color: '#f4f4f4'
                    }
                },
                scales: {
                    y: { 
                        type: 'linear',
                        position: 'left',
                        ticks: { color: '#c6c6c6' },
                        grid: { color: '#525252' },
                        title: { display: true, text: 'Available Bays', color: '#c6c6c6' }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        ticks: { color: '#c6c6c6' },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Utilization %', color: '#c6c6c6' }
                    },
                    x: { 
                        ticks: { 
                            color: '#c6c6c6',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: { color: '#525252' }
                    }
                }
            }
        });
        
        // Update recommendations
        document.getElementById('stationRecommendations').innerHTML = `
            <div style="margin-bottom: var(--cds-spacing-05);">
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">CURRENT STATUS</div>
                <div style="font-size: 1.5rem; font-weight: 600; color: var(--cds-text-primary);">${station.current_available}/${station.total_bays}</div>
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary);">Available Bays</div>
            </div>
            <div>
                <div style="font-size: 0.75rem; color: var(--cds-text-secondary); margin-bottom: var(--cds-spacing-02);">RECOMMENDATIONS</div>
                ${station.recommendations.map(rec => `
                    <div style="
                        padding: 0.5rem;
                        background: var(--cds-layer-02);
                        margin-bottom: 0.5rem;
                        border-radius: 2px;
                        color: var(--cds-text-primary);
                        font-size: 0.875rem;
                    ">${rec}</div>
                `).join('')}
            </div>
        `;
}

// Fleet Optimization
async function loadFleetOptimization() {
    try {
        const frequency = document.getElementById('forecastFrequency')?.value || '5min';
        const cacheBuster = `&_t=${Date.now()}`;
        console.log('Fetching fleet optimization:', `${FORECAST_API_BASE}/api/forecast/fleet?frequency=${frequency}${cacheBuster}`);
        
        // Fetch both forecast data and active alerts
        const [forecastResponse, alertsResponse] = await Promise.all([
            fetch(`${FORECAST_API_BASE}/api/forecast/fleet?frequency=${frequency}${cacheBuster}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            }),
            fetch('/api/alerts?active_only=true').catch(() => ({ json: async () => [] })) // Fallback if alerts API fails
        ]);
        
        const data = await forecastResponse.json();
        const alerts = await alertsResponse.json();
        console.log('Fleet optimization data:', data);
        console.log('Active alerts:', alerts);
        
        // Create a map of truck IDs to their alerts
        const truckAlerts = {};
        if (Array.isArray(alerts)) {
            alerts.forEach(alert => {
                const truckId = alert.truckId || alert.truck_id;
                if (truckId) {
                    if (!truckAlerts[truckId]) {
                        truckAlerts[truckId] = [];
                    }
                    truckAlerts[truckId].push(alert);
                }
            });
        }
        
        // Update fleet summary (inline format)
        const summary = data.fleet_summary;
        const activeAlertsCount = Object.keys(truckAlerts).length;
        document.getElementById('fleetSummary').innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 0.6875rem; color: var(--cds-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Total Trucks</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: var(--cds-text-primary); margin-top: 0.125rem;">${summary.total_trucks}</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 0.6875rem; color: var(--cds-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Active Alerts</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: #da1e28; margin-top: 0.125rem;">${activeAlertsCount}</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 0.6875rem; color: var(--cds-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">High Risk</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: #ff8389; margin-top: 0.125rem;">${summary.high_risk_trucks}</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 0.6875rem; color: var(--cds-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Avg Risk</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: var(--cds-text-primary); margin-top: 0.125rem;">${summary.average_risk_score}%</div>
            </div>
        `;
        
        // Categorize trucks
        const trucksWithAlerts = data.truck_insights.filter(truck => truckAlerts[truck.truck_id]);
        const highRiskTrucks = data.truck_insights.filter(truck =>
            truck.composite_risk_score > 70 && !truckAlerts[truck.truck_id]
        );
        const mediumRiskTrucks = data.truck_insights.filter(truck =>
            truck.composite_risk_score >= 40 && truck.composite_risk_score <= 70 && !truckAlerts[truck.truck_id]
        );
        
        // Generate HTML for truck cards
        const generateTruckCard = (truck, alerts = []) => {
            const riskColor = truck.composite_risk_score > 70 ? '#ff8389' : truck.composite_risk_score > 40 ? '#f1c21b' : '#42be65';
            const showAgentButton = truck.composite_risk_score > 70 || alerts.length > 0;
            const hasAlerts = alerts.length > 0;
            
            return `
                <div style="
                    padding: 0.625rem;
                    background: var(--cds-layer-02);
                    margin-bottom: 0.5rem;
                    border-left: 4px solid ${hasAlerts ? '#da1e28' : riskColor};
                    border-radius: 2px;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                ">
                    <!-- Left: Truck ID & Risk Score -->
                    <div style="display: flex; flex-direction: column; align-items: center; min-width: 80px;">
                        <div style="font-weight: 600; color: var(--cds-text-primary); font-size: 0.8125rem; margin-bottom: 0.25rem;">${truck.truck_id}</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: ${hasAlerts ? '#da1e28' : riskColor}; line-height: 1;">${truck.composite_risk_score}%</div>
                        <div style="font-size: 0.6875rem; color: var(--cds-text-secondary); text-transform: uppercase;">Risk</div>
                    </div>
                    
                    <!-- Middle: Metrics + Alerts -->
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 1rem; font-size: 0.75rem; align-items: center; margin-bottom: ${hasAlerts ? '0.5rem' : '0'};">
                            <div style="display: flex; flex-direction: column;">
                                <div style="color: var(--cds-text-secondary); font-size: 0.6875rem;" title="Probability of future breach">Temp Risk</div>
                                <div style="color: var(--cds-text-primary); font-weight: 600;">${truck.temperature_risk}%</div>
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <div style="color: var(--cds-text-secondary); font-size: 0.6875rem;">Weather Risk</div>
                                <div style="color: var(--cds-text-primary); font-weight: 600;">${truck.weather_risk}%</div>
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <div style="color: var(--cds-text-secondary); font-size: 0.6875rem;">Priority</div>
                                <div style="color: ${hasAlerts ? '#da1e28' : riskColor}; font-weight: 600;">${hasAlerts ? 'CRITICAL' : truck.priority}</div>
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <div style="color: var(--cds-text-secondary); font-size: 0.6875rem;">Cargo</div>
                                <div style="color: var(--cds-text-primary); font-weight: 600;">$${(truck.cargo_value/1000).toFixed(0)}K</div>
                            </div>
                        </div>
                        ${hasAlerts ? `
                            <div style="padding: 0.375rem 0.5rem; background: #fff1f1; border-radius: 2px; border-left: 3px solid #da1e28;">
                                <div style="font-size: 0.6875rem; color: #da1e28; font-weight: 600; margin-bottom: 0.25rem;">
                                    ⚠️ ACTIVE BREACH - IMMEDIATE ACTION REQUIRED
                                </div>
                                <div style="font-size: 0.6875rem; color: #525252; margin-bottom: 0.375rem; font-style: italic;">
                                    Current status: ${alerts.length} active alert${alerts.length > 1 ? 's' : ''} | AI Forecast: ${
                                        truck.temperature_risk > 70
                                            ? `${truck.temperature_risk}% risk of continued breach`
                                            : truck.temperature_risk > 40
                                                ? `${truck.temperature_risk}% risk, ${100 - truck.temperature_risk}% chance of stabilization`
                                                : `${100 - truck.temperature_risk}% confidence temperature will stay safe`
                                    }
                                </div>
                                ${(() => {
                                    // Show sample alerts: 3 temp + 1 weather (no "more alerts" message)
                                    const tempAlerts = alerts.filter(a => (a.type || a.alertType) === 'CARGO_THRESHOLD_BREACH');
                                    const weatherAlerts = alerts.filter(a => (a.type || a.alertType) === 'WEATHER_ALERT');
                                    
                                    const displayAlerts = [];
                                    
                                    // Temperature: Show last 3 (most recent)
                                    if (tempAlerts.length > 0) {
                                        displayAlerts.push(...tempAlerts.slice(-3));
                                    }
                                    
                                    // Weather: Show only 1
                                    if (weatherAlerts.length > 0) {
                                        displayAlerts.push(weatherAlerts[0]);
                                    }
                                    
                                    return displayAlerts.map(alert => `
                                        <div style="font-size: 0.6875rem; color: #525252; margin-bottom: 0.125rem;">
                                            • ${alert.type || alert.alertType}: ${alert.message || alert.description || 'Alert active'}
                                        </div>
                                    `).join('');
                                })()}
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Right: Action Buttons -->
                    <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button
                            onclick="viewTruckForecast('${truck.truck_id}')"
                            style="
                                background: var(--cds-layer-03);
                                color: var(--cds-text-primary);
                                border: 1px solid var(--cds-border-subtle);
                                padding: 0.375rem 0.75rem;
                                border-radius: 4px;
                                font-size: 0.75rem;
                                font-weight: 600;
                                cursor: pointer;
                                white-space: nowrap;
                                transition: background 0.2s;
                            "
                            onmouseover="this.style.background='var(--cds-layer-hover)'"
                            onmouseout="this.style.background='var(--cds-layer-03)'">
                            View Forecast
                        </button>
                        
                        ${showAgentButton ? `
                            <button
                                onclick="triggerAgentAnalysis('${truck.truck_id}')"
                                style="
                                    background: #0f62fe;
                                    color: white;
                                    border: none;
                                    padding: 0.375rem 0.75rem;
                                    border-radius: 4px;
                                    font-size: 0.75rem;
                                    font-weight: 600;
                                    cursor: pointer;
                                    white-space: nowrap;
                                    transition: background 0.2s;
                                "
                                onmouseover="this.style.background='#0353e9'"
                                onmouseout="this.style.background='#0f62fe'">
                                Analyze
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        };
        
        // Build the complete HTML
        let html = '';
        
        // Active Alerts Section
        if (trucksWithAlerts.length > 0) {
            html += `
                <div style="margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                        <div style="width: 8px; height: 8px; background: #da1e28; border-radius: 50%;"></div>
                        <div style="font-size: 0.875rem; font-weight: 600; color: #da1e28; text-transform: uppercase; letter-spacing: 0.5px;">
                            Active Alerts (${trucksWithAlerts.length}) - Immediate Attention Required
                        </div>
                    </div>
                    ${trucksWithAlerts.map(truck => generateTruckCard(truck, truckAlerts[truck.truck_id])).join('')}
                </div>
            `;
        }
        
        // High Risk Section
        if (highRiskTrucks.length > 0) {
            html += `
                <div style="margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                        <div style="width: 8px; height: 8px; background: #ff8389; border-radius: 50%;"></div>
                        <div style="font-size: 0.875rem; font-weight: 600; color: #ff8389; text-transform: uppercase; letter-spacing: 0.5px;">
                            High Priority (${highRiskTrucks.length}) - Preventive Action Recommended
                        </div>
                    </div>
                    ${highRiskTrucks.map(truck => generateTruckCard(truck)).join('')}
                </div>
            `;
        }
        
        // Medium Risk Section
        if (mediumRiskTrucks.length > 0) {
            html += `
                <div style="margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                        <div style="width: 8px; height: 8px; background: #f1c21b; border-radius: 50%;"></div>
                        <div style="font-size: 0.875rem; font-weight: 600; color: #f1c21b; text-transform: uppercase; letter-spacing: 0.5px;">
                            Medium Priority (${mediumRiskTrucks.length}) - Monitor Conditions
                        </div>
                    </div>
                    ${mediumRiskTrucks.map(truck => generateTruckCard(truck)).join('')}
                </div>
            `;
        }
        
        // If no trucks in any category
        if (html === '') {
            html = `
                <div style="text-align: center; padding: 2rem; color: var(--cds-text-secondary);">
                    <div style="font-size: 1rem; margin-bottom: 0.5rem;">No trucks require attention</div>
                    <div style="font-size: 0.875rem;">All fleet operations are running normally</div>
                </div>
            `;
        }
        
        document.getElementById('highRiskTrucks').innerHTML = html;
        
    } catch (error) {
        console.error('Fleet optimization error:', error);
        document.getElementById('highRiskTrucks').innerHTML = `
            <div style="color: var(--cds-support-error); font-size: 0.875rem;">
                Failed to load fleet optimization data<br>
                ${error.message}
            </div>
        `;
    }
}

// Helper function to render truck card (moved outside for reusability)
function renderTruckCard(truck, alerts = []) {
    const riskColor = truck.composite_risk_score > 70 ? '#ff8389' : truck.composite_risk_score > 40 ? '#f1c21b' : '#42be65';
    const showAgentButton = truck.composite_risk_score > 70 || alerts.length > 0;
    const hasAlerts = alerts.length > 0;
    
    return `
        <div style="
            padding: 0.625rem;
            background: var(--cds-layer-02);
            margin-bottom: 0.5rem;
            border-left: 4px solid ${hasAlerts ? '#da1e28' : riskColor};
            border-radius: 2px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        ">
            <!-- Truck card content here -->
        </div>
    `;
}

// Keep the old function signature for backward compatibility
async function loadFleetOptimizationOld() {
    try {
        const frequency = document.getElementById('forecastFrequency')?.value || '5min';
        const cacheBuster = `&_t=${Date.now()}`;
        const response = await fetch(`${FORECAST_API_BASE}/api/forecast/fleet?frequency=${frequency}${cacheBuster}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        const data = await response.json();
        
        // Old implementation - kept for reference
        document.getElementById('highRiskTrucks').innerHTML = `
            <div style="font-size: 0.875rem; font-weight: 600; color: var(--cds-text-primary); margin-bottom: var(--cds-spacing-03);">
                High Priority Trucks (Top ${Math.min(5, data.truck_insights.length)})
            </div>
            ${data.truck_insights.slice(0, 5).map(truck => {
                const riskColor = truck.composite_risk_score > 70 ? '#ff8389' : truck.composite_risk_score > 40 ? '#f1c21b' : '#42be65';
                const showAgentButton = truck.composite_risk_score > 70; // Show agent button for high-risk trucks
                
                return `
                    <div style="
                        padding: 0.625rem;
                        background: var(--cds-layer-02);
                        margin-bottom: 0.5rem;
                        border-left: 4px solid ${riskColor};
                        border-radius: 2px;
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                    ">
                        <!-- Left: Truck ID & Risk Score -->
                        <div style="display: flex; flex-direction: column; align-items: center; min-width: 80px;">
                            <div style="font-weight: 600; color: var(--cds-text-primary); font-size: 0.8125rem; margin-bottom: 0.25rem;">${truck.truck_id}</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: ${riskColor}; line-height: 1;">${truck.composite_risk_score}%</div>
                            <div style="font-size: 0.6875rem; color: var(--cds-text-secondary); text-transform: uppercase;">Risk</div>
                        </div>
                        
                        <!-- Middle: Metrics in horizontal layout -->
                        <div style="flex: 1; display: flex; gap: 1rem; font-size: 0.75rem; align-items: center;">
                            <div style="display: flex; flex-direction: column;">
                                    <div style="color: var(--cds-text-secondary); font-size: 0.6875rem;">Temp Risk</div>
                                    <div style="color: var(--cds-text-primary); font-weight: 600;">${truck.temperature_risk}%</div>
                                </div>
                                <div style="display: flex; flex-direction: column;">
                                    <div style="color: var(--cds-text-secondary); font-size: 0.6875rem;">Weather Risk</div>
                                    <div style="color: var(--cds-text-primary); font-weight: 600;">${truck.weather_risk}%</div>
                                </div>
                            <div style="display: flex; flex-direction: column;">
                                <div style="color: var(--cds-text-secondary); font-size: 0.6875rem;">Priority</div>
                                <div style="color: ${riskColor}; font-weight: 600;">${truck.priority}</div>
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <div style="color: var(--cds-text-secondary); font-size: 0.6875rem;">Cargo</div>
                                <div style="color: var(--cds-text-primary); font-weight: 600;">$${(truck.cargo_value/1000).toFixed(0)}K</div>
                            </div>
                        </div>
                        
                        <!-- Right: Action Buttons -->
                        <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                            <button
                                onclick="viewTruckForecast('${truck.truck_id}')"
                                style="
                                    background: var(--cds-layer-03);
                                    color: var(--cds-text-primary);
                                    border: 1px solid var(--cds-border-subtle);
                                    padding: 0.375rem 0.75rem;
                                    border-radius: 4px;
                                    font-size: 0.75rem;
                                    font-weight: 600;
                                    cursor: pointer;
                                    white-space: nowrap;
                                    transition: background 0.2s;
                                "
                                onmouseover="this.style.background='var(--cds-layer-hover)'"
                                onmouseout="this.style.background='var(--cds-layer-03)'">
                                View Forecast
                            </button>
                            
                            ${showAgentButton ? `
                                <button
                                    onclick="triggerAgentAnalysis('${truck.truck_id}')"
                                    style="
                                        background: #0f62fe;
                                        color: white;
                                        border: none;
                                        padding: 0.375rem 0.75rem;
                                        border-radius: 4px;
                                        font-size: 0.75rem;
                                        font-weight: 600;
                                        cursor: pointer;
                                        white-space: nowrap;
                                        transition: background 0.2s;
                                    "
                                    onmouseover="this.style.background='#0353e9'"
                                    onmouseout="this.style.background='#0f62fe'">
                                    Analyze
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    } catch (error) {
        console.error('Fleet optimization error:', error);
        document.getElementById('highRiskTrucks').innerHTML = `
            <div style="color: var(--cds-support-error); font-size: 0.875rem;">
                Failed to load fleet optimization data<br>
                ${error.message}
            </div>
        `;
    }
}

// ============================================================================
// FORECAST → AGENT INTEGRATION
// ============================================================================

/**
 * Trigger agent analysis for a specific truck
 * Called from "Analyze with Agents" buttons
 */
function triggerAgentAnalysis(truckId) {
    console.log(`🤖 Triggering agent analysis for ${truckId}`);
    
    // Store selected truck for agent tab
    sessionStorage.setItem('agentAnalysisTruck', truckId);
    sessionStorage.setItem('agentAnalysisSource', 'forecasting');
    
    // Switch to Agents tab
    switchTab('agentic', null);
    
    // Show notification (if notification function exists)
    if (typeof showNotification === 'function') {
        showNotification(`Starting agent analysis for ${truckId}...`, 'info');
    }
}

/**
 * View detailed forecast for a truck
 * Called from "View Forecast" buttons in Fleet Optimization
 */
function viewTruckForecast(truckId) {
    console.log(`📊 Loading forecast for ${truckId}`);
    
    // Select truck in dropdown
    const selector = document.getElementById('forecastTruckSelector');
    if (selector) {
        selector.value = truckId;
    }
    
    // Load forecasts
    loadForecastsForSelectedTruck();
    
    // Scroll to forecast charts
    setTimeout(() => {
        const chartElement = document.getElementById('tempForecastChart');
        if (chartElement) {
            chartElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }, 500);
    
    // Show notification (if notification function exists)
    if (typeof showNotification === 'function') {
        showNotification(`Loading forecast for ${truckId}...`, 'info');
    }
}

// Made with Bob

// Function to switch to driver view for selected truck
function switchToDriverViewFromForecast() {
    const selector = document.getElementById('forecastTruckSelector');
    const selectedTruckId = selector ? selector.value : null;
    
    if (!selectedTruckId) {
        console.log('No truck selected');
        return;
    }
    
    console.log('Switching to driver view for truck:', selectedTruckId);
    
    // Store selected truck in global variable
    window.selectedTruckFromOtherTab = selectedTruckId;
    
    // Switch to driver tab
    const driverTabButton = document.querySelector('[onclick*="driver"]');
    if (driverTabButton) {
        driverTabButton.click();
    }
}
