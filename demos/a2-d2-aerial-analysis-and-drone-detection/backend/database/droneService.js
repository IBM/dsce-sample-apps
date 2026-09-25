const { Drone } = require('./models');

/**
 * MongoDB Service for Drone Operations
 * Replaces CSV-based storage with MongoDB
 */

/**
 * Find or create a drone document
 * @param {string} drone_id - Unique drone identifier
 * @returns {Promise<Drone>} Drone document
 */
async function findOrCreateDrone(drone_id) {
  let drone = await Drone.findOne({ drone_id });
  
  if (!drone) {
    console.log(`📝 Creating new drone document for: ${drone_id}`);
    drone = new Drone({
      drone_id,
      first_seen: new Date(),
      last_seen: new Date(),
      total_flights: 0,
      flights: [],
      current_position: {},
      metadata: {},
      alert_level: 'none',
      is_blacklisted: false,
    });
    await drone.save();
  }
  
  return drone;
}

/**
 * Add or update telemetry point for a drone's active flight
 * @param {Object} telemetryData - Telemetry data from WebSocket
 * @returns {Promise<Drone>} Updated drone document
 */
async function addTelemetryPoint(telemetryData) {
  const {
    drone_id,
    flight_id,
    lat,
    lng,
    altitude,
    speed,
    azimuth,
    timestamp,
    distance,
    frequency,
    rssi,
    snr,
    sensor_type,
    sensor_id,
    drone_type,
    has_payload,
  } = telemetryData;

  // Find or create drone
  let drone = await findOrCreateDrone(drone_id);

  // Find active flight or create new one
  let activeFlight = drone.flights.find(
    f => f.flight_id === flight_id && f.status === 'active'
  );

  const telemetryPoint = {
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    altitude: altitude != null ? parseFloat(altitude) : null,
    speed: speed != null ? parseFloat(speed) : null,
    azimuth: azimuth != null ? parseFloat(azimuth) : null,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    distance: distance != null ? parseFloat(distance) : null,
    frequency: frequency || null,
    rssi: rssi != null ? parseFloat(rssi) : null,
    snr: snr != null ? parseFloat(snr) : null,
  };

  if (!activeFlight) {
    // Create new flight
    console.log(`✈️  Starting new flight: ${flight_id} for drone: ${drone_id}`);
    
    // Ensure sensor_type is valid, default to 'dji' if not provided
    const validSensorType = sensor_type || 'dji';
    
    activeFlight = {
      flight_id,
      start_time: telemetryPoint.timestamp,
      end_time: null,
      sensor_type: validSensorType,
      sensor_id: sensor_id || null,
      route: [telemetryPoint],
      incidents: [],
      summary: {
        max_altitude: altitude || null,
        max_speed: speed || null,
        duration_seconds: 0,
        distance_meters: null,
        zone_breaches: 0,
        total_points: 1,
      },
      status: 'active',
      last_update: telemetryPoint.timestamp,
    };
    
    drone.flights.push(activeFlight);
    drone.total_flights = drone.flights.length;
  } else {
    // Add point to existing flight
    activeFlight.route.push(telemetryPoint);
    activeFlight.last_update = telemetryPoint.timestamp;
    
    // Update flight summary
    const summary = activeFlight.summary;
    summary.total_points = activeFlight.route.length;
    
    if (altitude != null) {
      summary.max_altitude = Math.max(summary.max_altitude || 0, altitude);
    }
    if (speed != null) {
      summary.max_speed = Math.max(summary.max_speed || 0, speed);
    }
    
    const duration = (telemetryPoint.timestamp - activeFlight.start_time) / 1000;
    summary.duration_seconds = Math.round(duration);
  }

  // Update current position
  drone.current_position = {
    lat: telemetryPoint.lat,
    lng: telemetryPoint.lng,
    altitude: telemetryPoint.altitude,
    timestamp: telemetryPoint.timestamp,
  };

  // Update metadata
  if (drone_type) {
    drone.metadata.model = drone_type;
  }
  if (has_payload != null) {
    drone.metadata.has_payload = has_payload;
  }

  // Update last seen
  drone.last_seen = telemetryPoint.timestamp;

  // Save drone document
  await drone.save();
  
  console.log(`📍 Added telemetry point to ${flight_id}: route has ${activeFlight.route.length} points`);
  
  return drone;
}

/**
 * Complete a flight (mark as completed)
 * @param {string} drone_id - Drone identifier
 * @param {string} flight_id - Flight identifier
 * @returns {Promise<Drone>} Updated drone document
 */
async function completeFlight(drone_id, flight_id) {
  const drone = await Drone.findOne({ drone_id });
  
  if (!drone) {
    throw new Error(`Drone not found: ${drone_id}`);
  }

  const flight = drone.flights.find(f => f.flight_id === flight_id);
  
  if (!flight) {
    throw new Error(`Flight not found: ${flight_id}`);
  }

  flight.status = 'completed';
  flight.end_time = new Date();
  
  await drone.save();
  
  console.log(`✅ Flight completed: ${flight_id} for drone: ${drone_id}`);
  
  return drone;
}

/**
 * Get all active drones (seen within threshold)
 * @param {number} minutesThreshold - Minutes threshold for active status
 * @returns {Promise<Array>} Array of active drones
 */
async function getActiveDrones(minutesThreshold = 3) {
  const thresholdTime = new Date(Date.now() - minutesThreshold * 60 * 1000);
  const drones = await Drone.find({ last_seen: { $gte: thresholdTime } });
  
  return drones.map(drone => formatDroneForFrontend(drone));
}

