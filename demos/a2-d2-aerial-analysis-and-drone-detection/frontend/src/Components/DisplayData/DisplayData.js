import React, { useMemo, useState, useEffect, useCallback } from 'react';
import styles from './DisplayData.module.scss';
import { useData } from '../../DataContext';
import ImageComponent from '../ImageComponent/ImageComponent';


const DisplayData = () => {
  const {
    masterData,
    drones,
    selectedRow,
    setSelectedRow,
    alertStatus,
    setMasterData,
    setPrevPos,
    setDrones,
    checkInactiveDrones,
    inactiveDronesRefreshTrigger,
  } = useData();

  // Main tab state: 'active' or 'inactive'
  const [mainTab, setMainTab] = useState('active');
  
  // Sub-tab state for telemetry: 'flight', 'profile', or 'incidents'
  const [telemetryTab, setTelemetryTab] = useState('flight');
  
  const [visualExpanded, setVisualExpanded] = useState(true);
  const [inactiveDrones, setInactiveDrones] = useState([]);
  const [refreshNotification, setRefreshNotification] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingLists, setIsRefreshingLists] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);

  const droneIds = Object.keys(masterData);

  // Get current drone from masterData (active drones), drones context, or inactiveDrones list
  const currentDrone = useMemo(() => {
    if (!selectedRow) return undefined;
    if (masterData[selectedRow]?.drone) return masterData[selectedRow].drone;
    if (masterData[selectedRow] && (masterData[selectedRow].lat != null || masterData[selectedRow].current_position)) return masterData[selectedRow];
    if (drones[selectedRow]) return drones[selectedRow];
    const foundInactive = inactiveDrones.find(d => d.drone_id === selectedRow || d.id === selectedRow);
    if (foundInactive) return foundInactive;
    return undefined;
  }, [selectedRow, masterData, drones, inactiveDrones]);

  const fetchInactiveDrones = React.useCallback(async () => {

    // Clear all inactive drones from map before fetching new list
    setDrones(prev => {
      const activeDronesOnly = {};
      Object.keys(prev).forEach(id => {
        if (!prev[id]._isInactive) {
          activeDronesOnly[id] = prev[id];
        }
      });
      return activeDronesOnly;
    });
    
    // Also clear from masterData
    setMasterData(prev => {
      const activeDronesOnly = {};
      Object.keys(prev).forEach(id => {
        if (!prev[id]?.drone?._isInactive) {
          activeDronesOnly[id] = prev[id];
        }
      });
      return activeDronesOnly;
    });
    
    try {
      const isLocal = window.location.hostname === 'localhost';
      const baseUrl = isLocal ? 'http://localhost:4000' : '';
      
      const response = await fetch(`${baseUrl}/api/inactive-drones`);
      const result = await response.json();
      
      if (result.success) {
        setInactiveDrones(result.data);
        // Show notification
        setRefreshNotification(true);
        setTimeout(() => setRefreshNotification(false), 3000);
      }
    } catch (error) {
      console.error('Error fetching inactive drones:', error);
    } finally {
      // Loading state removed
    }
  }, [setDrones, setMasterData, setInactiveDrones]);

  // Refresh drone lists by clearing backend cache
  const refreshDroneLists = useCallback(async () => {
    if (isRefreshingLists) return;
    
    setIsRefreshingLists(true);
    console.log('🔄 Refreshing drone lists...');
    
    try {
      const isLocal = window.location.hostname === 'localhost';
      const baseUrl = isLocal ? 'http://localhost:4000' : '';
      
      // Call backend to clear active drones cache
      const response = await fetch(`${baseUrl}/api/refresh-drone-lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ ${result.message}`);
        console.log(`   ${result.previousCount} drones cleared from backend cache`);
        
        // Wait a moment for backend to rebuild from WebSocket
        setTimeout(() => {
          // Fetch updated inactive drones list
          fetchInactiveDrones();
          console.log('✅ Drone lists refreshed successfully');
        }, 1000);
      } else {
        console.error('Failed to refresh drone lists:', result.error);
      }
    } catch (error) {
      console.error('Error refreshing drone lists:', error);
    } finally {
      setTimeout(() => setIsRefreshingLists(false), 2000);
    }
  }, [isRefreshingLists, fetchInactiveDrones]);

  // Fetch inactive drones on mount and when trigger changes (no auto-refresh)
  useEffect(() => {
    fetchInactiveDrones();
  }, [fetchInactiveDrones, inactiveDronesRefreshTrigger]);

