// src/DataContext.js
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const DataContext = createContext();
export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
	const [prevPos, setPrevPos] = useState({});
	const [drones, setDrones] = useState({});
	const [masterData, setMasterData] = useState({});
	const [selectedRow, setSelectedRow] = useState();
	const [isReady, setIsReady] = useState(false);
	const [currentImage, setCurrentImage] = useState();
	const [connectionStatus, setConnectionStatus] = useState('connecting');
	const [alertStatus, setAlertStatus] = useState({});
	const [historicalPaths, setHistoricalPaths] = useState({});
	const [inactiveDronesRefreshTrigger, setInactiveDronesRefreshTrigger] = useState(0);

	const currentDroneId = useRef(null);
	const apiCallingId = useRef(null);

	const socketRef = useRef(null);
	const reconnectTimeoutRef = useRef(null);
	const heartbeatIntervalRef = useRef(null);
	const inactivityCheckIntervalRef = useRef(null);
	const lastSeenTimestamps = useRef({}); // Track last seen time for each drone
	
	// Initialize blacklist - ALWAYS start empty on page load to prevent showing old inactive drones
	const blacklistedDroneIds = useRef(null);
	if (blacklistedDroneIds.current === null) {
		// DON'T load from localStorage on page reload - start fresh
		// This prevents 700+ old inactive drones from appearing on page load
		blacklistedDroneIds.current = new Set();
		console.log(`🆕 Starting with empty blacklist (cleared on page reload)`);
		
		// Clear localStorage to prevent accumulation
		try {
			localStorage.removeItem('blacklistedDroneIds');
			console.log(`🗑️  Cleared blacklist from localStorage`);
		} catch (e) {
			console.error('Error clearing blacklist from localStorage:', e);
		}
	}
	
	const maxReconnectAttempts = 10;
	const reconnectAttemptRef = useRef(0);
	const INACTIVITY_THRESHOLD = 3 * 60 * 1000; // 3 minutes in milliseconds

	// Function to check for inactive drones and move them
	const checkInactiveDrones = useCallback(() => {
		const now = Date.now();
		const inactiveDroneIds = [];

		console.log(`🔍 Running inactivity check at ${new Date(now).toLocaleTimeString()}`);
		
		// Check each drone's last seen timestamp
		// Filter out metadata keys (those ending with _dataTimestamp)
		Object.keys(lastSeenTimestamps.current).forEach(key => {
			// Skip metadata keys - only check actual drone IDs
			if (key.endsWith('_dataTimestamp')) {
				return;
			}
			
			const droneId = key;
			const lastSeen = lastSeenTimestamps.current[droneId];
			const timeSinceLastSeen = now - lastSeen;
			const minutesSinceLastSeen = Math.round(timeSinceLastSeen / 60000);
			const secondsSinceLastSeen = Math.round(timeSinceLastSeen / 1000);

			console.log(`   📊 Drone ${droneId}: last seen ${minutesSinceLastSeen} min (${secondsSinceLastSeen}s) ago | Threshold: ${INACTIVITY_THRESHOLD}ms (${INACTIVITY_THRESHOLD/1000}s)`);
			console.log(`      Time since last seen: ${timeSinceLastSeen}ms | Is inactive? ${timeSinceLastSeen >= INACTIVITY_THRESHOLD}`);

			if (timeSinceLastSeen >= INACTIVITY_THRESHOLD) {
				inactiveDroneIds.push(droneId);
				console.log(`   🔴 Drone ${droneId} is INACTIVE (no data for ${minutesSinceLastSeen} minutes / ${secondsSinceLastSeen} seconds)`);
			}
		});

		// Move inactive drones from active list
		if (inactiveDroneIds.length > 0) {
			console.log(`🔄 Removing ${inactiveDroneIds.length} inactive drones from active list and map`);
			
			// Add to blacklist to prevent re-adding from WebSocket
			inactiveDroneIds.forEach(droneId => {
				blacklistedDroneIds.current.add(droneId);
				console.log(`   🚫 Blacklisting drone ${droneId} - will not accept WebSocket data until reactivated`);
			});
			
			// Persist blacklist to localStorage
			try {
				localStorage.setItem('blacklistedDroneIds', JSON.stringify(Array.from(blacklistedDroneIds.current)));
				console.log(`💾 Saved blacklist to localStorage (${blacklistedDroneIds.current.size} drones blacklisted)`);
			} catch (e) {
				console.error('Error saving blacklist to localStorage:', e);
			}
			
			// Remove from masterData (active list)
			setMasterData(prev => {
				const updated = { ...prev };
				inactiveDroneIds.forEach(droneId => {
					if (updated[droneId]) {
						console.log(`   ❌ Removing drone ${droneId} from active list (masterData)`);
						delete updated[droneId];
					}
				});
				return updated;
			});

			// Remove from drones (map display) and add to inactive section
			setDrones(prev => {
				const updated = { ...prev };
				inactiveDroneIds.forEach(droneId => {
					if (updated[droneId]) {
						console.log(`   ❌ Removing drone ${droneId} from map (drones state)`);
						// Mark as inactive before removing from map
						updated[droneId] = { ...updated[droneId], _isInactive: true };
					}
				});
				
				// Keep inactive drones in drones state but marked as inactive
				// They won't show on map but will be available for inactive list
				return updated;
			});

			// Remove from prevPos (trail)
			setPrevPos(prev => {
				const updated = { ...prev };
				inactiveDroneIds.forEach(droneId => {
					if (updated[droneId]) {
						delete updated[droneId];
					}
				});
				return updated;
			});
			
			// Clean up lastSeenTimestamps
			inactiveDroneIds.forEach(droneId => {
				delete lastSeenTimestamps.current[droneId];
			});
			
			console.log(`✅ Inactivity check complete: ${inactiveDroneIds.length} drones moved to inactive`);
			
			// Trigger refresh of inactive drones list in DisplayData
			setInactiveDronesRefreshTrigger(prev => prev + 1);
		} else {
			console.log(`✅ Inactivity check complete: All ${Object.keys(lastSeenTimestamps.current).filter(k => !k.endsWith('_dataTimestamp')).length} drones are active`);
		}
	}, [setDrones, setMasterData, setPrevPos, INACTIVITY_THRESHOLD]);

	const connectWebSocket = () => {
		try {
			const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
			const isLocal = window.location.hostname === 'localhost';
			
			// In production, use same host as frontend (backend serves both)
			// In local dev, connect directly to backend on port 4000
			const wsUrl = isLocal
				? `${wsProto}://localhost:4000/ws`
				: `${wsProto}://${window.location.host}/ws`;
	
			console.log('Attempting to connect to WebSocket:', wsUrl);
			console.log('Frontend host:', window.location.host);
			setConnectionStatus('connecting');

			const socket = new WebSocket(wsUrl);
			socketRef.current = socket;

			socket.onopen = () => {
				console.log('WebSocket connected successfully');
				setConnectionStatus('connected');
				reconnectAttemptRef.current = 0;
				setIsReady(true);
				
				// Start heartbeat to keep connection alive
				if (heartbeatIntervalRef.current) {
					clearInterval(heartbeatIntervalRef.current);
				}
				heartbeatIntervalRef.current = setInterval(() => {
					if (socket.readyState === WebSocket.OPEN) {
						socket.send(JSON.stringify({ type: 'ping' }));
					}
				}, 30000); // Send ping every 30 seconds

				// DISABLED: Automatic inactivity check
				// Users will manually refresh inactive drones list using the refresh button
				if (inactivityCheckIntervalRef.current) {
					clearInterval(inactivityCheckIntervalRef.current);
				}
				
				console.log(`ℹ️  Automatic inactivity check is DISABLED`);
				console.log(`   Use the refresh button to manually update inactive drones list`);
				
				// // Run first check after 3 minutes
				// inactivityCheckIntervalRef.current = setInterval(() => {
				// 	console.log('⏰ Running scheduled inactivity check (every 3 minutes)');
				// 	checkInactiveDrones();
				// }, 180000); // Check every 3 minutes (180,000 milliseconds)
				//
				// const checkTime = new Date(Date.now() + 180000).toLocaleTimeString();
				// console.log(`✅ Automatic inactivity check enabled: First check at ${checkTime}, then every 3 minutes`);
				// console.log(`   Threshold: Drones inactive for 3+ minutes will be removed`);
			};

			socket.onmessage = (event) => {
				try {
					const raw = JSON.parse(event.data);
					// console.log('WS raw data:', raw);

					// backend sends: [ { drone_id, lat, lng, ... }, ... ]
					let list;
					if (Array.isArray(raw)) {
						list = raw;
					} else if (raw && typeof raw === 'object') {
						list = Object.values(raw);
					} else {
						console.warn('WS data not array or object, ignoring:', raw);
						return;
					}

					if (!list || list.length === 0) {
						console.log('WS frame is empty after normalisation');
						return;
					}

					const updated = {};
					const masterDataUpdates = {};
					const firstDrone = list[0];
					const firstDroneId =
						firstDrone.drone_id || firstDrone.id || firstDrone.flight_id;

					list.forEach((drone) => {
						const droneId = drone.drone_id || drone.id || drone.flight_id;
						if (!droneId) return;
		
						// Update last seen timestamp ONLY if this is new data
						// Check if drone has a timestamp and if it's different from what we have
						const droneTimestamp = drone.timestamp || drone.detection_time || drone.time_utc || drone.last_update;
						const now = Date.now();
						
						// Check if this is new data by comparing the drone's data timestamp
						const isFirstTime = !lastSeenTimestamps.current[droneId];
						const hasNewData = droneTimestamp && droneTimestamp !== lastSeenTimestamps.current[`${droneId}_dataTimestamp`];
						
						// If drone is blacklisted, only remove from blacklist if it has NEW data
						if (blacklistedDroneIds.current.has(droneId)) {
							if (hasNewData) {
								console.log(`✅ [WebSocket] Drone ${droneId} has NEW data - removing from blacklist and reactivating`);
								blacklistedDroneIds.current.delete(droneId);
								
								// Update localStorage
								try {
									localStorage.setItem('blacklistedDroneIds', JSON.stringify(Array.from(blacklistedDroneIds.current)));
									console.log(`💾 Updated blacklist in localStorage (${blacklistedDroneIds.current.size} drones remaining)`);
								} catch (e) {
									console.error('Error updating blacklist in localStorage:', e);
								}
							} else {
								// Drone is blacklisted and has no new data - skip processing
								console.log(`🚫 Skipping blacklisted drone ${droneId} - no new data (still inactive)`);
								return;
							}
						}
						
						if (isFirstTime) {
							// First time seeing this drone - use the drone's actual timestamp if available
							// This prevents old drones from appearing as "just seen" on page load
							if (droneTimestamp) {
								// Convert drone timestamp to milliseconds if needed
								const droneTimeMs = droneTimestamp > 10000000000 ? droneTimestamp : droneTimestamp * 1000;
								lastSeenTimestamps.current[droneId] = droneTimeMs;
								lastSeenTimestamps.current[`${droneId}_dataTimestamp`] = droneTimestamp;
								console.log(`🆕 First time seeing ${droneId} - using drone's timestamp: ${new Date(droneTimeMs).toLocaleTimeString()} (${droneTimestamp})`);
							} else {
								// No timestamp available, use current time
								lastSeenTimestamps.current[droneId] = now;
								console.log(`🆕 First time seeing ${droneId} - no drone timestamp, using current time`);
							}
						} else if (hasNewData) {
							// Existing drone with new data - update to current time
							lastSeenTimestamps.current[droneId] = now;
							lastSeenTimestamps.current[`${droneId}_dataTimestamp`] = droneTimestamp;
							console.log(`📡 Updated last seen for ${droneId} at ${new Date(now).toLocaleTimeString()} (data timestamp: ${droneTimestamp})`);
						} else {
							// Same old data being re-broadcast - don't update timestamp
							console.log(`⏭️  Skipping timestamp update for ${droneId} - same data being re-broadcast`);
						}

						// normalise lat/lng (backend already sends top-level lat/lng)
						const lat = drone.lat ?? drone.position?.lat ?? drone.drone_latitude;
						const lng = drone.lng ?? drone.position?.lng ?? drone.drone_longitude;

						// Helper to parse numeric values (null if empty/invalid)
						const parseNumeric = (value) => {
							if (value === null || value === undefined || value === '') return null;
							const parsed = parseFloat(value);
							return isNaN(parsed) ? null : parsed;
						};

						// Parse altitude and speed (only use normalized field names to avoid conflicts)
						const altitude = parseNumeric(drone.altitude);
						const speed = parseNumeric(drone.speed);

						// Log telemetry values for debugging
						if (altitude !== null || speed !== null) {
							console.log(`📊 [${droneId}] Telemetry - Alt: ${altitude}m, Speed: ${speed}m/s`);
						}

						// Handle live data format with additional fields
						// Preserve ALL fields from the incoming data using spread operator first
						const normalised = {
							...drone, // Preserve all original fields including azimuth, elevation, angle, error, etc.
							lat,
							lng,
							// Ensure these fields exist for compatibility (use null instead of 0 for missing values)
							altitude,
							speed,
							timestamp: drone.timestamp ?? drone.detection_time ?? drone.time_utc ?? drone.last_update,
							// Explicitly preserve sensor-specific fields for FOV direction
							azimuth: drone.azimuth,
							elevation: drone.elevation,
							angle: drone.angle,
							error: drone.error,
						};

						updated[droneId] = normalised;
						masterDataUpdates[droneId] = { drone: normalised };

						if (lat != null && lng != null) {
							setPrevPos((prev) => {
								const oldPos = prev[droneId] || [];
								const newPos = [...oldPos, [lat, lng]];
								
								// Log position changes for debugging
								if (oldPos.length > 0) {
									const lastPos = oldPos[oldPos.length - 1];
									const latDiff = Math.abs(lat - lastPos[0]);
									const lngDiff = Math.abs(lng - lastPos[1]);
									
									if (latDiff > 0.000001 || lngDiff > 0.000001) {
										const distanceMeters = Math.sqrt(
											Math.pow((lat - lastPos[0]) * 111000, 2) +
											Math.pow((lng - lastPos[1]) * 111000 * Math.cos(lat * Math.PI / 180), 2)
										);
										console.log(`📍 [${droneId}] Position changed: ${distanceMeters.toFixed(2)}m (Δlat: ${latDiff.toFixed(8)}, Δlng: ${lngDiff.toFixed(8)})`);
									}
								}
								
								if (newPos.length > 5) {
									newPos.splice(0, newPos.length - 5);
								}
								return { ...prev, [droneId]: newPos };
							});
						}
					});

					// Update masterData once with all drones (excluding blacklisted)
					// Preserve any selected inactive drone so tabs/panels stay populated
					setMasterData((prev) => {
						// Keep inactive drones from prev state
						const inactiveInPrev = {};
						Object.keys(prev).forEach(id => {
							if (prev[id]?.drone?._isInactive || prev[id]?._isInactive) {
								inactiveInPrev[id] = prev[id];
							}
						});

						const updated = { ...inactiveInPrev };
						
						// Add non-blacklisted incoming live drones
						Object.keys(masterDataUpdates).forEach(droneId => {
							if (!blacklistedDroneIds.current.has(droneId)) {
								updated[droneId] = masterDataUpdates[droneId];
							}
						});
						
						const blacklistedCount = Object.keys(masterDataUpdates).filter(id => blacklistedDroneIds.current.has(id)).length;
						console.log(`📡 WebSocket update: ${Object.keys(masterDataUpdates).length} drones received, ${blacklistedCount} blacklisted, ${Object.keys(updated).length} total active in masterData`);
						return updated;
					});

					// console.log(
					//   'Normalised drone count:',
					//   Object.keys(updated).length
					// );
					
					// Update drones state for map display
					setDrones((prev) => {
						// If we received drone updates, use them
						if (Object.keys(updated).length > 0) {
							// Keep inactive drones from previous state
							const inactiveDrones = {};
							Object.keys(prev).forEach(id => {
								if (prev[id]._isInactive) {
									inactiveDrones[id] = prev[id];
								}
							});
							
							// Filter out blacklisted drones from updated
							const activeUpdated = {};
							Object.keys(updated).forEach(droneId => {
								if (!blacklistedDroneIds.current.has(droneId)) {
									activeUpdated[droneId] = updated[droneId];
								}
							});
							
							// Merge live drones with inactive drones
							return { ...inactiveDrones, ...activeUpdated };
						} else {
							// No new drone data - keep previous state (don't clear the map!)
							console.log('📡 No new drone data in this update - preserving previous state');
							return prev;
						}
					});
					setIsReady(true);

					if (firstDroneId) {
						setSelectedRow((prev) => prev || firstDroneId);
					}
				} catch (err) {
					console.error('Error in WS onmessage:', err);
					console.error('Raw message:', event.data);
				}
			};

			socket.onerror = (error) => {
				console.error('WebSocket error:', error);
				setConnectionStatus('error');
			};

			socket.onclose = (event) => {
				console.log('WebSocket connection closed:', event.code, event.reason);
				setConnectionStatus('disconnected');
				
				// Clear heartbeat interval
				if (heartbeatIntervalRef.current) {
					clearInterval(heartbeatIntervalRef.current);
					heartbeatIntervalRef.current = null;
				}

				if (
					event.code !== 1000 &&
					reconnectAttemptRef.current < maxReconnectAttempts
				) {
					reconnectAttemptRef.current += 1;
					const delay = Math.min(
						1000 * Math.pow(2, reconnectAttemptRef.current),
						10000
					);
					console.log(
						`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts})`
					);

					reconnectTimeoutRef.current = setTimeout(() => {
						connectWebSocket();
					}, delay);
				}
			};
		} catch (error) {
			console.error('Failed to create WebSocket connection:', error);
			setConnectionStatus('error');
		}
	};

	useEffect(() => {
		const initialDelay = setTimeout(() => {
			connectWebSocket();
		}, 1000);

		const reconnectTimeoutRefCurrent = reconnectTimeoutRef;
		const heartbeatIntervalRefCurrent = heartbeatIntervalRef;
		const inactivityCheckIntervalRefCurrent = inactivityCheckIntervalRef;
		const socketRefCurrent = socketRef;

		return () => {
			clearTimeout(initialDelay);
			if (reconnectTimeoutRefCurrent.current) {
				clearTimeout(reconnectTimeoutRefCurrent.current);
			}
			if (heartbeatIntervalRefCurrent.current) {
				clearInterval(heartbeatIntervalRefCurrent.current);
			}
			if (inactivityCheckIntervalRefCurrent.current) {
				clearInterval(inactivityCheckIntervalRefCurrent.current);
			}
			if (socketRefCurrent.current) {
				socketRefCurrent.current.close(1000);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // connectWebSocket is stable, no need to include in deps

	const value = {
		prevPos,
		setPrevPos,
		drones,
		setDrones,
		masterData,
		setMasterData,
		selectedRow,
		setSelectedRow,
		isReady,
		currentImage,
		setCurrentImage,
		alertStatus,
		setAlertStatus,
		apiCallingId,
		currentDroneId,
		connectionStatus,
		historicalPaths,
		setHistoricalPaths,
		checkInactiveDrones, // Expose for manual refresh
		inactiveDronesRefreshTrigger, // Trigger for inactive drones refresh
	};

	return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