/**
 * Get all inactive drones
 * @param {number} minutesThreshold - Minutes threshold for inactive status
 * @returns {Promise<Array>} Array of inactive drones
 */
async function getInactiveDrones(minutesThreshold = 3) {
  const thresholdTime = new Date(Date.now() - minutesThreshold * 60 * 1000);
  const drones = await Drone.find({ last_seen: { $lt: thresholdTime } });
  
  return drones.map(drone => formatDroneForFrontend(drone, true));
}

/**
 * Get flight history for a specific flight_id
 * @param {string} flight_id - Flight identifier
 * @returns {Promise<Object>} Flight data with route
 */
async function getFlightHistory(flight_id) {
  const drone = await Drone.findOne({ 'flights.flight_id': flight_id });
  
  if (!drone) {
    return null;
  }

  const flight = drone.flights.find(f => f.flight_id === flight_id);
  
  return {
    drone_id: drone.drone_id,
    flight_id: flight.flight_id,
    start_time: flight.start_time,
    end_time: flight.end_time,
    sensor_type: flight.sensor_type,
    status: flight.status,
    route: flight.route,
    summary: flight.summary,
    incidents: flight.incidents,
  };
}

/**
 * Get all flights for a specific drone
 * @param {string} drone_id - Drone identifier
 * @returns {Promise<Array>} Array of flights
 */
async function getDroneFlights(drone_id) {
  const drone = await Drone.findOne({ drone_id });
  
  if (!drone) {
    return [];
  }

  return drone.flights.map(flight => ({
    flight_id: flight.flight_id,
    start_time: flight.start_time,
    end_time: flight.end_time,
    sensor_type: flight.sensor_type,
    status: flight.status,
    route_points: flight.route.length,
    summary: flight.summary,
  }));
}

/**
 * Get historical records for a drone (all telemetry points from all flights)
 * @param {string} drone_id - Drone identifier
 * @returns {Promise<Array>} Array of telemetry records
 */
async function getHistoricalRecords(drone_id) {
  const drone = await Drone.findOne({ drone_id });
  
  if (!drone) {
    return [];
  }

  const records = [];
  
  for (const flight of drone.flights) {
    for (const point of flight.route) {
      records.push({
        drone_id: drone.drone_id,
        flight_id: flight.flight_id,
        timestamp: point.timestamp,
        lat: point.lat,
        lng: point.lng,
        altitude: point.altitude,
        speed: point.speed,
        azimuth: point.azimuth,
        distance: point.distance,
        frequency: point.frequency,
        rssi: point.rssi,
        snr: point.snr,
        sensor_type: flight.sensor_type,
      });
    }
  }
  
  // Sort by timestamp
  records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  return records;
}

/**
 * Format drone document for frontend
 * @param {Drone} drone - Mongoose drone document
 * @param {boolean} isInactive - Whether drone is inactive
 * @returns {Object} Formatted drone object
 */
function formatDroneForFrontend(drone, isInactive = false) {
  const activeFlight = drone.flights.find(f => f.status === 'active');
  const latestFlight = activeFlight || drone.flights[drone.flights.length - 1];
  const latestPoint = latestFlight?.route[latestFlight.route.length - 1];
  
  // Get sensor type - map to frontend expected values
  const sensorType = latestFlight?.sensor_type || 'unknown';
  let detection_type = sensorType;
  
  // Map sensor types to detection types for frontend
  if (sensorType.includes('dji') || sensorType.includes('aeroscope')) {
    detection_type = 'apolloshield_dji';
  } else if (sensorType.includes('df') || sensorType.includes('bluvec')) {
    detection_type = 'apolloshield_df';
  } else if (sensorType.includes('camera')) {
    detection_type = 'camera';
  }
  
  return {
    drone_id: drone.drone_id,
    flight_id: latestFlight?.flight_id || null,
    lat: latestPoint?.lat || drone.current_position.lat,
    lng: latestPoint?.lng || drone.current_position.lng,
    altitude: latestPoint?.altitude || drone.current_position.altitude || null,
    speed: latestPoint?.speed || null,
    vel: latestPoint?.speed || null, // Alias for speed
    azimuth: latestPoint?.azimuth || null,
    timestamp: drone.last_seen,
    drone_type: drone.metadata.model || 'Unknown',
    droneType: drone.metadata.model || 'Unknown', // Alias for Aeroscope
    has_payload: drone.metadata.has_payload || false,
    sensor_type: sensorType,
    detection_type: detection_type,
    device_id: latestFlight?.sensor_id || null,
    device_name: latestFlight?.sensor_id || null,
    frequency_hz: latestPoint?.frequency || null,
    distance: latestPoint?.distance || null,
    rssi: latestPoint?.rssi || null,
    snr: latestPoint?.snr || null,
    total_flights: drone.total_flights,
    route_points: latestFlight?.route.length || 0,
    _isInactive: isInactive,
    first_seen: drone.first_seen,
    last_seen: drone.last_seen,
    // Additional fields for compatibility
    home: null, // Not available in current data
    pilot: null, // Not available in current data
    angle: null,
    error: null,
    aeroscopeID: null,
    pitch: null,
    roll: null,
    yaw: null,
    event: null,
  };
}

module.exports = {
  findOrCreateDrone,
  addTelemetryPoint,
  completeFlight,
  getActiveDrones,
  getInactiveDrones,
  getFlightHistory,
  getDroneFlights,
  getHistoricalRecords,
  formatDroneForFrontend,
};

// Made with Bob