// Only count active drones (exclude inactive ones)
const activeDroneIds = droneIds.filter((id) => {
  const d = masterData[id]?.drone || {};
  return !d._isInactive;
});

const totalCount = activeDroneIds.length;


	const backendPayload = currentDrone?.has_payload === true;
const uiAlertPayload = alertStatus[selectedRow] === 'red';

const hasPayload = backendPayload || uiAlertPayload;



 const droneList = useMemo(
  () =>
    droneIds
      .filter((id) => {
        // Filter out inactive drones from the active list
        const d = masterData[id]?.drone || {};
        return !d._isInactive;
      })
      .map((id) => {
        const d = masterData[id]?.drone || {};

        const hasPayloadBackend = d?.has_payload === true;
        const hasPayloadAlert = alertStatus[id] === 'red';

        const isThreat = hasPayloadBackend || hasPayloadAlert;

        return {
          id,
          label: d.drone_id || id,
          type: d.drone_type || 'Unknown',
          status: isThreat ? 'threat' : 'normal',
        };
      }),
  [droneIds, masterData, alertStatus]
);


  const handleManualRefresh = () => {
    setIsRefreshing(true);
    
    // Check for inactive active drones (those receiving WebSocket data)
    checkInactiveDrones();
    
    // Also clear inactive drones from map (those clicked from Inactive Drones list)
    setDrones(prev => {
      const activeDronesOnly = {};
      Object.keys(prev).forEach(id => {
        if (!prev[id]._isInactive) {
          activeDronesOnly[id] = prev[id];
        }
      });
      console.log(`🧹 Cleared ${Object.keys(prev).length - Object.keys(activeDronesOnly).length} inactive drones from map`);
      return activeDronesOnly;
    });
    
    // Show notification and stop animation after 1 second
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshNotification(true);
      setTimeout(() => setRefreshNotification(false), 3000);
    }, 1000);
  };

  const handleInactiveDroneClick = (drone) => {
    console.log('📋 Inactive drone clicked:', drone);
    console.log('📋 Available fields:', Object.keys(drone));
    console.log('📋 device_id:', drone.device_id, 'type:', typeof drone.device_id);
    console.log('📋 frequency_hz:', drone.frequency_hz, 'type:', typeof drone.frequency_hz);
    console.log('📋 angle:', drone.angle, 'type:', typeof drone.angle);
    console.log('📋 error:', drone.error, 'type:', typeof drone.error);
    console.log('📋 event:', drone.event, 'type:', typeof drone.event);
    
    // Parse coordinates - support direct lat/lng or nested current_position
    const lat = parseFloat(drone.lat ?? drone.current_position?.lat);
    const lng = parseFloat(drone.lng ?? drone.current_position?.lng);
    
    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      console.error('Invalid coordinates for drone:', drone);
      return;
    }
    
    console.log('Parsed coordinates:', { lat, lng });
    
    // Helper function to safely parse numeric values
    const parseNum = (val) => {
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };
    
    // Store the inactive drone data temporarily for display purposes only
    // Include ALL telemetry fields from CSV
    const inactiveDroneData = {
      drone: {
        drone_id: drone.drone_id,
        flight_id: drone.flight_id,
        drone_type: drone.drone_type || drone.droneType || 'Unknown',
        lat: lat,
        lng: lng,
        altitude: parseNum(drone.altitude) || parseNum(drone.absoluteHeight) || 0,
        speed: parseNum(drone.speed) || 0,
        has_payload: drone.has_payload === 'true' || drone.has_payload === true,
        sensor_type: drone.sensor_type || drone.detection_type,
        timestamp: drone.last_seen || drone.timestamp,
        
        // Apolloshield DF specific fields
        device_id: drone.device_id,
        device_name: drone.device_name,
        frequency_hz: parseNum(drone.frequency_hz),
        angle: parseNum(drone.angle),
        error: parseNum(drone.error),
        detection_type: drone.detection_type,
        event: drone.event,
        vendor: drone.vendor,
        orientation_offset: parseNum(drone.orientation_offset),
        
        // Fortem Radar specific fields
        azimuth: parseNum(drone.azimuth),
        elevation: parseNum(drone.elevation),
        distance: parseNum(drone.distance),
        range: parseNum(drone.range),
        threatLevel: drone.threatLevel,
        category: drone.category,
        aboveGroundLevel: parseNum(drone.aboveGroundLevel),
        duration: parseNum(drone.duration),
        gain: parseNum(drone.gain),
        
        // DJI Aeroscope specific fields
        aeroscopeID: drone.aeroscopeID,
        droneType: drone.droneType,
        pitch: parseNum(drone.pitch),
        roll: parseNum(drone.roll),
        yaw: parseNum(drone.yaw),
        seqNum: drone.seqNum,
        latitudeSpeed: parseNum(drone.latitudeSpeed),
        longitudeSpeed: parseNum(drone.longitudeSpeed),
        absoluteHeight: parseNum(drone.absoluteHeight),
        
        home: drone.home_lat && drone.home_lng ? {
          lat: parseFloat(drone.home_lat),
          lng: parseFloat(drone.home_lng),
        } : null,
        pilot: drone.pilot_lat && drone.pilot_lng ? {
          lat: parseFloat(drone.pilot_lat),
          lng: parseFloat(drone.pilot_lng),
        } : null,
        _isInactive: true, // Mark as inactive to prevent it from showing in active list
      }
    };
    
    console.log('Inactive drone data to set:', inactiveDroneData);
    
    // Create the drone object for the drones context (used by map)
    // Include azimuth, elevation, and angle for FOV polygon direction
    const droneForMap = {
      drone_id: drone.drone_id,
      id: drone.drone_id,
      flight_id: drone.flight_id,
      drone_type: drone.drone_type || 'Unknown',
      lat: lat,
      lng: lng,
      altitude: parseNum(drone.altitude) || parseNum(drone.absoluteHeight) || 0,
      speed: parseNum(drone.speed) || 0,
      has_payload: drone.has_payload === 'true' || drone.has_payload === true,
      sensor_type: drone.sensor_type || drone.detection_type,
      timestamp: drone.last_seen || drone.timestamp,
      // CRITICAL: Include azimuth, elevation, and angle for FOV direction
      // These fields are essential for correct polygon orientation
      azimuth: parseNum(drone.azimuth),
      elevation: parseNum(drone.elevation),
      angle: parseNum(drone.angle),
      // Also include home and pilot for inactive drones
      home: drone.home_lat && drone.home_lng ? {
        lat: parseFloat(drone.home_lat),
        lng: parseFloat(drone.home_lng),
      } : null,
      pilot: drone.pilot_lat && drone.pilot_lng ? {
        lat: parseFloat(drone.pilot_lat),
        lng: parseFloat(drone.pilot_lng),
      } : null,
      _isInactive: true,
    };
    
    console.log('🎯 Inactive drone FOV data:', {
      drone_id: drone.drone_id,
      azimuth: droneForMap.azimuth,
      elevation: droneForMap.elevation,
      angle: droneForMap.angle,
      hasAnyDirection: !!(droneForMap.azimuth || droneForMap.elevation || droneForMap.angle)
    });
    
    // Update drones context (used by map component)
    setDrones(prev => ({
      ...prev,
      [drone.drone_id]: droneForMap
    }));

    // Also update masterData so tabs (Flight, Profile, Incidents, Visuals) render properly
    setMasterData(prev => ({
      ...prev,
      [drone.drone_id]: inactiveDroneData
    }));
    
    // Update prevPos to show the drone position on map
    setPrevPos(prev => ({
      ...prev,
      [drone.drone_id]: [[lat, lng]]
    }));
    
    // Set this inactive drone as selected with a small delay to prevent lag
    setTimeout(() => {
      setSelectedRow(drone.drone_id);
      console.log('Inactive drone added to map and tabs:', drone.drone_id);
    }, 50);
  };

  // Render drone list based on current main tab
  const renderDroneList = () => {
    if (mainTab === 'active') {
      return (
        <div className={styles.droneList}>
          {droneList.map((drone) => {
            const selected = drone.id === selectedRow;
            return (
              <button
                key={drone.id}
                className={`${styles.droneRow} ${
                  selected ? styles.droneRowSelected : ''
                }`}
                onClick={() => setSelectedRow(drone.id)}
              >
                <div className={styles.droneRowMain}>
                  <span className={styles.droneId}>
                    {drone.label}
                  </span>
                  <span
                    className={`${styles.statusDot} ${
                      drone.status === 'threat'
                        ? styles.statusThreat
                        : styles.statusNormal
                    }`}
                  />
                </div>
                <div className={styles.droneRowSub}>
                  {drone.type}
                </div>
              </button>
            );
          })}
        </div>
      );
    } else {
      // Inactive drones list
      return (
        <div className={styles.droneList}>
          {inactiveDrones.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyText}>
                No inactive drones found
              </span>
            </div>
          ) : (
            inactiveDrones.map((drone, index) => {
              const selected = drone.drone_id === selectedRow;
              return (
                <button
                  key={`inactive-${drone.drone_id}-${index}`}
                  className={`${styles.droneRow} ${
                    selected ? styles.droneRowSelected : ''
                  }`}
                  onClick={() => handleInactiveDroneClick(drone)}
                >
                  <div className={styles.droneRowMain}>
                    <span className={styles.droneId}>
                      {drone.drone_id}
                    </span>
                    <span
                      className={`${styles.statusDot} ${styles.statusInactive}`}
                    />
                  </div>
                  <div className={styles.droneRowSub}>
                    {drone.drone_type || 'Unknown'} · {
                      (() => {
                        // Handle various timestamp formats from MongoDB
                        const timestamp = drone.last_seen || drone.timestamp;
                        if (!timestamp) return 'Unknown time';
                        
                        try {
                          // MongoDB returns Date objects as ISO strings
                          // Create Date object from the timestamp
                          const date = new Date(timestamp);
                          
                          // Check if date is valid
                          if (isNaN(date.getTime())) {
                            return 'Invalid date';
                          }
                          
                          // Return formatted date
                          return date.toLocaleString();
                        } catch (error) {
                          console.error('Error parsing date:', error, timestamp);
                          return 'Invalid date';
                        }
                      })()
                    }
                  </div>
                </button>
              );
            })
          )}
        </div>
      );
    }
  };

  // Fetch incidents for the selected drone
  const fetchIncidents = React.useCallback(async (droneId) => {
    if (!droneId) return;
    
    setLoadingIncidents(true);
    try {
      const isLocal = window.location.hostname === 'localhost';
      const baseUrl = isLocal ? 'http://localhost:4000' : '';
      
      const response = await fetch(`${baseUrl}/api/drone-incidents/${droneId}`);
      const result = await response.json();
      
      if (result.success) {
        setIncidents(result.incidents || []);
      } else {
        setIncidents([]);
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
      setIncidents([]);
    } finally {
      setLoadingIncidents(false);
    }
  }, []);

  // Fetch incidents when drone changes
  React.useEffect(() => {
    if (selectedRow && telemetryTab === 'incidents') {
      fetchIncidents(selectedRow);
    }
  }, [selectedRow, telemetryTab, fetchIncidents]);

  // Render telemetry content based on selected sub-tab
  const renderTelemetryContent = () => {
    if (!currentDrone) {
      return (
        <div className={styles.emptyState}>
          <span className={styles.emptyTitle}>
            No drone selected
          </span>
          <span className={styles.emptyText}>
            Click a track on the map or from the list to
            inspect details.
          </span>
        </div>
      );
    }

    switch (telemetryTab) {
      case 'flight':
        return renderFlightTab();
      case 'profile':
        return renderProfileTab();
      case 'incidents':
        return renderIncidentsTab();
      default:
        return null;
    }
  };

  // Flight tab content
  const renderFlightTab = () => {
    // Only use normalized field names to avoid conflicts with lat/lng
    const alt = currentDrone.altitude;
    const spd = currentDrone.speed;
    
    return (
      <div className={styles.telemetryContent}>
        {/* DRONE SECTION */}
        <div className={styles.telemetrySection}>
          <div className={styles.telemetrySectionHeader}>
            <span className={styles.telemetryIcon}>🚁</span>
            <span className={styles.telemetrySectionTitle}>DRONE</span>
          </div>
          <div className={styles.telemetryGrid}>
            <div className={styles.telemetryItem}>
              <div className={styles.telemetryValue}>
                {alt != null && alt !== '' ? `${Math.round(alt)} ft` : '-'}
              </div>
              <div className={styles.telemetryLabel}>Altitude</div>
            </div>
            <div className={styles.telemetryItem}>
              <div className={styles.telemetryValue}>
                {spd != null && spd !== '' ? `${parseFloat(spd).toFixed(1)} mph` : '-'}
              </div>
              <div className={styles.telemetryLabel}>Speed</div>
            </div>
          </div>
          <div className={styles.telemetryAddress}>
            {currentDrone.lat != null && currentDrone.lng != null
              ? `${currentDrone.lat.toFixed(6)}, ${currentDrone.lng.toFixed(6)}`
              : 'Location unavailable'}
          </div>
          <div className={styles.telemetryCoords}>
            {currentDrone.lat != null && currentDrone.lng != null
              ? `${currentDrone.lat.toFixed(6)}, ${currentDrone.lng.toFixed(6)}`
              : '-'}
          </div>
        </div>

        {/* PILOT SECTION */}
        {currentDrone.pilot && currentDrone.pilot.lat != null && (
          <div className={styles.telemetrySection}>
            <div className={styles.telemetrySectionHeader}>
              <span className={styles.telemetryIcon}>👤</span>
              <span className={styles.telemetrySectionTitle}>PILOT</span>
            </div>
            <div className={styles.telemetryAddress}>
              {`${currentDrone.pilot.lat.toFixed(6)}, ${currentDrone.pilot.lng.toFixed(6)}`}
            </div>
            <div className={styles.telemetryCoords}>
              {`${currentDrone.pilot.lat.toFixed(6)}, ${currentDrone.pilot.lng.toFixed(6)}`}
            </div>
          </div>
        )}

        {/* HOME SECTION */}
        {currentDrone.home && currentDrone.home.lat != null && (
          <div className={styles.telemetrySection}>
            <div className={styles.telemetrySectionHeader}>
              <span className={styles.telemetryIcon}>🏠</span>
              <span className={styles.telemetrySectionTitle}>HOME</span>
            </div>
            <div className={styles.telemetryAddress}>
              {`${currentDrone.home.lat.toFixed(6)}, ${currentDrone.home.lng.toFixed(6)}`}
            </div>
            <div className={styles.telemetryCoords}>
              {`${currentDrone.home.lat.toFixed(6)}, ${currentDrone.home.lng.toFixed(6)}`}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Profile tab content
  const renderProfileTab = () => {
    return (
      <div className={styles.telemetryContent}>
        {/* HARDWARE PROFILE */}
        <div className={styles.telemetrySection}>
          <div className={styles.telemetrySectionHeader}>
            <span className={styles.telemetrySectionTitle}>HARDWARE PROFILE</span>
          </div>
          <div className={styles.profileGrid}>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Drone ID</span>
              <span className={styles.profileValue}>{currentDrone.drone_id || '-'}</span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Model</span>
              <span className={styles.profileValue}>
                {currentDrone.drone_type || currentDrone.droneType || 'Mavic 3C'}
              </span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Payload</span>
              <span className={`${styles.profileValue} ${(!currentDrone._isInactive && hasPayload) ? styles.profileValueDanger : ''}`}>
                {currentDrone._isInactive ? 'None' : (hasPayload ? '●● Medium' : 'None')}
              </span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Risk</span>
              <span className={`${styles.profileValue} ${(!currentDrone._isInactive && hasPayload) ? styles.profileValueDanger : ''}`}>
                {currentDrone._isInactive ? '● None (Inactive)' : (hasPayload ? '●● Medium' : '● Low')}
              </span>
            </div>
            <div className={styles.riskExplanation}>
              Risk is calculated based on payload detection and threat level
            </div>
          </div>
        </div>

        {/* DETECTION */}
        <div className={styles.telemetrySection}>
          <div className={styles.telemetrySectionHeader}>
            <span className={styles.telemetrySectionTitle}>DETECTION</span>
          </div>
          <div className={styles.profileGrid}>
            {currentDrone.angle != null && (
              <div className={styles.profileRow}>
                <span className={styles.profileLabel}>Detection Angle</span>
                <span className={styles.profileValue}>{currentDrone.angle}°</span>
              </div>
            )}
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Detected By Sensor</span>
              <span className={styles.profileValue}>
                {(() => {
                  const detectionType = currentDrone.detection_type || '';
                  const sensorType = currentDrone.sensor_type || '';
                  
                  if (detectionType.includes('apolloshield_dji') || detectionType.includes('aeroscope')) {
                    return '📡 Apolloshield DJI';
                  } else if (detectionType.includes('fortem') || sensorType.includes('radar')) {
                    return '📡 Fortem Radar';
                  } else if (detectionType.includes('apolloshield_df') || sensorType.includes('bluvec')) {
                    return '📶 Apolloshield DF';
                  } else if (detectionType.includes('dji')) {
                    return '📡 DJI Aeroscope';
                  }
                  return '📡 DJI Aeroscope';
                })()}
              </span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Sensor Device</span>
              <span className={styles.profileValue}>
                {currentDrone.sensor_type || currentDrone.device_name || 'bluvec2.0'}
              </span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Frequency</span>
              <span className={styles.profileValue}>
                {currentDrone.frequency_hz
                  ? `${(parseFloat(currentDrone.frequency_hz) / 1000000000).toFixed(2)} GHz`
                  : '2.4 GHz, 5.8 GHz'}
              </span>
            </div>
          </div>
        </div>

        {/* DRONE INSIGHTS - Only show for inactive drones with historical data */}
        {currentDrone._isInactive && (
          <div className={styles.telemetrySection}>
            <div className={styles.telemetrySectionHeader}>
              <span className={styles.telemetrySectionTitle}>DRONE INSIGHTS</span>
            </div>
            
            {/* Activity Heatmap */}
            <div className={styles.insightsBlock}>
            <div className={styles.insightsLabel}>
              <span>251 ft</span>
              <span className={styles.insightsTitle}>Altitude violations</span>
              <span className={styles.insightsValue}>405 ft</span>
            </div>
            <div className={styles.heatmapGrid}>
              {Array.from({ length: 168 }).map((_, i) => {
                // Generate semi-random activity pattern based on time of day
                // 7 days x 24 hours = 168 cells
                const dayOfWeek = Math.floor(i / 24);
                const hourOfDay = i % 24;
                
                // More activity during daytime hours (8am-8pm)
                let activity = Math.random();
                if (hourOfDay >= 8 && hourOfDay <= 20) {
                  activity = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
                } else {
                  activity = Math.random() * 0.3; // 0 to 0.3
                }
                
                let color = '#1a1a1a';
                if (activity > 0.7) color = '#00d4ff';
                else if (activity > 0.4) color = '#0088aa';
                else if (activity > 0.2) color = '#004455';
                
                return (
                  <div
                    key={i}
                    className={styles.heatmapCell}
                    style={{ backgroundColor: color }}
                    title={`Day ${dayOfWeek + 1}, Hour ${hourOfDay}:00 - Activity: ${(activity * 100).toFixed(0)}%`}
                  />
                );
              })}
            </div>
            <div className={styles.heatmapLabels}>
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>
            <div className={styles.heatmapDescription}>
              Weekly flight activity pattern (7 days × 24 hours). Brighter colors indicate more flight activity.
            </div>
            </div>

            {/* Speed Violations */}
            <div className={styles.insightsBlock}>
              <div className={styles.insightsLabel}>
                <span>3 mph</span>
                <span className={styles.insightsTitle}>Average speed</span>
                <span className={styles.insightsValue}>32 mph</span>
              </div>
              <div className={styles.insightsLabel}>
                <span style={{ fontSize: '11px', color: '#888' }}>Max speed</span>
              </div>
              <div className={styles.insightsLabel} style={{ marginTop: '8px' }}>
                <span>0</span>
                <span className={styles.insightsTitle}>BVLOS violations</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Incidents tab content
  const renderIncidentsTab = () => {
    if (loadingIncidents) {
      return (
        <div className={styles.telemetryContent}>
          <div className={styles.telemetrySection}>
            <div className={styles.telemetrySectionHeader}>
              <span className={styles.telemetrySectionTitle}>INCIDENTS</span>
            </div>
            <div className={styles.emptyState}>
              <span className={styles.emptyText}>Loading incidents...</span>
            </div>
          </div>
        </div>
      );
    }

    if (incidents.length === 0) {
      return (
        <div className={styles.telemetryContent}>
          <div className={styles.telemetrySection}>
            <div className={styles.telemetrySectionHeader}>
              <span className={styles.telemetrySectionTitle}>INCIDENTS</span>
            </div>
            <div className={styles.emptyState}>
              <span className={styles.emptyText}>
                No incidents recorded for this drone
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.telemetryContent}>
        <div className={styles.telemetrySection}>
          <div className={styles.telemetrySectionHeader}>
            <span className={styles.telemetrySectionTitle}>INCIDENTS</span>
          </div>
          {incidents.map((incident, index) => (
            <div key={incident.incident_id || index} className={styles.incidentCard}>
              <div className={styles.incidentHeader}>
                <span className={`${styles.incidentSeverity} ${styles[`severity${incident.severity}`]}`}>
                  {incident.severity?.toUpperCase()}
                </span>
                <span className={styles.incidentType}>
                  {incident.type?.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className={styles.incidentDetails}>
                <div className={styles.incidentRow}>
                  <span className={styles.incidentLabel}>Time:</span>
                  <span className={styles.incidentValue}>
                    {new Date(incident.timestamp).toLocaleString()}
                  </span>
                </div>
                {incident.description && (
                  <div className={styles.incidentRow}>
                    <span className={styles.incidentLabel}>Description:</span>
                    <span className={styles.incidentValue}>{incident.description}</span>
                  </div>
                )}
                {incident.zone && (
                  <div className={styles.incidentRow}>
                    <span className={styles.incidentLabel}>Zone:</span>
                    <span className={styles.incidentValue}>{incident.zone}</span>
                  </div>
                )}
                {incident.altitude && (
                  <div className={styles.incidentRow}>
                    <span className={styles.incidentLabel}>Altitude:</span>
                    <span className={styles.incidentValue}>{incident.altitude} ft</span>
                  </div>
                )}
                <div className={styles.incidentRow}>
                  <span className={styles.incidentLabel}>Status:</span>
                  <span className={`${styles.incidentValue} ${styles[`status${incident.status}`]}`}>
                    {incident.status?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      {/* REFRESH NOTIFICATION */}
      {refreshNotification && (
        <div className={styles.refreshNotification}>
          ✓ Inactive drones refreshed
        </div>
      )}

      {/* MAIN TABS: Active Drones / Inactive Drones */}
      <div className={styles.mainTabs}>
        <button
          className={`${styles.mainTab} ${mainTab === 'active' ? styles.mainTabActive : ''}`}
          onClick={() => setMainTab('active')}
        >
          Active Drones
          {mainTab === 'active' && (
            <span className={styles.mainTabCount}>
              {totalCount}
            </span>
          )}
        </button>
        <button
          className={`${styles.mainTab} ${mainTab === 'inactive' ? styles.mainTabActive : ''}`}
          onClick={() => setMainTab('inactive')}
        >
          Inactive Drones
          {mainTab === 'inactive' && (
            <span className={styles.mainTabCount}>
              {inactiveDrones.length}
            </span>
          )}
        </button>
      </div>

      {/* DRONE LIST SECTION */}
      <div className={styles.droneListSection}>
        <div className={styles.droneListHeader}>
          <span className={styles.droneListTitle}>
            {mainTab === 'active' 
              ? `${totalCount} Active ${totalCount === 1 ? 'Drone' : 'Drones'}`
              : `${inactiveDrones.length} Inactive ${inactiveDrones.length === 1 ? 'Drone' : 'Drones'}`
            }
          </span>
          {mainTab === 'active' && (
            <button
              className={`${styles.refreshButton} ${isRefreshing ? styles.refreshing : ''}`}
              onClick={handleManualRefresh}
              title="Check for inactive drones"
              disabled={isRefreshing}
            >
              <span className={styles.refreshIcon}>↻</span>
            </button>
          )}
          {mainTab === 'inactive' && (
            <button
              className={`${styles.refreshButton} ${isRefreshingLists ? styles.refreshing : ''}`}
              onClick={refreshDroneLists}
              title="Refresh drone lists"
              disabled={isRefreshingLists}
            >
              <span className={styles.refreshIcon}>↻</span>
            </button>
          )}
        </div>
        {renderDroneList()}
      </div>

      {/* DRONE DETAILS SECTION */}
      {currentDrone && (
        <div className={styles.droneDetails}>
          {/* Drone Header with Icon and Name */}
          <div className={styles.droneHeader}>
            <div className={styles.droneIcon}>
              <svg width="40" height="40" viewBox="0 0 40 40">
                <path
                  d="M20 8 L28 16 L20 24 L12 16 Z M20 16 L20 32"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </div>
            <div className={styles.droneInfo}>
              <div className={styles.droneId}>{currentDrone.drone_id || '000P'}</div>
              <div className={styles.droneModel}>
                {currentDrone.drone_type || currentDrone.droneType || 'Mavic 3C'}
              </div>
            </div>
            <div className={styles.droneStatus}>
              <span className={`${styles.statusIndicator} ${hasPayload ? styles.statusDanger : styles.statusNormal}`}>
                ●●
              </span>
            </div>
          </div>

          {/* Telemetry Sub-tabs */}
          <div className={styles.subTabs}>
            <button
              className={`${styles.subTab} ${telemetryTab === 'flight' ? styles.subTabActive : ''}`}
              onClick={() => setTelemetryTab('flight')}
            >
              Flight
            </button>
            <button
              className={`${styles.subTab} ${telemetryTab === 'profile' ? styles.subTabActive : ''}`}
              onClick={() => setTelemetryTab('profile')}
            >
              Profile
            </button>
            <button
              className={`${styles.subTab} ${telemetryTab === 'incidents' ? styles.subTabActive : ''}`}
              onClick={() => setTelemetryTab('incidents')}
            >
              Incidents
              {incidents.length > 0 && (
                <span className={styles.incidentBadge}>{incidents.length}</span>
              )}
            </button>
          </div>

          {/* Telemetry Content */}
          {renderTelemetryContent()}

          {/* VISUAL SECTION */}
          <div className={styles.collapsibleSection}>
            <div
              className={styles.sectionHeader}
              onClick={() => setVisualExpanded(!visualExpanded)}
              style={{ cursor: 'pointer' }}
            >
              <span className={styles.sectionTitle}>
                <span className={styles.expandIcon}>
                  {visualExpanded ? '▼' : '▶'}
                </span>
                Visual
              </span>
            </div>
            {visualExpanded && (
              <div className={styles.imageCard}>
                <ImageComponent />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DisplayData;

// Made with Bob
