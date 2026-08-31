/**
 * Agents Module - watsonx Orchestrate Integration
 * Handles agent workflow execution and status updates
 */

const AgentsModule = (() => {
    let currentExecutionId = null;
    let statusPollingInterval = null;
    let selectedTruckId = null;
    let workflowStartLogged = false;  // Track if workflow start has been logged
    let agentDataStore = {}; // Store full agent output data for modal
    let cachedTrucksData = null; // Cache truck data for agent workflow

    /**
     * Initialize agents module
     */
    function init() {
        console.log('Agents module initialized');
        // Populate truck dropdown will be called from fetchData in app.js
    }

    /**
     * Populate agents truck dropdown with truck data
     */
    function populateAgentTruckDropdown(trucks) {
        const dropdown = document.getElementById('agent-truck-select');
        if (!dropdown) return;

        // Cache the truck data for use in agent workflow
        cachedTrucksData = trucks;

        // Save currently selected value
        const currentValue = dropdown.value;

        // Clear existing options except the first one (placeholder)
        while (dropdown.options.length > 1) {
            dropdown.remove(1);
        }

        // Add truck options - extract origin/destination from full truck objects
        trucks.forEach(truck => {
            const option = document.createElement('option');
            option.value = truck.truckId;
            // Extract city names from full truck data structure
            const origin = truck.currentTrip?.origin?.name?.split(' ')[0] || 'Unknown';
            const destination = truck.currentTrip?.destination?.name?.split(' ')[0] || 'Unknown';
            option.textContent = `${truck.truckId} - ${origin} → ${destination}`;
            dropdown.appendChild(option);
        });

        // Check if truck was pre-selected from Forecasting tab
        const preSelectedTruck = sessionStorage.getItem('agentAnalysisTruck');
        const source = sessionStorage.getItem('agentAnalysisSource');
        
        if (preSelectedTruck && source === 'forecasting') {
            console.log(`🤖 Auto-selecting truck from Forecasting tab: ${preSelectedTruck}`);
            dropdown.value = preSelectedTruck;
            
            // Clear session storage
            sessionStorage.removeItem('agentAnalysisTruck');
            sessionStorage.removeItem('agentAnalysisSource');
            
            // Trigger the workflow after a short delay
            setTimeout(() => {
                console.log(`🚀 Auto-starting agent workflow for ${preSelectedTruck}`);
                onTruckSelected(preSelectedTruck);
            }, 500);
        } else if (currentValue && Array.from(dropdown.options).some(opt => opt.value === currentValue)) {
            // Restore previously selected value if it still exists
            dropdown.value = currentValue;
        }

        // Add event listener if not already added
        if (!dropdown.hasAttribute('data-listener-added')) {
            dropdown.addEventListener('change', function() {
                const selectedTruckId = this.value;
                console.log('Dropdown changed! Selected truck:', selectedTruckId);
                if (selectedTruckId) {
                    console.log('Calling onTruckSelected with:', selectedTruckId);
                    onTruckSelected(selectedTruckId);
                } else {
                    console.log('No truck selected (empty value)');
                }
            });
            dropdown.setAttribute('data-listener-added', 'true');
            console.log('Added change event listener to agent truck dropdown');
        }

        console.log(`Populated agents dropdown with ${trucks.length} trucks`);
    }

    /**
     * Handle truck selection from dropdown
     */
    function onTruckSelected(truckId) {
        selectedTruckId = truckId;
        console.log('Truck selected:', truckId);
        
        // Store selected truck for cross-tab navigation
        window.selectedTruckFromOtherTab = truckId;
        
        // Reset UI
        resetAgentTiles();
        
        // Stop any existing polling
        stopStatusPolling();
        currentExecutionId = null;
        
        if (!truckId) {
            return;
        }
        
        // Auto-trigger agent execution
        executeAgentWorkflow(truckId);
    }

    /**
     * Execute agent workflow for selected truck
     */
    async function executeAgentWorkflow(truckId) {
        try {
            console.log('=== EXECUTE AGENT WORKFLOW START ===');
            console.log('Truck ID:', truckId);
            console.log('Current window.location.origin:', window.location.origin);
            console.log('Current window.location.href:', window.location.href);
            
            // The frontend calls /api/agents/execute which is proxied by server.js
            // Server.js will forward to: ${COLDCHAIN_API_URL}/api/agents/execute
            // COLDCHAIN_API_URL from .env: https://fleetops-api-v2-fleetops-backend.apps.itz-uv3vvn.hub01-lb.techzone.ibm.com
            const apiEndpoint = '/api/agents/execute';
            console.log('Frontend API endpoint (will be proxied by server.js):', apiEndpoint);
            console.log('Full URL that will be called:', window.location.origin + apiEndpoint);
            console.log('This will be proxied to backend at: https://fleetops-api-v2-fleetops-backend.apps.itz-uv3vvn.hub01-lb.techzone.ibm.com/api/agents/execute');
            
            // Show loading state
            showExecutionStarting();
            
            const requestPayload = { truck_id: truckId };
            console.log('Request payload:', JSON.stringify(requestPayload, null, 2));
            
            console.log('Sending POST request...');
            const startTime = Date.now();
            
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            });
            
            const endTime = Date.now();
            console.log(`Request completed in ${endTime - startTime}ms`);
            console.log('Response status:', response.status);
            console.log('Response statusText:', response.statusText);
            console.log('Response OK:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response error body:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const data = await response.json();
            console.log('Response data:', JSON.stringify(data, null, 2));
            currentExecutionId = data.execution_id;
            
            console.log('Agent workflow started successfully with execution_id:', currentExecutionId);
            console.log('=== EXECUTE AGENT WORKFLOW END ===');
            
            // Get truck info for activity log with detailed trip information
            // Backend TruckState structure: { truckId, cargo: {type}, currentTrip: {origin: {name}, destination: {name}}, telemetry: {temperature} }
            const truckData = cachedTrucksData?.find(t => t.truckId === selectedTruckId);
            
            console.log('[Activity Log] Looking for truck:', selectedTruckId);
            console.log('[Activity Log] Found truck data:', truckData);
            
            // Extract data matching backend TruckState model structure
            const cargoType = truckData?.cargo?.type || 'Unknown';
            const temp = truckData?.telemetry?.temperature || 'N/A';
            const originCity = truckData?.currentTrip?.origin?.name || 'Unknown';
            const destCity = truckData?.currentTrip?.destination?.name || 'Unknown';
            
            const truckInfo = truckData ? {
                cargo: cargoType,
                temperature: temp,
                origin: originCity,
                destination: destCity,
                route: truckData.route,
                status: truckData.status
            } : null;
            
            const tripDetails = `Cargo: ${cargoType}, Temp: ${temp}°C, Route: ${originCity} → ${destCity}`;
            
            console.log('[Activity Log] Trip details:', tripDetails);
            
            addAgentActivityLog(
                `Agent workflow started for Truck ${selectedTruckId} - ${tripDetails}`,
                'info',
                null,
                truckInfo
            );
            
            // Start polling for status updates
            startStatusPolling();
            
        } catch (error) {
            console.error('=== EXECUTE AGENT WORKFLOW ERROR ===');
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('=== ERROR END ===');
            showExecutionError(error.message);
        }
    }

    /**
     * Poll for status once
     */
    async function pollStatusOnce() {
        console.log('--- Polling tick ---');
        console.log('Current execution ID:', currentExecutionId);
        
        if (!currentExecutionId) {
            console.log('No execution ID, stopping polling');
            stopStatusPolling();
            return;
        }
        
        try {
            const statusUrl = `/api/agents/status/${currentExecutionId}`;
            console.log('Fetching status from:', statusUrl);
            console.log('Full URL:', window.location.origin + statusUrl);
            
            const response = await fetch(statusUrl);
            console.log('Status response received:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Status fetch error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }
            
            const execution = await response.json();
            console.log('Polling status update:', JSON.stringify(execution, null, 2));
            
            console.log('Calling updateAgentTiles with execution data');
            updateAgentTiles(execution);
            
            // Stop polling only if ALL agents are in a terminal state (completed or failed)
            const agents = execution.agents;
            const allAgentsTerminal = Object.values(agents).every(agent => {
                const status = agent.status.toUpperCase();
                const isTerminal = status === 'COMPLETED' || status === 'FAILED';
                console.log(`Agent status: ${status}, terminal: ${isTerminal}`);
                return isTerminal;
            });
            
            console.log('All agents terminal?', allAgentsTerminal);
            if (allAgentsTerminal) {
                console.log('All agents completed or failed, stopping polling');
                stopStatusPolling();
                
                // Get truck info for activity log
                const truckData = cachedTrucksData?.find(t => t.truckId === selectedTruckId);
                const truckInfo = truckData ? {
                    cargo: truckData.cargo?.type || 'Unknown',
                    temperature: truckData.telemetry?.temperature || 'N/A',
                    origin: truckData.currentTrip?.origin?.name || 'Unknown',
                    destination: truckData.currentTrip?.destination?.name || 'Unknown'
                } : null;
                
                // Add activity log entry for completed workflow (without agent summaries to avoid duplication)
                const hasFailures = Object.values(agents).some(agent =>
                    agent.status.toUpperCase() === 'FAILED'
                );
                
                if (hasFailures) {
                    addAgentActivityLog(
                        `⚠️ Agent workflow completed with failures for Truck ${selectedTruckId}`,
                        'error',
                        null,  // Don't pass agentDataStore to avoid duplicate summaries
                        truckInfo
                    );
                } else {
                    addAgentActivityLog(
                        `Agent workflow completed successfully for Truck ${selectedTruckId}`,
                        'success',
                        null,  // Don't pass agentDataStore to avoid duplicate summaries
                        truckInfo
                    );
                }
            }
            
        } catch (error) {
            console.error('=== POLLING ERROR ===');
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('=== POLLING ERROR END ===');
            console.log('Stopping polling due to error');
            stopStatusPolling();
        }
    }

    /**
     * Start polling for execution status
     */
    function startStatusPolling() {
        console.log('=== START STATUS POLLING ===');
        console.log('Current execution ID:', currentExecutionId);
        
        if (statusPollingInterval) {
            console.log('Clearing existing polling interval');
            clearInterval(statusPollingInterval);
        }
        
        // Do an immediate first poll
        console.log('Performing immediate first poll...');
        pollStatusOnce();
        
        // Then poll every 2 seconds
        console.log('Setting up polling interval (every 2 seconds)');
        statusPollingInterval = setInterval(() => {
            pollStatusOnce();
        }, 2000);
        
        console.log('Polling interval set up successfully');
        console.log('=== START STATUS POLLING END ===');
    }

    /**
     * Stop status polling
     */
    function stopStatusPolling() {
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
            statusPollingInterval = null;
        }
        // Reset the workflow start logged flag for next execution
        workflowStartLogged = false;
    }

    /**
     * Update agent tiles with execution status
     */
    function updateAgentTiles(execution) {
        console.log('=== UPDATE AGENT TILES ===');
        console.log('Execution data:', execution);
        
        // Update each agent tile
        console.log('Updating weather agent...');
        updateAgentTile('weather', execution.agents.weather);
        
        console.log('Updating station agent...');
        updateAgentTile('station', execution.agents.station);
        
        console.log('Updating route agent...');
        updateAgentTile('route', execution.agents.route);
        
        console.log('Updating decision agent...');
        updateAgentTile('decision', execution.agents.decision);
        
        console.log('Updating notification agent...');
        updateAgentTile('notification', execution.agents.notification);
        
        console.log('=== UPDATE AGENT TILES COMPLETE ===');
    }

    /**
     * Update individual agent tile
     */
    function updateAgentTile(agentName, agentStatus) {
        console.log(`--- Updating ${agentName} tile ---`);
        console.log('Agent status:', agentStatus);
        
        const tile = document.getElementById(`agent-${agentName}`);
        console.log(`Tile element for agent-${agentName}:`, tile);
        
        if (!tile) {
            console.error(`Tile not found for agent-${agentName}!`);
            return;
        }

        // Store full agent data for modal - parse raw_content if present
        // Declare parsedOutput at function scope so it's accessible throughout
        let parsedOutput = null;
        
        if (agentStatus.output) {
            parsedOutput = agentStatus.output;
            
            // Check if output has raw_content field (Decision Agent case)
            if (parsedOutput.raw_content) {
                try {
                    console.log(`[${agentName}] Detected raw_content field, parsing...`);
                    console.log(`[${agentName}] Raw content:`, parsedOutput.raw_content);
                    
                    // Remove outer braces and parse the JSON string
                    let contentStr = parsedOutput.raw_content;
                    
                    // Handle double-escaped JSON: {{\"key\":\"value\"}}
                    if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                        contentStr = contentStr.slice(1, -1); // Remove outer braces
                    }
                    
                    // Parse the JSON string
                    parsedOutput = JSON.parse(contentStr);
                    console.log(`[${agentName}] Successfully parsed raw_content:`, parsedOutput);
                } catch (parseError) {
                    console.error(`[${agentName}] Failed to parse raw_content:`, parseError);
                    console.error(`[${agentName}] Raw content was:`, parsedOutput.raw_content);
                    // Keep original output if parsing fails
                }
            }
            
            agentDataStore[agentName] = parsedOutput;
        }

        // Add click handler to tile if completed
        if (agentStatus.status.toUpperCase() === 'COMPLETED' && agentStatus.output) {
            tile.style.cursor = 'pointer';
            tile.onclick = () => openAgentModal(agentName);
            tile.title = 'Click to view full details';
        } else {
            tile.style.cursor = 'default';
            tile.onclick = null;
            tile.title = '';
        }

        const statusBadge = tile.querySelector('.agent-status-badge');
        const spinner = tile.querySelector('.agent-spinner');
        const outputDiv = tile.querySelector('.agent-output');
        const progressBar = tile.querySelector('.agent-progress-bar');
        
        console.log('DOM elements found:', {
            statusBadge: !!statusBadge,
            spinner: !!spinner,
            outputDiv: !!outputDiv,
            progressBar: !!progressBar
        });

        // Update status badge
        if (statusBadge) {
            // Convert status to uppercase for display and comparison
            const status = agentStatus.status.toUpperCase();
        
        // Check if agent just completed and log it
        const wasCompleted = tile.dataset.wasCompleted === 'true';
        const isNowCompleted = status === 'COMPLETED';
        
        if (isNowCompleted && !wasCompleted && agentStatus.output) {
            tile.dataset.wasCompleted = 'true';
            
            // Get truck info for activity log
            const truckData = cachedTrucksData?.find(t => t.truckId === selectedTruckId);
            const truckInfo = truckData ? {
                cargo: truckData.cargo?.type || 'Unknown',
                temperature: truckData.telemetry?.temperature || 'N/A',
                origin: truckData.currentTrip?.origin?.name || 'Unknown',
                destination: truckData.currentTrip?.destination?.name || 'Unknown'
            } : null;
            
            // Create agent-specific data object with parsed output
            const singleAgentData = {};
            singleAgentData[agentName] = parsedOutput;
            
            // Log individual agent completion with detailed summary
            const agentTitles = {
                weather: 'Weather Agent',
                station: 'Station Agent',
                route: 'Route Agent',
                decision: 'Decision Agent',
                notification: 'Notification Agent'
            };
            
            // Create detailed summary based on agent type
            let summary = '';
            if (agentName === 'weather' && parsedOutput) {
                // Weather Agent output may have raw_content as a JSON string
                let weatherData = parsedOutput;
                if (parsedOutput.raw_content && typeof parsedOutput.raw_content === 'string') {
                    try {
                        weatherData = JSON.parse(parsedOutput.raw_content);
                    } catch (e) {
                        console.warn('[Weather Agent] Failed to parse raw_content:', e);
                    }
                }
                const segments = weatherData.segments || weatherData.weatherSegments || [];
                const severeCount = segments.filter(s =>
                    (s.severity || s.risk_level || 'LOW').toUpperCase() === 'HIGH' ||
                    (s.severity || s.risk_level || 'LOW').toUpperCase() === 'SEVERE'
                ).length;
                summary = `${segments.length} segments analyzed${severeCount > 0 ? `, ${severeCount} severe conditions` : ''}`;
            } else if (agentName === 'station' && parsedOutput) {
                // Station Agent output has raw_content as a JSON string that needs parsing
                let stationData = parsedOutput;
                if (parsedOutput.raw_content && typeof parsedOutput.raw_content === 'string') {
                    try {
                        stationData = JSON.parse(parsedOutput.raw_content);
                    } catch (e) {
                        console.warn('[Station Agent] Failed to parse raw_content:', e);
                    }
                }
                const facilities = stationData.facilities || stationData.stations || [];
                const nearest = facilities[0];
                const nearestName = nearest?.name || nearest?.facility_name || 'Unknown';
                const distance = nearest?.distance || nearest?.distance_km || 'N/A';
                summary = `${facilities.length} facilities found, nearest: ${nearestName} (${distance}km)`;
            } else if (agentName === 'route' && parsedOutput) {
                // Route Agent output may have raw_content as a JSON string
                let routeData = parsedOutput;
                if (parsedOutput.raw_content && typeof parsedOutput.raw_content === 'string') {
                    try {
                        routeData = JSON.parse(parsedOutput.raw_content);
                    } catch (e) {
                        console.warn('[Route Agent] Failed to parse raw_content:', e);
                    }
                }
                const routes = routeData.routes || routeData.alternativeRoutes || [];
                const primary = routes[0];
                const duration = primary?.duration || primary?.estimated_duration || primary?.totalDuration || 'N/A';
                summary = `${routes.length} route${routes.length !== 1 ? 's' : ''} calculated${primary ? `, ETA: ${duration}` : ''}`;
            } else if (agentName === 'decision' && parsedOutput) {
                // Decision Agent output may have raw_content as a JSON string
                let decisionData = parsedOutput;
                if (parsedOutput.raw_content && typeof parsedOutput.raw_content === 'string') {
                    try {
                        decisionData = JSON.parse(parsedOutput.raw_content);
                    } catch (e) {
                        console.warn('[Decision Agent] Failed to parse raw_content:', e);
                    }
                }
                const decision = decisionData.decision || decisionData.action || 'N/A';
                const urgency = decisionData.urgency || decisionData.priority || 'N/A';
                const riskScore = decisionData.riskScore || decisionData.risk_score || decisionData.overallRisk || 'N/A';
                summary = `${decision}, Urgency: ${urgency}, Risk: ${riskScore}/100`;
            } else if (agentName === 'notification' && parsedOutput) {
                // Notification Agent output
                let notificationData = parsedOutput;
                if (parsedOutput.raw_content && typeof parsedOutput.raw_content === 'string') {
                    try {
                        notificationData = JSON.parse(parsedOutput.raw_content);
                    } catch (e) {
                        console.warn('[Notification Agent] Failed to parse raw_content:', e);
                    }
                }
                const notificationSent = notificationData.notificationSent || false;
                const messageSid = notificationData.messageSid || 'N/A';
                // _orchestrate_error is set by the backend when the Orchestrate connection
                // is misconfigured — treat it as a graceful fallback, not a hard failure.
                if (notificationData._orchestrate_error) {
                    summary = `Notification skipped (Orchestrate connection not configured) — workflow completed`;
                } else {
                    const nStatus = notificationData.status || 'UNKNOWN';
                    summary = `${nStatus} - ${notificationSent ? 'WhatsApp sent' : 'Not sent'}, SID: ${messageSid}`;
                }
            }
            
            addAgentActivityLog(
                `${agentTitles[agentName] || agentName} completed - ${summary}`,
                'success',
                singleAgentData,
                truckInfo
            );
        }
            console.log(`Setting status badge to: ${status}`);
            statusBadge.textContent = status;
            
            // Apply color coding based on status
            statusBadge.className = 'agent-status-badge';
            
            switch (status) {
                case 'PENDING':
                    statusBadge.className += ' status-pending';
                    break;
                case 'RUNNING':
                    statusBadge.className += ' status-running';
                    break;
                case 'COMPLETED':
                    statusBadge.className += ' status-completed';
                    break;
                case 'FAILED':
                    statusBadge.className += ' status-failed';
                    break;
            }
            console.log('Status badge classes:', statusBadge.className);
        } else {
            console.error('Status badge element not found!');
        }

        // Show/hide spinner
        if (spinner) {
            const shouldShow = agentStatus.status.toUpperCase() === 'RUNNING';
            console.log(`Spinner display: ${shouldShow ? 'block' : 'none'}`);
            spinner.style.display = shouldShow ? 'block' : 'none';
        }

        // Update progress bar
        if (progressBar && agentStatus.progress !== null) {
            console.log(`Setting progress bar to: ${agentStatus.progress}%`);
            progressBar.style.width = `${agentStatus.progress}%`;
        }

        // Update output
        if (outputDiv) {
            const status = agentStatus.status.toUpperCase();
            console.log(`Output div status check: ${status}, has output: ${!!agentStatus.output}`);
            
            if (status === 'COMPLETED' && agentStatus.output) {
                console.log('Formatting and displaying output...');
                // Use parsedOutput (which has raw_content already parsed) instead of agentStatus.output
                const formattedOutput = formatAgentOutput(agentName, parsedOutput || agentStatus.output);
                console.log('Formatted output length:', formattedOutput.length);
                outputDiv.innerHTML = formattedOutput + '<p style="color: var(--cds-text-secondary); font-size: 0.75rem; margin-top: var(--cds-spacing-03);">Click tile for full details</p>';
                outputDiv.style.display = 'block';
                console.log('Output div display set to block');
            } else if (status === 'FAILED' && agentStatus.error) {
                console.log('Displaying error...');
                outputDiv.innerHTML = `<div class="error-message">Error: ${agentStatus.error}</div>`;
                outputDiv.style.display = 'block';
            } else {
                console.log('Hiding output div');
                outputDiv.style.display = 'none';
            }
        } else {
            console.error('Output div element not found!');
        }
        
        console.log(`--- ${agentName} tile update complete ---`);
    }

    /**
     * Format agent output for display
     */
    function formatAgentOutput(agentName, output) {
        try {
            const data = typeof output === 'string' ? JSON.parse(output) : output;
            
            switch (agentName) {
                case 'weather':
                    return formatWeatherOutput(data);
                case 'station':
                    return formatStationOutput(data);
                case 'route':
                    return formatRouteOutput(data);
                case 'decision':
                    return formatDecisionOutput(data);
                case 'notification':
                    return formatNotificationOutput(data);
                default:
                    return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
            }
        } catch (error) {
            return `<pre>${output}</pre>`;
        }
    }

    /**
     * Format weather agent output
     */
    function formatWeatherOutput(data) {
        // Handle raw_content field - check both nested (data.output.raw_content) and root level (data.raw_content)
        const rawContent = data.output?.raw_content || data.raw_content;
        
        if (rawContent && typeof rawContent === 'string') {
            try {
                let contentStr = rawContent;
                // Handle double-escaped JSON if present
                if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                    contentStr = contentStr.slice(1, -1);
                }
                data = JSON.parse(contentStr);
            } catch (parseError) {
                console.error('[Weather] Failed to parse raw_content:', parseError);
                console.error('[Weather] Raw content was:', rawContent);
                return '<p>Error parsing weather data</p>';
            }
        }
        
        if (!data.severeWeatherDetected && data.severeWeatherDetected !== false) {
            return '<p>No weather data available</p>';
        }
        
        const severeDetected = data.severeWeatherDetected ? 'Yes' : 'No';
        const riskLevel = data.overallWeatherRisk || 0;
        const totalDelay = data.totalDelayMinutes || 0;
        const segmentCount = data.segments ? data.segments.length : 0;
        
        return `
            <div class="agent-output-section">
                <h4>Weather Analysis</h4>
                <p><strong>Severe Weather:</strong> ${severeDetected}</p>
                <p><strong>Overall Risk:</strong> ${riskLevel}%</p>
                <p><strong>Total Delay:</strong> ${totalDelay} minutes</p>
                <p><strong>Segments Analyzed:</strong> ${segmentCount}</p>
            </div>
        `;
    }

    /**
     * Format station agent output
     */
    function formatStationOutput(data) {
        // Handle raw_content field - check both nested (data.output.raw_content) and root level (data.raw_content)
        const rawContent = data.output?.raw_content || data.raw_content;
        
        if (rawContent && typeof rawContent === 'string') {
            try {
                let contentStr = rawContent;
                // Handle double-escaped JSON if present
                if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                    contentStr = contentStr.slice(1, -1);
                }
                data = JSON.parse(contentStr);
            } catch (parseError) {
                console.error('[Station] Failed to parse raw_content:', parseError);
                console.error('[Station] Raw content was:', rawContent);
                return '<p>Error parsing station data</p>';
            }
        }
        
        if (!data.facilities || data.facilities.length === 0) {
            return '<p>No facilities found</p>';
        }
        
        let html = '<div class="agent-output-section"><h4>Available Facilities</h4><ul>';
        data.facilities.slice(0, 3).forEach(facility => {
            const capabilities = facility.capabilities ?
                Object.keys(facility.capabilities).filter(k => facility.capabilities[k]).join(', ') :
                'N/A';
            html += `
                <li>
                    <strong>${facility.name}</strong><br>
                    Distance: ${facility.distance}km |
                    Capabilities: ${capabilities}<br>
                    Bays Available: ${facility.baysAvailable}/${facility.totalBays}
                </li>
            `;
        });
        html += '</ul></div>';
        return html;
    }

    /**
     * Format route agent output
     */
    function formatRouteOutput(data) {
        // Handle raw_content field - check both nested (data.output.raw_content) and root level (data.raw_content)
        const rawContent = data.output?.raw_content || data.raw_content;
        
        if (rawContent && typeof rawContent === 'string') {
            try {
                let contentStr = rawContent;
                // Handle double-escaped JSON if present
                if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                    contentStr = contentStr.slice(1, -1);
                }
                data = JSON.parse(contentStr);
            } catch (parseError) {
                console.error('[Route] Failed to parse raw_content:', parseError);
                console.error('[Route] Raw content was:', rawContent);
                return '<p>Error parsing route data</p>';
            }
        }

        if (!data.routes || data.routes.length === 0) {
            return '<p>No alternative routes found</p>';
        }
        
        let html = '<div class="agent-output-section"><h4>Alternative Routes</h4><ul>';
        data.routes.slice(0, 3).forEach(route => {
            html += `
                <li>
                    <strong>${route.name || 'Route'}</strong><br>
                    Duration: ${route.estimatedDuration || route.totalDuration || 'N/A'}min |
                    Fuel Cost: $${route.fuelCost || 'N/A'}
                </li>
            `;
        });
        html += '</ul></div>';
        return html;
    }

    /**
     * Format decision agent output
     */
    function formatDecisionOutput(data) {
        console.log('=== formatDecisionOutput called ===');
        console.log('Decision data received:', JSON.stringify(data, null, 2));
        console.log('data.decision exists:', !!data.decision);
        console.log('data keys:', Object.keys(data));
        
        // Handle empty or invalid data
        if (!data || typeof data !== 'object') {
            console.warn('Invalid decision data:', data);
            return '<p>No decision data available</p>';
        }
        
        // Handle raw_content format - check both nested (data.output.raw_content) and root level (data.raw_content)
        let parsedData = data;
        const rawContent = data.output?.raw_content || data.raw_content;
        
        if (rawContent && typeof rawContent === 'string') {
            console.log('Detected raw_content in formatDecisionOutput, parsing...');
            try {
                let contentStr = rawContent;
                // Handle double-escaped JSON if present
                if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                    contentStr = contentStr.slice(1, -1);
                }
                parsedData = JSON.parse(contentStr);
                console.log('Successfully parsed raw_content in formatter:', parsedData);
            } catch (parseError) {
                console.error('Failed to parse raw_content in formatter:', parseError);
                console.error('Raw content was:', rawContent);
                parsedData = data; // Keep original if parsing fails
            }
        }
        
        // Check if decision field exists
        if (!parsedData.decision) {
            console.warn('No decision field found in data');
            // Try to show whatever data we have
            if (Object.keys(parsedData).length > 0) {
                return `<div class="agent-output-section"><h4>Decision</h4><p>Decision processing incomplete. Raw data available in details.</p></div>`;
            }
            return '<p>No decision available</p>';
        }
        
        const decision = parsedData.decision;
        const urgency = parsedData.urgency || 'N/A';
        const riskScore = parsedData.riskScore !== undefined ? parsedData.riskScore : 0;
        const action = parsedData.recommendation?.action || parsedData.action || 'N/A';
        
        console.log('Formatted values:', { decision, urgency, riskScore, action });
        
        return `
            <div class="agent-output-section">
                <h4>Decision</h4>
                <p><strong>Decision:</strong> ${decision}</p>
                <p><strong>Urgency:</strong> ${urgency}</p>
                <p><strong>Risk Score:</strong> ${riskScore}/100</p>
                <p><strong>Recommended Action:</strong> ${action}</p>
            </div>
        `;
    }

    /**
     * Format notification agent output for inline tile display
     */
    function formatNotificationOutput(data) {
        const sent = data.notificationSent === true;
        const status = data._orchestrate_error
            ? 'SKIPPED'
            : (data.status || 'UNKNOWN');
        const sid = data.messageSid || '—';
        const msg = data.message || data._orchestrate_error || '—';

        const statusColor = sent
            ? 'var(--cds-support-success)'
            : (data._orchestrate_error ? 'var(--cds-support-warning)' : 'var(--cds-support-error)');

        return `
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <span style="font-size:0.7rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;
                                 color:${statusColor};">${status}</span>
                    <span style="font-size:0.8rem;color:var(--cds-text-secondary);">
                        ${sent ? '✓ WhatsApp sent' : (data._orchestrate_error ? 'Notification skipped' : '✗ Not sent')}
                    </span>
                </div>
                ${msg !== '—' ? `<div style="font-size:0.8rem;color:var(--cds-text-secondary);word-break:break-word;">${msg}</div>` : ''}
                ${sid !== '—' ? `<div style="font-size:0.75rem;color:var(--cds-text-placeholder);font-family:'IBM Plex Mono',monospace;">SID: ${sid}</div>` : ''}
            </div>`;
    }

    /**
     * Show execution starting state
     */
    function showExecutionStarting() {
        resetAgentTiles();
        
        // Show all agents as pending
        ['weather', 'station', 'route', 'decision', 'notification'].forEach(agentName => {
            const tile = document.getElementById(`agent-${agentName}`);
            if (tile) {
                const statusBadge = tile.querySelector('.agent-status-badge');
                if (statusBadge) {
                    statusBadge.textContent = 'PENDING';
                    statusBadge.className = 'agent-status-badge status-pending';
                }
            }
        });
    }

    /**
     * Show execution error
     */
    function showExecutionError(errorMessage) {
        console.error('Execution error:', errorMessage);
        
        // Show error in all agent tiles
        ['weather', 'station', 'route', 'decision', 'notification'].forEach(agentName => {
            const tile = document.getElementById(`agent-${agentName}`);
            if (tile) {
                const statusBadge = tile.querySelector('.agent-status-badge');
                const outputDiv = tile.querySelector('.agent-output');
                
                if (statusBadge) {
                    statusBadge.textContent = 'FAILED';
                    statusBadge.className = 'agent-status-badge status-failed';
                }
                
                if (outputDiv) {
                    outputDiv.innerHTML = `<div class="error-message">Error: ${errorMessage}</div>`;
                    outputDiv.style.display = 'block';
                }
            }
        });
    }

    /**
     * Reset all agent tiles to initial state
     */
    function resetAgentTiles() {
        ['weather', 'station', 'route', 'decision', 'notification'].forEach(agentName => {
            const tile = document.getElementById(`agent-${agentName}`);
            if (tile) {
                // Clear the wasCompleted flag to allow fresh logging for new execution
                delete tile.dataset.wasCompleted;
                
                const statusBadge = tile.querySelector('.agent-status-badge');
                const spinner = tile.querySelector('.agent-spinner');
                const outputDiv = tile.querySelector('.agent-output');
                const progressBar = tile.querySelector('.agent-progress-bar');
                
                if (statusBadge) {
                    statusBadge.textContent = 'IDLE';
                    statusBadge.className = 'agent-status-badge';
                }
                
                if (spinner) {
                    spinner.style.display = 'none';
                }
                
                if (outputDiv) {
                    outputDiv.style.display = 'none';
                    outputDiv.innerHTML = '';
                }
                
                if (progressBar) {
                    progressBar.style.width = '0%';
                }
                
                // Remove click handler
                tile.style.cursor = 'default';
                tile.onclick = null;
                tile.title = '';
            }
        });
        
        // Clear data store
        agentDataStore = {};
    }

    /**
     * Open agent details modal
     */
    function openAgentModal(agentName) {
        const data = agentDataStore[agentName];
        if (!data) {
            console.error('No data available for agent:', agentName);
            return;
        }

        const modal = document.getElementById('agentDetailsModal');
        const title = document.getElementById('modalAgentTitle');
        const content = document.getElementById('modalAgentContent');

        if (!modal || !title || !content) {
            console.error('Modal elements not found');
            return;
        }

        // Set title
        const agentTitles = {
            weather: 'Weather Agent - Full Analysis',
            station: 'Station Agent - Facility Details',
            route: 'Route Agent - Route Analysis',
            decision: 'Decision Agent - Complete Recommendation',
            notification: 'Notification Agent - WhatsApp Notification Details'
        };
        title.textContent = agentTitles[agentName] || 'Agent Details';

        // Format and display content
        try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            content.innerHTML = formatDetailedOutput(agentName, parsedData);
        } catch (error) {
            content.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }

        // Show modal
        modal.style.display = 'block';
        // Lock vertical scroll only — never lock horizontal (causes layout shift on close)
        document.body.style.overflowY = 'hidden';
    }

    /**
     * Close agent details modal
     */
    function closeModal() {
        const modal = document.getElementById('agentDetailsModal');
        if (modal) {
            modal.style.display = 'none';
            // Restore to default (empty string) — NOT 'auto'.
            // Setting overflow:'auto' on body creates a horizontal scrollbar that
            // shifts the entire page layout to the left when content is wide.
            document.body.style.overflowY = '';
        }
    }

    /**
     * Format detailed output for modal
     */
    function formatDetailedOutput(agentName, data) {
        switch (agentName) {
            case 'weather':
                return formatDetailedWeatherOutput(data);
            case 'station':
                return formatDetailedStationOutput(data);
            case 'route':
                return formatDetailedRouteOutput(data);
            case 'decision':
                return formatDetailedDecisionOutput(data);
            case 'notification':
                return formatDetailedNotificationOutput(data);
            default:
                return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
    }

    /**
     * Format detailed weather output
     */
    function formatDetailedWeatherOutput(data) {
        // Handle raw_content field - check both nested (data.output.raw_content) and root level (data.raw_content)
        const rawContent = data.output?.raw_content || data.raw_content;
        
        if (rawContent && typeof rawContent === 'string') {
            try {
                let contentStr = rawContent;
                // Handle double-escaped JSON if present
                if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                    contentStr = contentStr.slice(1, -1);
                }
                data = JSON.parse(contentStr);
            } catch (parseError) {
                console.error('[Weather Detail] Failed to parse raw_content:', parseError);
                console.error('[Weather Detail] Raw content was:', rawContent);
                return '<div style="color: var(--cds-text-primary);"><p>Error parsing weather data</p></div>';
            }
        }
        
        let html = '<div style="color: var(--cds-text-primary);">';
        
        // Summary
        html += '<h3 style="margin-top: 0;">Summary</h3>';
        html += `<p><strong>Severe Weather Detected:</strong> ${data.severeWeatherDetected ? 'Yes ⚠️' : 'No ✓'}</p>`;
        html += `<p><strong>Overall Risk Level:</strong> ${data.overallWeatherRisk || 0}%</p>`;
        html += `<p><strong>Total Delay:</strong> ${data.totalDelayMinutes || 0} minutes</p>`;
        
        // Segments - using actual API structure
        if (data.segments && data.segments.length > 0) {
            html += '<h3>Route Segments</h3>';
            html += '<div style="max-height: 400px; overflow-y: auto;">';
            data.segments.forEach((segment, index) => {
                // Determine border color based on severity
                let borderColor = '#24a148'; // green for LOW
                if (segment.severity === 'SEVERE') borderColor = '#da1e28'; // red
                else if (segment.severity === 'MODERATE') borderColor = '#ff832b'; // orange
                
                // Format coordinates
                const coords = (segment.coordinates?.latitude !== undefined && segment.coordinates?.longitude !== undefined) ?
                    `${segment.coordinates.latitude.toFixed(4)}, ${segment.coordinates.longitude.toFixed(4)}` : 'N/A';
                
                html += `
                    <div style="
                        background: var(--cds-layer-02);
                        padding: var(--cds-spacing-04);
                        margin-bottom: var(--cds-spacing-03);
                        border-radius: 4px;
                        border-left: 3px solid ${borderColor};
                    ">
                        <h4 style="margin: 0 0 var(--cds-spacing-03) 0;">Segment ${index + 1}: ${segment.location || 'N/A'}</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--cds-spacing-03);">
                            <div>
                                <p><strong>Coordinates:</strong> ${coords}</p>
                                <p><strong>Condition:</strong> ${segment.condition || 'N/A'}</p>
                                <p><strong>Severity:</strong> ${segment.severity || 'N/A'}</p>
                            </div>
                            <div>
                                <p><strong>Temperature:</strong> ${segment.temperature !== undefined ? segment.temperature + '°F' : 'N/A'}</p>
                                <p><strong>Wind Speed:</strong> ${segment.windSpeed !== undefined ? segment.windSpeed + ' mph' : 'N/A'}</p>
                                <p><strong>Visibility:</strong> ${segment.visibility !== undefined ? segment.visibility + ' miles' : 'N/A'}</p>
                            </div>
                        </div>
                        <p style="margin-top: var(--cds-spacing-03);"><strong>Estimated Delay:</strong> ${segment.estimatedDelay || 0} minutes</p>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Format detailed station output
     */
    function formatDetailedStationOutput(data) {
        // Handle raw_content field - check both nested (data.output.raw_content) and root level (data.raw_content)
        const rawContent = data.output?.raw_content || data.raw_content;
        
        if (rawContent && typeof rawContent === 'string') {
            try {
                let contentStr = rawContent;
                // Handle double-escaped JSON if present
                if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                    contentStr = contentStr.slice(1, -1);
                }
                data = JSON.parse(contentStr);
            } catch (parseError) {
                console.error('[Station Detail] Failed to parse raw_content:', parseError);
                console.error('[Station Detail] Raw content was:', rawContent);
                return '<div style="color: var(--cds-text-primary);"><p>Error parsing station data</p></div>';
            }
        }
        
        let html = '<div style="color: var(--cds-text-primary);">';
        
        if (!data.facilities || data.facilities.length === 0) {
            html += '<p>No facilities found</p>';
        } else {
            html += `<h3 style="margin-top: 0;">Found ${data.facilities.length} Facilities</h3>`;
            html += '<div style="max-height: 500px; overflow-y: auto;">';
            
            data.facilities.forEach((facility, index) => {
                // Format capabilities
                const capabilities = facility.capabilities ?
                    Object.entries(facility.capabilities)
                        .filter(([_, value]) => value)
                        .map(([key, _]) => key.replace(/([A-Z])/g, ' $1').trim())
                        .join(', ') : 'N/A';
                
                // Format operating hours from nested object structure
                let hoursText = '';
                if (facility.operatingHours) {
                    if (facility.operatingHours.open24x7) {
                        hoursText = '24/7';
                    } else if (facility.operatingHours.currentlyOpen !== undefined) {
                        hoursText = facility.operatingHours.currentlyOpen ? 'Currently Open' : 'Currently Closed';
                        if (facility.operatingHours.closingTime) {
                            const closingTime = new Date(facility.operatingHours.closingTime);
                            hoursText += ` (Closes: ${closingTime.toLocaleTimeString()})`;
                        }
                    } else if (typeof facility.operatingHours === 'object') {
                        hoursText = `${facility.operatingHours.open || 'N/A'} - ${facility.operatingHours.close || 'N/A'}`;
                    } else {
                        hoursText = facility.operatingHours;
                    }
                }
                
                // Extract city and state from name or location object
                let location = 'N/A';
                if (facility.location && facility.location.address) {
                    location = facility.location.address;
                } else if (facility.city && facility.state) {
                    location = `${facility.city}, ${facility.state}`;
                } else if (facility.name) {
                    // Try to extract from name (e.g., "Florence, SC Cold Storage")
                    const match = facility.name.match(/^([^,]+),\s*([A-Z]{2})/);
                    if (match) {
                        location = `${match[1]}, ${match[2]}`;
                    }
                }
                
                // Format coordinates from nested location object or top-level
                let coords = 'N/A';
                if (facility.location && facility.location.latitude !== undefined && facility.location.longitude !== undefined) {
                    coords = `${facility.location.latitude.toFixed(4)}, ${facility.location.longitude.toFixed(4)}`;
                } else if (facility.latitude !== undefined && facility.longitude !== undefined) {
                    coords = `${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}`;
                }
                
                html += `
                    <div style="
                        background: var(--cds-layer-02);
                        padding: var(--cds-spacing-05);
                        margin-bottom: var(--cds-spacing-04);
                        border-radius: 4px;
                    ">
                        <h4 style="margin: 0 0 var(--cds-spacing-03) 0;">${index + 1}. ${facility.name || 'Unnamed Facility'}</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--cds-spacing-03);">
                            <div>
                                <p><strong>Distance:</strong> ${facility.distance ? facility.distance.toFixed(2) : 'N/A'} km</p>
                                <p><strong>Location:</strong> ${location}</p>
                                <p><strong>Coordinates:</strong> ${coords}</p>
                            </div>
                            <div>
                                <p><strong>Bays Available:</strong> ${facility.baysAvailable || 0}/${facility.totalBays || 0}</p>
                                <p><strong>Wait Time:</strong> ${facility.estimatedWaitTime || 0} min</p>
                                <p><strong>Service Time:</strong> ${facility.estimatedServiceTime || 0} min</p>
                            </div>
                        </div>
                        <p style="margin-top: var(--cds-spacing-03);"><strong>Capabilities:</strong> ${capabilities}</p>
                        ${hoursText ? `<p><strong>Hours:</strong> ${hoursText}</p>` : ''}
                    </div>
                `;
            });
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Format detailed route output
     */
    function formatDetailedRouteOutput(data) {
        // Handle raw_content field - check both nested (data.output.raw_content) and root level (data.raw_content)
        const rawContent = data.output?.raw_content || data.raw_content;
        
        if (rawContent && typeof rawContent === 'string') {
            try {
                let contentStr = rawContent;
                // Handle double-escaped JSON if present
                if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                    contentStr = contentStr.slice(1, -1);
                }
                data = JSON.parse(contentStr);
            } catch (parseError) {
                console.error('[Route Detail] Failed to parse raw_content:', parseError);
                console.error('[Route Detail] Raw content was:', rawContent);
                return '<div style="color: var(--cds-text-primary);"><p>Error parsing route data</p></div>';
            }
        }

        let html = '<div style="color: var(--cds-text-primary);">';
        
        if (!data.routes || data.routes.length === 0) {
            html += '<p>No routes found</p>';
        } else {
            html += `<h3 style="margin-top: 0;">Found ${data.routes.length} Route${data.routes.length > 1 ? 's' : ''}</h3>`;
            html += `<p><strong>Total Routes Evaluated:</strong> ${data.totalRoutesEvaluated || data.routes.length}</p>`;
            html += '<div style="max-height: 500px; overflow-y: auto;">';
            
            data.routes.forEach((route, index) => {
                // Format destination
                const destName = route.destination?.facilityName || route.destination?.name || 'Unknown Destination';
                const destAddress = route.destination?.address || '';
                const destCoords = (route.destination?.latitude !== undefined && route.destination?.longitude !== undefined) ?
                    `${route.destination.latitude.toFixed(4)}, ${route.destination.longitude.toFixed(4)}` : '';
                
                // Format arrival time
                const arrivalTime = route.arrivalTime ? new Date(route.arrivalTime).toLocaleString() : 'N/A';
                
                html += `
                    <div style="
                        background: var(--cds-layer-02);
                        padding: var(--cds-spacing-05);
                        margin-bottom: var(--cds-spacing-04);
                        border-radius: 4px;
                        border-left: 3px solid ${route.isAlternateRoute ? '#525252' : '#0f62fe'};
                    ">
                        <h4 style="margin: 0 0 var(--cds-spacing-03) 0;">
                            ${route.name || `Route ${index + 1}`}
                            ${!route.isAlternateRoute ? ' (Primary Route)' : ''}
                        </h4>
                        
                        <div style="background: var(--cds-layer-01); padding: var(--cds-spacing-03); margin-bottom: var(--cds-spacing-03); border-radius: 4px;">
                            <p style="margin: 0;"><strong>Destination:</strong> ${destName}</p>
                            ${destAddress ? `<p style="margin: var(--cds-spacing-02) 0 0 0; font-size: 0.875rem;">${destAddress}</p>` : ''}
                            ${destCoords ? `<p style="margin: var(--cds-spacing-02) 0 0 0; font-size: 0.875rem; color: var(--cds-text-secondary);">Coordinates: ${destCoords}</p>` : ''}
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--cds-spacing-03);">
                            <div>
                                <p><strong>Distance:</strong> ${route.distance !== undefined ? route.distance + ' km' : 'N/A'}</p>
                                <p><strong>Duration:</strong> ${route.estimatedDuration || route.totalDuration || 'N/A'} min</p>
                                <p><strong>Fuel Cost:</strong> $${route.fuelCost || 'N/A'}</p>
                            </div>
                            <div>
                                <p><strong>Arrival Time:</strong> ${arrivalTime}</p>
                                <p><strong>Route Type:</strong> ${route.isAlternateRoute ? 'Alternate' : 'Primary'}</p>
                                <p><strong>Route ID:</strong> ${route.routeId || 'N/A'}</p>
                            </div>
                        </div>
                        
                        ${route.waypoints && route.waypoints.length > 0 ? `
                            <div style="margin-top: var(--cds-spacing-04);">
                                <strong>Waypoints (${route.waypoints.length}):</strong>
                                <ul style="margin: var(--cds-spacing-02) 0; padding-left: var(--cds-spacing-05); max-height: 150px; overflow-y: auto;">
                                    ${route.waypoints.map(wp => {
                                        const city = wp.city || 'Unknown';
                                        const highway = wp.highway ? ` via ${wp.highway}` : '';
                                        const type = wp.type ? ` (${wp.type})` : '';
                                        const note = wp.note ? ` - ${wp.note}` : '';
                                        return `<li>${city}${highway}${type}${note}</li>`;
                                    }).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Format detailed decision output
     */
    function formatDetailedDecisionOutput(data) {
        // Handle raw_content format - check both nested (data.output.raw_content) and root level (data.raw_content)
        let parsedData = data;
        const rawContent = data.output?.raw_content || data.raw_content;
        
        if (rawContent && typeof rawContent === 'string') {
            console.log('Detected raw_content in formatDetailedDecisionOutput, parsing...');
            try {
                let contentStr = rawContent;
                // Handle double-escaped JSON if present
                if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                    contentStr = contentStr.slice(1, -1);
                }
                parsedData = JSON.parse(contentStr);
                console.log('Successfully parsed raw_content in detailed formatter:', parsedData);
            } catch (parseError) {
                console.error('Failed to parse raw_content in detailed formatter:', parseError);
                console.error('Raw content was:', rawContent);
                parsedData = data; // Keep original if parsing fails
            }
        }
        
        // Use parsedData instead of data for the rest of the function
        data = parsedData;
        
        let html = '<div style="color: var(--cds-text-primary);">';
        
        // Decision Summary
        html += '<h3 style="margin-top: 0;">Decision Summary</h3>';
        html += `
            <div style="
                background: var(--cds-layer-02);
                padding: var(--cds-spacing-05);
                margin-bottom: var(--cds-spacing-05);
                border-radius: 4px;
                border-left: 4px solid ${data.urgency === 'CRITICAL' ? '#da1e28' : data.urgency === 'HIGH' ? '#ff832b' : '#24a148'};
            ">
                <h4 style="margin: 0 0 var(--cds-spacing-03) 0; font-size: 1.25rem;">${data.decision || 'N/A'}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--cds-spacing-04); margin-top: var(--cds-spacing-04);">
                    <div>
                        <p><strong>Urgency:</strong> <span style="color: ${data.urgency === 'CRITICAL' ? '#da1e28' : data.urgency === 'HIGH' ? '#ff832b' : '#24a148'};">${data.urgency || 'N/A'}</span></p>
                        <p><strong>Risk Score:</strong> ${data.riskScore !== undefined ? data.riskScore.toFixed(1) : 0}/100</p>
                    </div>
                </div>
            </div>
        `;
        
        // Risk Factors - using actual API structure with objects
        if (data.riskFactors && data.riskFactors.length > 0) {
            html += '<h3>Risk Factors</h3>';
            html += '<div style="max-height: 300px; overflow-y: auto;">';
            data.riskFactors.forEach((factor, index) => {
                // Handle both object and string formats
                let factorName, factorValue, factorSeverity;
                if (typeof factor === 'object') {
                    factorName = factor.factor || 'Unknown Factor';
                    factorValue = factor.value || 'N/A';
                    factorSeverity = factor.severity || 'UNKNOWN';
                } else {
                    factorName = factor;
                    factorValue = 'N/A';
                    factorSeverity = 'UNKNOWN';
                }
                
                const severityColor = factorSeverity === 'CRITICAL' ? '#da1e28' :
                                     factorSeverity === 'HIGH' ? '#ff832b' :
                                     factorSeverity === 'MODERATE' ? '#f1c21b' : '#24a148';
                
                html += `
                    <div style="
                        background: var(--cds-layer-02);
                        padding: var(--cds-spacing-04);
                        margin-bottom: var(--cds-spacing-03);
                        border-radius: 4px;
                        border-left: 3px solid ${severityColor};
                    ">
                        <p style="margin: 0;"><strong>${factorName}</strong></p>
                        <p style="margin: var(--cds-spacing-02) 0 0 0;">Value: ${factorValue}</p>
                        <p style="margin: var(--cds-spacing-02) 0 0 0;">Severity: <span style="color: ${severityColor};">${factorSeverity}</span></p>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Selected Route
        if (data.selectedRoute) {
            html += '<h3>Selected Route</h3>';
            const route = data.selectedRoute;
            const arrivalTime = route.arrivalTime ? new Date(route.arrivalTime).toLocaleString() : 'N/A';
            html += `
                <div style="background: var(--cds-layer-02); padding: var(--cds-spacing-05); margin-bottom: var(--cds-spacing-05); border-radius: 4px;">
                    <h4 style="margin: 0 0 var(--cds-spacing-03) 0;">${route.name || 'Selected Route'}</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--cds-spacing-03);">
                        <div>
                            <p><strong>Route ID:</strong> ${route.routeId || 'N/A'}</p>
                            <p><strong>Destination:</strong> ${route.destination || 'N/A'}</p>
                            <p><strong>Duration:</strong> ${route.duration || 'N/A'} min</p>
                        </div>
                        <div>
                            <p><strong>Arrival Time:</strong> ${arrivalTime}</p>
                            <p><strong>Fuel Cost:</strong> $${route.fuelCost || 'N/A'}</p>
                            <p><strong>Alternate Route:</strong> ${route.isAlternateRoute ? 'Yes' : 'No'}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Selected Facility
        if (data.selectedFacility) {
            html += '<h3>Selected Facility</h3>';
            const facility = data.selectedFacility;
            html += `
                <div style="background: var(--cds-layer-02); padding: var(--cds-spacing-05); margin-bottom: var(--cds-spacing-05); border-radius: 4px;">
                    <h4 style="margin: 0 0 var(--cds-spacing-03) 0;">${facility.name || 'Selected Facility'}</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--cds-spacing-03);">
                        <div>
                            <p><strong>Station ID:</strong> ${facility.stationId || 'N/A'}</p>
                            <p><strong>On Planned Route:</strong> ${facility.onPlannedRoute ? 'Yes' : 'No'}</p>
                            <p><strong>Service Available:</strong> ${facility.serviceAvailable ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                            <p><strong>Service Type:</strong> ${facility.serviceType || 'N/A'}</p>
                            <p><strong>Service Fee:</strong> $${facility.serviceFee || 'N/A'}</p>
                            ${facility.coolingDuration ? `<p><strong>Cooling Duration:</strong> ${facility.coolingDuration} min</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Rejected Options
        if (data.rejectedOptions && data.rejectedOptions.length > 0) {
            html += '<h3>Rejected Options</h3>';
            html += '<div style="max-height: 300px; overflow-y: auto;">';
            data.rejectedOptions.forEach((option, index) => {
                html += `
                    <div style="background: var(--cds-layer-02); padding: var(--cds-spacing-04); margin-bottom: var(--cds-spacing-03); border-radius: 4px;">
                        <h4 style="margin: 0 0 var(--cds-spacing-02) 0;">${option.name || `Option ${index + 1}`}</h4>
                        <p><strong>Type:</strong> ${option.type || 'N/A'}</p>
                        ${option.stationId ? `<p><strong>Station ID:</strong> ${option.stationId}</p>` : ''}
                        <p><strong>Reason:</strong> ${option.reason || 'N/A'}</p>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Recommendation with reasoning array
        if (data.recommendation) {
            html += '<h3>Recommended Action</h3>';
            html += `
                <div style="background: var(--cds-layer-02); padding: var(--cds-spacing-05); margin-bottom: var(--cds-spacing-05); border-radius: 4px;">
                    <p><strong>Action:</strong> ${data.recommendation.action || 'N/A'}</p>
                    ${data.recommendation.estimatedArrival ? `<p><strong>Estimated Arrival:</strong> ${new Date(data.recommendation.estimatedArrival).toLocaleString()}</p>` : ''}
                    ${data.recommendation.serviceRestored ? `<p><strong>Service Restored:</strong> ${new Date(data.recommendation.serviceRestored).toLocaleString()}</p>` : ''}
                    ${data.recommendation.serviceType ? `<p><strong>Service Type:</strong> ${data.recommendation.serviceType}</p>` : ''}
                    ${data.recommendation.safetyBuffer !== undefined ? `<p><strong>Safety Buffer:</strong> ${data.recommendation.safetyBuffer} min</p>` : ''}
                    
                    ${data.recommendation.reasoning && Array.isArray(data.recommendation.reasoning) ? `
                        <div style="margin-top: var(--cds-spacing-04);">
                            <strong>Reasoning:</strong>
                            <ul style="margin: var(--cds-spacing-02) 0; padding-left: var(--cds-spacing-05);">
                                ${data.recommendation.reasoning.map(reason => `<li style="margin-bottom: var(--cds-spacing-02);">${reason}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Financial Analysis
        if (data.financialAnalysis) {
            html += '<h3>Financial Analysis</h3>';
            const fa = data.financialAnalysis;
            html += `
                <div style="background: var(--cds-layer-02); padding: var(--cds-spacing-05); margin-bottom: var(--cds-spacing-05); border-radius: 4px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--cds-spacing-03);">
                        <div>
                            <p><strong>Reroute Cost:</strong> $${fa.rerouteCost || 'N/A'}</p>
                            <p><strong>Cargo Value at Risk:</strong> $${fa.cargoValueAtRisk?.toLocaleString() || 'N/A'}</p>
                            <p><strong>Net Savings:</strong> $${fa.netSavings?.toLocaleString() || 'N/A'}</p>
                        </div>
                        <div>
                            ${fa.roi !== undefined ? `<p><strong>ROI:</strong> ${fa.roi.toLocaleString()}%</p>` : ''}
                            ${fa.costAsPercentOfCargo !== undefined ? `<p><strong>Cost as % of Cargo:</strong> ${(fa.costAsPercentOfCargo * 100).toFixed(2)}%</p>` : ''}
                        </div>
                    </div>
                    ${fa.breakdown ? `
                        <div style="margin-top: var(--cds-spacing-04); padding-top: var(--cds-spacing-04); border-top: 1px solid var(--cds-border-subtle);">
                            <strong>Cost Breakdown:</strong>
                            <ul style="margin: var(--cds-spacing-02) 0; padding-left: var(--cds-spacing-05);">
                                ${Object.entries(fa.breakdown).map(([key, value]) =>
                                    `<li>${key.replace(/([A-Z])/g, ' $1').trim()}: $${value}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Post Recovery Plan
        if (data.postRecoveryPlan) {
            html += '<h3>Post-Recovery Plan</h3>';
            const prp = data.postRecoveryPlan;
            html += `
                <div style="background: var(--cds-layer-02); padding: var(--cds-spacing-05); margin-bottom: var(--cds-spacing-05); border-radius: 4px;">
                    ${prp.serviceRestored ? `<p><strong>Service Restored:</strong> ${new Date(prp.serviceRestored).toLocaleString()}</p>` : ''}
                    ${prp.serviceType ? `<p><strong>Service Type:</strong> ${prp.serviceType}</p>` : ''}
                    ${prp.transferToOriginalDestination ? `<p><strong>Transfer to Original Destination:</strong> ${new Date(prp.transferToOriginalDestination).toLocaleString()}</p>` : ''}
                    ${prp.finalArrivalNewYork ? `<p><strong>Final Arrival:</strong> ${new Date(prp.finalArrivalNewYork).toLocaleString()}</p>` : ''}
                    ${prp.totalDelayFromOriginal !== undefined ? `<p><strong>Total Delay from Original:</strong> ${prp.totalDelayFromOriginal} min</p>` : ''}
                    ${prp.cargoCondition ? `<p><strong>Cargo Condition:</strong> <span style="color: ${prp.cargoCondition === 'PRESERVED' ? '#24a148' : '#da1e28'};">${prp.cargoCondition}</span></p>` : ''}
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }
    /**
     * Format detailed notification output
     */
    function formatDetailedNotificationOutput(data) {
        // Handle raw_content format - check both nested (data.output.raw_content) and root level (data.raw_content)
        let parsedData = data;
        const rawContent = data.output?.raw_content || data.raw_content;
        
        if (rawContent && typeof rawContent === 'string') {
            console.log('Detected raw_content in formatDetailedNotificationOutput, parsing...');
            try {
                let contentStr = rawContent;
                // Handle double-escaped JSON if present
                if (contentStr.startsWith('{{') && contentStr.endsWith('}}')) {
                    contentStr = contentStr.slice(1, -1);
                }
                parsedData = JSON.parse(contentStr);
                console.log('Successfully parsed raw_content in notification formatter:', parsedData);
            } catch (parseError) {
                console.error('Failed to parse raw_content in notification formatter:', parseError);
                console.error('Raw content was:', rawContent);
                parsedData = data; // Keep original if parsing fails
            }
        }
        
        // Use parsedData instead of data for the rest of the function
        data = parsedData;
        
        let html = '<div style="color: var(--cds-text-primary);">';
        
        // Notification Status Summary
        const notificationSent = data.notificationSent || false;
        const status = data.status || 'UNKNOWN';
        const statusColor = notificationSent ? '#24a148' : '#da1e28'; // green for success, red for failure
        
        html += '<h3 style="margin-top: 0;">Notification Status</h3>';
        html += `
            <div style="
                background: var(--cds-layer-02);
                padding: var(--cds-spacing-05);
                margin-bottom: var(--cds-spacing-05);
                border-radius: 4px;
                border-left: 4px solid ${statusColor};
            ">
                <h4 style="margin: 0 0 var(--cds-spacing-03) 0; font-size: 1.25rem; color: ${statusColor};">
                    ${notificationSent ? '✓ WhatsApp Notification Sent' : '✗ Notification Failed'}
                </h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--cds-spacing-04); margin-top: var(--cds-spacing-04);">
                    <div>
                        <p><strong>Status:</strong> <span style="color: ${statusColor};">${status}</span></p>
                        <p><strong>Message SID:</strong> ${data.messageSid || 'N/A'}</p>
                    </div>
                    <div>
                        <p><strong>Timestamp:</strong> ${data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}</p>
                        <p><strong>Notification Sent:</strong> ${notificationSent ? 'Yes' : 'No'}</p>
                    </div>
                </div>
            </div>
        `;
        
        // Message Content
        if (data.message) {
            html += '<h3>Message Content</h3>';
            html += `
                <div style="
                    background: var(--cds-layer-02);
                    padding: var(--cds-spacing-05);
                    margin-bottom: var(--cds-spacing-05);
                    border-radius: 4px;
                    font-family: 'IBM Plex Mono', monospace;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                ">
                    ${data.message}
                </div>
            `;
        }
        
        // Error Details (if any)
        if (data.error) {
            html += '<h3>Error Details</h3>';
            html += `
                <div style="
                    background: var(--cds-layer-02);
                    padding: var(--cds-spacing-05);
                    margin-bottom: var(--cds-spacing-05);
                    border-radius: 4px;
                    border-left: 4px solid #da1e28;
                ">
                    <p style="color: #da1e28; font-weight: 600;">${data.error}</p>
                </div>
            `;
        }
        
        // Additional Details
        if (data.truckId || data.driverName) {
            html += '<h3>Recipient Details</h3>';
            html += `
                <div style="
                    background: var(--cds-layer-02);
                    padding: var(--cds-spacing-05);
                    margin-bottom: var(--cds-spacing-05);
                    border-radius: 4px;
                ">
                    ${data.truckId ? `<p><strong>Truck ID:</strong> ${data.truckId}</p>` : ''}
                    ${data.driverName ? `<p><strong>Driver Name:</strong> ${data.driverName}</p>` : ''}
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }


    // Add activity log entry for agent execution
    function addAgentActivityLog(message, type = 'info', agentData = null, truckInfo = null) {
        const log = document.getElementById('agentActivityLog');
        if (!log) return;

        const entry = document.createElement('div');
        entry.style.cssText = `
            padding: var(--cds-spacing-04);
            border-left: 3px solid ${type === 'success' ? '#24a148' : type === 'error' ? '#da1e28' : '#0f62fe'};
            background: var(--cds-layer-01);
            margin-bottom: var(--cds-spacing-03);
            font-size: 0.875rem;
            line-height: 1.5;
        `;

        const timestamp = new Date().toLocaleTimeString();
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--cds-spacing-02);">
                <strong style="color: var(--cds-text-primary);">${message}</strong>
                <span style="color: var(--cds-text-secondary); font-size: 0.75rem;">${timestamp}</span>
            </div>
        `;

        // Add truck context if provided
        if (truckInfo) {
            html += '<div style="margin-top: var(--cds-spacing-02); padding: var(--cds-spacing-03); background: var(--cds-layer-02); border-radius: 4px; font-size: 0.8125rem;">';
            html += `<strong>Cargo:</strong> ${truckInfo.cargo || 'N/A'} | `;
            html += `<strong>Temp:</strong> ${truckInfo.temperature || 'N/A'}°C | `;
            html += `<strong>Route:</strong> ${truckInfo.origin || 'N/A'} → ${truckInfo.destination || 'N/A'}`;
            html += '</div>';
        }

        // Add agent-specific summary data
        if (agentData) {
            html += '<div style="margin-top: var(--cds-spacing-03); padding-left: var(--cds-spacing-04); border-left: 2px solid var(--cds-border-subtle);">';
            
            if (agentData.weather) {
                const w = agentData.weather;
                // Convert numeric overallWeatherRisk (0-100) to risk level string
                const riskScore = w.overallWeatherRisk || w.overall_weather_risk || 0;
                let risk = 'UNKNOWN';
                if (riskScore <= 25) risk = 'LOW';
                else if (riskScore <= 50) risk = 'MODERATE';
                else if (riskScore <= 75) risk = 'HIGH';
                else if (riskScore > 75) risk = 'SEVERE';
                const segmentCount = w.segments?.length || 0;
                const severeCount = w.segments?.filter(s => (s.riskLevel || s.risk_level || '').toUpperCase() === 'HIGH' || (s.riskLevel || s.risk_level || '').toUpperCase() === 'SEVERE').length || 0;
                html += `
                    <div style="margin-bottom: var(--cds-spacing-02);">
                        <strong style="color: var(--cds-text-secondary);">Weather:</strong>
                        <span style="color: var(--cds-text-primary);"> ${risk} risk, ${segmentCount} segments analyzed${severeCount > 0 ? `, ${severeCount} severe` : ''}</span>
                    </div>
                `;
            }

            if (agentData.station) {
                const s = agentData.station;
                const facilityCount = s.facilities?.length || 0;
                const firstFacility = s.facilities?.[0];
                const distance = firstFacility?.distance || firstFacility?.distanceKm || 'N/A';
                html += `
                    <div style="margin-bottom: var(--cds-spacing-02);">
                        <strong style="color: var(--cds-text-secondary);">Station:</strong>
                        <span style="color: var(--cds-text-primary);"> ${facilityCount} facilities found${firstFacility ? `, nearest: ${firstFacility.name} (${distance}km)` : ''}</span>
                    </div>
                `;
            }

            if (agentData.route) {
                const r = agentData.route;
                const routeCount = r.routes?.length || 0;
                const primaryRoute = r.routes?.[0];
                const distance = primaryRoute?.totalDistance || primaryRoute?.total_distance || 'N/A';
                const duration = primaryRoute?.totalDuration || primaryRoute?.total_duration || primaryRoute?.estimatedDuration || primaryRoute?.estimated_duration || 'N/A';
                html += `
                    <div style="margin-bottom: var(--cds-spacing-02);">
                        <strong style="color: var(--cds-text-secondary);">Route:</strong>
                        <span style="color: var(--cds-text-primary);"> ${routeCount} routes calculated${primaryRoute ? `, primary: ${distance}km, ${duration}min` : ''}</span>
                    </div>
                `;
            }

            if (agentData.decision) {
                const d = agentData.decision;
                const riskScore = d.riskScore || d.risk_score || d.riskAssessment?.overallRiskScore || d.risk_assessment?.overall_risk_score || 'N/A';
                const action = d.action || d.recommendation?.action || 'N/A';
                const urgency = d.urgency || d.recommendation?.urgency || '';
                html += `
                    <div style="margin-bottom: var(--cds-spacing-02);">
                        <strong style="color: var(--cds-text-secondary);">Decision:</strong>
                        <span style="color: var(--cds-text-primary);"> Risk: ${riskScore}/100${urgency ? ` (${urgency})` : ''}, Action: ${action}</span>
                    </div>
                `;
            }

            html += '</div>';
        }

        entry.innerHTML = html;
        log.insertBefore(entry, log.firstChild);

        // Keep only last 20 entries
        while (log.children.length > 20) {
            log.removeChild(log.lastChild);
        }
    }
    
    /**
     * Switch to driver view for the currently selected truck
     */
    function switchToDriverView() {
        if (!selectedTruckId) {
            console.log('No truck selected in agents tab');
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

    // Public API
    return {
        init,
        onTruckSelected,
        executeAgentWorkflow,
        populateAgentTruckDropdown,
        closeModal,
        addAgentActivityLog,
        switchToDriverView
    };
})();

// Initialize on page load
if (typeof window !== 'undefined') {
    window.AgentsModule = AgentsModule;
    window.onAgentTruckSelected = AgentsModule.onTruckSelected;
    window.switchToDriverViewFromAgents = AgentsModule.switchToDriverView;
}

// Made with Bob
